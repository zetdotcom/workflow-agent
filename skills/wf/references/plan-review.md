# `wf plan-review [change] [ticket]`

Optionally review implementation plan before coding.

## Argument Resolution

Use the shared resolution rules in `SKILL.md`. Candidate tickets are in `2.todo/` and contain `PLAN.md` and `PLAN-BRIEF.md`.

## Steps

1. Read `TICKET.md`, `PLAN.md`, and `PLAN-BRIEF.md`.
2. Explore codebase to verify referenced files, functions, assumptions, and feasibility.
3. Review:
   - Completeness against observable acceptance criteria
   - Feasibility in current codebase
   - Vertical phase boundaries and working intermediate states
   - Public verification seams, failing-before evidence, repository-defined commands, and official sources for version-sensitive external APIs
   - Direct runtime/smoke coverage for every runnable changed surface
   - Risk identification and dependency readiness
   - Deployment safety and scope control
   - Brief accuracy: faithfully summarizes plan, data flow, decisions, risks, and user-visible changes
   - Human readability: understandable without reading detailed plan
4. Create `REVIEWS.md` from `references/reviews-template.md` if absent, otherwise append to it:

   ```markdown
   ### Plan Review - YYYY-MM-DD

   **Verdict:** approved | needs-changes | blocked

   **Findings:**
   - <what is good>
   - <concern or suggestion>
   - <must fix before implementation>

   **Suggested changes to plan:**
   - ...
   ```

5. If verdict is `needs-changes`, update `PLAN.md` and `PLAN-BRIEF.md` together, then describe changes in `REVIEWS.md`. If blocked, record reason clearly.
6. Update actual `updated` date in every modified file.
7. If approved, suggest `wf implement <change> <ticket> phase 1`.

## Rules

- Actually explore codebase.
- Flag nonexistent files/functions and missed edge cases.
- Keep findings concise and actionable.
- A blocked verdict prevents implementation unless user explicitly overrides.
- Reject material disagreement between detailed plan and brief.
