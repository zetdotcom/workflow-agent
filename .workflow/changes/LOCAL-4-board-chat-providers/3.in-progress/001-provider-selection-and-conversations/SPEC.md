---
created: 2026-11-26
updated: 2026-11-26
---

# Board chat provider behavior

## User story

A developer wants the board to remember which assistant they use for each project and let them change it from Settings.

### First-open setup and returning visits

Opening an unconfigured project presents Codex, Claude Code, and GitHub Copilot, even before chat is opened. The user can browse the board and explicitly save a provider when ready. Reopening or restarting a configured project loads its choice without onboarding. Sign-in failures surface in chat and do not clear the choice.

### Project scope and privacy

Linked Git worktrees share their project's saved choice. Separate local clones and independent workflow roots configure their own providers. Saving a choice, switching providers, and chatting produce no provider state in the project’s working tree. Native credentials stay outside the board API.

### Change provider in Settings

Saving a different provider in Settings applies to new chats and subsequent sends. The composer identifies who receives the message. An earlier provider’s transcript is readable, and an in-flight run can finish or be stopped. Starting a new conversation or switching back is explicit. Stale Settings submissions cannot overwrite a more recent choice.

### Reopen and resume

When a saved chat’s provider matches the project's setting, a follow-up resumes its exact native session. Previous Codex conversations retain their transcripts and pending approvals. A missing native session produces an error that directs the user to start a new chat.

### Discuss selected work

When the user sends a message from a change, ticket, or archived change, Copilot and Claude receive the selected document's text plus the text of distinct attached files. The board applies its repository boundary and redaction. It names the problem if a file disappears, resolves outside the repository, is binary, or exceeds the combined context budget. These errors let the user correct the draft before resending.

### Stop or fix setup

When an active chat is stopped, its runtime ends that turn, the transcript records the interruption, and another chat can continue independently. Missing installations, credentials and provider errors produce actionable provider-specific messages. Private host diagnostics stay out of the transcript.

### Use workflow actions

The new providers receive discussion context without project tools. Users can identify Codex as the option for repository search and authorized workflow actions. The Codex proposal, approval, execution, and result flow continues to work, including after a board restart.
