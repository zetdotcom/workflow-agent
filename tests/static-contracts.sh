#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL="$ROOT/skills/wf"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

name="$(grep -m1 '^name:' "$SKILL/SKILL.md" | cut -d: -f2- | xargs)"
description="$(grep -m1 '^description:' "$SKILL/SKILL.md" | cut -d: -f2- | xargs)"

[[ "$name" == "$(basename "$SKILL")" ]]
[[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]
[[ -n "$description" && ${#description} -le 1026 ]]
[[ "$(grep -c '^---$' "$SKILL/SKILL.md")" -ge 2 ]]

while IFS= read -r relative; do
  [[ -f "$SKILL/$relative" ]] || {
    echo "Missing referenced file: $relative" >&2
    exit 1
  }
done < <(grep -Eo '(references|scripts)/[a-z0-9./-]+\.(md|sh)' "$SKILL/SKILL.md" | sort -u)

for reference in "$SKILL"/references/*.md; do
  [[ -s "$reference" ]]
done

for script in "$SKILL"/scripts/*.sh; do
  [[ -x "$script" ]]
  bash -n "$script"
done

grep -q '| `specify` |' "$SKILL/SKILL.md"
grep -q 'references/specify.md' "$SKILL/SKILL.md"
grep -q 'references/spec-template.md' "$SKILL/references/specify.md"
grep -q '| `to-pr` |' "$SKILL/SKILL.md"
grep -q 'references/to-pr.md' "$SKILL/SKILL.md"
[[ -f "$SKILL/references/to-pr-template.md" ]]
grep -q 'fresh-agent-dispatch' "$SKILL/references/to-pr.md"
grep -q 'pull-request-create' "$SKILL/references/to-pr.md"
grep -q 'delivered-to-review' "$SKILL/references/to-pr-template.md"
grep -q 'blocked' "$SKILL/references/to-pr-template.md"
grep -q 'optional confirmed user stories' "$SKILL/SKILL.md"
grep -q 'every scenario and protected behavior' "$SKILL/references/plan.md"
grep -q 'every scenario and protected behavior has explicit observed evidence' "$SKILL/references/complete.md"

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq -- "$text" "$file"; then
    echo "Missing contract in $file: $text" >&2
    exit 1
  fi
}

require_text "$SKILL/references/to-pr.md" 'at most three repair'
require_text "$SKILL/references/to-pr.md" 'attempts'
require_text "$SKILL/references/to-pr.md" 'fresh read-only reviewer'
require_text "$SKILL/references/to-pr.md" 'git diff --cached --name-status'
require_text "$SKILL/references/to-pr.md" 'normal non-force push'
require_text "$SKILL/references/to-pr.md" 'never'
require_text "$SKILL/references/to-pr.md" 'duplicate pull request'
require_text "$SKILL/references/to-pr.md" 'draft pull request only'
require_text "$SKILL/references/to-pr.md" 'temporary local directories'
require_text "$SKILL/references/to-pr.md" 'temporary GitHub repositories'
require_text "$SKILL/references/to-pr.md" 'to-pr prerequisite unavailable: <capability>'
require_text "$SKILL/references/to-pr.md" 'reviewer cannot edit code'
require_text "$SKILL/references/to-pr.md" 'append-only repair commits'
require_text "$SKILL/references/to-pr.md" 'Do not mutate the approved `PLAN.md`'
require_text "$SKILL/references/to-pr.md" 'use `playwright-cli` to exercise the affected user flow'
require_text "$SKILL/references/to-pr.md" 'independently repeat the'
require_text "$SKILL/references/to-pr.md" 'complete acceptance flow with `playwright-cli`'
require_text "$SKILL/references/to-pr.md" 'does not stop implementation or pull-request creation'
require_text "$SKILL/references/to-pr.md" 'only draft delivery'
require_text "$SKILL/references/to-pr.md" 'unresolved observed browser failure blocks pull'
require_text "$SKILL/references/to-pr-template.md" 'browser_verification: not-applicable'
for surface in "$ROOT/README.md" "$ROOT/llms.txt" "$ROOT/index.html" "$ROOT/presentation.html"; do
  require_text "$surface" 'wf to-pr'
  require_text "$surface" 'TO-PR.md'
  require_text "$surface" 'delivered-to-review'
  require_text "$surface" 'playwright-cli'
done
require_text "$ROOT/README.md" 'does not claim CI success, merge, or deployment'
require_text "$ROOT/llms.txt" 'does not imply CI success, merge, or deployment'
require_text "$ROOT/index.html" 'optional autonomous path'
require_text "$ROOT/presentation.html" 'Optional autonomous delivery'

LIFECYCLE='new -> discover -> breakdown -> specify? -> plan -> implement -> complete -> archive'

require_text "$ROOT/README.md" "$LIFECYCLE"
require_text "$ROOT/README.md" 'wf specify'
require_text "$ROOT/README.md" 'wf archive'
require_text "$ROOT/README.md" '--worktree'

require_text "$ROOT/llms.txt" "$LIFECYCLE"
require_text "$ROOT/llms.txt" 'wf specify'
require_text "$ROOT/llms.txt" 'wf archive'
require_text "$ROOT/llms.txt" '--worktree'

require_text "$ROOT/index.html" 'wf specify'
require_text "$ROOT/index.html" 'wf archive'
require_text "$ROOT/index.html" '--worktree'

require_text "$ROOT/presentation.html" 'wf specify'
require_text "$ROOT/presentation.html" 'wf archive'
require_text "$ROOT/presentation.html" '--worktree'

AGENTS_SKILLS_DIR="$TMP/skills" "$ROOT/install.sh" >/dev/null
[[ -L "$TMP/skills/wf" ]]
[[ -f "$TMP/skills/wf/SKILL.md" ]]
[[ -x "$TMP/skills/wf/scripts/validate-workflow.sh" ]]

echo "Skill structure and distribution contracts passed."
