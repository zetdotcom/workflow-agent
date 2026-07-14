---
name: wf-status
description: "Invoke this skill when the user wants to check workflow progress. Triggered by: 'status', 'wf-status', 'progress', 'show kanban', 'where are we'. Optional parameter: ticket number, init name, or change ID to scope the view. Without parameters, shows overview of all inits."
---

# Status Skill

Shows current progress of inits and tickets. Quick, read-only overview.

## Workflow

### Determine Scope

Based on parameters:

- **No parameter** → show overview of ALL inits (one-liner per init with progress)
- **Init name** (e.g. `deposit-refactor`) → show full kanban for that init (read STATUS.md)
- **Ticket number** (e.g. `003`) → show that ticket's current status, title, and last activity (from Review Notes or Implementation Notes timestamps)

### Output Format

#### All inits overview (no params):

```
Workflow Status
──────────────
deposit-refactor  ████░░░░░░  3/10 done  (1 in progress, 1 blocked)
auth-migration    ██████████  5/5 done   ✓ complete
```

#### Single init (init name given):

Read and display STATUS.md content. Additionally, verify STATUS.md accuracy by listing files in each status folder (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`). If discrepancies found, note them. Add summary line:

```
deposit-refactor — 3/10 done

In Progress:
  → 004 - extract deposit validator

Blocked:
  ⊘ 006 - migrate state management (blocked by 004)

Todo:
  ○ 005 - split route handlers
  ○ 007 - add integration tests
  ...

Done:
  ✓ 001 - extract types
  ✓ 002 - create deposit service
  ✓ 003 - add unit tests
```

#### Single ticket (ticket number given):

Read ticket file (search across `1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`), show condensed view:

```
004 - extract deposit validator
Status: in_progress
Risk: medium
Dependencies: none
Last activity: Implementation Plan added (2024-01-15)
```

## Rules

- Read-only — never modify files
- If `.workflow/` doesn't exist, inform user and suggest `wf-new-init`
- If only one init exists, show its full kanban even without parameters
- If multiple inits exist and no parameter given, show overview; user can drill down
- Keep output concise — this is a quick status check, not a deep dive
