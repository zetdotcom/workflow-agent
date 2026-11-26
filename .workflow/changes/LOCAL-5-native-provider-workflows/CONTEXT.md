---
created: 2026-11-26
updated: 2026-11-26
---
# Native board tools and workflows

## Problem Statement

A developer can choose Claude Code or GitHub Copilot for a project, but currently needs Codex to search repository files from a conversation or execute an approved workflow.

## Goal

All three providers can use the board's file and proposal tools. A project configured with Claude Code or GitHub Copilot can execute an approved status or ticket-to-PR workflow with that provider, including when Codex is absent.

## Current State

The board owns repository lookup, file reads, proposal validation, approval and delivery receipts. Tool registration and tool dispatch currently run through the Codex adapter. The approval handler starts Codex unconditionally. [Board chat](../../../wf-agent/server/chat.ts) · [Codex adapter](../../../wf-agent/server/codex.ts)

## Discovery decisions

An independent questioner challenged a separate answering agent on tool isolation, native execution, credentials, stale approvals and proof of delivery. The Claude runtime specialist also exercised the installed CLI.

| Question | Decision |
| --- | --- |
| What can a conversation do before approval? | All providers can call the same four board tools. File lookup and paged reads use the existing checkout boundary. Workflow calls prepare a preview. Only the board's approval button can claim an execution. Attachments keep their existing context budget. |
| Where does the code run? | The chat's immutable provider starts a fresh native execution in the approved checkout. The board keeps the discussion session separate, stores private state outside Git and rechecks the approved inputs immediately before work. A conflicting project setting blocks a new approval. |
| How does the provider receive tools? | Claude's CLI exchanges explicit board MCP messages over its owned stdio stream. Copilot receives SDK custom tool definitions on create and resume. Both discussion modes deny ambient shell, write and third-party tools. |
| Which skill does a Claude-only or Copilot-only installation use? | Ship the repository's canonical wf skill and references inside the board's npm package. The native worker receives that skill, the applicable command reference and the authorized target. Follow the checkout's instructions. |
| What does approval cover? | Status inspects workflow state and may reconcile the eligible active change's STATUS.md. Ticket-to-PR can implement, run checks, dispatch fresh provider-native workers for implementation and independent review, and publish to the reviewed destination. Individual host permission requests remain visible in the board. |
| How are failure and delivery reported? | Stop interrupts the active provider and any pending permission. Persist public activity and keep the saved chat usable. A PR link comes from a completed matching ticket journal. Ready and qualified draft receipts retain their distinction. Model prose alone cannot mark delivery. |
| How is independence proved? | Exercise the native runtime and public board endpoints with Codex unavailable. Verify repository access, real file effects, approval, denial, Stop and receipt handling. Record the distinction between hosted inference, controlled model responses, and external publication. |

The implementation targets the installed Claude CLI and pinned Microsoft Copilot SDK. [Claude headless CLI](https://code.claude.com/docs/en/headless) · [Copilot subagents](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/custom-agents)

## Scope and delivery

One ticket covers the two user-approved stages and their shared permission boundary. Stack the pull request on the open provider-selection PR so each change can be reviewed independently. [Provider setup](https://github.com/zetdotcom/workflow-agent/pull/3)

## Raw Context

The developer requested two stages, independent discovery questioning and answering, an implementation and a separate pull request. Each provider must run approved workflows without Codex installed.
