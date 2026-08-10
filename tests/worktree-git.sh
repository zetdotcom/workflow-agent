#!/usr/bin/env bash
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

REPO="$TMP/sample"
git init -q -b main "$REPO"
git -C "$REPO" config user.name "Workflow Test"
git -C "$REPO" config user.email "workflow@example.invalid"
printf 'base\n' > "$REPO/file.txt"
git -C "$REPO" add file.txt
git -C "$REPO" commit -qm base
BASE="$(git -C "$REPO" rev-parse HEAD)"

git -C "$REPO" worktree add -q -b feature/test "$TMP/sample-feature-test" "$BASE"
[[ "$(git -C "$TMP/sample-feature-test" symbolic-ref --short HEAD)" == "feature/test" ]]
[[ "$(git -C "$REPO" rev-parse HEAD)" == "$BASE" ]]

git -C "$REPO" worktree add -q --detach "$TMP/sample-detached" "$BASE"
if git -C "$TMP/sample-detached" symbolic-ref -q HEAD >/dev/null; then
  echo "Detached worktree unexpectedly has a branch" >&2
  exit 1
fi

if git -C "$REPO" worktree add "$TMP/occupied" feature/test >/dev/null 2>&1; then
  echo "Occupied branch was checked out twice" >&2
  exit 1
fi

if git -C "$REPO" rev-parse --verify 'missing-ref^{commit}' >/dev/null 2>&1; then
  echo "Invalid ref unexpectedly resolved" >&2
  exit 1
fi

REGISTERED="$(git -C "$REPO" worktree list --porcelain)"
[[ "$REGISTERED" == *"worktree $TMP/sample-feature-test"* ]]
[[ "$REGISTERED" == *"branch refs/heads/feature/test"* ]]

mkdir "$TMP/sample-collision"
CANDIDATE="$TMP/sample-collision"
suffix=2
while [[ -e "$CANDIDATE" ]]; do
  CANDIDATE="$TMP/sample-collision-$suffix"
  suffix=$((suffix + 1))
done
[[ "$CANDIDATE" == "$TMP/sample-collision-2" ]]
[[ -d "$TMP/sample-collision" ]]

echo "Disposable Git worktree recipes passed."
