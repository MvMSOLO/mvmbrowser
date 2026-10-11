#!/usr/bin/env bash
set -Eeuo pipefail

# Reproducible first milestone: build the upstream Chromium Android browser.
# Requirements: x86_64 Linux, 16+ GB RAM recommended, 100+ GB free disk,
# Git, Python, and sudo access for Chromium build dependencies.
#
# Usage:
#   bash scripts/build-chromium-android.sh
# Optional:
#   CHROMIUM_ROOT="$HOME/chromium-mvm" DEPOT_TOOLS="$HOME/depot_tools" bash scripts/build-chromium-android.sh

CHROMIUM_ROOT="${CHROMIUM_ROOT:-$HOME/chromium-mvm}"
DEPOT_TOOLS="${DEPOT_TOOLS:-$HOME/depot_tools}"
SRC_DIR="$CHROMIUM_ROOT/src"
OUT_DIR="out/MVM"

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "ERROR: Chromium's official Android build requires x86_64 Linux." >&2
  exit 2
fi

if ! command -v git >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: Install git and python3 before running this script." >&2
  exit 2
fi

mkdir -p "$CHROMIUM_ROOT"

if [[ ! -d "$DEPOT_TOOLS/.git" ]]; then
  echo "==> Downloading Chromium depot_tools"
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$DEPOT_TOOLS"
fi

export PATH="$DEPOT_TOOLS:$PATH"
export DEPOT_TOOLS_UPDATE=1

if [[ ! -d "$SRC_DIR/.git" ]]; then
  if [[ -e "$SRC_DIR" ]]; then
    echo "ERROR: $SRC_DIR exists but is not a Chromium Git checkout." >&2
    exit 2
  fi
  echo "==> Fetching Chromium Android source (large download; may take hours)"
  cd "$CHROMIUM_ROOT"
  fetch --no-history android
fi

cd "$SRC_DIR"

echo "==> Installing official Chromium Linux/Android build dependencies"
sudo build/install-build-deps.sh

echo "==> Syncing Chromium dependencies and hooks"
gclient sync
gclient runhooks

echo "==> Generating arm64 Android browser build"
mkdir -p "$OUT_DIR"
cat > "$OUT_DIR/args.gn" <<'GN_ARGS'
target_os = "android"
target_cpu = "arm64"
is_debug = false
is_component_build = false
symbol_level = 0
use_remoteexec = false
GN_ARGS

gn gen "$OUT_DIR"

echo "==> Building Chromium's complete Android browser target"
autoninja -C "$OUT_DIR" chrome_public_apk

APK="$SRC_DIR/$OUT_DIR/apks/ChromePublic.apk"
if [[ ! -f "$APK" ]]; then
  APK="$(find "$SRC_DIR/$OUT_DIR" -type f -name 'ChromePublic.apk' -print -quit)"
fi
if [[ -z "$APK" || ! -f "$APK" ]]; then
  echo "ERROR: Build completed but ChromePublic.apk was not found under $SRC_DIR/$OUT_DIR." >&2
  echo "Inspect the output above and the generated APK paths before retrying." >&2
  exit 1
fi

DEST="$CHROMIUM_ROOT/MVM-Chromium-arm64-debug.apk"
cp "$APK" "$DEST"
echo
echo "SUCCESS: Upstream Chromium Android browser built."
echo "APK: $DEST"
echo "NOTE: This is an unbranded Chromium proof build, not yet the finished MVM Browser."
