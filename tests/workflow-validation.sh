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
