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
#   CHROMIUM_REVISION=<commit-or-ref> bash scripts/build-chromium-android.sh

CHROMIUM_ROOT="${CHROMIUM_ROOT:-$HOME/chromium-mvm}"
DEPOT_TOOLS="${DEPOT_TOOLS:-$HOME/depot_tools}"
CHROMIUM_REVISION="${CHROMIUM_REVISION:-}"
DEPOT_TOOLS_REVISION="${DEPOT_TOOLS_REVISION:-}"
DEPOT_TOOLS_UPDATE="${DEPOT_TOOLS_UPDATE:-1}"
CHROMIUM_MIN_FREE_GB="${CHROMIUM_MIN_FREE_GB:-100}"
ALLOW_LOW_DISK="${ALLOW_LOW_DISK:-0}"
ALLOW_LOW_MEMORY="${ALLOW_LOW_MEMORY:-0}"
ALLOW_UNKNOWN_MEMORY="${ALLOW_UNKNOWN_MEMORY:-0}"
SRC_DIR="$CHROMIUM_ROOT/src"
OUT_DIR="out/MVM"

# Chromium's own checkout instructions require paths without whitespace.
if [[ "$CHROMIUM_ROOT" =~ [[:space:]] || "$DEPOT_TOOLS" =~ [[:space:]] ]]; then
  echo "ERROR: Chromium and depot_tools paths must not contain whitespace." >&2
  exit 2
fi

if ! [[ "$CHROMIUM_MIN_FREE_GB" =~ ^[0-9]+$ ]] || (( CHROMIUM_MIN_FREE_GB < 1 )); then
  echo "ERROR: CHROMIUM_MIN_FREE_GB must be a positive whole number." >&2
  exit 2
fi
for flag_name in ALLOW_LOW_DISK ALLOW_LOW_MEMORY ALLOW_UNKNOWN_MEMORY; do
  flag_value="${!flag_name}"
  if [[ "$flag_value" != "0" && "$flag_value" != "1" ]]; then
    echo "ERROR: $flag_name must be set to 0 or 1." >&2
    exit 2
  fi
