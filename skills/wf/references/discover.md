# `wf discover [slug]`

Interview user to build complete `CONTEXT.md` between `wf new` and `wf breakdown`.

## Steps

1. Resolve change. If slug omitted, present existing changes with Question tool.
2. Read existing `CONTEXT.md`; identify clear, incomplete, and unresolved areas. Resolve factual questions from repository files and existing documentation before asking the user.
3. State consequential assumptions already implied by the supplied context and ask the user to correct them. Do not ask them to repeat facts available in the repository.
4. Interview user with 1-3 tightly related questions at a time. Cover only relevant gaps:
   - Problem and goal: what, why, users, observable success criteria
   - Current state: existing behavior and pain points
   - Desired state: intended behavior and key flows
   - Boundaries: in/out of scope and constraints
   - Domain language: project-specific terms whose meaning affects design or acceptance
   - Dependencies and risks: external dependencies, ordering, blast radius
   - Rollout: deployment, migrations, rollback
5. Adapt depth to scope. Small refactors need fewer questions. Stop when each requested behavior has testable acceptance criteria and unresolved decisions are explicit.
6. Rewrite `CONTEXT.md` using `references/context-template.md` structure. Preserve original raw context at bottom. Update actual `updated` date.
7. Present synthesis, assumptions, and open questions; ask whether anything is missing or wrong. Iterate until confirmed.
8. Suggest `wf breakdown`.

## Rules

- If user already supplied rich context, synthesize first and ask only about consequential gaps.
- Never delete raw context.
- Keep context proportional to change size; omit empty optional discussion rather than inventing content.
- Record unresolved questions explicitly rather than guessing.
- Use one term consistently for each domain concept.
