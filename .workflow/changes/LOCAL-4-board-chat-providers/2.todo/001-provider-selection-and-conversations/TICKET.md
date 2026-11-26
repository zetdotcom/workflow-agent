---
created: 2026-11-26
updated: 2026-11-26
---

# 001 — Choose a provider for board conversations

## Summary

**Goal:** Let a developer ask GitHub Copilot or Claude Code about the board from the same composer they use for Codex.

**Scope:** Provider selection, conversation history, bounded repository context, local setup feedback, Stop, and coverage of Codex workflow approvals.

**Acceptance Criteria:**

- [ ] A new conversation can use any of the three providers. Its provider and session survive reopening and board restarts.
- [ ] Copilot and Claude receive the selected board document and attached text files through a read-only discussion path.
- [ ] A user can identify the provider, stop its turn, and recover from a setup, context, or session error.

**Verification Required:** Exercise the HTTP API, persisted chats, browser composer, and actual provider startup. Record which authenticated turns were observed.

**Risk:** Medium. Each runtime owns its session and permission model.

**Dependencies:** The Copilot SDK runtime and the user's local Claude Code installation or credentials, according to the selected provider.

## Technical Deep-Dive

The chat server claims a turn in SQLite before dispatch. Store the provider when creating the chat and scope the native session ID to that record. Bind dispatch and cancellation to server-owned state. The client can choose a provider only for a new chat.

Reuse the board's file validation, transcript redaction, active-run claims, and Codex approval flow. The chat dock can send from both the board and the ticket details panel. The browser suite also exercises saving an empty new conversation and reopening it after a restart.
