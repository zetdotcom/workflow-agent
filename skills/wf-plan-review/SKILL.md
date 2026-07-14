---
name: wf-plan-review
description: "Invoke this skill when the user wants to review an implementation plan before coding begins. Triggered by: 'review plan NNN', 'plan-review NNN', 'check plan for NNN'. Reviews the plan for completeness, risks, and feasibility, adds review notes inline."
---

# Plan Review Skill

Reviews an implementation plan for a ticket, identifies gaps, risks, and improvements. Adds review notes inline in the ticket file.

## Workflow

### Step 1: Read Ticket + Plan

- Read the full ticket — search across status folders (`1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`) in `.workflow/inits/<init-name>/`
- Focus on the Implementation Plan section
- Also read related code if needed to validate plan feasibility

### Step 2: Review Checklist

Evaluate the plan against:

1. **Completeness** - Does the plan cover all acceptance criteria?
2. **Feasibility** - Are the steps actually doable given the codebase?
3. **Risk** - Are risky steps identified? Any missing risks?
4. **Dependencies** - Are dependent tickets actually done? Any new dependencies discovered?
5. **Testing** - Is the testing strategy adequate?
6. **Deploy safety** - Can this be deployed without breaking things?
7. **Scope creep** - Does the plan stay within ticket scope?

### Step 3: Write Review Notes

Add findings to the `## Review Notes` section in the ticket:

```markdown
## Review Notes

### Plan Review — <date>

**Verdict:** approved | needs-changes | blocked

**Findings:**
- ✅ <what's good>
- ⚠️ <concern/suggestion>
- ❌ <must fix before implementing>

**Suggested changes to plan:**
- ...
```

### Step 4: If Changes Needed

- If verdict is `needs-changes`, update the Implementation Plan section with the fixes
- If verdict is `blocked`, update ticket status to `blocked` and note why
- If verdict is `approved`, confirm ticket is ready for implementation

## Rules

- Be rigorous — this is the last checkpoint before AI writes code
- Actually explore the codebase to verify plan steps are valid
- If plan references files/functions that don't exist, flag it
- If plan misses edge cases visible in the code, flag them
- Keep review concise and actionable
- After approval, the ticket is ready for `implement` skill
