---
created: 2026-11-26
updated: 2026-11-26
---
# 001 — Use board tools and execute workflows with the selected provider

## Summary

Developers using Claude Code or GitHub Copilot can inspect repository files and authorize workflows directly in the board. Each uses its own runtime and login for both conversation and execution.

## Acceptance criteria

- [ ] Both providers can find and read repository files and propose a resolved workflow action. Discussion has no native shell or write capability.
- [ ] A Claude-only or Copilot-only environment can run approved status and ticket-to-PR workflows in the correct checkout using the selected provider.
- [ ] Permission decisions, Stop, stale approvals and verified delivery are visible in the same board conversation.
- [ ] Existing Codex execution, private project storage, attachments and session ownership keep working.

## Technical deep-dive

The server owns the SQLite claim and the checkout tools. Two native adapters translate the shared contract to the Claude CLI and Copilot SDK. Dispatch confirmed actions using the provider stored with the chat. Verify the packaged skill, provider isolation and journal receipts through normal entry points.

**Risk** is high because approved runs can edit files and publish work. **Dependency** is the provider selection in LOCAL-4. Required verification includes browser/API tests, native runtime probes, package inspection, the repository suite and workflow metadata validation.
