#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only provenance guard for the Chromium source checkout.
# No network, package installs, build actions, or repository changes.
# Usage: bash scripts/check-chromium-source-clean.sh /path/to/chromium/src

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: pass the Chromium src directory as the first argument." >&2
  exit 2
fi
if [[ ! -d "$ROOT" ]]; then
  echo "ERROR: source directory does not exist: $ROOT" >&2
  exit 2
fi
if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: source directory is not inside a Git worktree: $ROOT" >&2
  exit 2
fi

REVISION="$(git -C "$ROOT" rev-parse --verify HEAD)"
if ! [[ "$REVISION" =~ ^[0-9a-fA-F]{40}$ ]]; then
  echo "ERROR: could not resolve HEAD to a full Git commit hash." >&2
  exit 2
fi

STATUS="$(git -C "$ROOT" status --porcelain --untracked-files=normal)"
if [[ -n "$STATUS" ]]; then
  echo "SOURCE CHECK FAILED: Chromium checkout has tracked or untracked changes." >&2
  printf '%s\n' "$STATUS" >&2
  echo "Commit, stash, or remove local source changes before building." >&2
  exit 1
fi

echo "SOURCE CHECK PASSED: Chromium checkout is clean."
echo "Source directory: $(cd "$ROOT" && pwd)"
echo "Chromium revision: $REVISION"
