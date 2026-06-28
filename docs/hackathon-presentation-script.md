# FlowSync AI — 4-Minute Hackathon Presentation

Open `docs/hackathon-presentation.html` in a browser and use the arrow keys.

## Timing

| Time | Slide | Goal |
| --- | --- | --- |
| 0:00-0:12 | 1. The Transformers | Introduce the team |
| 0:12-0:42 | 2. Problem statement | Make fragmented coordination recognizable |
| 0:42-1:00 | 3. FlowSync AI | Reveal the engineering workflow assistant |
| 1:00-1:22 | 4. One agentic workflow | Explain the product simply |
| 1:22-1:45 | 5. Architecture | Show the two execution modes |
| 1:45-2:25 | 6. Coordinated action | Show real outputs |
| 2:25-2:52 | 7. Continuous workflow signals | Reveal background automation |
| 2:52-3:15 | 8. Human control | Establish trust |
| 3:15-3:35 | 9. Expected impact | Quantify value |
| 3:35-3:52 | 10. Closing | Land the message |
| 3:52-4:00 | 11. Demo recording | Share the walkthrough |

## Presenter Script

### Slide 1 — The Transformers

"We are The Transformers: Siddharth Koundal, Praveen Kagitha, Sruthi Ganjam,
and SreeCharan."

### Slide 2 — Problem Statement

"Engineering work moves through Jira, Bitbucket, Teams, meetings, and
Confluence, but the context does not move with it. Teams repeatedly check which
PR merged, what is blocked, what needs QA, who owns the next action, and what
must be communicated. The information exists; the coordination layer does not."

### Slide 3 — FlowSync AI

"FlowSync AI is an agentic engineering workflow assistant. One conversation or
system event becomes verified status, targeted updates, owned action items, and
the next team brief. Standups are one workflow; engineering coordination is the
product."

### Slide 4 — One Agentic Workflow

"Flow Agent understands natural language, verifies Jira and Bitbucket, reasons
about blockers, dependencies, decisions, review queues, and QA handoffs, then
updates the right systems. It is not merely summarizing—it is closing the
coordination loop."

### Slide 5 — Architecture

"FlowSync has two modes using the same integrations. Flow Agent handles
conversation and ambiguous multi-system work. The background watcher detects
configured Jira and Bitbucket signals continuously. Together they connect
tickets, code, conversations, Confluence, and Teams."

### Slide 6 — Coordinated Action

"This is what FlowSync produces from real engineering context: a concise team
recap, an attention-first brief, and ticket-specific Jira comments. The same
workflow works for a standup, project update, release check, or QA handoff."

Demo:

1. Select `@flow-agent` in Copilot Chat.
2. Run `/flowsync-transcript` with
   `mock/data/transcript-2026-06-09.txt`.
3. Show the blocker on `RDSB-14913`.
4. Show the decision and risk on `RDSB-15123`.
5. Show the ticket-specific Jira drafts and Teams-ready brief.

### Slide 7 — Continuous Workflow Signals

"FlowSync keeps working between conversations. Its watcher detects Jira status
changes and Bitbucket PR events, stages the changes in Confluence, and surfaces
handoffs. Configurable JQL means the same watcher can follow a sprint, project,
component, or release."

```bash
node watcher/daemon.mjs --dry-run --once
node watcher/brief.mjs --dry-run
```

### Slide 8 — Human Control

"Agentic does not mean uncontrolled. FlowSync verifies live data, separates
facts from inferences, requires approval for Jira transitions, previews
multi-system writes, and supports dry-run mode."

### Slide 9 — Expected Impact

"We expect a major reduction in repetitive status preparation and follow-up.
More importantly, blockers surface earlier, reviews and QA handoffs stay
visible, and decisions do not disappear between tools."

### Slide 10 — Closing

"FlowSync does not add another dashboard to maintain. It turns the tools and
conversations teams already use into one continuously synchronized engineering
workflow. Stop reporting the work. Let the work report itself."

### Slide 11 — Demo Recording

"The recorded demonstration shows FlowSync turning engineering conversation
and live tool data into coordinated action."

## Demo Checklist

- Open the deck full screen.
- Select `@flow-agent`.
- Keep the mock transcript ready.
- Open the Teams recap and engineering brief.
- Keep Jira tickets `RDSB-14913` and `RDSB-15123` ready.
- Warm authentication before presenting.
- Keep screenshots as backup.

## Judge Q&A

**Why is this agentic?**  
The LLM resolves unstructured context, identifies implications and dependencies,
decides which systems need updates, and creates destination-specific actions.
The watcher handles deterministic event detection.

**How do you prevent incorrect updates?**  
FlowSync verifies Jira and Bitbucket first, labels uncertainty, requires approval
for transitions, limits comments to relevant context, previews multi-system
writes, and supports dry-run mode.

**Why not just use dashboards?**  
Dashboards show fields. FlowSync connects those fields with PR activity,
meeting decisions, blockers, action owners, handoffs, and the updates required
across tools.

**What is ready today?**  
The prototype can read live Jira and Bitbucket context, analyze transcripts,
generate ticket-specific updates and Teams briefs, update Confluence, and
detect Jira workflow changes in the background.
