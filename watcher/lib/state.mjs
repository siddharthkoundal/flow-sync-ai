/**
 * FlowSync Watcher — state management.
 *
 * Tracks last-seen PR states and Jira ticket statuses so the watcher
 * only fires Confluence updates on actual changes.
 *
 * State lives at:
 *   $XDG_STATE_HOME/flowsync-watcher/   (if set)
 *   ~/.local/state/flowsync-watcher/    (default)
 *
 * A legacy SprintSync snapshot is read when no FlowSync snapshot exists.
 */

import fs from "node:fs";
import path from "node:path";

const HOME = process.env.HOME || "";
const XDG_STATE_HOME =
  process.env.XDG_STATE_HOME || path.join(HOME, ".local", "state");
export const STATE_DIR = path.join(XDG_STATE_HOME, "flowsync-watcher");
const STATE_FILE = path.join(STATE_DIR, "snapshot.json");
const LOCK_PATH = path.join(STATE_DIR, "daemon.lock");
const LEGACY_STATE_FILE = path.join(
  XDG_STATE_HOME,
  "sprintsync-watcher",
  "snapshot.json",
);

fs.mkdirSync(STATE_DIR, { recursive: true });

/**
 * @typedef {{ prKey: string, state: string, updatedDate: number }} PrSnapshot
 * @typedef {{ ticketKey: string, status: string, updated: string }} TicketSnapshot
 * @typedef {{ prs: Record<string, PrSnapshot>, tickets: Record<string, TicketSnapshot>, lastCycle: string }} Snapshot
 */

/** @returns {Snapshot} */
export function loadSnapshot() {
  for (const file of [STATE_FILE, LEGACY_STATE_FILE]) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch {
      /* try the next location */
    }
  }
  return { prs: {}, tickets: {}, lastCycle: "" };
}

/** @param {Snapshot} snap */
export function saveSnapshot(snap) {
  snap.lastCycle = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(snap, null, 2));
}

export function acquireLock() {
  try {
    const existing = JSON.parse(fs.readFileSync(LOCK_PATH, "utf-8"));
    try {
      process.kill(existing.pid, 0);
      return false;
    } catch {
      /* stale */
    }
  } catch {
    /* no lock */
  }
  fs.writeFileSync(
    LOCK_PATH,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
  );
  return true;
}

export function releaseLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {
    /* ok */
  }
}
