---
name: wf-manager
description: "Invoke this skill when the user wants to manage their workflow tickets/inits: creating new inits, creating tickets, updating ticket status, viewing kanban/progress, breaking down scope into tickets, or any operation on .workflow/ directory. Also invoke when user says 'new ticket', 'update status', 'show kanban', 'breakdown', or references init/ticket management."
---

# Workflow Manager

Manages tickets and inits in `.workflow/` directory. Structure:

```
.workflow/
├── README.md
├── templates/ticket.md
└── inits/<init-name>/
    ├── SPEC.md        # Raw requirements / brain dump
    ├── STATUS.md      # Kanban overview
    ├── 1.draft/       # New/unrefined tickets
    ├── 2.todo/        # Refined, ready to plan/implement
    ├── 3.in-progress/ # Currently being worked on
    └── 4.done/        # Completed tickets
```

Ticket files live in the folder matching their current status. Moving a ticket between statuses means moving the file between folders.

## Bootstrap

If `.workflow/` does not exist in project root, create the full structure (dirs + README + template) before proceeding.

## Operations

### 1. Create New Init

When user wants to start a new initiative:

1. Ask for init name (slug format, e.g. `deposit-refactor`)
2. Create directory `.workflow/inits/<init-name>/`
3. Create status folders: `1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`
4. Create `SPEC.md` (ask user for raw context, or leave placeholder)
5. Create `STATUS.md`:

```markdown
# <Init Name (human readable)>

## Progress: 0/0 done

### In Progress

### Blocked

### Todo

### Done
```

### 2. Create Ticket

When user wants to create a ticket within an init:

1. Determine which init (ask if ambiguous, or infer from context)
2. Find next ticket number by checking existing files across all status folders (1.draft/, 2.todo/, 3.in-progress/, 4.done/)
3. Ask for: title, description, acceptance criteria, dependencies, risk level
4. Create ticket file from template at `.workflow/templates/ticket.md` in `1.draft/`
5. Update STATUS.md - add to Todo section

Filename: `NNN-slug.md` where NNN is zero-padded 3 digits, slug derived from title.

### 3. Batch Create Tickets (Breakdown)

When user wants to break down a larger scope:

1. Discuss scope with user, understand the work
2. Propose ticket breakdown with titles, brief descriptions, dependency graph, risk levels
3. After user confirms, create all ticket files + update STATUS.md
4. Show final kanban view

### 4. Update Ticket Status

When user says a ticket is done, in progress, or blocked:

1. Update the `## Status:` line in the ticket file
2. **Move the ticket file** to the corresponding folder:
   - `draft` → `1.draft/`
   - `todo` → `2.todo/`
   - `in_progress` → `3.in-progress/`
   - `done` → `4.done/`
3. Update STATUS.md to reflect the change
4. Update the progress counter in STATUS.md header

Valid transitions:
- `draft` → `todo`
- `todo` → `in_progress`
- `in_progress` → `done` | `blocked`
- `blocked` → `in_progress`
- Any → `draft` (reset)

### 5. Show Kanban / Progress

Read and display the STATUS.md for the requested init (or all inits if user asks for overview).

### 6. Edit Ticket

When user wants to modify ticket content (AC, plan, risk, etc.):
1. Read current ticket
2. Apply requested changes
3. If dependencies changed, update STATUS.md blocked section accordingly

## Rules

- ALWAYS keep STATUS.md in sync with individual ticket files
- When showing progress, use format: `Progress: X/Y done`
- Ticket numbers are per-init, not global
- Multiple inits can exist simultaneously - never mix them
- If init has only one active init, assume that's the target. If multiple, ask.
- Risk assessment is mandatory for every ticket (can be "low" with brief justification)

## STATUS.md Format

```markdown
# Init Human Name

## Progress: X/Y done

### In Progress
- [ ] NNN - ticket title

### Blocked
- [ ] NNN - ticket title (blocked by NNN)

### Todo
- [ ] NNN - ticket title

### Done
- [x] NNN - ticket title
```

## Ticket Format

Tickets use two-section format:
- **Summary** — Jira-ready, manager-friendly (goal, scope, AC, risk)
- **Technical Deep-Dive** — dev/AI-facing (context, approach, files affected, gotchas)
- **Implementation Plan** — filled by `wf-plan` skill (leave empty on creation)
- **Review Notes** — filled by `wf-plan-review` and `wf-impl-review` skills

Read template from `.workflow/templates/ticket.md` when creating new tickets. Fill in Summary and Technical Deep-Dive sections.
