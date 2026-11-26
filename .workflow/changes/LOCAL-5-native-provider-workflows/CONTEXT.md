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

## Raw Context

The developer requested two stages, independent discovery questioning and answering, an implementation and a separate pull request. Each provider must run approved workflows without Codex installed.
