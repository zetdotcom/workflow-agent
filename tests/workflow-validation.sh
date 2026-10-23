#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATOR="$ROOT/skills/wf/scripts/validate-workflow.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"
CHANGE="$REPO/.workflow/changes/PROJ-123-checkout"
OTHER_CHANGE="$REPO/.workflow/changes/PROJ-456-refund"
TODAY="2026-10-09"
ARCHIVE_ROOT="$REPO/.workflow/archive"

write_document() {
  local path="$1"
  local created="${2:-yes}"
  mkdir -p "$(dirname "$path")"
  {
    echo '---'
    if [[ "$created" == "yes" ]]; then
      echo "created: $TODAY"
    fi
    echo "updated: $TODAY"
    echo '---'
    echo
    echo '# Fixture'
  } > "$path"
}

write_archive_summary() {
  local path="$1"
  local change="$2"
  local archived="$3"
  local outcome="$4"
  mkdir -p "$(dirname "$path")"
  {
    echo '---'
    echo "change: $change"
    echo "created: $TODAY"
    echo "updated: $TODAY"
    echo "archived: $archived"
    echo "outcome: $outcome"
    echo '---'
    echo
    echo '# Archived Fixture'
  } > "$path"
}

expect_failure() {
  local expected="$1"
  local output
  if output="$("$VALIDATOR" "$REPO" 2>&1)"; then
    echo "Validator unexpectedly passed; expected: $expected" >&2
    exit 1
  fi
  [[ "$output" == *"$expected"* ]] || {
    echo "Validator failed without expected diagnostic: $expected" >&2
    echo "$output" >&2
    exit 1
  }
}

mkdir -p "$CHANGE"/{1.draft,2.todo,3.in-progress,4.done}
write_document "$CHANGE/CONTEXT.md"
write_document "$CHANGE/STATUS.md" no
write_document "$CHANGE/1.draft/001-draft/TICKET.md"
write_document "$CHANGE/1.draft/001-draft/SPEC.md"
"$VALIDATOR" "$REPO" >/dev/null
printf '%s\n' '---' 'created: 2026-10-09' 'updated: invalid' '---' '# Behavior Specification' > "$CHANGE/1.draft/001-draft/SPEC.md"
expect_failure 'invalid or missing updated date: .workflow/changes/PROJ-123-checkout/1.draft/001-draft/SPEC.md'
write_document "$CHANGE/1.draft/001-draft/SPEC.md"
"$VALIDATOR" "$REPO" >/dev/null
write_document "$CHANGE/1.draft/005a/TICKET.md"
"$VALIDATOR" "$REPO" >/dev/null
mkdir -p "$OTHER_CHANGE"/{1.draft,2.todo,3.in-progress,4.done}
write_document "$OTHER_CHANGE/CONTEXT.md"
write_document "$OTHER_CHANGE/STATUS.md" no
write_document "$OTHER_CHANGE/1.draft/001-draft/TICKET.md"
"$VALIDATOR" "$REPO" >/dev/null


write_document "$CHANGE/2.todo/002-planned/TICKET.md"
expect_failure 'missing file: .workflow/changes/PROJ-123-checkout/2.todo/002-planned/PLAN.md'
write_document "$CHANGE/2.todo/002-planned/PLAN.md"
write_document "$CHANGE/2.todo/002-planned/PLAN-BRIEF.md"
"$VALIDATOR" "$REPO" >/dev/null

mkdir -p "$CHANGE/1.draft/002-planned"
write_document "$CHANGE/1.draft/002-planned/TICKET.md"
expect_failure 'duplicate ticket directory across statuses: 002-planned'
rm -rf "$CHANGE/1.draft/002-planned"

write_document "$CHANGE/4.done/003-finished/TICKET.md"
write_document "$CHANGE/4.done/003-finished/PLAN.md"
write_document "$CHANGE/4.done/003-finished/PLAN-BRIEF.md"
expect_failure 'missing file: .workflow/changes/PROJ-123-checkout/4.done/003-finished/PROGRESS.md'
write_document "$CHANGE/4.done/003-finished/PROGRESS.md"
"$VALIDATOR" "$REPO" >/dev/null

write_document "$CHANGE/4.done/003-finished/REVIEWS.md"
printf '%s\n' '---' 'created: 2026-10-09' 'updated: not-a-date' '---' '# Reviews' > "$CHANGE/4.done/003-finished/REVIEWS.md"
expect_failure 'invalid or missing updated date: .workflow/changes/PROJ-123-checkout/4.done/003-finished/REVIEWS.md'
printf '%s\n' '---' 'created: 2026-10-09' 'updated: 2026-10-09' '# Reviews' > "$CHANGE/4.done/003-finished/REVIEWS.md"
expect_failure 'missing YAML frontmatter closer: .workflow/changes/PROJ-123-checkout/4.done/003-finished/REVIEWS.md'


write_document "$CHANGE/4.done/003-finished/REVIEWS.md"
"$VALIDATOR" "$REPO" >/dev/null

TO_PR="$CHANGE/3.in-progress/004-autonomous"
write_document "$TO_PR/TICKET.md"
write_document "$TO_PR/PLAN.md"
write_document "$TO_PR/PLAN-BRIEF.md"
write_document "$TO_PR/PROGRESS.md"
cat > "$TO_PR/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: phase-1
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 1
completed_phases: 0
phase_attempts: 1
review_cycle: 0
delivery_kind: none
runtime_limitation_recorded: no
push_result: success
completion_recorded: no
push_result: none
---
# Autonomous Ticket-to-PR Run
EOF
"$VALIDATOR" "$REPO" >/dev/null

