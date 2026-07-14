---
name: wf-plan
description: "Invoke this skill when the user wants to create an implementation plan for a specific ticket. Triggered by: 'plan ticket NNN', 'plan NNN', 'create plan for NNN', 'let's plan <ticket>'. Reads the ticket, explores the codebase, and writes a directional implementation plan into the ticket file."
---

# Plan Skill

Creates an implementation plan for a ticket by reading the ticket content and exploring the codebase.

## Workflow

### Step 1: Identify Ticket

- Determine which init and ticket number (ask if ambiguous)
- Read the ticket file — search across status folders (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`) in `.workflow/inits/<init-name>/`
- Understand the goal, scope, and technical deep-dive

### Step 2: Explore Codebase

- Validate technical assumptions from the ticket's Deep-Dive section
- Find the actual files, functions, and patterns involved
- Identify current architecture relevant to the change
- Note any discrepancies between ticket assumptions and reality

### Step 3: Write Implementation Plan

Write the plan into the ticket's `## Implementation Plan` section. Plan should be **directional, not prescriptive**:

Format:
```markdown
## Implementation Plan

**Validated assumptions:**
- [confirmed/corrected] assumption from deep-dive

**Approach:**

1. **Step name** — what to do and why
   - Key decisions: ...
   - Affected: `path/to/file.ts`

2. **Step name** — ...

**Testing strategy:**
- How to verify this works

**Deploy notes:**
- Any special deploy considerations (migrations, feature flags, etc.)
```

### Step 4: Update Status

- Update ticket status from `draft`/`todo` to `in_progress` (planning counts as starting work)
- Move ticket file to `3.in-progress/` if not already there
- Update STATUS.md accordingly

## Rules

- Plan must be grounded in actual codebase exploration, not assumptions
- If ticket's Technical Deep-Dive has incorrect assumptions, note corrections in the plan
- Keep plan directional — steps + key decisions, not line-by-line pseudocode
- AI will figure out implementation details during `implement` phase
- Always include testing strategy
- If the ticket depends on other tickets that aren't done yet, flag this clearly
