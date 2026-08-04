# `wf plan [change] [ticket]`

Create grounded implementation plan for specific ticket.

## Prerequisites

- Parent change has substantive `CONTEXT.md`.
- Ticket directory exists in a status folder and contains `TICKET.md`.

## Argument Resolution

Resolve change first. If omitted, present changes with Question tool. Then resolve ticket directory inside that change. If ticket omitted, present tickets in `1.draft/` and `2.todo/` without `PLAN.md`. Accept unique change prefixes such as `PYE-1123`.

## Steps

1. Read `TICKET.md`: goal, scope, acceptance criteria, testing requirements, and Technical Deep-Dive.
2. Read parent `CONTEXT.md`.
3. Explore actual codebase. Find relevant files, functions, architecture, tests, and conventions. Validate or correct ticket assumptions.
4. Divide implementation into coherent phases. Each phase must be independently executable and verifiable, with explicit dependencies on earlier phases where needed. Boundaries should represent implementation milestones, not arbitrary file groups.
5. Create or replace `PLAN.md` using `references/plan-template.md`. Write detailed, comprehensive plan:

   ```markdown
   # Implementation Plan

   **Validated assumptions:**
   - [confirmed/corrected] assumption from deep-dive

   **Approach summary:**
   - Overall implementation strategy and important decisions

   ### Phase 1: <coherent milestone>

   **Goal:**
   - Outcome this phase delivers

   **Dependencies:**
   - None | Phase N | ticket NNN

   **Changes:**
   1. Detailed implementation step and why it is needed
      - Key decisions: ...
      - Affected: `path/to/file.ts`
   2. ...

   **Verification:**
   - Phase-specific tests and checks

   **Completion criteria:**
   - [ ] Observable result proving phase is complete

   ### Phase 2: <coherent milestone>
   ...

   ### Final Verification
   - [ ] Run relevant full test suite
   - [ ] Verify every acceptance criterion
   - [ ] Verify deployment and rollback considerations

   ### Deploy Notes
   - Special deploy considerations
   ```

6. Create or replace `PLAN-BRIEF.md` using `references/plan-brief-template.md`. Derive it from validated codebase findings and `PLAN.md`, not from assumptions alone. Include:
   - Goal and outcome
   - Current state summary
   - Main changes grouped by area
   - Architecture and data flow, including a concise Mermaid diagram when flow is non-trivial
   - Phase map with purpose and outcome of each phase, without low-level steps
   - Important decisions and alternatives considered
   - User-visible behavior changes
   - Risks, compatibility, rollout, and rollback
   - Testing summary
   - Open questions or specific points needing human review
7. If ticket is in `1.draft/`, move whole ticket directory to `2.todo/`. Do not move it to `3.in-progress/`.
8. Set actual `created` and `updated` dates in newly created files. Preserve original `created` when replacing existing files. Update `STATUS.md` actual `updated` date if directory moved.
9. Report phases, validated assumptions, and both plan paths. Suggest `wf plan-review <change> <ticket>` or `wf implement <change> <ticket> phase 1`.

## Rules

- Plan must be grounded in codebase exploration, not ticket assumptions alone.
- Correct inaccurate Technical Deep-Dive assumptions explicitly.
- Plan must be comprehensive enough for another agent or session to implement any phase without reconstructing intent.
- Include concrete steps, decisions, affected files, verification, and completion criteria, but avoid line-by-line pseudocode.
- Every phase must include phase-specific verification.
- Always include final cross-phase verification.
- Flag incomplete dependencies clearly.
- `PLAN.md` is implementation source of truth. `PLAN-BRIEF.md` is a human review aid and must not introduce scope or decisions absent from `PLAN.md`.
- Keep brief concise enough to review quickly. Prefer diagrams and summaries over procedural detail.
- Whenever planning changes materially, update both plan files in same operation.
