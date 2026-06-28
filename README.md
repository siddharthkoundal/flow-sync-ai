# FlowSync AI

**An AI-powered engineering workflow assistant that keeps tickets, pull
requests, meeting notes, team updates, and documentation in sync.**

FlowSync AI connects Jira, Bitbucket, Confluence, Microsoft Teams, and developer
input into one engineering coordination layer. It can run interactively through
the **Flow Agent** or continuously through a background watcher.

Sprint planning, standups, and sprint reporting are supported workflows, but
the platform also covers code review, QA handoffs, delivery risks, release
updates, stale work, decisions, and action ownership.

## What It Solves

FlowSync AI helps teams answer and act on questions such as:

- What changed since the last update?
- Is the pull request merged, and what handoff does that unblock?
- Which work is blocked, stale, awaiting review, or ready for QA?
- What decisions and action items came out of the meeting?
- Which Jira, Confluence, or Teams updates are now required?
- What is the current project, sprint, or release status?

It verifies live system data, combines it with conversational context, and
produces structured updates in the systems the team already uses.

## Modes

### Interactive — Flow Agent

Open Copilot Chat in VS Code and select **Flow Agent** or type `@flow-agent`.

Examples:

> `@flow-agent sync RDSB-14913`

> `@flow-agent summarize today's standup`

> `@flow-agent update project status`

> `@flow-agent check blockers and QA handoffs`

> `@flow-agent prepare a release update for Teams`

The agent identifies relevant tickets and PRs, fetches live truth, explains any
ambiguity, previews planned writes, and updates approved systems.

### Background — Workflow Watcher

The watcher polls Jira and, when configured, Bitbucket. It detects workflow
signals such as ticket transitions and PR merges, stages them in Confluence, and
posts ticket-specific Jira comments for significant events.

```bash
# Seed or run one cycle
node watcher/daemon.mjs --once

# Continuous polling
node watcher/daemon.mjs

# Detect without external writes
node watcher/daemon.mjs --dry-run --once

# Inspect tracked state
node watcher/daemon.mjs --status
```

Configuration: [watcher/config/watcher.json](watcher/config/watcher.json).
See [watcher/README.md](watcher/README.md) for details.

## Slash Commands

| Command | What it does |
| --- | --- |
| `/flowsync-sync` | Synchronize a ticket, project, sprint, or release across tools |
| `/flowsync-status` | Show live status, blockers, reviews, handoffs, and stale work |
| `/flowsync-transcript` | Extract decisions, owners, and system updates from a transcript |
| `/flowsync-update` | Process a quick ticket, PR, QA, blocker, or release event |
| `/flowsync-page` | Create or refresh a Confluence workflow status page |
| `/flowsync-watch` | Start, inspect, or dry-run the background watcher |
| `/flowsync-brief` | Generate an action-first engineering brief and optionally post it |

## Architecture

```text
Conversations ─┐
Jira tickets ──┼─→ Flow Agent / Workflow Watcher
Bitbucket PRs ─┤       ├─ verify and correlate live signals
Developer input┘       ├─ reason about blockers, decisions, and handoffs
                       └─ update Jira, Confluence, and Teams
```

- **Flow Agent** handles ambiguous, conversational, and multi-system work.
- **Workflow Watcher** handles repeatable background event detection.
- Both modes use the same Jira, Bitbucket, Confluence, and Teams integrations.
- Watcher state lives at `~/.local/state/flowsync-watcher/`.

## Setup

1. Install the Jira, Bitbucket, and Confluence Copilot skills.
2. Authenticate the skills at
   `~/.config/syf-skills/{jira,bitbucket,confluence}/token.json`.
3. Copy `watcher/config/watcher.example.json` to
   `watcher/config/watcher.json` and add local identifiers.
4. Set `TEAMS_WEBHOOK_URL` in the environment if Teams delivery is required.
5. Open this workspace in VS Code and select **Flow Agent**.

## Project Structure

```text
.github/
  agents/flow-agent.agent.md
  prompts/flowsync-*.prompt.md
watcher/
  daemon.mjs
  brief.mjs
  config/
  lib/
docs/
  product-spec.md
  hackathon-submission.md
AGENTS.md
README.md
```

## Safety

- Live data is fetched before status is reported or changed.
- Verified facts, inferences, and unknowns are kept distinct.
- Jira transitions require explicit approval.
- The first interactive Confluence write requires confirmation.
- Multi-system writes are previewed before execution.
- Ticket comments contain only ticket-relevant context.
- Dry-run mode previews watcher behavior without external writes.
- Partial failures are surfaced rather than hidden.

## Product Specification

The scope, functional requirements, non-goals, and acceptance criteria are in
[docs/product-spec.md](docs/product-spec.md).

## Hackathon

- [Submission notes](docs/hackathon-submission.md)
- [Presentation deck](docs/hackathon-presentation.html)
- [Four-minute presenter script](docs/hackathon-presentation-script.md)
# flow-sync-ai
