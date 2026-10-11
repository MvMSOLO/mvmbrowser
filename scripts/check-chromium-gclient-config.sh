#!/usr/bin/env bash
set -Eeuo pipefail

# Safely validate that a Chromium checkout's .gclient explicitly targets Android.
# The Python config is parsed with ast.literal_eval; it is never executed.
# Usage: bash scripts/check-chromium-gclient-config.sh /path/to/.gclient

GCLIENT_FILE="${1:-}"
if [[ -z "$GCLIENT_FILE" ]]; then
  echo "ERROR: pass the checkout's .gclient file path." >&2
  exit 2
fi
if [[ ! -r "$GCLIENT_FILE" ]]; then
  echo "ERROR: .gclient file is missing or unreadable: $GCLIENT_FILE" >&2
  exit 2
fi

python3 - "$GCLIENT_FILE" <<'PY'
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
except (OSError, SyntaxError, UnicodeError) as error:
    print(f"ERROR: could not parse .gclient safely: {error}", file=sys.stderr)
    raise SystemExit(2)

target_os = None
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        isinstance(target, ast.Name) and target.id == "target_os"
        for target in node.targets
    ):
        try:
            target_os = ast.literal_eval(node.value)
        except (ValueError, TypeError):
            print("ERROR: .gclient target_os must be a literal list or tuple.", file=sys.stderr)
            raise SystemExit(2)
        break

if not isinstance(target_os, (list, tuple)) or not all(
    isinstance(item, str) for item in target_os
):
    print("ERROR: .gclient must explicitly define target_os as a list or tuple.", file=sys.stderr)
    raise SystemExit(2)

if "android" not in target_os:
    print(
        f"ERROR: .gclient target_os is {target_os!r}; Android is missing. "
        "Configure target_os to include 'android' and run gclient sync.",
        file=sys.stderr,
    )
    raise SystemExit(1)

print(f"CONFIG CHECK PASSED: .gclient target_os includes Android ({target_os!r}).")
PY
