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

echo "Workflow metadata validation scenarios passed."
