#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq -- "$text" "$file"; then
    echo "Missing contract in $file: $text" >&2
    exit 1
  fi
}

require_text "$ROOT/skills/wf/SKILL.md" 'references/worktree.md'
require_text "$ROOT/skills/wf/SKILL.md" 'selected worktree root as execution root'
require_text "$ROOT/skills/wf/references/worktree.md" 'git worktree list --porcelain'
require_text "$ROOT/skills/wf/references/worktree.md" 'Never add `--force`'
require_text "$ROOT/skills/wf/references/worktree.md" 'npm ci'
require_text "$ROOT/skills/wf/references/worktree.md" 'pnpm install --frozen-lockfile'
require_text "$ROOT/skills/wf/references/worktree.md" 'yarn install --immutable'
require_text "$ROOT/skills/wf/references/worktree.md" 'bun install --frozen-lockfile'
require_text "$ROOT/README.md" 'wf plan PYE-1123 001 --worktree'
require_text "$ROOT/llms.txt" '## Optional worktrees'
require_text "$ROOT/index.html" '<code>--worktree</code>'
require_text "$ROOT/presentation.html" '<code>--worktree</code>'

while IFS= read -r reference; do
  [[ -f "$ROOT/skills/wf/$reference" ]] || {
    echo "Missing referenced file: $reference" >&2
    exit 1
  }
done < <(grep -o 'references/[a-z0-9-]*\.md' "$ROOT/skills/wf/SKILL.md" | sort -u)

AGENTS_SKILLS_DIR="$TMP/skills" "$ROOT/install.sh" >/dev/null
[[ -L "$TMP/skills/wf" ]]
[[ -f "$TMP/skills/wf/SKILL.md" ]]
[[ -f "$TMP/skills/wf/references/worktree.md" ]]

echo "Static and distribution contracts passed."
