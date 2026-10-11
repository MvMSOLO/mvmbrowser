#!/usr/bin/env bash
set -uo pipefail

# Read-only host suitability report for an upstream Chromium Android build.
# This script does not download code, install packages, require sudo, or create
# cloud resources. Use: bash scripts/check-chromium-build-host.sh

ROOT="\${CHROMIUM_ROOT:-$HOME/chromium-mvm}"
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "BLOCKED: Chromium Android builds require x86-64 Linux."
  echo "Detected: $(uname -s) / $(uname -m)"
  exit 2
fi

echo "Chromium Android build-host report"
echo "Target checkout path: $ROOT"
echo "CPU threads visible: $(getconf _NPROCESSORS_ONLN 2>/dev/null || echo unknown)"

if [[ -r /proc/meminfo ]]; then
  MEM_KB="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  MEM_GIB="$((MEM_KB / 1024 / 1024))"
  echo "Detected RAM: \${MEM_GIB} GiB"
else
  MEM_GIB=0
  echo "Detected RAM: unknown (/proc/meminfo unavailable)"
fi

DISK_BASE="$ROOT"
while [[ ! -d "$DISK_BASE" && "$DISK_BASE" != "/" ]]; do
  DISK_BASE="$(dirname "$DISK_BASE")"
done
FREE_KB="$(df -Pk "$DISK_BASE" | awk 'NR==2 {print $4}')"
FREE_GIB="$((FREE_KB / 1024 / 1024))"
echo "Disk path checked: $DISK_BASE"
echo "Free disk: \${FREE_GIB} GiB"

if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  echo "Linux distribution: \${PRETTY_NAME:-unknown}"
fi

blocked=0
if (( MEM_GIB < 8 )); then
  echo "BLOCKED: official minimum is 8 GiB RAM; 16+ GiB is highly recommended."
  blocked=1
elif (( MEM_GIB < 16 )); then
  echo "WARNING: RAM meets the stated minimum but is below the recommended 16+ GiB."
else
  echo "RAM: OK"
fi

if (( FREE_GIB < 100 )); then
  echo "BLOCKED: need at least 100 GiB free for checkout/build; more headroom is safer."
  blocked=1
else
  echo "Disk: OK"
fi

if [[ -r /etc/os-release ]]; then
  case "\${ID:-unknown}" in
    ubuntu|debian) echo "Distribution family: supported starting point" ;;
    *) echo "WARNING: Ubuntu is the primary Chromium build environment; this distribution may need extra work." ;;
  esac
fi

if (( blocked )); then
  echo "RESULT: NOT READY — do not start the large Chromium checkout on this host."
  exit 1
fi

echo "RESULT: basic requirements pass. This checks hardware only; it does not verify network, packages, disk performance, or a successful build."
