---
created: 2026-11-26
updated: 2026-11-26
---

# Board chat providers

## Problem Statement

Board chat only connects to Codex. Developers who use GitHub Copilot or Claude Code have to leave the board to ask their assistant about a change or ticket.

## Goal

Let developers use Codex, GitHub Copilot, or Claude Code from the same board chat.

## Current State

- The chat panel is labeled Codex, and it creates chats without a provider setting. [Chat UI](../../../wf-agent/web/chat.tsx)
- The server launches the local Codex app-server for every turn and saves its thread ID for subsequent messages. The board also lets Codex propose workflow actions for the user to authorize. [Chat server](../../../wf-agent/server/chat.ts) · [Chat storage](../../../wf-agent/server/chat-store.ts)

## Desired State

- Choose a provider when starting a chat, and see the provider when reopening a saved chat. Subsequent messages use that chat’s provider and session.
- Ask the chosen provider about the active change or ticket and include selected repository files from the chat composer.
- Show what setup or sign-in is needed when a provider is unavailable.

## Constraints

- Apply the board’s read-only repository access to ordinary chat. Require explicit authorization in the board before executing a proposed workflow action.

## Open Questions

- Which runtime and sign-in flow should the board use for GitHub Copilot and Claude Code?
- Should the first release include model selection within each provider?
- Which providers should support proposing and running `wf` actions at launch?
