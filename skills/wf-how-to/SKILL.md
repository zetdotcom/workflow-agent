---
name: wf-how-to
description: "Invoke this skill when the user wants to understand the workflow system. Triggered by: 'how does workflow work', 'wf-how-to', 'workflow guide', 'how to use workflow', 'explain workflow'. Shows a quick overview of the full ticket lifecycle from init to completion."
---

# Workflow How-To

Explains the workflow system to the user. Present the following guide concisely.

## Quick Overview

The workflow system lives in `.workflow/inits/` and manages work from idea to completion through a structured ticket lifecycle.

## Folder Structure

```
.workflow/inits/<init-name>/
├── SPEC.md          # Everything you know about the work
├── STATUS.md        # Progress overview
├── 1.draft/         # New/unrefined tickets
├── 2.todo/          # Refined, ready for planning
├── 3.in-progress/   # Currently being worked on
└── 4.done/          # Completed tickets
```

Ticket files move between folders as their status changes.

## Lifecycle

Present this as a numbered flow:

### 1. Create Init (`wf-new-init`)
Start a new initiative. Creates the folder structure with SPEC.md and STATUS.md.

### 2. Discover (`wf-discover`)
Flesh out SPEC.md through a structured interview. Agent asks targeted questions, identifies gaps, and writes a complete, well-structured spec. Ensures nothing critical is missed before breakdown.

### 3. Breakdown (`wf-breakdown`)
Turn the spec into actionable tickets. Interactive process — proposes tickets, you confirm/adjust. Tickets land in `1.draft/`.

### 4. Plan (`wf-plan`)
Pick a ticket and create a detailed implementation plan. Explores the codebase to validate assumptions and writes concrete steps. Ticket moves to `2.todo/` (ready for work).

### 5. Review Plan (`wf-plan-review`)
Review the plan before coding. Checks completeness, feasibility, risks. Last checkpoint before implementation.

### 6. Implement (`wf-implement`)
Execute the plan. Writes actual code changes following the plan steps. Moves ticket to `3.in-progress/`.

### 7. Review Implementation (`wf-impl-review`)
Review code changes against the plan and acceptance criteria. Approves or requests changes.

### 8. Complete (`wf-complete`)
Mark ticket done. Moves to `4.done/`, updates STATUS.md.

## Other Useful Commands

- **`wf-status`** — Check progress (kanban view, per-ticket status)

## Tips

- You can skip steps if the work is simple (e.g., go straight from breakdown to implement for trivial tickets)
- Plan review is optional but recommended for medium/high risk tickets
- Folder contents are the source of truth for ticket status — STATUS.md is auto-corrected by `wf-status` if it drifts
- Each ticket should be independently deployable (1-3 days of work max)

## Rules

- This skill is read-only — just show the guide, don't modify any files
- Keep the explanation concise and practical
- If user asks follow-up questions about a specific step, suggest invoking that step's skill directly
