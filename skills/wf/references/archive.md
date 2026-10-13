# `wf archive [change]`

Distill an active change into one durable historical record, then remove its active workflow workspace after explicit confirmation.

## Argument Resolution

Resolve exactly one active change under `.workflow/changes/` using the shared resolution rules in `SKILL.md`. If omitted or ambiguous, present exact active changes. Never archive an existing record or resolve archived records as the source.

## Outcomes

Every archive has exactly one terminal workflow outcome:

- `completed`: intended change delivered
- `cancelled`: intentionally stopped without delivery
- `superseded`: replaced by another change
- `closed-incomplete`: stopped without delivery or replacement

When every ticket is in `4.done/`, recommend `completed` but allow another explicit outcome. When any ticket is in `1.draft/`, `2.todo/`, or `3.in-progress/`, require the user to select an outcome explicitly and provide a reason. Never describe unfinished work as completed.

## Steps

1. Read `CONTEXT.md`, `STATUS.md`, and every existing ticket artifact in the selected change, including optional `SPEC.md` files. Reconcile what was specified, intended, planned, actually implemented, verified, omitted, and left unresolved.
2. Inspect the current repository, current documentation/runbooks, and available Git history needed to verify lasting behavior, code entry points, operational changes, and references. Implementation claims must be supported by repository evidence or `PROGRESS.md`; `SPEC.md`, `PLAN.md`, and `PLAN-BRIEF.md` alone prove intent, not delivery.
3. Determine outcome using the rules above. Require a concise reason for `cancelled`, `superseded`, or `closed-incomplete`. For `superseded`, record the replacement change or reference when known.
4. Use the actual current date as the archive date. Set destination to `.workflow/archive/YYYY-MM-DD-<original-change-slug>/SUMMARY.md`. Stop if that destination directory or file already exists; never merge, overwrite, or add a numeric suffix.
5. Draft `SUMMARY.md` from `references/archive-summary-template.md`:
   - Preserve the original change creation date from `CONTEXT.md` as `created`.
   - Set `change` to the exact original active directory name.
   - Set `updated` and `archived` to the archive date.
   - Set `outcome` to one allowed value.
   - Describe the actual outcome and outcome reason.
   - Record current behavior and durable invariants future maintainers can rely on.
   - Record only lasting decisions: decision, rationale, meaningful rejected alternatives, and conditions for revisiting.
   - Map stable components and entry points, not every touched file or line number.
   - Link canonical current runbooks/docs for operational behavior; do not turn historical text into the only current instruction source.
   - Record known limits and every unfinished ticket or acceptance criterion.
   - Summarize observed verification without promoting missing evidence to a pass.
   - Include useful PR, commit, issue, ADR, runbook, and replacement-change references.
   - Omit empty optional subsections; do not invent evidence or references.
6. Before any mutation, show:
   - the complete proposed `SUMMARY.md`;
   - the destination path;
   - the selected outcome and a prominent warning when work is incomplete;
   - every file and directory under the active change that will be removed.
7. Ask for explicit confirmation to create the archive and remove the active change. Declining or cancelling leaves the filesystem unchanged.
8. After confirmation, create the destination directory and `SUMMARY.md`, then remove the whole `.workflow/changes/<slug>/` directory. If source removal fails, retain and report both copies; never claim archival succeeded.
9. Run the metadata validator required by `SKILL.md`. Fix violations caused by archival and rerun until it passes. Do not silently alter unrelated workflow data.
10. Report the created summary path, removed active path, outcome, incomplete-work warning when applicable, and exact validator command/result. Suggest `wf status archived <change>` to inspect the record.

## Rules

- Archival is destructive only after a complete preview and explicit confirmation.
- Any active change may be archived; eligibility never changes the evidence standard.
- `completed` is invalid when repository/progress evidence contradicts delivery. Ask the user to choose an accurate outcome instead of suppressing contradictions.
- `SUMMARY.md` is a synthesis, not a concatenation of source files.
- Do not copy raw context, detailed plans, chronological progress logs, ticket lifecycle bookkeeping, or review transcripts into the archive.
- Git history remains the raw audit trail. The summary preserves durable rationale and references needed for future codebase exploration.
- Archived records are immutable historical snapshots. Later corrections may update `SUMMARY.md` and its `updated` date, but must not rename the directory or change `archived`.
