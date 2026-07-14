#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

echo "workflow-agent installer"
echo "========================"
echo "Source:      $SKILLS_SRC"
echo "Destination: $SKILLS_DST"
echo ""

mkdir -p "$SKILLS_DST"

linked=0
skipped=0

for skill_dir in "$SKILLS_SRC"/wf-*/; do
  name="$(basename "$skill_dir")"
  target="$SKILLS_DST/$name"

  if [[ -e "$target" || -L "$target" ]]; then
    if $FORCE; then
      rm -rf "$target"
    else
      echo "SKIP: $target already exists (use --force to overwrite)"
      skipped=$((skipped + 1))
      continue
    fi
  fi

  ln -s "$skill_dir" "$target"
  echo "  OK: $target -> $skill_dir"
  linked=$((linked + 1))
done

echo ""
echo "Done. Linked: $linked, Skipped: $skipped"
