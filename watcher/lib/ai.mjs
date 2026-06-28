/**
 * FlowSync AI — LLM helper via GitHub Copilot chat-completions.
 *
 * Discovers the Copilot token from VS Code's extension host, then calls
 * the Copilot chat-completions endpoint to generate AI-powered summaries.
 *
 * Token discovery order:
 *   1. GITHUB_TOKEN env var (recommended — set a PAT with models:read scope)
 *   2. VS Code Copilot extension's token cache (~/.config/github-copilot/)
 *
 * To generate a token: https://github.com/settings/tokens → "models:read" scope
 *
 * Falls back gracefully — if no token is found or the API call fails,
 * returns null so the brief can proceed with its deterministic summary.
 */

import fs from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const COPILOT_TOKEN_URLS = [
  // Standard VS Code Copilot token locations
  path.join(os.homedir(), ".config", "github-copilot", "hosts.json"),
  path.join(os.homedir(), ".config", "github-copilot", "apps.json"),
];

const API_BASE = "https://models.inference.ai.azure.com";
const MODEL = "gpt-4o";

/**
 * Discover a GitHub token from known locations.
 * @param {string} [configToken]  Token from watcher config (optional)
 * @returns {string|null}
 */
function discoverToken(configToken) {
  // 1. Explicit config value
  if (configToken) return configToken;

  // 2. Env var (explicit override)
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  // 2. VS Code Copilot extension host cache
  for (const tokenPath of COPILOT_TOKEN_URLS) {
    try {
      const data = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
      // hosts.json format: { "github.com": { "oauth_token": "..." } }
      // apps.json format: { "github.com:AppId": { "oauth_token": "..." } }
      for (const [key, entry] of Object.entries(data)) {
        if (key.startsWith("github.com") && entry?.oauth_token) {
          return entry.oauth_token;
        }
      }
    } catch {
      /* not found, try next */
    }
  }

  return null;
}

/**
 * Call the GitHub Models chat-completions endpoint.
 * Uses the OAuth token directly — no session token exchange needed.
 * @param {string} token  GitHub OAuth token
 * @param {Array<{role:string, content:string}>} messages
 * @returns {Promise<string|null>}  The assistant's response text
 */
function chatCompletion(token, messages) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    });

    const url = new URL("/chat/completions", API_BASE);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            const text = data.choices?.[0]?.message?.content;
            if (!text) {
              console.log(
                `[ai] Completion response (${res.statusCode}):`,
                body.slice(0, 300),
              );
            }
            resolve(text || null);
          } catch {
            console.log(
              `[ai] Completion parse error (${res.statusCode}):`,
              body.slice(0, 300),
            );
            resolve(null);
          }
        });
      },
    );
    req.on("error", (e) => {
      console.log(`[ai] Completion request error:`, e.message);
      resolve(null);
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Generate an AI-powered engineering brief from raw ticket data.
 *
 * @param {object} params
 * @param {Array} params.issues         Raw Jira issues
 * @param {Array} params.blockers       Blocked tickets
 * @param {Array} params.stale          Stale tickets (no update 3+ days)
 * @param {Array} params.recentChanges  Status transitions since last snapshot
 * @param {Array} params.realtimeEntries  RT updates from watcher daemon
 * @param {string} params.transcriptSummary  Yesterday's meeting notes (if any)
 * @param {object} params.byStatus      Tickets grouped by status
 * @param {string} [params.githubToken]  GitHub PAT with models:read scope
 * @returns {Promise<string|null>}  AI-generated summary, or null if unavailable
 */
export async function generateAiBrief({
  issues,
  blockers,
  stale,
  recentChanges,
  realtimeEntries,
  transcriptSummary,
  byStatus,
  githubToken,
}) {
  const token = discoverToken(githubToken);
  if (!token) {
    console.log("[ai] No GitHub token found — skipping AI summary");
    return null;
  }

  // Build a compact data dump for the LLM
  const ticketDump = issues.map((i) => ({
    key: i.key,
    summary: i.summary,
    status: i.status,
    assignee: i.assignee?.split("|")[0]?.trim() || "Unassigned",
    updated: i.updated,
    priority: i.priority,
  }));

  const contextParts = [];
  contextParts.push(
    `Workflow tickets (${issues.length} total):\n${JSON.stringify(ticketDump, null, 1)}`,
  );

  if (blockers.length > 0) {
    contextParts.push(
      `Blocked tickets: ${blockers.map((b) => b.key).join(", ")}`,
    );
  }
  if (stale.length > 0) {
    contextParts.push(
      `Stale (3+ days no update): ${stale.map((s) => `${s.key} (${s.daysSinceUpdate}d)`).join(", ")}`,
    );
  }
  if (recentChanges.length > 0) {
    contextParts.push(
      `Status changes: ${recentChanges.map((c) => `${c.key}: ${c.from} → ${c.to}`).join("; ")}`,
    );
  }
  if (realtimeEntries.length > 0) {
    contextParts.push(
      `Real-time watcher updates:\n- ${realtimeEntries.join("\n- ")}`,
    );
  }
  if (transcriptSummary) {
    contextParts.push(`Yesterday's meeting notes:\n${transcriptSummary}`);
  }

  const systemPrompt = `You are FlowSync AI, an engineering workflow analyst. Generate a concise, actionable engineering brief for a software team.

Rules:
- Lead with RISKS and things that need discussion — blockers, stale tickets, dependency chains
- Identify cross-ticket patterns (e.g., "3 QA tickets from same feature — bottleneck risk")
- Call out hidden risks (e.g., stale ticket with no assignee, code review blocking QA pipeline)
- Keep it SHORT — max 8-10 bullet points total, no fluff
- Use ticket IDs (e.g., RDSB-14913) for reference
- End with a one-line delivery health verdict: on track / at risk / behind
- Format as markdown bullet points suitable for a Teams message
- Do NOT repeat raw data — synthesize and add insight`;

  const userPrompt = `Generate a smart engineering workflow brief from this data:\n\n${contextParts.join("\n\n")}`;

  console.log("[ai] Generating AI-powered brief...");
  const response = await chatCompletion(token, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  if (response) {
    console.log("[ai] ✅ AI summary generated");
  } else {
    console.log("[ai] ⚠️ AI response was empty");
  }

  return response;
}
