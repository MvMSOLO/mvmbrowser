#!/usr/bin/env bash
set -Eeuo pipefail

# Verify a locally built Chromium APK and its provenance sidecar without
# installing the app or contacting any external service.
#
# Usage:
#   bash scripts/verify-chromium-apk.sh
#   bash scripts/verify-chromium-apk.sh /path/to/MVM-Chromium-arm64.apk

DEFAULT_ROOT="${CHROMIUM_ROOT:-$HOME/chromium-mvm}"
APK="${1:-$DEFAULT_ROOT/MVM-Chromium-arm64.apk}"
BASE="${APK%.apk}"
METADATA="${BASE}.metadata.txt"
ARGS_FILE="${BASE}.args.gn"

fail() {
  echo "VERIFY FAILED: $*" >&2
  exit 1
}

for tool in sha256sum unzip awk; do
  command -v "$tool" >/dev/null 2>&1 || fail "Required tool '$tool' was not found."
done

[[ -f "$APK" ]] || fail "APK file not found: $APK"
[[ -f "$METADATA" ]] || fail "Metadata sidecar not found: $METADATA"
[[ -f "$ARGS_FILE" ]] || fail "GN args sidecar not found: $ARGS_FILE"

metadata_value() {
  awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$METADATA"
}

TARGET_OS="$(metadata_value target_os)"
TARGET_CPU="$(metadata_value target_cpu)"
APK_FILE="$(metadata_value apk_file)"
EXPECTED_APK_SHA="$(metadata_value apk_sha256)"
EXPECTED_ARGS_FILE="$(metadata_value gn_args_file)"
EXPECTED_ARGS_SHA="$(metadata_value gn_args_sha256)"
CHROMIUM_REVISION="$(metadata_value chromium_revision)"
DEPOT_TOOLS_REVISION="$(metadata_value depot_tools_revision)"

[[ "$TARGET_OS" == "android" ]] || fail "Metadata target_os is not android."
[[ "$TARGET_CPU" == "arm64" ]] || fail "Metadata target_cpu is not arm64."
[[ "$APK_FILE" == "$(basename "$APK")" ]] || fail "Metadata APK filename does not match the supplied APK."
[[ "$EXPECTED_ARGS_FILE" == "$(basename "$ARGS_FILE")" ]] || fail "Metadata GN args filename does not match its sidecar."
[[ "$CHROMIUM_REVISION" =~ ^[0-9a-fA-F]{40}$ ]] || fail "Chromium revision is missing or is not a full Git commit hash."
[[ "$DEPOT_TOOLS_REVISION" =~ ^[0-9a-fA-F]{40}$ ]] || fail "depot_tools revision is missing or is not a full Git commit hash."
[[ "$EXPECTED_APK_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || fail "APK SHA-256 is missing or malformed."
[[ "$EXPECTED_ARGS_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || fail "GN args SHA-256 is missing or malformed."

ACTUAL_APK_SHA="$(sha256sum "$APK" | awk '{print $1}')"
ACTUAL_ARGS_SHA="$(sha256sum "$ARGS_FILE" | awk '{print $1}')"
[[ "$ACTUAL_APK_SHA" == "$EXPECTED_APK_SHA" ]] || fail "APK SHA-256 does not match metadata."
[[ "$ACTUAL_ARGS_SHA" == "$EXPECTED_ARGS_SHA" ]] || fail "GN args checksum does not match metadata."

grep -Eq '^[[:space:]]*target_os[[:space:]]*=[[:space:]]*"android"[[:space:]]*$' "$ARGS_FILE" \
  || fail "GN args sidecar does not declare target_os = android."
grep -Eq '^[[:space:]]*target_cpu[[:space:]]*=[[:space:]]*"arm64"[[:space:]]*$' "$ARGS_FILE" \
  || fail "GN args sidecar does not declare target_cpu = arm64."

unzip -tq "$APK" >/dev/null || fail "APK ZIP integrity test failed."
if ! unzip -Z1 "$APK" | grep -Fxq 'AndroidManifest.xml'; then
  fail "APK archive does not contain AndroidManifest.xml at its root."
fi

# When Android Build Tools are available, inspect the binary manifest too.
# The ZIP-only fixture path remains useful for offline CI without an Android SDK.
AAPT_BIN="${AAPT:-}"
if [[ -z "$AAPT_BIN" ]] && command -v aapt >/dev/null 2>&1; then
  AAPT_BIN="$(command -v aapt)"
fi
if [[ -z "$AAPT_BIN" ]]; then
  SDK_BUILD_TOOLS="${CHROMIUM_ROOT:-$HOME/chromium-mvm}/src/third_party/android_sdk/public/build-tools"
  if [[ -d "$SDK_BUILD_TOOLS" ]]; then
    AAPT_BIN="$(find "$SDK_BUILD_TOOLS" -type f -name aapt -perm -111 -print -quit)"
  fi
fi
if [[ -n "$AAPT_BIN" ]]; then
  [[ -x "$AAPT_BIN" ]] || fail "AAPT is not executable: $AAPT_BIN"
  BADGING="$("$AAPT_BIN" dump badging "$APK")" || fail "aapt could not read the APK binary manifest."
  PACKAGE_NAME="$(printf '%s\n' "$BADGING" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -n 1)"
  MIN_SDK="$(printf '%s\n' "$BADGING" | sed -n "s/^sdkVersion:'\([0-9][0-9]*\)'.*/\1/p" | head -n 1)"
  [[ -n "$PACKAGE_NAME" ]] || fail "APK package ID could not be read from Android manifest."
  [[ "$MIN_SDK" =~ ^[0-9]+$ ]] || fail "APK minSdkVersion could not be read from Android manifest."
  (( MIN_SDK >= 29 )) || fail "APK minSdkVersion is $MIN_SDK; this Chrome public target is expected to require API 29 or newer."
  printf '%s\n' "$BADGING" | grep -Eq "^native-code:.*'arm64-v8a'" || fail "APK manifest/native-code metadata does not list arm64-v8a."
  echo "Package ID: $PACKAGE_NAME"
  echo "Minimum Android API: $MIN_SDK"
  echo "Native ABI: arm64-v8a"
else
  echo "NOTE: aapt not found; binary Android manifest metadata check was skipped."
fi

echo "VERIFY PASSED: APK structure, GN args, metadata and ZIP integrity agree."
echo "APK: $APK"
echo "Chromium revision: $CHROMIUM_REVISION"
echo "depot_tools revision: $DEPOT_TOOLS_REVISION"
echo "APK SHA-256: $ACTUAL_APK_SHA"
echo "GN args SHA-256: $ACTUAL_ARGS_SHA"
echo "This script did not install or launch the APK."
