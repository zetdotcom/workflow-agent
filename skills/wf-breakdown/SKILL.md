---
name: wf-breakdown
description: "Invoke this skill when the user wants to break down a larger piece of work into individual tickets. Triggered by: 'breakdown', 'create tickets', 'split this into tickets', 'ticket breakdown for <topic>'. The skill interviews the user to understand scope, then proposes a set of deployable tickets."
---

# Breakdown Skill

Takes a large piece of work and breaks it into individual, deployable tickets through an interview process.

## Workflow

### Phase 0: Bootstrap

If `.workflow/` directory does not exist in the project root:

1. Create `.workflow/` directory
2. Create `.workflow/templates/` directory
3. Create `.workflow/templates/ticket.md` with the standard ticket template (two-section format: Summary + Technical Deep-Dive)
4. Create `.workflow/inits/` directory
5. Create `.workflow/README.md` with workflow documentation

If `.workflow/` exists but the target init does not, just create the init directory.

### Phase 1: SPEC.md

Before interviewing, create/update the raw spec file:

1. Ask user to provide all raw context, requirements, and notes about the work
2. Save as `.workflow/inits/<init-name>/SPEC.md`
3. This is the unstructured brain dump — requirements, stakeholder requests, technical context, risk notes, anything relevant
4. SPEC.md stays as permanent reference; tickets will be derived from it

If user already has context in conversation, compile it into SPEC.md automatically.

### Phase 2: Interview

Ask questions to understand the full scope. Questions should cover:

1. **What** - What's the high-level goal? What problem does this solve?
2. **Why now** - What's the urgency/driver?
3. **Current state** - What exists today? What's wrong with it?
4. **Desired state** - What should it look like after?
5. **Constraints** - What can't change? What's risky? What's the deploy strategy?
6. **Dependencies** - Are there external dependencies? Order constraints?
7. **Scope boundaries** - What's explicitly out of scope?

Ask 2-4 questions at a time. Don't overwhelm. Adapt based on answers - skip what's already clear, dig into what's vague.

### Phase 3: Propose Tickets

After sufficient understanding, propose the full ticket breakdown:

For each ticket, present:
- **Number + Title**
- **Goal** (1 sentence)
- **Risk** (low/medium/high)
- **Dependencies** (which other tickets it depends on)
- **Deployable independently?** (yes/no/after-NNN)

Present as a numbered list. Ask user to confirm, add, remove, split, or merge tickets.

### Phase 4: Iterate

User may want to:
- Split a ticket that's too big
- Merge tickets that are too small
- Reorder dependencies
- Add missing tickets
- Remove unnecessary ones

Iterate until user confirms.

### Phase 5: Create Files

Once confirmed:

1. Determine init name (ask if not clear, use slug format like `deposit-refactor`)
2. Create `.workflow/inits/<init-name>/` directory
3. Create status folders: `1.draft/`, `2.todo/`, `3.in-progress/`, `4.done/`
4. For each ticket, create `.workflow/inits/<init-name>/1.draft/NNN-slug.md` using template from `.workflow/templates/ticket.md`
5. Fill in both Summary (Jira-ready) and Technical Deep-Dive sections
6. Leave Implementation Plan empty (that's for the `plan` skill)
7. Create/update `.workflow/inits/<init-name>/STATUS.md`

### Ticket Content Guidelines

**Summary section (Jira-ready):**
- Written for managers and stakeholders
- Clear goal, scope, acceptance criteria
- No implementation details
- Risk stated plainly

**Technical Deep-Dive section (dev/AI-facing):**
- Context about current code
- Suggested approach (directional, not prescriptive)
- Files likely affected
- Edge cases and gotchas
- Always include the VERIFY warning about validating assumptions

**Each ticket must be independently deployable** (or explicitly state dependency chain).

### STATUS.md Format

```markdown
# <Init Human Name>

## Progress: 0/N done

### In Progress

### Blocked

### Todo
- [ ] 001 - ticket title
- [ ] 002 - ticket title
...

### Done
```

## Rules

- Never create tickets without user confirmation of the breakdown
- Each ticket should be 1-3 days of work max
- If a ticket is bigger, suggest splitting
- Risk assessment is mandatory
- Dependencies must form a valid DAG (no cycles)
- Ticket content will be copied to Jira - Summary must be self-contained and readable without the Technical section
