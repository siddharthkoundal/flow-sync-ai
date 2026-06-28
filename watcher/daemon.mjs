#!/usr/bin/env node
/**
 * FlowSync Watcher — background polling daemon.
 *
 * Polls Jira and (optionally) Bitbucket at a fixed interval, detects
 * ticket status changes and PR merges, then auto-updates the configured
 * Confluence workflow page and posts Jira comments.
 *
 * Usage:
 *   node watcher/daemon.mjs                    # run forever (default: 60s poll)
 *   node watcher/daemon.mjs --once             # one cycle, then exit
 *   node watcher/daemon.mjs --dry-run          # detect changes but don't write
 *   node watcher/daemon.mjs --interval 30000   # custom poll interval (ms)
 *
 * Requires config/watcher.json — see config/watcher.example.json.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSnapshot,
  saveSnapshot,
  acquireLock,
  releaseLock,
} from "./lib/state.mjs";
import { fetchWorkflowTickets, addComment } from "./lib/jira.mjs";
import { fetchPrs } from "./lib/bitbucket.mjs";
import { appendRealtimeUpdate } from "./lib/confluence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config", "watcher.json");

// ── Parse CLI flags ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const once = args.includes("--once");
const dryRun = args.includes("--dry-run");
const intervalIdx = args.indexOf("--interval");
const statusOnly = args.includes("--status");

// ── Load config ─────────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(
    `[watcher] Missing ${CONFIG_PATH} — copy config/watcher.example.json first.`,
  );
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const pollIntervalMs =
  intervalIdx >= 0
    ? Number(args[intervalIdx + 1])
    : config.pollIntervalMs || 60_000;

if (statusOnly) {
  const snap = loadSnapshot();
  console.log(
    JSON.stringify(
      {
        lastCycle: snap.lastCycle,
        trackedTickets: Object.keys(snap.tickets).length,
        trackedPrs: Object.keys(snap.prs).length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ── Single-instance lock ────────────────────────────────────────────────
if (!acquireLock()) {
  console.error("[watcher] Another instance is already running. Exiting.");
  process.exit(1);
}
process.on("exit", releaseLock);
process.on("SIGINT", () => {
  releaseLock();
  process.exit(0);
});
process.on("SIGTERM", () => {
  releaseLock();
  process.exit(0);
});

// ── Status — use raw Jira status.name (no normalization) ────────────────
function friendlyStatus(jiraStatus) {
  return jiraStatus || "Unknown";
}

// ── Ticket ID regex ─────────────────────────────────────────────────────
const TICKET_RE = /[A-Z]+-\d+/g;

// ── Main cycle ──────────────────────────────────────────────────────────
async function cycle() {
  const snap = loadSnapshot();
  const changes = [];
  const now = new Date().toISOString();

  console.log(`[${now}] Starting cycle...`);

  // 1. Poll Jira for ticket status changes in the configured workflow scope
  try {
    const result = fetchWorkflowTickets(
      config.jiraProject,
      config.jiraMaxResults || 30,
      config.jiraJql || "",
    );
    const issues = result.issues || [];
    console.log(
      `  [jira] Fetched ${issues.length} tickets from ${config.jiraProject}`,
    );

    for (const issue of issues) {
      const prev = snap.tickets[issue.key];
      const currentStatus = friendlyStatus(issue.status);
      const prevStatus = prev?.status;

      if (prev && prevStatus !== currentStatus) {
        const change = {
          type: "ticket_status_change",
          ticketId: issue.key,
          summary: issue.summary,
          assignee: issue.assignee?.split("|")[0]?.trim() || "Unassigned",
          from: prevStatus,
          to: currentStatus,
        };
        changes.push(change);
        console.log(`  [jira] ${issue.key}: ${prevStatus} → ${currentStatus}`);
      }

      snap.tickets[issue.key] = {
        ticketKey: issue.key,
        status: currentStatus,
        updated: issue.updated,
      };
    }
  } catch (err) {
    console.error(`  [jira] Error: ${err.message}`);
  }

  // 2. Poll Bitbucket for PR state changes (if configured)
  if (config.bbProject && config.bbRepo) {
    try {
      const prs = fetchPrs(config.bbProject, config.bbRepo, "ALL", 30);
      const prList = prs.values || prs || [];
      console.log(
        `  [bb] Fetched ${prList.length} PRs from ${config.bbProject}/${config.bbRepo}`,
      );

      for (const pr of prList) {
        const prKey = `${pr.id}`;
        const prState = pr.state?.toUpperCase() || "OPEN";
        const prev = snap.prs[prKey];

        if (prev && prev.state !== prState) {
          const ticketIds = (pr.title || "").match(TICKET_RE) || [];
          const change = {
            type:
              prState === "MERGED"
                ? "pr_merged"
                : `pr_${prState.toLowerCase()}`,
            prId: pr.id,
            prTitle: pr.title,
            author:
              pr.author?.user?.displayName?.split("(")[0]?.trim() || "Unknown",
            from: prev.state,
            to: prState,
            ticketIds,
          };
          changes.push(change);
          console.log(
            `  [bb] PR #${pr.id}: ${prev.state} → ${prState} (${ticketIds.join(", ") || "no ticket"})`,
          );
        }

        snap.prs[prKey] = {
          prKey,
          state: prState,
          updatedDate: pr.updatedDate || Date.now(),
        };
      }
    } catch (err) {
      console.error(`  [bb] Error: ${err.message}`);
    }
  }

  // 3. Apply changes
  if (changes.length === 0) {
    console.log("  No changes detected.");
    saveSnapshot(snap);
    return;
  }

  console.log(`  ${changes.length} change(s) detected.`);

  for (const change of changes) {
    if (dryRun) {
      console.log(`  [dry-run] Would process: ${JSON.stringify(change)}`);
      continue;
    }

    try {
      if (change.type === "pr_merged") {
        // PR was merged — stage in Real-Time Updates + comment on linked tickets
        const entry = `PR #${change.prId} merged by ${change.author}: ${change.prTitle}`;
        appendRealtimeUpdate(config.confluencePageId, entry);
        console.log(`  [confluence] Real-Time: ${entry}`);

        for (const ticketId of change.ticketIds) {
          addComment(
            ticketId,
            `[FlowSync Watcher] PR #${change.prId} merged — "${change.prTitle}" by ${change.author}. This may be ready for a review or QA handoff; verify the Jira status before transitioning.`,
          );
          console.log(`  [jira] Commented on ${ticketId}`);
        }
      }

      if (change.type === "ticket_status_change") {
        const entry = `${change.ticketId} (${change.assignee}): ${change.from} → ${change.to} — ${change.summary}`;
        appendRealtimeUpdate(config.confluencePageId, entry);
        console.log(`  [confluence] Real-Time: ${entry}`);

        // Post Jira comment for significant transitions
        const significant = [
          "Done",
          "Validation (QA)",
          "Ready for QA",
          "Blocked",
          "Code Review",
        ];
        if (significant.includes(change.to)) {
          addComment(
            change.ticketId,
            `[FlowSync Watcher] Status changed: ${change.from} → ${change.to}`,
          );
          console.log(`  [jira] Commented on ${change.ticketId}`);
        }
      }
    } catch (err) {
      console.error(
        `  [error] Failed to process ${change.type}: ${err.message}`,
      );
    }
  }

  saveSnapshot(snap);
  console.log(`  Cycle complete. ${changes.length} change(s) processed.\n`);
}

// ── Run ─────────────────────────────────────────────────────────────────
console.log(
  `[flowsync-watcher] Starting — project: ${config.jiraProject}, poll: ${pollIntervalMs}ms, dry-run: ${dryRun}`,
);
if (config.bbProject) {
  console.log(
    `[flowsync-watcher] Bitbucket: ${config.bbProject}/${config.bbRepo}`,
  );
}
console.log(
  `[flowsync-watcher] Confluence page: ${config.confluencePageId}\n`,
);

await cycle();

if (!once) {
  setInterval(cycle, pollIntervalMs);
}
