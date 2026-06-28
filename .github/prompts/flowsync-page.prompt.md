---
agent: Flow Agent
description: Create or refresh a Confluence status page for a project, feature, sprint, release, or delivery stream.
---

Build a current Confluence workflow page for the scope supplied by the user.

Fetch Jira and Bitbucket first. Structure the page around:

- scope and last-verified time
- current status and recent changes
- blockers, dependencies, and delivery risks
- active work, review queue, QA handoffs, and completed work
- decisions and owned next actions
- unknowns requiring follow-up

Do not assume a sprint template when the scope is a project, feature, or release.
Show a concise preview and follow the first-Confluence-write confirmation rule.
