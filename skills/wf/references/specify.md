# `wf specify [change] [ticket]`

Create or update a ticket-level behavior specification with explicit user confirmation.

## Argument Resolution

Use the shared resolution rules in `SKILL.md`. Candidate tickets may be in any active status folder. If ticket is omitted, present tickets in the resolved change with their lifecycle status and whether `SPEC.md` exists.

## Steps

1. Read `TICKET.md`, parent `CONTEXT.md`, and existing `SPEC.md` if present.
2. Inspect the current code and documentation only where needed to distinguish existing behavior from proposed behavior. Do not turn specification into implementation planning.
3. Draft `SPEC.md` using `references/spec-template.md`:
   - User stories state actor, capability, and value.
   - Scenarios state observable happy paths, meaningful boundaries, and failure behavior using GIVEN/WHEN/THEN.
   - Protected Behaviors state existing behavior that must not regress.
   - Out of Scope prevents adjacent behavior from becoming implicit scope.
4. Keep scenarios specific enough to derive verification without prescribing implementation. Omit sections that genuinely do not apply; do not invent scenarios to fill the template.
5. Present the complete draft and call out assumptions or unresolved behavior. Ask the user to confirm or revise it. Iterate until explicitly confirmed.
6. After confirmation, create or replace `SPEC.md`. Preserve its original `created` date when updating it and set `updated` to the actual current date.
7. Run the metadata validator required by `SKILL.md`. Fix violations caused by this operation and rerun until it passes.
8. Report the specification path and exact validator command/result. Suggest `wf plan <change> <ticket>` when the ticket is unplanned; otherwise state that its plan must be reconciled with the changed specification before implementation continues.

## Rules

- `SPEC.md` is optional. Never create an empty placeholder or require unrelated tickets to have one.
- Do not write or update `SPEC.md` before explicit user confirmation.
- `SPEC.md` owns detailed observable behavior when present. Keep `TICKET.md` focused on goal, delivery boundary, dependencies, risk, and non-behavioral completion requirements; do not duplicate scenarios there.
- Scenario headings are the traceability keys used by plans, progress, and reviews. Keep a heading stable when its behavior is unchanged.
- A material behavior change during planning or implementation requires updating and reconfirming `SPEC.md` before continuing. Wording-only corrections do not require renewed confirmation.
- Keep the ticket in its current lifecycle folder. This command does not plan, implement, complete, split, delete, or reclassify tickets.
- When the user asks to split a ticket, follow their requested treatment of the original ticket. Specifications belong to the resulting executable tickets; do not introduce automatic parent or superseded semantics.
