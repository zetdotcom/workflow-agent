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
