#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Build the pinned upstream Cromite Android ARM64 APK in Cromite's published
# build image, overriding only the Android package ID for MVM compatibility.
# Safe by default: without --execute this prints the plan and does not pull/build.
#
# Requirements: x86_64 Linux, Docker Engine, >= 16 GiB RAM recommended,
# >= 150 GiB free disk, and network access to pull the pinned image.
#
# Usage:
#   bash scripts/build-cromite-android.sh
#   bash scripts/build-cromite-android.sh --execute
#   OUTPUT_DIR="$PWD/artifacts/cromite" bash scripts/build-cromite-android.sh --execute
#   ALLOW_STALE_PROTOTYPE=1 bash scripts/build-cromite-android.sh --execute

readonly CROMITE_VERSION="153.0.8010.37"
readonly CROMITE_SHA="11507ac1061b5ea227806f5e84db5a57df6ccf6a"
readonly MVM_PACKAGE_NAME="com.mvmsolo.mvmbrowser"
readonly IMAGE="uazo/cromite-build:${CROMITE_VERSION}-${CROMITE_SHA}"
readonly EXPECTED_RELEASE_APK_SHA256="9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071"
readonly MIN_FREE_GIB="${CROMITE_MIN_FREE_GIB:-150}"
OUTPUT_DIR="${OUTPUT_DIR:-$PWD/artifacts/cromite}"
EXECUTE=0
ALLOW_STALE_PROTOTYPE="${ALLOW_STALE_PROTOTYPE:-0}"
if [[ "$ALLOW_STALE_PROTOTYPE" != "0" && "$ALLOW_STALE_PROTOTYPE" != "1" ]]; then
  echo "ERROR: ALLOW_STALE_PROTOTYPE must be 0 or 1." >&2
  exit 2
fi

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
  echo "ERROR: the pinned Cromite build image requires an x86_64 Linux Docker host." >&2
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
echo "MVM package ID:  $MVM_PACKAGE_NAME (package identity only; upstream UI remains)"
echo "Build image:     $IMAGE"
echo "Output folder:   $OUTPUT_DIR"
echo "Free disk:       ${FREE_GIB} GiB (minimum ${MIN_FREE_GIB} GiB)"
echo "Expected upstream release APK SHA-256: $EXPECTED_RELEASE_APK_SHA256"
if (( FREE_GIB < MIN_FREE_GIB )); then
  echo "ERROR: insufficient free disk for a large Chromium build. Free space or intentionally change CROMITE_MIN_FREE_GIB." >&2
  exit 2
fi

if (( EXECUTE == 0 )); then
  cat <<PLAN

DRY RUN ONLY — nothing has been downloaded or built.
To start the long-running build explicitly, rerun:
  $0 --execute

Before pulling the large build image, execution checks the current Chrome Android
Stable/Early Stable baseline and requires this exact source version/commit to match
the latest published Cromite release. An outdated security base is blocked by default.
For isolated patch/build-pipeline testing only, explicitly opt in with:
  ALLOW_STALE_PROTOTYPE=1 $0 --execute
That override marks the result prototype-only; it is not approval for public release.

This compiles the upstream Android ARM64 browser with MVM package ID $MVM_PACKAGE_NAME.
App label, icons, settings UI, and start page remain upstream, so this is not a finished
MVM Browser. The compiled APK will not match the official release APK checksum above;
that checksum is for the separate upstream prebuilt release only.
PLAN
  exit 0
fi

echo "==> Checking latest Cromite pin and Chrome Android release freshness"
GATE_ARGS=(--pinned-version "$CROMITE_VERSION" --pinned-commit "$CROMITE_SHA")
if [[ "$ALLOW_STALE_PROTOTYPE" == "1" ]]; then
  GATE_ARGS+=(--allow-stale-prototype)
fi
python3 "$SCRIPT_DIR/check-cromite-release.py" "${GATE_ARGS[@]}"

echo "==> Checking Docker daemon"
docker info >/dev/null
echo "==> Checking that the pinned build-image tag exists before downloading it"
if ! docker manifest inspect "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: the pinned Cromite build image could not be verified in the registry." >&2
  echo "No image pull or compilation was started. Recheck the upstream release image reference." >&2
  exit 1
fi
echo "==> Pulling pinned official Cromite build image"
docker pull "$IMAGE"

echo "==> Building Cromite Android ARM64 APK with MVM package identity (this may take hours)"
# Feed a single-quoted host-side heredoc to bash inside the container. This
# avoids nested quote interpolation and keeps the commands exactly reviewable.
docker run --rm -i \
  --user lg \
  --env WORKSPACE=/home/lg/working_dir \
  --env HOME=/home/lg/working_dir \
  --env TARGET_ISDEBUG=false \
  --volume "$OUTPUT_DIR:/mvm-output" \
  --entrypoint /bin/bash \
  "$IMAGE" -s -- "$CROMITE_VERSION" "$CROMITE_SHA" "$IMAGE" "$MVM_PACKAGE_NAME" <<'CONTAINER_SCRIPT'
set -Eeuo pipefail
CROMITE_VERSION="$1"
CROMITE_SHA="$2"
IMAGE="$3"
MVM_PACKAGE_NAME="$4"

