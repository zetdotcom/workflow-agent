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

AGENTS_SKILLS_DIR="$TMP/skills" "$ROOT/install.sh" >/dev/null
[[ -L "$TMP/skills/wf" ]]
[[ -f "$TMP/skills/wf/SKILL.md" ]]
[[ -x "$TMP/skills/wf/scripts/validate-workflow.sh" ]]

echo "Skill structure and distribution contracts passed."
