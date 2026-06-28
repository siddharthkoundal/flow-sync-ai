/**
 * FlowSync Watcher — Bitbucket helpers.
 * Thin wrappers around the Bitbucket skill scripts.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const BB_SCRIPTS = path.join(
  os.homedir(),
  ".copilot",
  "skills",
  "bitbucket",
  "scripts",
);

function run(script, args) {
  const result = execFileSync(
    "node",
    [path.join(BB_SCRIPTS, script), ...args],
    {
      encoding: "utf-8",
      timeout: 30_000,
    },
  );
  return JSON.parse(result);
}

/** Fetch PRs for a repo. state: OPEN | MERGED | DECLINED | ALL */
export function fetchPrs(project, repo, state = "ALL", max = 30) {
  return run("pull-requests.mjs", [
    project,
    repo,
    "--state",
    state,
    "--limit",
    String(max),
  ]);
}