export PATH="$WORKSPACE/chromium/src/third_party/llvm-build/Release+Asserts/bin:$WORKSPACE/depot_tools:/usr/local/go/bin:$WORKSPACE/mtool/bin:$PATH"
cd "$WORKSPACE/chromium/src"
test -f ../../cromite/build/cromite.gn_args
test -f ../../cromite/build/RELEASE
actual_version="$(cat ../../cromite/build/RELEASE)"
[[ "$actual_version" == "$CROMITE_VERSION" ]] || { echo "ERROR: source version $actual_version does not match pinned $CROMITE_VERSION." >&2; exit 1; }

# Fail closed if the expected upstream package declaration has changed.
package_template="chrome/android/chrome_public_apk_tmpl.gni"
test -f "$package_template"
package_before="$(grep -Fc 'chrome_public_manifest_package = "org.bromite.bromite"' "$package_template" || true)"
[[ "$package_before" == "1" ]] || { echo "ERROR: expected exactly one upstream Bromite package declaration; refusing to patch an unknown source state." >&2; exit 1; }
sed -i "s/org[.]bromite[.]bromite/$MVM_PACKAGE_NAME/" "$package_template"
package_after="$(grep -Fc "chrome_public_manifest_package = \"$MVM_PACKAGE_NAME\"" "$package_template" || true)"
[[ "$package_after" == "1" ]] || { echo "ERROR: MVM package ID patch could not be verified." >&2; exit 1; }
echo "MVM package identity applied: $MVM_PACKAGE_NAME"

gn gen --args="target_os = \"android\" $(cat ../../cromite/build/cromite.gn_args) target_cpu = \"arm64\"" out/arm64
python3 /home/lg/working_dir/depot_tools/siso.py ninja -C out/arm64 chrome_public_bundle --offline
python3 /home/lg/working_dir/depot_tools/siso.py ninja -C out/arm64 chrome_public_apk --offline
test -s out/arm64/apks/ChromePublic.apk
AAPT_BIN="$(find "$WORKSPACE/chromium/src/third_party/android_sdk/public/build-tools" -type f -name aapt -perm -111 2>/dev/null | sort -V | tail -n 1)"
[[ -n "$AAPT_BIN" && -x "$AAPT_BIN" ]] || { echo "ERROR: could not find Android aapt to verify the produced APK." >&2; exit 1; }
BADGING="$("$AAPT_BIN" dump badging out/arm64/apks/ChromePublic.apk)"
PACKAGE_LINE="$(printf '%s\n' "$BADGING" | grep '^package:' | head -n 1)"
printf '%s\n' "$BADGING" | grep -Fq "package: name='$MVM_PACKAGE_NAME' " || { echo "ERROR: APK package metadata does not exactly match $MVM_PACKAGE_NAME: $PACKAGE_LINE" >&2; exit 1; }
printf '%s\n' "$BADGING" | grep -Eq "^native-code:.*'arm64-v8a'" || { echo "ERROR: APK does not report arm64-v8a native code." >&2; exit 1; }
cp out/arm64/apks/ChromePublic.apk "/mvm-output/MVM-Cromite-${CROMITE_VERSION}-arm64-MVM-package.apk"
cp ../../cromite/build/RELEASE /mvm-output/CROMITE-RELEASE.txt
printf 'cromite_version=%s\ncromite_commit=%s\nbuild_image=%s\ntarget_os=android\ntarget_cpu=arm64\nmvm_package_name=%s\nbranding_status=package-id-only-upstream-ui\n' \
  "$CROMITE_VERSION" "$CROMITE_SHA" "$IMAGE" "$MVM_PACKAGE_NAME" \
  > /mvm-output/MVM-Cromite-build-metadata.txt
APK_PATH="/mvm-output/MVM-Cromite-${CROMITE_VERSION}-arm64-MVM-package.apk"
APK_SHA256="$(sha256sum "$APK_PATH" | awk '{print $1}')"
printf 'apk_sha256=%s\n' "$APK_SHA256" >> /mvm-output/MVM-Cromite-build-metadata.txt
printf '%s  %s\n' "$APK_SHA256" "$(basename "$APK_PATH")" > "/mvm-output/MVM-Cromite-${CROMITE_VERSION}-arm64.sha256"
CONTAINER_SCRIPT

APK="$OUTPUT_DIR/MVM-Cromite-${CROMITE_VERSION}-arm64-MVM-package.apk"
if [[ ! -s "$APK" ]]; then
  echo "ERROR: build command returned but the expected APK is missing." >&2
  exit 1
fi
ACTUAL_SHA="$(sha256sum "$APK" | awk '{print $1}')"
EXPECTED_SHA="$(awk -F= '$1 == "apk_sha256" {sub(/^[^=]*=/, ""); print; exit}' "$OUTPUT_DIR/MVM-Cromite-build-metadata.txt")"
[[ "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || { echo "ERROR: build metadata is missing a valid APK SHA-256." >&2; exit 1; }
[[ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]] || { echo "ERROR: output APK SHA-256 differs from build-container metadata." >&2; exit 1; }
echo "Build artifact created: $APK"
echo "APK SHA-256: $ACTUAL_SHA"
echo "Checksum sidecar: $OUTPUT_DIR/MVM-Cromite-${CROMITE_VERSION}-arm64.sha256"
echo "Next: run scripts/verify-cromite-mvm-apk.sh with this APK and metadata, then inspect signing and smoke-test on Android."
