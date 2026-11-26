---
created: 2026-11-26
updated: 2026-11-26
---

# Reviews

### Plan Review — 2026-11-26

**Verdict:** approved

The independent questioner and answering agent reviewed first-open setup, Settings changes across windows, project identity, credentials, and in-flight chats. They agreed that creating a chat must read the saved project setting. The server checks a stale window’s expected value before saving or sending. Earlier transcripts retain their provider identity and drafts are never transferred automatically. The specification maps each decision to a browser, API, storage, or runtime check.

### Implementation Review — 2026-11-26

**Verdict:** approved

An independent reviewer inspected the UI, project and checkout storage, session migration, turn routing, provider runtimes, package requirements and test coverage. They found that a native Claude or Codex state-directory override could point into a worktree. The server now resolves those directories before sending a turn or authorizing an action and reports an actionable error for a project-local destination. The reviewer checked relative, linked-worktree and external locations and approved the fix. The full suite passed after the change.

The authenticated Copilot smoke and the real Claude CLI smoke are recorded in `PROGRESS.md`, including the limit on hosted Claude verification.
