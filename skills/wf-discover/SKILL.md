---
name: wf-discover
description: "Invoke this skill when the user wants to flesh out a SPEC.md before breakdown. Triggered by: 'discover', 'flesh out spec', 'work on spec', 'spec interview', 'wf-discover', 'prepare spec'. Interviews the user to build a complete, well-structured SPEC.md ready for ticket breakdown."
---

# Discover Skill

Interviews the user to build a high-quality SPEC.md that's ready for `wf-breakdown`. Ensures nothing critical is missing before tickets get created.

## When to Use

Between `wf-new-init` (which creates a skeleton SPEC.md) and `wf-breakdown` (which turns it into tickets). This skill bridges the gap — turning a vague idea into a structured, complete specification.

## Workflow

### Step 1: Read Existing Context

- Read the init's SPEC.md (may be empty skeleton or partially filled)
- Read any relevant codebase context the user mentions
- Note what's already clear vs what's missing

### Step 2: Interview

Run a structured interview. Ask 2-3 questions at a time. Adapt based on answers — skip what's already clear, dig into what's vague.

**Core areas to cover:**

1. **Problem & Goal**
   - What problem does this solve? Who has this problem?
   - What does success look like? How will you measure it?
   - Why now? What's the urgency or trigger?

2. **Current State**
   - What exists today? How does it work?
   - What's wrong with it? What are the pain points?
   - Are there workarounds people use?

3. **Desired State**
   - What should it look like after?
   - Walk me through the key user flows / scenarios
   - What's the minimum viable version?

4. **Boundaries**
   - What's explicitly out of scope?
   - What can't change? Hard constraints (tech, business, regulatory)?
   - Are there performance / scale requirements?

5. **Dependencies & Risks**
   - External systems or teams involved?
   - What can go wrong? What's the blast radius?
   - Order constraints? Things that must happen first?

6. **Rollout**
   - Deploy strategy? Feature flags? Incremental rollout?
   - Migration needed? Data backfill?
   - Rollback plan?

Don't ask all of these. Adapt to the scope — a small refactor needs fewer questions than a new feature. Stop when you have enough clarity for someone to write tickets.

### Step 3: Synthesize & Write SPEC.md

After interview, rewrite SPEC.md with structured content:

```markdown
# <Initiative Name>

## Problem Statement
<1-3 sentences: what problem, who has it, why it matters>

## Goal
<What success looks like, measurable if possible>

## Current State
<How things work today, what's wrong>

## Desired State
<What it should look like after, key user flows>

## Scope
### In Scope
- ...

### Out of Scope
- ...

## Constraints
- <Hard technical/business/regulatory constraints>

## Dependencies
- <External systems, teams, order constraints>

## Risks
- <What can go wrong, blast radius, mitigation>

## Rollout Strategy
- <Deploy approach, feature flags, migrations, rollback>

## Open Questions
- <Anything still unresolved — flag for breakdown phase>

## Raw Context
<Original dump from user, preserved for reference>
```

### Step 4: Confirm with User

Present the completed SPEC.md to user. Ask:
- Anything missing or wrong?
- Any open questions you can resolve now?
- Ready for `wf-breakdown`?

Iterate until user confirms.

## Rules

- Don't overwhelm — 2-3 questions at a time max
- If user already provided rich context, synthesize first, then ask only about gaps
- Preserve raw context at the bottom — never delete what user originally wrote
- Keep spec concise — this isn't a PRD, it's enough to write tickets from
- Flag open questions explicitly rather than guessing answers
- If the scope is tiny (single file refactor), keep the spec proportionally small — don't force full structure
- After confirmation, tell user: "Spec ready. Run `wf-breakdown` to create tickets."
