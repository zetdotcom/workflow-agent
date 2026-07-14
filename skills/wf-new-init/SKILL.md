---
name: wf-new-init
description: "Invoke this skill when the user wants to create a new initiative/epic. Triggered by: 'new init', 'create init', 'new initiative', 'start new epic', 'wf-new-init'. Creates the folder structure with placeholder files and guides the user on how to start discovery."
---

# New Init Skill

Creates a new initiative folder with placeholder files and guides the user on next steps.

## Workflow

### Step 1: Bootstrap

If `.workflow/` does not exist in project root, create the full structure:
- `.workflow/README.md`
- `.workflow/templates/ticket.md`
- `.workflow/inits/`

### Step 2: Get Init Name

Ask for:
- **Slug** (folder name, e.g. `deposit-refactor`)
- **Human-readable name** (e.g. "Deposit Area Refactor")

### Step 3: Create Structure

Create:
```
.workflow/inits/<slug>/
├── SPEC.md
├── STATUS.md
├── 1.draft/
├── 2.todo/
├── 3.in-progress/
└── 4.done/
```

### Step 4: SPEC.md Content

Create SPEC.md with discovery prompts:

```markdown
# <Human-Readable Name>

## Raw Context

_Dump everything you know here: requirements, stakeholder requests, technical debt notes, screenshots descriptions, conversations, links. Unstructured is fine._

## Discovery Questions

Answer these to clarify scope before breakdown:

- [ ] What's the high-level goal? What problem does this solve?
- [ ] Why now? What's the urgency/driver?
- [ ] What exists today? What's wrong with it?
- [ ] What should it look like after?
- [ ] What can't change? Hard constraints?
- [ ] What's explicitly out of scope?
- [ ] Are there external dependencies or order constraints?
- [ ] What's the risk level? What can break?
- [ ] Deploy strategy? Feature flags? Incremental rollout?

## Notes

_Additional thoughts, links, references._
```

### Step 5: STATUS.md Content

```markdown
# <Human-Readable Name>

## Progress: 0/0 done

### In Progress

### Blocked

### Todo

### Done
```

### Step 6: Guide User

After creating files, tell the user:

```
✓ Init "<name>" created at .workflow/inits/<slug>/

Next steps:
1. Fill in SPEC.md — dump all raw context and answer discovery questions
2. When ready, invoke `wf-breakdown` to turn the spec into actionable tickets
```

## Rules

- Don't create tickets at this stage — that's `wf-breakdown`'s job
- SPEC.md discovery questions are suggestions, not mandatory fields
- Keep it lightweight — the point is to lower the barrier to starting
