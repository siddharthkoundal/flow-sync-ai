/**
 * FlowSync Watcher — Jira helpers.
 * Thin wrappers around the Jira skill scripts.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const JIRA_SCRIPTS = path.join(
  os.homedir(),
  ".copilot",
  "skills",
  "jira",
  "scripts",
);

function run(script, args) {
  const result = execFileSync(
    "node",
    [path.join(JIRA_SCRIPTS, script), ...args],
    {
      encoding: "utf-8",
      timeout: 30_000,
    },
  );
  return JSON.parse(result);
}

/**
 * Fetch tickets in the configured workflow scope.
 * Defaults to the project's open sprint for backward compatibility.
 */
export function fetchWorkflowTickets(project, max = 30, jql = "") {
  const query =
    jql.trim() ||
    `project=${project} AND sprint in openSprints() ORDER BY updated DESC`;
  return run("search.mjs", [
    query,
    "--max",
    String(max),
  ]);
}

/** Post a comment on a Jira ticket. */
export function addComment(issueKey, text) {
  return run("add-comment.mjs", [issueKey, text]);
}
