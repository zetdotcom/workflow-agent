---
created: 2026-11-26
updated: 2026-11-26
---

# Board chat providers

## Problem Statement

Board chat only connects to Codex. Developers who use GitHub Copilot or Claude Code have to leave the board to ask their assistant about a change or ticket.

## Goal

Choose Codex, Claude Code, or GitHub Copilot once when opening a project's board. The board remembers the choice on this machine. Settings is where the user can change it.

## Current State

- The chat panel is labeled Codex, and it creates chats without a provider setting. [Chat UI](../../../wf-agent/web/chat.tsx)
- The server launches the local Codex app-server for every turn and saves its thread ID for subsequent messages. The board also lets Codex propose workflow actions for the user to authorize. [Chat server](../../../wf-agent/server/chat.ts) · [Chat storage](../../../wf-agent/server/chat-store.ts)

## Discovery decisions

The developer delegated the discovery interview to an independent questioner and respondent. They tested the following decisions against the existing chat dock, SQLite store, workflow approvals, and provider interfaces.

| Question | Decision and reason |
| --- | --- |
| When does setup appear? | Opening an unconfigured board presents all three providers. Reading the board can continue while setup is open or deferred. Saving an explicit choice enables chat. Future openings, including in another browser or after a restart, load that project setting. |
| How does a developer switch assistants? | Change the project provider in **Settings**. Every new chat uses that choice. Each transcript shows its original provider. The user can read an earlier provider's conversation, stop its running turn, start a new chat with the configured provider, or switch back to resume its exact session. Each provider uses its own model configuration. |
| What identifies a project? | Use the local Git repository identity shared by its linked worktrees, or the canonical board directory for a standalone workflow project. Separate clones and separate projects have independent settings. Transcripts stay with the checkout whose files they reference. |
| Where is project data saved? | Persist the choice in the user's external wf-agent state directory, alongside checkout-specific chat storage. Keep provider credentials in the provider's native sign-in mechanism. Reject a state path inside the project. The working tree receives no settings, sessions, transcripts, or secrets. |
| What if two windows change Settings? | Check the previously displayed value when saving. A stale window reloads the saved setting. New turns check the project's current provider before they claim a run. An authorized run already in progress can finish or be stopped. |
| What does Copilot or Claude know about the board? | Send the text of the open change, ticket, or archive record and the files explicitly attached with `@`. Deduplicate files. Validate paths and apply the board’s redaction before sending. Identify any binary, missing, or oversized input so the user can fix it. |
| Can every assistant run a workflow? | Copilot and Claude provide discussion using the supplied text. Their sessions have no project tools and run outside the checkout. Codex handles repository search and approved `wf` actions through its existing board integration. Make this distinction visible when choosing a chat. |
| Where do credentials and sessions live? | Use the official Copilot SDK in empty mode with a board-owned working directory and explicit tool restrictions. Run the local Claude Code CLI in safe mode with built-in and MCP tools disabled. Both use provider authentication configured outside the board. The board stores the provider and native session ID alongside its transcript. |
| What happens on failure or Stop? | Report provider-specific installation, sign-in, or session errors inside the conversation. Stop interrupts the active provider, releases the chat for another turn, and leaves the transcript available. A successful turn requires a public assistant response. |

GitHub documents Copilot’s session isolation and Anthropic documents Claude’s safe mode, tool restrictions, and session flags. Local administrator policies still apply. [Copilot SDK isolation](https://docs.github.com/en/copilot/how-tos/copilot-sdk/setup/multi-tenancy) · [Claude Code CLI](https://code.claude.com/docs/en/cli-reference)

## Scope and rollout

Ship project setup, Settings, and both discussion runtimes together. Identify existing conversations as Codex in a single storage migration. The first explicit project choice still belongs to the user. Validate the board on its supported platforms and report live sign-in or inference limitations for each provider.

## Raw Context

The developer asked to “expand options for model provider in my board chat” and “add copilot and claude as well.” They clarified that the board should ask for setup on first open, remember a configured provider, offer changes in Settings, and keep provider data per project and out of Git.
