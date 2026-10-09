# Manual Skill Conformance

Run each case in a fresh agent session against a disposable repository. Record model/runtime version, whether `wf` activated, files read, questions asked, mutations, and exact verification output. Test at least one fast model and one frontier model before release.

## Trigger And Routing

- [ ] `Plan ticket PROJ-123 001 with workflow` activates `wf`, reads `SKILL.md` plus `references/plan.md`, and does not ask which command the user meant.
- [ ] `I have rough notes for a change but the requirements are unclear` routes to `discover`; `I need this change split into deployable tickets` routes to `breakdown`.
- [ ] An ambiguous request such as `Help me with the workflow` presents command choices instead of guessing.
- [ ] `Explain how Git worktrees share object storage` does not activate `wf`; it is a Git question, not workflow execution.
- [ ] `Write a standalone implementation plan for this function` does not mutate `.workflow/` unless the user indicates a tracked workflow ticket.

## Discovery And Breakdown

- [ ] Rich supplied context is synthesized before questions; the agent asks only about consequential gaps and never asks for repository facts it can inspect.
- [ ] Project-specific terms are captured once under Domain Language and used consistently in tickets.
- [ ] A feature spanning database, API, and UI is split into complete user behaviors, not one ticket per layer. Every proposed ticket has observable acceptance criteria and blocking edges.
- [ ] A wide incompatible rename is handled as expand → migrate batches → contract, with the final removal blocked by every migration.
- [ ] No ticket files are created before the user approves the breakdown.

## Planning

- [ ] The agent explores actual code, corrects inaccurate ticket assumptions, and copies check commands from repository configuration rather than inventing them.
- [ ] A version-sensitive framework decision records the installed version and a specific official documentation or changelog URL; unavailable evidence is marked unverified.
- [ ] `PLAN.md` identifies a stable public verification seam, a focused check, and a direct runtime/smoke scenario for each runnable surface.
- [ ] Phases are vertical behavior slices that leave the repository working. Any groundwork phase names its immediate consumer and verification.
- [ ] Planning creates or updates both `PLAN.md` and `PLAN-BRIEF.md`, then the metadata validator passes.

## Implementation And Completion

- [ ] For a bug, the original symptom is observed through a focused reproduction before production code changes; the same scenario is green afterward.
- [ ] For new behavior, a behavior test at the planned public seam is observed failing when practical, then passing after the minimal implementation.
- [ ] For a docs-only change, the agent records why red/runtime evidence is not meaningful and runs the relevant validator instead of inventing a test.
- [ ] Focused checks run after each behavior slice; the full suite runs once after the final relevant code change; unchanged checks are not repeated for reassurance.
- [ ] A runnable UI, CLI, or API is exercised directly. A test-only result is not recorded as runtime proof.
- [ ] `wf complete` refuses a normal completion when final checks, runtime evidence, acceptance criteria, or metadata validation are missing. An explicit override is recorded as unverified, never as passed.

## Progressive Disclosure And State

- [ ] A normal command reads only its command reference plus `TICKET.md` and explicitly required artifacts; unrelated command references remain unloaded.
- [ ] A worktree invocation reads `references/worktree.md` before exactly one command reference and performs all later work in the selected root.
- [ ] `scripts/validate-workflow.sh` catches a missing plan in `2.todo/`, a duplicate ticket directory across statuses, a done ticket without progress, and malformed dates.
