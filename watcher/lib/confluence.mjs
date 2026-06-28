/**
 * FlowSync Watcher — Confluence page updater.
 *
 * Daemon-detected changes go into "Real-Time Updates" (a staging section).
 * When a brief is generated, those entries are read, included in the brief,
 * and then cleared from the page so they don't accumulate forever.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const CONFLUENCE_SCRIPTS = path.join(
  os.homedir(),
  ".copilot",
  "skills",
  "confluence",
  "scripts",
);

const RT_HEADING = "Real-Time Updates";
const RT_HEADING_RE = /Real-Time Updates/;

function run(script, args) {
  const result = execFileSync(
    "node",
    [path.join(CONFLUENCE_SCRIPTS, script), ...args],
    {
      encoding: "utf-8",
      timeout: 30_000,
    },
  );
  return JSON.parse(result);
}

/** Read the current Confluence page body. */
export function getPageBody(pageId) {
  const page = run("get-page.mjs", [pageId, "--body"]);
  return page.body || "";
}

/** Write an updated body back to Confluence. */
function writePage(pageId, body, message) {
  const tmpFile = path.join(
    os.tmpdir(),
    `flowsync-update-${Date.now()}.html`,
  );
  fs.writeFileSync(tmpFile, body);
  try {
    run("update-page.mjs", [
      pageId,
      "--body-file",
      tmpFile,
      "--message",
      message,
    ]);
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      /* ok */
    }
  }
}

/**
 * Append a timestamped entry to the "Real-Time Updates" section.
 * Creates the section at the bottom of the page if it doesn't exist.
 */
export function appendRealtimeUpdate(pageId, entry) {
  const currentBody = getPageBody(pageId);
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const newLi = `<li>${timestamp} — ${escapeHtml(entry)}</li>`;

  let updatedBody;
  const rtIdx = currentBody.search(RT_HEADING_RE);
  if (rtIdx !== -1) {
    const ulCloseIdx = currentBody.indexOf("</ul>", rtIdx);
    if (ulCloseIdx !== -1) {
      updatedBody =
        currentBody.slice(0, ulCloseIdx) +
        newLi +
        "\n" +
        currentBody.slice(ulCloseIdx);
    }
  }

  // Section doesn't exist yet — create it at the bottom
  if (!updatedBody) {
    updatedBody =
      currentBody +
      `\n<h2>${RT_HEADING}</h2>\n<p><em>Auto-detected by FlowSync Watcher</em></p>\n<ul>\n${newLi}\n</ul>`;
  }

  // Update the timestamp line
  updatedBody = updatedBody.replace(
    /Last updated by (?:SprintSync|FlowSync) AI at [^<]+/,
    `Last updated by FlowSync AI at ${new Date().toISOString()}`,
  );

  writePage(pageId, updatedBody, `FlowSync Watcher: ${entry.slice(0, 60)}`);

  return { success: true, entry };
}

/**
 * Read all entries from the "Real-Time Updates" section.
 * Returns an array of plain-text strings (timestamps + descriptions).
 */
export function readRealtimeUpdates(pageId) {
  const body = getPageBody(pageId);
  const rtIdx = body.search(RT_HEADING_RE);
  if (rtIdx === -1) return [];

  // Extract the <ul>…</ul> block after the heading
  const ulOpenIdx = body.indexOf("<ul>", rtIdx);
  const ulCloseIdx = body.indexOf("</ul>", rtIdx);
  if (ulOpenIdx === -1 || ulCloseIdx === -1) return [];

  const ulContent = body.slice(ulOpenIdx + 4, ulCloseIdx);
  const entries = [];
  const liRe = /<li>(.*?)<\/li>/gs;
  let match;
  while ((match = liRe.exec(ulContent)) !== null) {
    // Strip HTML tags and decode common entities for plain-text output
    entries.push(
      match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&mdash;/g, "—")
        .replace(/&rarr;/g, "→")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim(),
    );
  }
  return entries;
}

/**
 * Clear the "Real-Time Updates" section (empty the <ul>).
 * Called after the brief merges entries into the main document.
 */
export function clearRealtimeUpdates(pageId) {
  const body = getPageBody(pageId);
  const rtIdx = body.search(RT_HEADING_RE);
  if (rtIdx === -1) return; // nothing to clear

  const ulOpenIdx = body.indexOf("<ul>", rtIdx);
  const ulCloseIdx = body.indexOf("</ul>", rtIdx);
  if (ulOpenIdx === -1 || ulCloseIdx === -1) return;

  const updatedBody =
    body.slice(0, ulOpenIdx + 4) + "\n" + body.slice(ulCloseIdx);

  writePage(
    pageId,
    updatedBody,
    "FlowSync: cleared Real-Time Updates after brief",
  );
}

/**
 * Append a timestamped update to "Today's Updates" (used by the agent /
 * brief when merging real-time entries into the main doc).
 */
export function appendUpdate(pageId, entry) {
  const currentBody = getPageBody(pageId);
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const newLi = `<li>${timestamp} — ${escapeHtml(entry)}</li>`;

  let updatedBody;
  const todayIdx = currentBody.indexOf("Today's Updates");
  if (todayIdx !== -1) {
    const ulCloseIdx = currentBody.indexOf("</ul>", todayIdx);
    if (ulCloseIdx !== -1) {
      updatedBody =
        currentBody.slice(0, ulCloseIdx) +
        newLi +
        "\n" +
        currentBody.slice(ulCloseIdx);
    }
  }

  if (!updatedBody) {
    updatedBody =
      currentBody + `\n<h2>Today's Updates</h2>\n<ul>\n${newLi}\n</ul>`;
  }

  updatedBody = updatedBody.replace(
    /Last updated by (?:SprintSync|FlowSync) AI at [^<]+/,
    `Last updated by FlowSync AI at ${new Date().toISOString()}`,
  );

  writePage(pageId, updatedBody, `FlowSync: ${entry.slice(0, 60)}`);

  return { success: true, entry };
}

/**
 * Move a ticket row between sections (Active Work → QA Queue, etc.)
 */
export function updateTicketStatus(pageId, ticketId, newStatus, note) {
  const entry = `${ticketId} → ${newStatus}${note ? ": " + note : ""}`;
  return appendUpdate(pageId, entry);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
