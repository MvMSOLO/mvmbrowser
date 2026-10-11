#!/usr/bin/env bash
set -Eeuo pipefail

# Parse Chromium's chrome/VERSION file into MAJOR.MINOR.BUILD.PATCH.
# Read-only; no network or build tools required.
# Usage: bash scripts/read-chromium-version.sh /path/to/chrome/VERSION

VERSION_FILE="${1:-}"
if [[ -z "$VERSION_FILE" ]]; then
  echo "ERROR: pass the Chromium chrome/VERSION file path." >&2
  exit 2
fi
if [[ ! -r "$VERSION_FILE" ]]; then
  echo "ERROR: Chromium VERSION file is missing or unreadable: $VERSION_FILE" >&2
  exit 2
fi

read_component() {
  awk -F'= *' -v field="$1" '$1 == field {gsub(/[[:space:]]/, "", $2); print $2; exit}' "$VERSION_FILE"
}

MAJOR="$(read_component MAJOR)"
MINOR="$(read_component MINOR)"
BUILD="$(read_component BUILD)"
PATCH="$(read_component PATCH)"

for component in "$MAJOR" "$MINOR" "$BUILD" "$PATCH"; do
  if ! [[ "$component" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Chromium VERSION file must contain numeric MAJOR, MINOR, BUILD and PATCH fields." >&2
    exit 1
  fi
done

printf '%s.%s.%s.%s\n' "$MAJOR" "$MINOR" "$BUILD" "$PATCH"
