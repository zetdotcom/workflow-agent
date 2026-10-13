---
name: wf
description: "Routes and executes repository-persisted software delivery workflows from change discovery through ticket specification, code-grounded planning, phased implementation, review, completion, archival, and status. Use when the user invokes `wf` or `workflow`, or asks to create, specify, plan, implement, review, complete, archive, or inspect a tracked change or ticket. Supports optional isolated Git worktrees."
license: MIT
compatibility: "Requires filesystem tools and a question/choice prompt. Git is required for worktree mode; package managers are optional."
---

# Workflow Agent

Manage work from initial idea through completed implementation. Support single-ticket changes and multi-ticket epics through one `wf` entry point.

## Router

Determine intent, then read the matching command reference before acting. Paths are relative to this skill directory.

### Global Worktree Modifier

Before normal command routing, detect whether invocation contains `--worktree` in any position or naturally asks to run workflow work in an isolated Git worktree. Worktree intent is an execution modifier, not a command.

When worktree intent is present:

1. Preserve original invocation and inferred command arguments. Remove only explicit `--worktree` tokens from payload that normal command receives.
2. If command intent is missing or ambiguous, resolve it using normal routing behavior before changing repository state.
3. Read and execute `references/worktree.md` before reading command reference. This is exception to one-reference rule below.
4. After setup succeeds, treat selected worktree root as execution root for rest of invocation:
   - Use absolute paths rooted there for every file tool operation.
   - Set that directory as working directory for every Bash operation.
   - Resolve `.workflow/` only there; never read or mutate caller worktree as fallback.
5. Continue preserved command under normal routing and lifecycle rules. If setup stops or is cancelled, do not dispatch command.

Without explicit or natural-language worktree intent, skip setup and preserve existing behavior exactly.

| Command | Purpose | Instructions |
|---|---|---|
| `new` | Start a change | `references/new.md` |
| `discover` | Flesh out context | `references/discover.md` |
| `breakdown` | Split change into tickets | `references/breakdown.md` |
| `specify` | Confirm ticket behavior and scenarios | `references/specify.md` |
| `plan` | Create ticket implementation plan | `references/plan.md` |
| `plan-review` | Optionally review plan | `references/plan-review.md` |
| `implement` | Execute implementation plan | `references/implement.md` |
| `impl-review` | Optionally review code changes | `references/impl-review.md` |
| `complete` | Mark ticket done | `references/complete.md` |
| `archive` | Distill and archive a change | `references/archive.md` |
| `status` | Show progress and next actions | `references/status.md` |

Routing behavior:

1. **No arguments / `wf`**: use Question tool to show command menu. Include command names and purposes from table.
2. **Explicit command** (for example, `wf plan PYE-1123 001`): load its reference and execute it directly.
3. **Natural language** (for example, "I want to start working on something"): infer and execute the command when one route clearly fits. Ask only when materially different commands remain plausible.
4. **Unknown command**: show command menu. Do not guess an unsupported operation.

Read only relevant command reference for current operation. Worktree-modified invocation may additionally read `references/worktree.md` before command reference. If operation changes during conversation, read new command reference before continuing.

## Storage Model

Active workflow data lives in `.workflow/changes/<slug>/`. Archived changes become one distilled record under `.workflow/archive/YYYY-MM-DD-<slug>/`:

```text
.workflow/
  changes/
    <PROJ-123-slug>/
      CONTEXT.md
      STATUS.md
      1.draft/
        001-ticket-slug/
          TICKET.md
          SPEC.md
      2.todo/
      3.in-progress/
      4.done/
  archive/
    2026-12-05-PROJ-122-earlier-change/
      SUMMARY.md
```

Active folder meanings:

- `1.draft/`: new or unplanned tickets
- `2.todo/`: planned tickets ready for implementation
- `3.in-progress/`: tickets currently being implemented or updated
- `4.done/`: implementation completed; PR may be ready for review, ready to merge, merged, or receiving follow-up review changes

Each active ticket is a directory named with a three-digit number, optional letter suffix, and optional slug, such as `001-ticket-slug` or `005a`. Move whole ticket directories between numbered folders as status changes. Directory location is source of truth for ticket lifecycle status. `STATUS.md` is derived progress summary.

Ticket directory files:

- `TICKET.md`: stable goal, delivery boundary, acceptance criteria, testing requirements, risk, dependencies, and technical context; created during breakdown
- `SPEC.md`: optional confirmed user stories, observable scenarios, protected behaviors, and exclusions; created or updated by specification
- `PLAN.md`: detailed, comprehensive, phased implementation plan; created during planning
- `PLAN-BRIEF.md`: concise human-readable explanation of planned changes and data flow; created during planning
- `PROGRESS.md`: phase results, verification, deviations, reopening notes, and PR-feedback work; created when first needed
- `REVIEWS.md`: dated plan and implementation reviews; created when first review runs