cat > "$TO_PR/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: draft
runtime_limitation_recorded: yes
push_result: success
pr_url: https://github.com/example/repo/pull/1
completion_recorded: yes
runtime_limitation_recorded: yes
push_result: success
---
# Autonomous Ticket-to-PR Run
EOF
mkdir -p "$CHANGE/4.done/004-autonomous"
mv "$TO_PR/TO-PR.md" "$CHANGE/4.done/004-autonomous/TO-PR.md"
mv "$TO_PR/TICKET.md" "$CHANGE/4.done/004-autonomous/TICKET.md"
mv "$TO_PR/PLAN.md" "$CHANGE/4.done/004-autonomous/PLAN.md"
mv "$TO_PR/PLAN-BRIEF.md" "$CHANGE/4.done/004-autonomous/PLAN-BRIEF.md"
mv "$TO_PR/PROGRESS.md" "$CHANGE/4.done/004-autonomous/PROGRESS.md"
rmdir "$TO_PR"
"$VALIDATOR" "$REPO" >/dev/null

cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 1
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: draft
runtime_limitation_recorded: yes
push_result: success
pr_url: https://github.com/example/repo/pull/1
completion_recorded: yes
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'delivered-to-review requires completed phases and no active phase: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'

cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: final-verification
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 0
delivery_kind: draft
runtime_limitation_recorded: yes
push_result: none
completion_recorded: no
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'final-verification TO-PR state cannot contain delivery metadata: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'

cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: unknown
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: draft
pr_url: https://github.com/example/repo/pull/1
completion_recorded: yes
runtime_limitation_recorded: yes
push_result: success
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'invalid TO-PR state: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'
cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity:
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: draft
pr_url: https://github.com/example/repo/pull/1
completion_recorded: yes
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'missing TO-PR spec_identity: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'
cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: ready
runtime_limitation_recorded: no
push_result: success
completion_recorded: yes
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'missing TO-PR pr_url: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'
cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: ready
pr_url: https://github.com/example/repo/pull/1
completion_recorded: no
runtime_limitation_recorded: no
push_result: success
---
# Autonomous Ticket-to-PR Run
EOF
expect_failure 'delivered-to-review requires completion_recorded: yes: .workflow/changes/PROJ-123-checkout/4.done/004-autonomous/TO-PR.md'
cat > "$CHANGE/4.done/004-autonomous/TO-PR.md" <<EOF
---
created: $TODAY
updated: $TODAY
state: delivered-to-review
spec_identity: spec-sha
plan_identity: plan-sha
baseline_head: abc123
baseline_branch: feature/test
baseline_paths_fingerprint: paths-sha
active_phase: 0
completed_phases: 1
phase_attempts: 1
review_cycle: 1
delivery_kind: draft
pr_url: https://github.com/example/repo/pull/1
completion_recorded: yes
runtime_limitation_recorded: yes
push_result: success
---
# Autonomous Ticket-to-PR Run
EOF

ARCHIVE="$ARCHIVE_ROOT/$TODAY-PROJ-789-auth"
write_archive_summary "$ARCHIVE/SUMMARY.md" 'PROJ-789-auth' "$TODAY" 'completed'
"$VALIDATOR" "$REPO" >/dev/null

write_archive_summary "$ARCHIVE/SUMMARY.md" 'PROJ-789-wrong' "$TODAY" 'completed'
expect_failure 'archive change identity does not match directory: .workflow/archive/2026-10-09-PROJ-789-auth/SUMMARY.md'
write_archive_summary "$ARCHIVE/SUMMARY.md" 'PROJ-789-auth' '2026-10-08' 'completed'
expect_failure 'archive date does not match directory: .workflow/archive/2026-10-09-PROJ-789-auth/SUMMARY.md'
write_archive_summary "$ARCHIVE/SUMMARY.md" 'PROJ-789-auth' "$TODAY" 'unknown'
expect_failure 'invalid or missing archive outcome: .workflow/archive/2026-10-09-PROJ-789-auth/SUMMARY.md'
write_archive_summary "$ARCHIVE/SUMMARY.md" 'PROJ-789-auth' "$TODAY" 'closed-incomplete'
printf '%s\n' 'unexpected' > "$ARCHIVE/RAW.md"
expect_failure 'unexpected archive entry: .workflow/archive/2026-10-09-PROJ-789-auth/RAW.md'
rm "$ARCHIVE/RAW.md"

INVALID_ARCHIVE="$ARCHIVE_ROOT/PROJ-999-no-date"
write_archive_summary "$INVALID_ARCHIVE/SUMMARY.md" 'PROJ-999-no-date' "$TODAY" 'cancelled'
expect_failure 'invalid archive directory name: .workflow/archive/PROJ-999-no-date'
rm -rf "$INVALID_ARCHIVE"

DUPLICATE_ARCHIVE="$ARCHIVE_ROOT/$TODAY-PROJ-123-checkout"
write_archive_summary "$DUPLICATE_ARCHIVE/SUMMARY.md" 'PROJ-123-checkout' "$TODAY" 'completed'
expect_failure 'change exists in active and archive storage: PROJ-123-checkout'
rm -rf "$DUPLICATE_ARCHIVE"
"$VALIDATOR" "$REPO" >/dev/null
rm -rf "$CHANGE" "$OTHER_CHANGE"
"$VALIDATOR" "$REPO" >/dev/null

echo "Workflow metadata validation scenarios passed."