done
if [[ -n "$CHROMIUM_REVISION" ]] && ! [[ "$CHROMIUM_REVISION" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]; then
  echo "ERROR: CHROMIUM_REVISION contains unsupported characters." >&2
  exit 2
fi
if [[ -n "$DEPOT_TOOLS_REVISION" ]] && ! [[ "$DEPOT_TOOLS_REVISION" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]]; then
  echo "ERROR: DEPOT_TOOLS_REVISION contains unsupported characters." >&2
  exit 2
fi
if [[ "$DEPOT_TOOLS_UPDATE" != "0" && "$DEPOT_TOOLS_UPDATE" != "1" ]]; then
  echo "ERROR: DEPOT_TOOLS_UPDATE must be set to 0 or 1." >&2
  exit 2
fi

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
if (( FREE_GB < CHROMIUM_MIN_FREE_GB )); then
  echo "ERROR: only ${FREE_GB} GiB free at $CHROMIUM_ROOT; need at least ${CHROMIUM_MIN_FREE_GB} GiB." >&2
  echo "Chromium's official Android build guide requires at least 100 GB free." >&2
  echo "Free disk space or explicitly set ALLOW_LOW_DISK=1 to bypass this guard." >&2
  if [[ "$ALLOW_LOW_DISK" != "1" ]]; then
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
    if [[ "$ALLOW_LOW_MEMORY" != "1" ]]; then
      exit 2
    fi
  elif (( MEM_GIB < 16 )); then
    echo "WARNING: detected ${MEM_GIB} GiB effective RAM; more than 16 GiB is highly recommended." >&2
  fi
else
  echo "ERROR: could not determine an effective RAM limit; refusing to start a large checkout." >&2
  echo "Confirm /proc/meminfo or cgroup memory data, or set ALLOW_UNKNOWN_MEMORY=1 for an intentional override." >&2
  if [[ "$ALLOW_UNKNOWN_MEMORY" != "1" ]]; then
    exit 2
  fi
fi

if (( EUID != 0 )); then
  if ! command -v sudo >/dev/null 2>&1; then
    echo "ERROR: sudo is required to install Chromium build dependencies." >&2
    exit 2
  fi
  if ! sudo -n true >/dev/null 2>&1; then
    echo "ERROR: sudo is not available non-interactively. Configure the intended build host before starting a large checkout." >&2
    echo "For a personal interactive session, confirm sudo access first, then rerun this script." >&2
    exit 2
  fi
fi

if [[ ! -d "$DEPOT_TOOLS/.git" ]]; then
  if [[ -e "$DEPOT_TOOLS" ]]; then
    echo "ERROR: $DEPOT_TOOLS exists but is not a depot_tools Git checkout." >&2
    echo "Move it aside or set DEPOT_TOOLS to a clean path before continuing." >&2
    exit 2
  fi
  echo "==> Downloading Chromium depot_tools"
  git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git "$DEPOT_TOOLS"
fi

if [[ -n "$DEPOT_TOOLS_REVISION" ]]; then
  echo "==> Resolving and pinning depot_tools revision: $DEPOT_TOOLS_REVISION"
  if [[ "$DEPOT_TOOLS_REVISION" =~ ^[0-9a-fA-F]{40}$ ]] && git -C "$DEPOT_TOOLS" cat-file -e "${DEPOT_TOOLS_REVISION}^{commit}" 2>/dev/null; then
    PINNED_DEPOT_TOOLS="$(git -C "$DEPOT_TOOLS" rev-parse --verify "${DEPOT_TOOLS_REVISION}^{commit}")"
  else
    git -C "$DEPOT_TOOLS" fetch --no-tags origin "$DEPOT_TOOLS_REVISION"
    PINNED_DEPOT_TOOLS="$(git -C "$DEPOT_TOOLS" rev-parse --verify 'FETCH_HEAD^{commit}')"
  fi
  git -C "$DEPOT_TOOLS" checkout --detach "$PINNED_DEPOT_TOOLS"
  DEPOT_TOOLS_UPDATE=0
fi

export PATH="$DEPOT_TOOLS:$PATH"
export DEPOT_TOOLS_UPDATE

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

if [[ -n "$CHROMIUM_REVISION" ]]; then
  echo "==> Resolving and pinning Chromium revision: $CHROMIUM_REVISION"
  # Reuse a full commit already available locally. Branch/tag names are fetched
  # explicitly and resolved through FETCH_HEAD, so stale local branches do not win.
  if [[ "$CHROMIUM_REVISION" =~ ^[0-9a-fA-F]{40}$ ]] && git cat-file -e "${CHROMIUM_REVISION}^{commit}" 2>/dev/null; then
    PINNED_REVISION="$(git rev-parse --verify "${CHROMIUM_REVISION}^{commit}")"
  else
    git fetch --no-tags origin "$CHROMIUM_REVISION"
    PINNED_REVISION="$(git rev-parse --verify 'FETCH_HEAD^{commit}')"
  fi
  git checkout --detach "$PINNED_REVISION"
fi

echo "==> Installing official Chromium Linux/Android build dependencies"
if (( EUID == 0 )); then
  build/install-build-deps.sh --no-prompt
else
  sudo build/install-build-deps.sh --no-prompt
fi

echo "==> Syncing Chromium dependencies without running hooks twice"
gclient sync --nohooks
echo "==> Running Chromium hooks once"
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
METADATA="$CHROMIUM_ROOT/MVM-Chromium-arm64.metadata.txt"
ARGS_COPY="$CHROMIUM_ROOT/MVM-Chromium-arm64.args.gn"
cp "$APK" "$DEST"
cp "$OUT_DIR/args.gn" "$ARGS_COPY"
BUILD_REVISION="$(git rev-parse HEAD)"
DEPOT_TOOLS_REVISION_ACTUAL="$(git -C "$DEPOT_TOOLS" rev-parse HEAD)"
APK_SHA256="$(sha256sum "$DEST" | awk '{print $1}')"
GN_ARGS_SHA256="$(sha256sum "$ARGS_COPY" | awk '{print $1}')"
BUILD_DATE_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
HOST_OS="$(uname -sr)"
HOST_ARCH="$(uname -m)"
cat > "$METADATA" <<BUILD_METADATA
MVM Browser upstream Chromium proof-build metadata
build_date_utc=$BUILD_DATE_UTC
host_os=$HOST_OS
host_arch=$HOST_ARCH
chromium_revision=$BUILD_REVISION
depot_tools_revision=$DEPOT_TOOLS_REVISION_ACTUAL
depot_tools_auto_update=$DEPOT_TOOLS_UPDATE
target_os=android
target_cpu=arm64
gn_args_file=$(basename "$ARGS_COPY")
gn_args_sha256=$GN_ARGS_SHA256
apk_file=$(basename "$DEST")
apk_sha256=$APK_SHA256
BUILD_METADATA
echo
echo "SUCCESS: Upstream Chromium Android browser built."
echo "APK: $DEST"
echo "Metadata: $METADATA"
echo "GN args: $ARGS_COPY"
echo "Chromium revision: $BUILD_REVISION"
echo "depot_tools revision: $DEPOT_TOOLS_REVISION_ACTUAL"
echo "GN args SHA-256: $GN_ARGS_SHA256"
echo "APK SHA-256: $APK_SHA256"
echo "NOTE: This is an unbranded Chromium proof build, not yet the finished MVM Browser."
