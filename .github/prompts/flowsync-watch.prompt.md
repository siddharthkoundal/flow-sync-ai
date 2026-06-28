---
agent: Flow Agent
description: Start, inspect, or safely preview the FlowSync background workflow watcher.
---

Operate `watcher/daemon.mjs` according to the user's request.

- Use `--status` to inspect tracked state.
- Use `--dry-run --once` for a no-write preview.
- Use `--once` for one write-enabled cycle.
- Use the default command for continuous polling only when explicitly requested.

Check `watcher/config/watcher.json` first and never print secret values. Explain
which Jira project, Bitbucket repository, and Confluence page are configured
without exposing credentials. Report process status and errors clearly.
