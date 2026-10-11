#!/usr/bin/env bash
set -Eeuo pipefail

# Build the pinned upstream Cromite Android ARM64 APK in Cromite's published
# build image. Safe by default: without --execute this only prints the plan.
#
# Requirements: x86_64 Linux, Docker Engine, >= 16 GiB RAM recommended,
# >= 150 GiB free disk, network access for pulling the image.
#
# Usage:
#   bash scripts/build-cromite-android.sh
#   bash scripts/build-cromite-android.sh --execute
#   OUTPUT_DIR="$PWD/artifacts/cromite" bash scripts/build-cromite-android.sh --execute

readonly CROMITE_VERSION="153.0.8010.37"
readonly CROMITE_SHA="11507ac1061b5ea227806f5e84db5a57df6ccf6a"
readonly IMAGE="uazo/cromite-build:${CROMITE_VERSION}-${CROMITE_SHA}"
readonly EXPECTED_RELEASE_APK_SHA256="9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071"
readonly MIN_FREE_GIB="${CROMITE_MIN_FREE_GIB:-150}"
readonly OUTPUT_DIR="${OUTPUT_DIR:-$PWD/artifacts/cromite}"
EXECUTE=0

if [[ "${1:-}" == "--execute" && $# -eq 1 ]]; then
  EXECUTE=1
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--execute]" >&2
  exit 2
fi

if ! [[ "$MIN_FREE_GIB" =~ ^[0-9]+$ ]] || (( MIN_FREE_GIB < 1 )); then
  echo "ERROR: CROMITE_MIN_FREE_GIB must be a positive whole number." >&2
  exit 2
fi

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "ERROR: the pinned Cromite Android build image requires an x86_64 Linux Docker host." >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker Engine is required; this script will not install it automatically." >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR="$(cd "$OUTPUT_DIR" && pwd)"
FREE_KB="$(df -Pk "$OUTPUT_DIR" | awk 'NR==2 {print $4}')"
FREE_GIB="$((FREE_KB / 1024 / 1024))"
echo "Cromite version: $CROMITE_VERSION"
echo "Cromite commit:  $CROMITE_SHA"
echo "Build image:     $IMAGE"
echo "Output folder:   $OUTPUT_DIR"
echo "Free disk:       ${FREE_GIB} GiB (minimum ${MIN_FREE_GIB} GiB)"
echo "Expected upstream release APK SHA-256: $EXPECTED_RELEASE_APK_SHA256"

if (( FREE_GIB < MIN_FREE_GIB )); then
  echo "ERROR: insufficient free disk for a large Chromium build. Free space or set CROMITE_MIN_FREE_GIB intentionally." >&2
  exit 2
fi

if (( EXECUTE == 0 )); then
  cat <<PLAN

DRY RUN ONLY — nothing has been downloaded or built.
To start the long-running build explicitly, rerun:
  $0 --execute

This will pull the pinned public Cromite build image and compile the Android
ARM64 browser. The output will be a Cromite-based prototype, not yet a
rebranded or security-approved MVM Browser. A new APK will not match the
official release APK checksum above; that checksum is for the upstream
prebuilt release only.
PLAN
  exit 0
fi

echo "==> Checking Docker daemon"
docker info >/dev/null
echo "==> Pulling pinned official Cromite build image"
docker pull "$IMAGE"

echo "==> Building Cromite Android ARM64 APK (may take hours)"
docker run --rm \
  --user lg \
  --env WORKSPACE=/home/lg/working_dir \
  --env HOME=/home/lg/working_dir \
  --env TARGET_ISDEBUG=false \
  --volume "$OUTPUT_DIR:/mvm-output" \
  --entrypoint /bin/bash \
  "$IMAGE" -lc '
    set -Eeuo pipefail
    export PATH="$WORKSPACE/chromium/src/third_party/llvm-build/Release+Asserts/bin:$WORKSPACE/depot_tools:/usr/local/go/bin:$WORKSPACE/mtool/bin:$PATH"
    cd "$WORKSPACE/chromium/src"
    test -f ../../cromite/build/cromite.gn_args
    test -f ../../cromite/build/RELEASE
    actual_version="$(cat ../../cromite/build/RELEASE)"
    test "$actual_version" = "'"$CROMITE_VERSION"'"
    gn gen --args="target_os = \"android\" $(cat ../../cromite/build/cromite.gn_args) target_cpu = \"arm64\"" out/arm64
    python3 /home/lg/working_dir/depot_tools/siso.py ninja -C out/arm64 chrome_public_bundle --offline
    python3 /home/lg/working_dir/depot_tools/siso.py ninja -C out/arm64 chrome_public_apk --offline
    test -s out/arm64/apks/ChromePublic.apk
    cp out/arm64/apks/ChromePublic.apk /mvm-output/MVM-Cromite-'"$CROMITE_VERSION"'-arm64-unsigned-or-upstream-signed.apk
    cp ../../cromite/build/RELEASE /mvm-output/CROMITE-RELEASE.txt
    printf "cromite_version=%s\ncromite_commit=%s\nbuild_image=%s\ntarget_os=android\ntarget_cpu=arm64\n"       "'"$CROMITE_VERSION"'" "'"$CROMITE_SHA"'" "'"$IMAGE"'" > /mvm-output/MVM-Cromite-build-metadata.txt
  '

APK="$OUTPUT_DIR/MVM-Cromite-$CROMITE_VERSION-arm64-unsigned-or-upstream-signed.apk"
if [[ ! -s "$APK" ]]; then
  echo "ERROR: build command returned but the expected APK is missing." >&2
  exit 1
fi
sha256sum "$APK" | tee "$OUTPUT_DIR/MVM-Cromite-$CROMITE_VERSION-arm64.sha256"
printf "apk_sha256=%s\n" "$(sha256sum "$APK" | awk '{print $1}')" >> "$OUTPUT_DIR/MVM-Cromite-build-metadata.txt"
echo "Build artifact created: $APK"
echo "NOTE: inspect signing with apksigner before attempting installation."
