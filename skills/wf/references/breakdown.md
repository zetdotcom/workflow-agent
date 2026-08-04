# `wf breakdown [slug]`

Split change into individual deployable tickets.

## Prerequisites

- Valid `CONTEXT.md` exists and contains substantive content.
- If context remains skeleton-only, stop and suggest `wf discover`.

## Steps

1. Resolve change. If slug omitted, present existing changes with Question tool.
2. Read `CONTEXT.md` and understand full scope.
3. Propose tickets. For each ticket show:
   - Number and title
   - Goal in one sentence
   - Risk: low, medium, or high
   - Dependencies
   - Independently deployable: yes, no, or after `NNN`
4. Ask user to confirm, split, merge, reorder, add, or remove tickets. Iterate until confirmed.
5. Create each ticket directory as `1.draft/NNN-slug/`.
6. Create only `TICKET.md` inside it using `references/ticket-template.md`. Fill Summary and Technical Deep-Dive and set actual `created` and `updated` dates. Do not create plan, progress, or review files yet.
7. Update `STATUS.md` Todo section and actual `updated` date.
8. Report created tickets and suggest `wf plan <change> <ticket>` using resolved change prefix and ticket number.

## Rules

- Never create tickets before explicit user confirmation.
- Each ticket should take 1-3 days maximum. Suggest splitting larger tickets.
- Dependencies must form directed acyclic graph.
- Single-ticket breakdown is valid.
- Summary must be Jira-ready, self-contained, stakeholder-readable, and free of implementation details.
- Technical Deep-Dive is developer/AI-facing: code context, directional approach, likely files, edge cases, and assumption warning.
- Ticket directory name is stable across lifecycle moves.
