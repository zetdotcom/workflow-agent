---
created: 2026-11-26
updated: 2026-11-26
---

# Board chat provider behavior

## User story

A developer wants to discuss the current work with the assistant they already use, see who receives each message, and return to the conversation later.

### Choose and identify the assistant

Given a board with no chats, the developer can choose Codex, GitHub Copilot, or Claude Code before sending from the collapsed dock. Codex is initially selected. Given a saved conversation, the composer and transcript identify its provider. Creating a separate chat with another provider works while the first chat is running and saves the new chat even before its first message.

### Reopen and resume

When the user reopens a chat or restarts the board, a follow-up goes to that chat's original provider and native session. Previous Codex conversations reopen with their transcripts and any pending approvals. A missing native session produces an error that directs the user to start a new chat.

### Discuss selected work

When the user sends a message from a change, ticket, or archived change, Copilot and Claude receive the selected document's text plus the text of distinct attached files. The board applies its repository boundary and redaction. It names the problem if a file disappears, resolves outside the repository, is binary, or exceeds the combined context budget. These errors let the user correct the draft before resending.

### Stop or fix setup

When an active chat is stopped, its runtime ends that turn, the transcript records the interruption, and another chat can continue independently. Missing installations, credentials and provider errors produce actionable provider-specific messages. Private host diagnostics stay out of the transcript.

### Use workflow actions

The new providers receive discussion context without project tools. Users can identify Codex as the option for repository search and authorized workflow actions. The Codex proposal, approval, execution, and result flow continues to work, including after a board restart.
