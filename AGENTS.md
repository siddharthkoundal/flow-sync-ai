# FlowSync AI — Agent Intent Layer

## What This Project Is

FlowSync AI is an **agentic engineering workflow assistant** that keeps tickets,
pull requests, conversations, documentation, and team updates synchronized.
Sprint ceremonies are one supported workflow, not the product boundary.

FlowSync AI has two execution modes:

1. **Interactive** — the Copilot Chat **Flow Agent** (`@flow-agent`) interprets
   natural-language requests, verifies live data, and coordinates updates.
2. **Background** — `watcher/daemon.mjs` detects Jira ticket changes and
   Bitbucket pull-request events, then updates shared status surfaces.

Both modes reuse the Jira, Bitbucket, Confluence, and Teams integrations.

## Product Boundary

FlowSync AI coordinates engineering work across:

- delivery status, blockers, dependencies, and stale work
- pull-request and code-review progress
- QA handoffs and release readiness
- meeting transcripts, decisions, and owned action items
- Jira comments and transitions
- Confluence project, delivery, and sprint pages
- Microsoft Teams recaps and engineering briefs

It is not merely a sprint tracker, standup bot, Jira script, Confluence updater,
or meeting summarizer. It is the workflow synchronization layer between those
systems.

## Architecture

```text
Interactive Mode (Copilot Chat)
  → Flow Agent (.github/agents/flow-agent.agent.md)
    → Jira skill scripts (~/.copilot/skills/jira/scripts/)
    → Bitbucket skill scripts (~/.copilot/skills/bitbucket/scripts/)
    → Confluence skill scripts (~/.copilot/skills/confluence/scripts/)
    → LLM reasoning (verification, synthesis, decisions, action planning)

Background Mode (watcher/daemon.mjs)
  → Polls Jira for ticket status changes
  → Polls Bitbucket for PR state changes when configured
  → Updates the configured Confluence workflow status page
  → Posts ticket-specific Jira comments on significant transitions
  → State persisted at ~/.local/state/flowsync-watcher/
```

## Project Structure

```text
.github/
  agents/flow-agent.agent.md          ← Interactive Flow Agent
  prompts/
    flowsync-sync.prompt.md           ← Cross-tool workflow synchronization
    flowsync-status.prompt.md         ← Live engineering status view
    flowsync-transcript.prompt.md     ← Transcript decisions/actions/updates
    flowsync-update.prompt.md         ← Quick engineering event processing
    flowsync-page.prompt.md           ← Build or refresh a status page
    flowsync-watch.prompt.md          ← Background watcher operations
    flowsync-brief.prompt.md          ← Engineering brief + Teams delivery
watcher/
  daemon.mjs                          ← Background event watcher
  brief.mjs                           ← Engineering brief generator
  config/
    watcher.json                      ← Local runtime configuration
    watcher.example.json              ← Safe configuration template
  lib/
    state.mjs                         ← Snapshot persistence + lock
    jira.mjs                          ← Jira skill wrappers
    bitbucket.mjs                     ← Bitbucket skill wrappers
    confluence.mjs                    ← Confluence page updater
    teams.mjs                         ← Teams webhook helper
docs/
  product-spec.md                     ← Product scope and requirements
  hackathon-submission.md             ← Hackathon submission notes
AGENTS.md                              ← This intent layer
README.md                              ← User-facing documentation
```

## Interactive Usage

1. Open Copilot Chat in VS Code.
2. Select **Flow Agent** or type `@flow-agent`.
3. Ask in natural language:
   - "Sync RDSB-14913 across Jira, its PR, and the project page."
   - "Summarize today's standup and identify owners."
   - "Show delivery status and blockers."
   - "What is waiting for QA or code review?"
   - "Prepare a release update for Teams."

## Background Usage

```bash
node watcher/daemon.mjs --once
node watcher/daemon.mjs
node watcher/daemon.mjs --dry-run --once
node watcher/daemon.mjs --status
```

See [watcher/README.md](watcher/README.md) for configuration.

## Slash Commands

- `/flowsync-sync` — synchronize workflow context across connected tools
- `/flowsync-status` — show current delivery status, blockers, and handoffs
- `/flowsync-transcript` — turn a meeting transcript into structured actions
- `/flowsync-update` — process a quick ticket, PR, QA, or release event
- `/flowsync-page` — create or refresh a Confluence workflow status page
- `/flowsync-watch` — operate the background watcher
- `/flowsync-brief` — generate an engineering brief and optionally post to Teams

## Prerequisites

The Jira, Bitbucket, and Confluence Copilot skills must be installed and
authenticated:

- `jira` — `~/.config/syf-skills/jira/token.json`
- `bitbucket` — `~/.config/syf-skills/bitbucket/token.json`
- `confluence` — `~/.config/syf-skills/confluence/token.json`

## Safety Rules

- Fetch live source data before reporting or writing status.
- Clearly distinguish verified facts, inferences, and unknowns.
- The first Confluence write in an interactive session requires confirmation.
- Jira transitions always require explicit user approval.
- Jira comments must contain only context relevant to that ticket.
- Never infer that a PR merge means a ticket is complete; describe it as a
  handoff signal until Jira or the user confirms the status.
- Preview multi-system mutations before applying them.
- Report partial failures and never claim an update succeeded without evidence.
- The background watcher supports `--dry-run` and uses a single-instance lock.
