---
created: 2026-11-26
updated: 2026-11-26
---
# Board tools and native workflows

### Search from a conversation

Given an authenticated Claude or Copilot project, a new or resumed chat can search the checkout and read a file through the board. Reads use repository-relative paths and return redacted text. External paths, Git internals and native mutation tools are unavailable in discussion.

### Propose and authorize

Asking about a workflow can produce a preview with its target, scope and provider. Decline leaves the checkout untouched. Authorize checks the saved provider and the proposal identity against current workflow inputs. A second approval, a changed plan or a stale provider cannot launch a new worker.

### Execute without Codex

Given a machine with the selected provider and its normal credentials, approval starts a fresh session for that same provider. Status can reconcile eligible active status files. Ticket-to-PR follows the packaged wf instructions with native subagents, verification, independent review and PR creation capabilities. The user can inspect and accept or decline actual native permission requests. A missing prerequisite produces a visible error.

### Stop, restart and report delivery

Stop ends the owned run, releases pending permissions and records the interruption. New discussions can resume the original chat session. A matching completed delivery journal supplies a ready or qualified draft link. An unconfirmed result remains visible as an error.

### Protected behavior

Keep Codex, project settings, separate checkout histories, the attachment context budget, repository boundaries and server-side approval claims working.
