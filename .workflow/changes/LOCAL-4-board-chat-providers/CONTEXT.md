---
created: 2026-11-26
updated: 2026-11-26
---

# Board chat providers

## Problem Statement

Board chat only connects to Codex. Developers who use GitHub Copilot or Claude Code have to leave the board to ask their assistant about a change or ticket.

## Goal

Start a conversation with Codex, GitHub Copilot, or Claude Code directly from the board and continue it with the same provider after reopening it.

## Current State

- The chat panel is labeled Codex, and it creates chats without a provider setting. [Chat UI](../../../wf-agent/web/chat.tsx)
- The server launches the local Codex app-server for every turn and saves its thread ID for subsequent messages. The board also lets Codex propose workflow actions for the user to authorize. [Chat server](../../../wf-agent/server/chat.ts) · [Chat storage](../../../wf-agent/server/chat-store.ts)

## Discovery decisions

The developer delegated the discovery interview to an independent questioner and respondent. They tested the following decisions against the existing chat dock, SQLite store, workflow approvals, and provider interfaces.

| Question | Decision and reason |
| --- | --- |
| How does someone know where a message will go? | Offer a provider choice before the first send, including in the collapsed composer. Label the current conversation and its saved entry. **New chat** creates a separate, saved conversation with the chosen provider and can be used while another chat is running. |
| What does choosing a provider mean? | Choose the assistant for the lifetime of a chat. Codex is the initial default. Each assistant uses its own model configuration. A follow-up or restart uses the stored provider and exact session. If that session cannot resume, explain how to start a new chat. |
| What does Copilot or Claude know about the board? | Send the text of the open change, ticket, or archive record and the files explicitly attached with `@`. Deduplicate files. Validate paths and apply the board’s redaction before sending. Identify any binary, missing, or oversized input so the user can fix it. |
| Can every assistant run a workflow? | Copilot and Claude provide discussion using the supplied text. Their sessions have no project tools and run outside the checkout. Codex handles repository search and approved `wf` actions through its existing board integration. Make this distinction visible when choosing a chat. |
| Where do credentials and sessions live? | Use the official Copilot SDK in empty mode with a board-owned working directory and explicit tool restrictions. Run the local Claude Code CLI in safe mode with built-in and MCP tools disabled. Both use provider authentication configured outside the board. The board stores the provider and native session ID alongside its transcript. |
| What happens on failure or Stop? | Report provider-specific installation, sign-in, or session errors inside the conversation. Stop interrupts the active provider, releases the chat for another turn, and leaves the transcript available. A successful turn requires a public assistant response. |

GitHub documents Copilot’s session isolation and Anthropic documents Claude’s safe mode, tool restrictions, and session flags. Local administrator policies still apply. [Copilot SDK isolation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy) · [Claude Code CLI](https://code.claude.com/docs/en/cli-reference)

## Scope and rollout

Ship provider selection and both discussion runtimes together. Identify existing conversations as Codex in a single storage migration. Validate the same board experience on the repository’s supported platforms and report live sign-in or inference limitations separately for each provider.

## Raw Context

The developer asked to “expand options for model provider in my board chat” and “add copilot and claude as well.” The initial draft called for per-chat selection, continued sessions, selected repository files, setup guidance, and discovery of model and workflow-action support.
