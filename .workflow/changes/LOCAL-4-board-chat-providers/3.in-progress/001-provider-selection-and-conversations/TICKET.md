---
created: 2026-11-26
updated: 2026-11-26
---

# 001 — Set up the project's board chat provider

## Summary

**Goal:** Let a developer select Codex, Claude Code, or GitHub Copilot once per project and change the choice in Settings.

**Scope:** Provider selection, conversation history, bounded repository context, local setup feedback, Stop, and coverage of Codex workflow approvals.

**Acceptance Criteria:**

- [ ] Opening an unconfigured board asks for a provider. Saving a choice prevents subsequent setup prompts for that project, including across restarts and linked worktrees.
- [ ] Settings can switch the project provider. New conversations use it and existing transcripts retain their original session identity.
- [ ] The board saves provider data outside the project and keeps settings independent across separate projects and clones.
- [ ] Copilot and Claude receive the selected board document and attached text files through a read-only discussion path.
- [ ] A user can identify the provider, stop its turn, and recover from a setup, context, or session error.

**Verification Required:** Exercise the HTTP API, persisted chats, browser composer, and actual provider startup. Record which authenticated turns were observed.

**Risk:** Medium. Each runtime owns its session and permission model.

**Dependencies:** The Copilot SDK runtime and the user's local Claude Code installation or credentials, according to the selected provider.

## Technical Deep-Dive

The chat server claims a turn in SQLite before dispatch. Read the project setting when creating a chat and bind the native session ID to that chat. Authorize new messages against the current project setting. Use the board's private state directory for configuration and runtime data.

Reuse the board's file validation, transcript redaction, active-run claims, and Codex approval flow. The chat dock can send from both the board and the ticket details panel. The browser suite also exercises saving an empty new conversation and reopening it after a restart.
