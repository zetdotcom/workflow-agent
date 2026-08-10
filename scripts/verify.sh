#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash -n "$ROOT/install.sh" "$ROOT/scripts/verify.sh" "$ROOT/tests/static-contracts.sh" "$ROOT/tests/worktree-git.sh"
"$ROOT/tests/static-contracts.sh"
"$ROOT/tests/worktree-git.sh"

echo "All automated checks passed."
