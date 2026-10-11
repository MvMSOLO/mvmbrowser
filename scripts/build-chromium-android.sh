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
CHROMIUM_ROOT="$(cd "$CHROMIUM_ROOT" && pwd)"
SRC_DIR="$CHROMIUM_ROOT/src"

# Fail before a large checkout if the host cannot meet Chromium's
# documented minimums. An override is available only for an intentional test.
FREE_KB="$(df -Pk "$CHROMIUM_ROOT" | awk 'NR==2 {print $4}')"
FREE_GB="$((FREE_KB / 1024 / 1024))"
CHROMIUM_MIN_FREE_GB="${CHROMIUM_MIN_FREE_GB:-100}"
if (( FREE_GB < CHROMIUM_MIN_FREE_GB )); then
  echo "ERROR: only ${FREE_GB} GiB free at $CHROMIUM_ROOT; need at least ${CHROMIUM_MIN_FREE_GB} GiB." >&2
  echo "Chromium's official Android build guide requires at least 100 GB free." >&2
  echo "Free disk space or explicitly set ALLOW_LOW_DISK=1 to bypass this guard." >&2
  if [[ "${ALLOW_LOW_DISK:-0}" != "1" ]]; then
    exit 2
  fi
fi

# Use the lower of host-visible RAM and container/cgroup memory limits.
MEM_KB=0
if [[ -r /proc/meminfo ]]; then
  MEM_KB="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
fi
if [[ -r /sys/fs/cgroup/memory.max ]]; then
  CGROUP_BYTES="$(cat /sys/fs/cgroup/memory.max)"
  if [[ "$CGROUP_BYTES" =~ ^[0-9]+$ ]] && (( CGROUP_BYTES > 0 )); then
    CGROUP_KB="$((CGROUP_BYTES / 1024))"
    if (( MEM_KB == 0 || CGROUP_KB < MEM_KB )); then MEM_KB="$CGROUP_KB"; fi
  fi
elif [[ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]]; then
  CGROUP_BYTES="$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)"
  if [[ "$CGROUP_BYTES" =~ ^[0-9]+$ ]] && (( CGROUP_BYTES > 0 && CGROUP_BYTES < 1099511627776 )); then
    CGROUP_KB="$((CGROUP_BYTES / 1024))"
    if (( MEM_KB == 0 || CGROUP_KB < MEM_KB )); then MEM_KB="$CGROUP_KB"; fi
  fi
fi

if (( MEM_KB > 0 )); then
  MEM_GIB="$((MEM_KB / 1024 / 1024))"
  echo "Detected effective RAM limit: ${MEM_GIB} GiB"
  if (( MEM_GIB < 8 )); then
    echo "ERROR: effective memory limit is ${MEM_GIB} GiB; Chromium's documented minimum is 8 GiB." >&2
    echo "16+ GiB is highly recommended. Set ALLOW_LOW_MEMORY=1 only for an intentional test." >&2
    if [[ "${ALLOW_LOW_MEMORY:-0}" != "1" ]]; then
      exit 2
    fi
  elif (( MEM_GIB < 16 )); then
    echo "WARNING: detected ${MEM_GIB} GiB effective RAM; more than 16 GiB is highly recommended." >&2
  fi
else
  echo "WARNING: could not determine RAM limit; continuing without a memory preflight." >&2
fi

if (( EUID != 0 )) && ! command -v sudo >/dev/null 2>&1; then
  echo "ERROR: sudo is required to install Chromium build dependencies." >&2
  exit 2
fi

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
  fetch --nohooks --no-history android
fi

cd "$SRC_DIR"

echo "==> Installing official Chromium Linux/Android build dependencies"
if (( EUID == 0 )); then
  build/install-build-deps.sh
else
  sudo build/install-build-deps.sh
fi

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

DEST="$CHROMIUM_ROOT/MVM-Chromium-arm64.apk"
cp "$APK" "$DEST"
echo
echo "SUCCESS: Upstream Chromium Android browser built."
echo "APK: $DEST"
echo "NOTE: This is an unbranded Chromium proof build, not yet the finished MVM Browser."
