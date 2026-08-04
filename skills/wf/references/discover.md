# `wf discover [slug]`

Interview user to build complete `CONTEXT.md` between `wf new` and `wf breakdown`.

## Steps

1. Resolve change. If slug omitted, present existing changes with Question tool.
2. Read existing `CONTEXT.md`; identify clear, incomplete, and unresolved areas.
3. Interview user with 2-3 questions at a time. Cover only relevant gaps:
   - Problem and goal: what, why, users, success criteria
   - Current state: existing behavior and pain points
   - Desired state: intended behavior and key flows
   - Boundaries: in/out of scope and constraints
   - Dependencies and risks: external dependencies, ordering, blast radius
   - Rollout: deployment, migrations, rollback
4. Adapt depth to scope. Small refactors need fewer questions. Stop when context is sufficient to create tickets.
5. Rewrite `CONTEXT.md` using `references/context-template.md` structure. Preserve original raw context at bottom. Update actual `updated` date.
6. Present synthesis and ask whether anything is missing or wrong. Iterate until confirmed.
7. Suggest `wf breakdown`.

## Rules

- If user already supplied rich context, synthesize first and ask only about gaps.
- Never delete raw context.
- Keep context proportional to change size.
- Record unresolved questions explicitly rather than guessing.
