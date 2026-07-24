---
name: wf-status
description: "Invoke this skill when the user wants to check workflow progress. Triggered by: 'status', 'wf-status', 'progress', 'show kanban', 'where are we'. Optional parameter: ticket number, init name, or change ID to scope the view. Without parameters, shows overview of all inits."
---

# Status Skill

Shows current progress of inits and tickets. Quick, read-only overview.

## Workflow

### Determine Scope

First inspect `.workflow/inits/` and resolve user argument against existing init folder names before deciding scope.

Resolution order:

1. **No parameter** → ask user which init they want status for; offer exact init folder names plus `all`
2. **Exact init folder match** (e.g. `deposit-refactor`) → show full kanban for that init
3. **Single partial init folder match** → if argument is contained anywhere in exactly one init folder name, use that init
4. **Numeric argument that matches one init folder name fragment** → if argument like `12` or `003` appears in exactly one init folder name, use that init
5. **`all`** → show overview of ALL inits (one-liner per init with progress)
6. **Ticket number** (e.g. `003`) → if no init match was found, search ticket files across all init status folders and show that ticket's current status, title, and last activity
7. **Ambiguous match** → if multiple init folders match, do not guess; ask user which init they mean and list matches

Examples:

- `wf-status` → ask user to choose one init or `all`
- `wf-status deposit` → matches `deposit-refactor` if unique
- `wf-status 012` → matches init folder containing `012` if unique; otherwise treat as ticket number search
- `wf-status auth-mig` → matches `2026-07-auth-migration` if unique

### Output Format

#### All inits overview (`wf-status all` or user chose `all`):

```
Workflow Status
──────────────
deposit-refactor  ████░░░░░░  3/10 done  (1 in progress, 1 blocked)
auth-migration    ██████████  5/5 done   ✓ complete
window-shopping   ░░░░░░░░░░  SPEC only, no tickets yet
```

#### Single init (init name or unique partial match given):

Read and display STATUS.md content. Additionally, verify STATUS.md accuracy by listing files in each status folder (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`). If discrepancies found, **auto-fix STATUS.md** to match the actual folder contents (folders are source of truth). Inform user what was corrected. Add summary line:

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
- If an init has no tickets yet (empty status folders), report its current state: e.g. "SPEC only, no tickets yet" or "empty — needs SPEC.md". This is normal early in the lifecycle, not an error.
- If no parameter was given, ask user to choose from existing init folder names and include `all` as option
- If only one init exists, still ask; offer that init and `all`
- Prefer init-folder resolution before ticket lookup whenever user supplied argument could plausibly be either
- For partial matches, use case-insensitive substring matching against folder name
- If multiple init folders match same argument, ask clarifying question with exact folder names
- Keep output concise — this is a quick status check, not a deep dive