An archived change contains only `SUMMARY.md`: outcome, current behavior and invariants, lasting decisions, stable codebase map, operational changes, limits, verification, and references. The physical directory date is the archive date; the original slug remains the logical change identity.

Do not create empty optional files. Commands must read only files relevant to their operation plus `TICKET.md`.

## Resolution Rules

- Never guess when change or ticket selection is ambiguous.
- When user omitted required selection, use Question tool with exact available options.
- Treat each positional argument as a possible change ID, ticket ID, work item ID, or slug fragment. Do not assume first argument is only a change folder.
- Resolve arguments by searching file and folder names first under `.workflow/changes/`, then searching file contents with Grep/ripgrep if name search has no unique match.
- Resolve change before resolving ticket when both are identifiable. Exact folder/file name match wins, then unique case-insensitive ID/name prefix such as `PYE-1123`, then unique content match.
- Ticket-scoped commands may use `<change> <ticket>` addressing, for example `wf implement PYE-1123 001`, or a unique work item ID such as `wf status PYE-11391` when that ID identifies one change or ticket.
- Do not resolve a bare ticket number across all changes. If change is omitted, ask user to select change first.
- Search ticket directories across all four status folders.
- If `.workflow/` does not exist, suggest `wf new` unless current command is `new`.
- Lifecycle commands other than `archive` and archive-aware `status` resolve active data under `.workflow/changes/` only.
- `archive` resolves an active change, while explicit archived status lookup resolves `.workflow/archive/` by physical directory name or logical `change` identity from `SUMMARY.md`.
- Active matches win for ordinary `wf status <identifier>` lookup; archived records are considered only when no active match exists. `wf status archived` explicitly lists archive records.

## Shared Invariants

- `CONTEXT.md` must contain substantive context before breakdown or planning.
- Prefer the project's established domain language. Record concise definitions in `CONTEXT.md` when terms are ambiguous or project-specific.
- Tickets should be vertical tracer bullets: the smallest complete, independently deployable and verifiable behavior through every affected layer. Use horizontal tickets only when an indivisible wide refactor cannot remain green as vertical slices.
- Tickets should take 1-3 days and fit one focused agent session unless an explicit dependency chain requires otherwise.
- Dependencies must form a directed acyclic graph.
- Never create breakdown tickets without user confirmation.
- Ticket specifications are optional and confirmed just in time. When `SPEC.md` exists, it is the source of truth for detailed observable behavior and every scenario and protected behavior must map to verification.
- Plans must be grounded in actual codebase exploration.
- Keep implementation changes minimal and ticket-scoped.
- Plan review and implementation review are optional; warn before bypassing relevant review, but permit explicit override.
- Plans are detailed, comprehensive, and divided into coherent, independently verifiable behavior slices. Each phase leaves the repository in a working state.
- Tests target stable public seams and observable behavior. Runtime smoke evidence is required for a changed runnable surface; tests alone are not proof that the surface works.
- `done` is not immutable. PR feedback changes may update code and ticket notes while ticket remains in `4.done/`.
- `done -> in-progress` is valid when user explicitly requests reopening; record reason and update dates.
- Follow-up work beyond original ticket or PR-review scope should become a new ticket.
- Update `STATUS.md` whenever ticket folders change.
- Suggest the exact `wf <command>` next action after every mutating command.
- Archiving is terminal for workflow metadata but does not imply successful delivery. Every archive records one outcome: `completed`, `cancelled`, `superseded`, or `closed-incomplete`.
- Archive summaries are historical rationale, not canonical current operational documentation. Link current runbooks and docs rather than duplicating instructions that can drift.

## Metadata Feedback Loop

After any command mutates `.workflow/`:

1. Run `bash <skill-root>/scripts/validate-workflow.sh <execution-root>` using the loaded skill directory and active repository/worktree root.
2. Fix metadata violations caused by the operation and rerun until it passes. Do not alter unrelated pre-existing workflow data silently; report it as a blocker.
3. Record the exact command and result in the command output and, for implementation work, in `PROGRESS.md`.

The validator proves storage and lifecycle invariants only. It does not prove code behavior, acceptance criteria, or deployment readiness.

## Date Handling

Use actual current date in `YYYY-MM-DD` format, never placeholder text.

- `CONTEXT.md`: `created` and `updated` in YAML frontmatter
- Every ticket Markdown file: `created` and `updated` in YAML frontmatter
- `STATUS.md`: `updated` in YAML frontmatter
- Update `updated` whenever file content changes
- Ticket latest modification is newest `updated` value among files in its directory
- `SUMMARY.md`: `created`, `updated`, and `archived` in YAML frontmatter; `updated` and `archived` equal the actual archive date when created
- Archive directory date must equal `SUMMARY.md` `archived`; `change` must equal the original active change slug

## Output Rules

- Keep output concise and actionable.
- Use actual `wf <command>` syntax in next-step guidance.
- Report files moved or created, observed runtime behavior, and exact verification commands with results.
- Surface blockers, unverified claims, and unmet prerequisites explicitly.
