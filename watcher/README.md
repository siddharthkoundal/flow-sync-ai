# FlowSync Workflow Watcher

The background watcher detects engineering workflow changes in Jira and
Bitbucket and publishes them to the configured Confluence page. It complements
the conversational Flow Agent with continuous, deterministic event detection.

## Quick Start

```bash
cp watcher/config/watcher.example.json watcher/config/watcher.json

# Detect one cycle without external writes
node watcher/daemon.mjs --dry-run --once

# Run one write-enabled cycle
node watcher/daemon.mjs --once

# Poll continuously
node watcher/daemon.mjs

# Inspect the saved snapshot
node watcher/daemon.mjs --status
```

## Events and Actions

| Event | Source | Action |
| --- | --- | --- |
| Ticket status change | Jira | Stage a Confluence update and comment on significant transitions |
| PR merged | Bitbucket | Stage a Confluence update and comment on explicitly linked tickets |
| PR declined | Bitbucket | Record the detected event |

A PR merge is treated as a review or QA handoff signal. The watcher does not
transition the associated Jira ticket or claim that it is complete.

## How It Works

1. The first run seeds a snapshot without reporting old activity.
2. Later runs compare live state with the snapshot and process differences.
3. State is stored at `~/.local/state/flowsync-watcher/snapshot.json`.
4. If only a legacy SprintSync snapshot exists, FlowSync reads it and writes the
   next snapshot to the new location.
5. A PID lock prevents duplicate watcher instances.

## Configuration

`watcher/config/watcher.json` is local-only and ignored by Git:

```json
{
  "jiraProject": "RDSB",
  "jiraJql": "",
  "jiraMaxResults": 50,
  "bbProject": "",
  "bbRepo": "",
  "confluencePageId": "1701642865",
  "pollIntervalMs": 60000,
  "teamsWebhookUrl": ""
}
```

- `jiraProject` is used by the default Jira query and in logs.
- `jiraJql` overrides the default open-sprint query. Use it to monitor a
  project, release, component, team, or another Jira-defined scope.
- `jiraMaxResults` limits the number of tickets in each cycle.
- `bbProject` and `bbRepo` may remain empty for Jira-only operation.
- `confluencePageId` is the page that receives staged workflow events.
- `pollIntervalMs` defaults to 60 seconds and can be overridden with
  `--interval`.
- Prefer the `TEAMS_WEBHOOK_URL` environment variable over storing a webhook in
  the configuration file.

Example release scope:

```json
{
  "jiraJql": "project = RDSB AND fixVersion = \"2026.07\" ORDER BY updated DESC"
}
```

An empty `jiraJql` preserves the original behavior:

```text
project=<jiraProject> AND sprint in openSprints() ORDER BY updated DESC
```

## Engineering Brief

Generate an action-first brief from the same workflow data:

```bash
# Generate only
node watcher/brief.mjs --dry-run

# Skip AI synthesis and use deterministic formatting
node watcher/brief.mjs --dry-run --no-ai

# Generate and post using TEAMS_WEBHOOK_URL
TEAMS_WEBHOOK_URL="https://..." node watcher/brief.mjs
```

The brief leads with blockers, stale work, code review, QA handoffs, and recent
changes. It can still serve as a pre-standup brief, but that is one use case
rather than its product boundary.

## Scheduling

### cron

```bash
0 9 * * 1-5 cd /path/to/flow-sync-ai && node watcher/brief.mjs >> /tmp/flowsync-brief.log 2>&1
```

### macOS LaunchAgent

Copy `watcher/config/com.flowsync.brief.plist.example` to
`~/Library/LaunchAgents/com.flowsync.brief.plist`, replace the example paths,
and then load it with `launchctl load`.

## Integrations

The watcher reuses the same skill scripts as Flow Agent:

- `~/.copilot/skills/jira/scripts/`
- `~/.copilot/skills/bitbucket/scripts/`
- `~/.copilot/skills/confluence/scripts/`
