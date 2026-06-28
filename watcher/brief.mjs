#!/usr/bin/env node
/**
 * FlowSync AI — Engineering brief generator.
 *
 * Generates a concise, actionable engineering workflow summary for Teams:
 *   TOP:    Blockers + items needing discussion (action required)
 *   MIDDLE: Real-time updates from watcher + workflow health one-liner
 *   BOTTOM: Completed items + yesterday's meeting notes (FYI only)
 *
 * Usage:
 *   node watcher/brief.mjs                  # generate + post to Teams (if webhook configured)
 *   node watcher/brief.mjs --dry-run        # generate only, print to stdout
 *   node watcher/brief.mjs --webhook <url>  # override webhook URL
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWorkflowTickets } from "./lib/jira.mjs";
import { loadSnapshot } from "./lib/state.mjs";
import { postToTeams } from "./lib/teams.mjs";
import {
  readRealtimeUpdates,
  clearRealtimeUpdates,
  appendUpdate,
} from "./lib/confluence.mjs";
import { generateAiBrief } from "./lib/ai.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config", "watcher.json");
const TRANSCRIPT_SUMMARY_PATH = path.join(
  __dirname,
  "config",
  "last-transcript-summary.txt",
);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const noAi = args.includes("--no-ai");
const webhookIdx = args.indexOf("--webhook");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`[brief] Missing ${CONFIG_PATH}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const webhookUrl =
  webhookIdx >= 0
    ? args[webhookIdx + 1]
    : process.env.TEAMS_WEBHOOK_URL || config.teamsWebhookUrl;

// ── Fetch data ──────────────────────────────────────────────────────────
const result = fetchWorkflowTickets(
  config.jiraProject,
  config.jiraMaxResults || 50,
  config.jiraJql || "",
);
const issues = result.issues || [];
const snap = loadSnapshot();

// ── Fetch real-time updates from Confluence ─────────────────────────────
let realtimeEntries = [];
if (config.confluencePageId) {
  try {
    realtimeEntries = readRealtimeUpdates(config.confluencePageId);
    if (realtimeEntries.length > 0) {
      console.log(
        `[brief] Found ${realtimeEntries.length} real-time update(s) from watcher`,
      );
    }
  } catch (err) {
    console.error(`[brief] Could not read real-time updates: ${err.message}`);
  }
}

// ── Load transcript summary (if saved by @flow-agent) ──────────────────
let transcriptSummary = "";
if (fs.existsSync(TRANSCRIPT_SUMMARY_PATH)) {
  transcriptSummary = fs.readFileSync(TRANSCRIPT_SUMMARY_PATH, "utf-8").trim();
  if (transcriptSummary) {
    console.log("[brief] Found yesterday's transcript summary");
  }
}

// ── Categorize tickets ──────────────────────────────────────────────────
const byStatus = {};
const blockers = [];
const recentChanges = [];
const stale = [];
const needsAttention = []; // actionable items needing discussion
const now = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;
const THREE_DAYS = 3 * ONE_DAY;

for (const issue of issues) {
  const status = issue.status || "Unknown";
  if (!byStatus[status]) byStatus[status] = [];
  byStatus[status].push(issue);

  const prev = snap.tickets?.[issue.key];
  if (prev && prev.status !== status) {
    recentChanges.push({
      key: issue.key,
      summary: issue.summary,
      from: prev.status,
      to: status,
    });
  }

  if (status.toLowerCase().includes("block")) {
    blockers.push(issue);
  }

  const updatedAt = issue.updated ? new Date(issue.updated).getTime() : 0;
  if (
    updatedAt > 0 &&
    now - updatedAt > THREE_DAYS &&
    !["Done", "Closed"].includes(status)
  ) {
    stale.push({
      ...issue,
      daysSinceUpdate: Math.floor((now - updatedAt) / ONE_DAY),
    });
  }
}

// Build actionable items list (stale + QA queue + code review)
for (const s of stale) {
  const assignee = s.assignee?.split("|")[0]?.trim() || "Unassigned";
  needsAttention.push(
    `⚠️ **${s.key}**: No update in ${s.daysSinceUpdate}d — ${assignee}`,
  );
}
const qaTickets = byStatus["Ready for QA"] || byStatus["Validation"] || [];
for (const q of qaTickets) {
  const assignee = q.assignee?.split("|")[0]?.trim() || "Unassigned";
  needsAttention.push(`🧪 **${q.key}**: Awaiting QA — ${assignee}`);
}
const crTickets = byStatus["Code Review"] || [];
for (const cr of crTickets) {
  const assignee = cr.assignee?.split("|")[0]?.trim() || "Unassigned";
  needsAttention.push(`👀 **${cr.key}**: Needs code review — ${assignee}`);
}

// ── Build the brief (concise, actionable) ───────────────────────────────
const today = new Date().toLocaleDateString("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const total = issues.length;
const done =
  (byStatus["Done"] || []).length + (byStatus["Closed"] || []).length;
const inProgress = (byStatus["In Progress"] || []).length;

const lines = [];

lines.push(`**📋 Engineering Brief — ${today}**`);

// ── TOP: Action required ────────────────────────────────────────────────

// Blockers (always first)
if (blockers.length > 0) {
  lines.push("");
  lines.push("**🚫 BLOCKERS**");
  for (const b of blockers) {
    const assignee = b.assignee?.split("|")[0]?.trim() || "Unassigned";
    lines.push(`- **${b.key}** (${assignee}): ${b.summary}`);
  }
}

// Actionable items
if (needsAttention.length > 0) {
  lines.push("");
  lines.push("**🔔 Needs Attention**");
  for (const item of needsAttention) {
    lines.push(`- ${item}`);
  }
}

// Status changes (only if any)
if (recentChanges.length > 0) {
  lines.push("");
  lines.push("**🔄 Moved**");
  for (const c of recentChanges) {
    lines.push(`- **${c.key}**: ${c.from} → ${c.to}`);
  }
}

// ── MIDDLE: Real-time + health ──────────────────────────────────────────

if (realtimeEntries.length > 0) {
  lines.push("");
  lines.push("**⚡ Since Last Check**");
  for (const entry of realtimeEntries) {
    lines.push(`- ${entry}`);
  }
}

// One-line workflow health
lines.push("");
lines.push(
  `📊 **${done}/${total}** done · **${inProgress}** in progress · **${blockers.length}** blocked`,
);

// ── BOTTOM: FYI only ────────────────────────────────────────────────────

const completed = [...(byStatus["Done"] || []), ...(byStatus["Closed"] || [])];
if (completed.length > 0) {
  lines.push("");
  lines.push("**✅ Completed**");
  for (const c of completed.slice(0, 3)) {
    lines.push(`- ${c.key}: ${c.summary}`);
  }
  if (completed.length > 3) lines.push(`- _...+${completed.length - 3} more_`);
}

// Yesterday's transcript summary
if (transcriptSummary) {
  lines.push("");
  lines.push("**📝 From Yesterday's Call**");
  lines.push(transcriptSummary);
}

// Nothing actionable? Say so explicitly
if (
  blockers.length === 0 &&
  needsAttention.length === 0 &&
  recentChanges.length === 0
) {
  lines.splice(1, 0, "", "_No blockers or items needing attention_ 🎉");
}

// ── AI-powered narrative summary ────────────────────────────────────────
let aiBrief = null;
if (!noAi) {
  try {
    aiBrief = await generateAiBrief({
      issues,
      blockers,
      stale,
      recentChanges,
      realtimeEntries,
      transcriptSummary,
      byStatus,
      githubToken: config.githubToken,
    });
  } catch (err) {
    console.error(`[brief] AI summary failed: ${err.message}`);
  }
}

// If AI produced a summary, prepend it; keep deterministic data below as reference
let brief;
if (aiBrief) {
  const aiLines = [];
  aiLines.push(`**📋 Engineering Brief — ${today}** 🤖`);
  aiLines.push("");
  aiLines.push(aiBrief);
  aiLines.push("");
  aiLines.push("---");
  aiLines.push("");
  aiLines.push(
    `📊 **${done}/${total}** done · **${inProgress}** in progress · **${blockers.length}** blocked`,
  );
  brief = aiLines.join("\n");
} else {
  brief = lines.join("\n");
}

// ── Output ──────────────────────────────────────────────────────────────
console.log(brief);
console.log("");

if (dryRun || !webhookUrl) {
  if (!webhookUrl) {
    console.log(
      "[brief] No teamsWebhookUrl in config — copy the above to Teams manually.",
    );
    console.log(
      "[brief] To auto-post, set TEAMS_WEBHOOK_URL in the environment.",
    );
  } else {
    console.log("[brief] Dry run — not posting to Teams.");
  }
} else {
  try {
    const { ok, status } = await postToTeams(webhookUrl, brief);
    if (ok) {
      console.log(`[brief] ✅ Posted to Teams (status: ${status})`);
    } else {
      console.error(`[brief] ❌ Teams webhook returned ${status}`);
    }
  } catch (err) {
    console.error(`[brief] ❌ Failed to post to Teams: ${err.message}`);
  }
}

// ── Merge real-time entries into Today's Updates + clear ─────────────────
if (realtimeEntries.length > 0 && config.confluencePageId && !dryRun) {
  try {
    for (const entry of realtimeEntries) {
      appendUpdate(config.confluencePageId, `[Watcher] ${entry}`);
    }
    clearRealtimeUpdates(config.confluencePageId);
    console.log(
      `[brief] ✅ Merged ${realtimeEntries.length} real-time update(s) into Today's Updates and cleared staging section`,
    );
  } catch (err) {
    console.error(
      `[brief] ⚠️ Failed to merge/clear real-time updates: ${err.message}`,
    );
  }
}

// Clear transcript summary after it's been included in the brief
if (transcriptSummary && !dryRun) {
  try {
    fs.unlinkSync(TRANSCRIPT_SUMMARY_PATH);
    console.log("[brief] Cleared transcript summary (included in brief)");
  } catch {
    /* ok if already gone */
  }
}
