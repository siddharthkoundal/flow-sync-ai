# FlowSync AI Product Specification

## Product Definition

FlowSync AI is an agentic engineering workflow assistant that connects project
management, code collaboration, team communication, and documentation tools. It
captures updates from Jira, Bitbucket, Teams transcripts, and developer input,
then converts them into verified status, blockers, action items, Jira comments,
Confluence pages, and team summaries.

**One-line positioning:** FlowSync AI keeps work moving by synchronizing updates
across tickets, code, meetings, and documentation.

**Agent:** Flow Agent — the conversational agent that understands engineering
context and updates the right systems with human control.

## Problem

Engineering signals are fragmented across systems. Teams repeatedly reconstruct
the same story to understand what changed, what is blocked, what needs review or
QA, what was decided, and who owns the next action. This creates stale status,
missed handoffs, duplicated updates, and avoidable coordination meetings.

## Users

- developers and technical leads
- QA engineers and release managers
- engineering managers and delivery leads
- product owners and project managers
- scrum masters and other ceremony facilitators

## Goals

1. Create a verified, current view of engineering work from live sources.
2. Convert conversations and system events into structured, owned actions.
3. Keep Jira, Bitbucket context, Confluence, and Teams aligned.
4. Surface blockers, dependencies, stale work, review queues, and QA handoffs.
5. Reduce manual reporting without removing human control over sensitive writes.

## Supported Workflows

- ticket and pull-request synchronization
- project, sprint, release, and delivery status reporting
- standup and meeting transcript processing
- blocker, dependency, decision, and action-item tracking
- code-review and QA handoff monitoring
- stale-work and missing-owner detection
- Confluence status-page creation and refresh
- Teams engineering briefs and release updates
- background detection of Jira transitions and Bitbucket PR events

## Functional Requirements

### FR1 — Resolve Context

Flow Agent must identify ticket IDs, pull requests, projects, releases, people,
and requested output surfaces from natural-language input. It must ask only when
missing context would materially change an external action.

### FR2 — Verify Live Truth

Before reporting or writing status, the system must fetch relevant Jira and
Bitbucket data. Meeting statements and developer input must remain attributed
context until verified.

### FR3 — Correlate Signals

The system must connect tickets to PRs and conversational references, while
preserving uncertainty when links are inferred rather than explicit.

### FR4 — Generate Workflow Intelligence

Outputs must distinguish:

- current verified status
- changes since the previous view
- blockers, dependencies, and risks
- review and QA handoffs
- decisions and action items with owners
- stale or unowned work
- unknowns requiring follow-up

### FR5 — Apply Targeted Updates

The system may generate or apply ticket-specific Jira comments, approved Jira
transitions, Confluence updates, and Teams summaries. Every update must be
appropriate for its destination and avoid unrelated context.

### FR6 — Support Interactive and Background Operation

The interactive agent handles ambiguous and multi-step coordination. The
watcher handles deterministic event detection, persisted snapshots,
single-instance execution, and dry-run previews.

### FR7 — Report Outcomes

After acting, the system must report which reads and writes succeeded, which
failed, and which items were skipped or remain uncertain.

## Safety Requirements

- Never fabricate tickets, PRs, status, owners, or completed writes.
- Label facts, inferences, and unknowns.
- Require explicit approval for Jira transitions.
- Require confirmation before the first interactive Confluence write.
- Preview multi-system writes before applying them.
- Keep Jira comments scoped to the referenced ticket.
- Treat a merged PR as a handoff signal, not proof that its ticket is done.
- Support no-write previews for background automation.
- Do not store credentials or webhook secrets in committed configuration.

## Non-Goals

FlowSync AI is not:

- a replacement for Jira, Bitbucket, Confluence, or Teams
- an autonomous code author or deployment system
- a general-purpose employee monitoring tool
- limited to a single agile framework or sprint ceremony
- a source of truth independent of connected systems
- authorized to make sensitive workflow changes without required approval

## Success Measures

- reduction in time spent assembling and distributing engineering updates
- percentage of blockers and action items captured with owners
- freshness of shared status pages and briefs
- reduced age of code-review and QA queues
- percentage of automated updates accepted without correction
- complete traceability of attempted and completed external actions

## Acceptance Criteria

1. `@flow-agent sync <ticket>` returns verified Jira and PR context and proposes
   destination-specific updates.
2. A transcript produces decisions, blockers, action items, and ticket-scoped
   update drafts without treating spoken claims as verified facts.
3. A status request can cover a project, sprint, or release and highlights
   blockers, stale work, code reviews, and QA handoffs.
4. The watcher detects Jira status changes and configured Bitbucket PR events,
   persists state, prevents duplicate instances, and supports `--dry-run`.
5. Confluence and Teams outputs describe engineering workflow status rather than
   assuming every request is a standup or sprint report.
6. All sensitive actions follow the approval and reporting rules above.
