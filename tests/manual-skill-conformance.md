# Manual Skill Conformance

Run each case in a fresh agent session against a disposable repository. Record model/runtime version, whether `wf` activated, files read, questions asked, mutations, and exact verification output. Test at least one fast model and one frontier model before release.

## Trigger And Routing

- [ ] `Plan ticket PROJ-123 001 with workflow` activates `wf`, reads `SKILL.md` plus `references/plan.md`, and does not ask which command the user meant.
- [ ] `I have rough notes for a change but the requirements are unclear` routes to `discover`; `I need this change split into deployable tickets` routes to `breakdown`.
- [ ] `Specify behavior for PROJ-123 001` routes to `specify`, reads `SKILL.md` plus `references/specify.md`, and does not route to breakdown or planning.
- [ ] An ambiguous request such as `Help me with the workflow` presents command choices instead of guessing.
- [ ] `Explain how Git worktrees share object storage` does not activate `wf`; it is a Git question, not workflow execution.
- [ ] `Write a standalone implementation plan for this function` does not mutate `.workflow/` unless the user indicates a tracked workflow ticket.

## Discovery And Breakdown

- [ ] Rich supplied context is synthesized before questions; the agent asks only about consequential gaps and never asks for repository facts it can inspect.
- [ ] Project-specific terms are captured once under Domain Language and used consistently in tickets.
- [ ] A feature spanning database, API, and UI is split into complete user behaviors, not one ticket per layer. Every proposed ticket has observable acceptance criteria and blocking edges.
- [ ] A wide incompatible rename is handled as expand → migrate batches → contract, with the final removal blocked by every migration.
- [ ] No ticket files are created before the user approves the breakdown.

## Ticket Specification

- [ ] `wf specify PROJ-123 001` drafts user stories, observable GIVEN/WHEN/THEN scenarios, protected behaviors, and exclusions without prescribing implementation.
- [ ] The agent presents the complete specification and does not create or update `SPEC.md` until the user explicitly confirms it.
- [ ] Specification is just in time: tickets without `SPEC.md` remain valid, and specifying one ticket does not create placeholders for sibling tickets.
- [ ] Updating an existing specification preserves its `created` date, updates its `updated` date, keeps unchanged scenario headings stable, and reruns metadata validation.
- [ ] A request to split a ticket follows the user's instruction to delete, retain as parent, or narrow the original; `wf specify` introduces no lifecycle state or automatic parent semantics.

## Planning

- [ ] The agent explores actual code, corrects inaccurate ticket assumptions, and copies check commands from repository configuration rather than inventing them.
- [ ] A version-sensitive framework decision records the installed version and a specific official documentation or changelog URL; unavailable evidence is marked unverified.
- [ ] `PLAN.md` identifies a stable public verification seam, a focused check, and a direct runtime/smoke scenario for each runnable surface.
- [ ] Phases are vertical behavior slices that leave the repository working. Any groundwork phase names its immediate consumer and verification.
- [ ] Planning creates or updates both `PLAN.md` and `PLAN-BRIEF.md`, then the metadata validator passes.
- [ ] When `SPEC.md` exists, `PLAN.md` maps every scenario and protected behavior to a stable verification seam and planned evidence without duplicating or reinterpreting the specification.

## Implementation And Completion

- [ ] For a bug, the original symptom is observed through a focused reproduction before production code changes; the same scenario is green afterward.
- [ ] For new behavior, a behavior test at the planned public seam is observed failing when practical, then passing after the minimal implementation.
- [ ] For a docs-only change, the agent records why red/runtime evidence is not meaningful and runs the relevant validator instead of inventing a test.
- [ ] Focused checks run after each behavior slice; the full suite runs once after the final relevant code change; unchanged checks are not repeated for reassurance.
- [ ] A runnable UI, CLI, or API is exercised directly. A test-only result is not recorded as runtime proof.
- [ ] `wf complete` refuses a normal completion when final checks, runtime evidence, acceptance criteria, or metadata validation are missing. An explicit override is recorded as unverified, never as passed.
- [ ] When `SPEC.md` exists, implementation records evidence against every scenario and protected behavior, review identifies uncovered behavior, and completion does not pass missing coverage.
- [ ] A material behavior mismatch stops planning or implementation and returns to `wf specify` for user confirmation; the agent never rewrites the specification merely to match code.

## Archival

- [ ] `wf archive <change>` reads all source artifacts and repository evidence, distinguishes planned from delivered behavior, and proposes exactly one `SUMMARY.md` under `YYYY-MM-DD-<original-change-slug>`.
- [ ] A fully done change recommends `completed`; a change with draft, todo, or in-progress tickets requires an explicit terminal outcome and reason, and lists unfinished work without presenting it as delivered.
- [ ] Before mutation, the agent shows the complete summary, destination, outcome warning, and deletion manifest. Declining confirmation leaves `.workflow/` byte-for-byte unchanged.
- [ ] Confirming creates the dated summary before removing the active directory, runs the validator, and reports both paths and exact result. An existing destination is never overwritten or suffixed.
- [ ] `wf status archived` lists only archive records; archived identity lookup works with the dated directory, original slug, and unique ID prefix. Ordinary lifecycle commands do not resolve archived changes.
- [ ] Planning searches archive summaries only after code exploration and reads only matches for verified paths, symbols, components, or domain terms; historical operational text never overrides current runbooks.

## Progressive Disclosure And State

- [ ] A normal command reads only its command reference plus `TICKET.md` and explicitly required artifacts; unrelated command references remain unloaded.
- [ ] A worktree invocation reads `references/worktree.md` before exactly one command reference and performs all later work in the selected root.
- [ ] `scripts/validate-workflow.sh` catches a missing plan in `2.todo/`, a duplicate ticket directory across statuses, a done ticket without progress, malformed dates, invalid archive names/outcomes, archive identity/date mismatches, unexpected archive files, and active/archive identity collisions.
