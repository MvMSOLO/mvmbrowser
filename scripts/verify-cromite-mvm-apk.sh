#!/usr/bin/env bash
set -Eeuo pipefail
# Verify a Cromite-derived MVM package-ID proof APK. This is not a full rebrand or install test.
# Usage: bash scripts/verify-cromite-mvm-apk.sh /path/to/apk /path/to/MVM-Cromite-build-metadata.txt
fail() { echo "VERIFY FAILED: $*" >&2; exit 1; }
PACKAGE_NAME="com.mvmsolo.mvmbrowser"
APK="${1:-}"
METADATA="${2:-}"
[[ -n "$APK" && -n "$METADATA" ]] || fail "Usage: $0 APK_PATH METADATA_PATH"
[[ -s "$APK" ]] || fail "APK is missing or empty: $APK"
[[ -s "$METADATA" ]] || fail "Build metadata is missing or empty: $METADATA"
for tool in sha256sum unzip awk grep; do command -v "$tool" >/dev/null 2>&1 || fail "Required tool '$tool' was not found."; done
metadata_value() { awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$METADATA"; }
[[ "$(metadata_value mvm_package_name)" == "$PACKAGE_NAME" ]] || fail "Metadata package ID does not equal $PACKAGE_NAME."
[[ "$(metadata_value target_os)" == "android" && "$(metadata_value target_cpu)" == "arm64" ]] || fail "Metadata target must be android/arm64."
[[ "$(metadata_value branding_status)" == "package-id-only-upstream-ui" ]] || fail "Metadata must explicitly identify this as package-ID-only; UI rebrand is incomplete."
VERSION="$(metadata_value cromite_version)"; COMMIT="$(metadata_value cromite_commit)"; IMAGE="$(metadata_value build_image)"; EXPECTED_SHA="$(metadata_value apk_sha256)"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Malformed Cromite version metadata."
[[ "$COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || fail "Malformed Cromite source commit metadata."
[[ -n "$IMAGE" ]] || fail "Build image metadata is missing."
[[ "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Missing or malformed APK SHA-256 metadata."
ACTUAL_SHA="$(sha256sum "$APK" | awk '{print $1}')"
[[ "$ACTUAL_SHA" == "$EXPECTED_SHA" ]] || fail "APK checksum does not match metadata."
unzip -tq "$APK" >/dev/null || fail "APK ZIP integrity check failed."
unzip -Z1 "$APK" | grep -Fx 'AndroidManifest.xml' >/dev/null || fail "APK root AndroidManifest.xml is missing."
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"; AAPT_BIN="${AAPT:-}"; APKSIGNER_BIN="${APKSIGNER:-}"
if [[ -z "$AAPT_BIN" && -n "$SDK_ROOT" && -d "$SDK_ROOT/build-tools" ]]; then AAPT_BIN="$(find "$SDK_ROOT/build-tools" -type f -name aapt -perm -111 2>/dev/null | sort -V | tail -n 1)"; fi
if [[ -z "$APKSIGNER_BIN" && -n "$SDK_ROOT" && -d "$SDK_ROOT/build-tools" ]]; then APKSIGNER_BIN="$(find "$SDK_ROOT/build-tools" -type f -name apksigner -perm -111 2>/dev/null | sort -V | tail -n 1)"; fi
[[ -n "$AAPT_BIN" && -x "$AAPT_BIN" ]] || fail "aapt is required to confirm the APK package ID; set AAPT or configure Android SDK build-tools."
BADGING="$("$AAPT_BIN" dump badging "$APK")" || fail "aapt could not read the APK manifest."
printf '%s\n' "$BADGING" | grep -Eq "^package: name='${PACKAGE_NAME}' " || fail "APK manifest does not use package $PACKAGE_NAME."
printf '%s\n' "$BADGING" | grep -Eq "^native-code:.*'arm64-v8a'" || fail "APK does not report ARM64 native code."
MIN_SDK="$(printf '%s\n' "$BADGING" | sed -n "s/^sdkVersion:'\([0-9][0-9]*\)'.*/\1/p" | head -n 1)"
[[ "$MIN_SDK" =~ ^[0-9]+$ ]] || fail "Could not read minSdkVersion from APK manifest."; (( MIN_SDK >= 29 )) || fail "Expected Android API 29+; actual minimum is $MIN_SDK."
if [[ -n "$APKSIGNER_BIN" && -x "$APKSIGNER_BIN" ]]; then
  SIGNATURE_REPORT="$("$APKSIGNER_BIN" verify --verbose --print-certs "$APK" 2>&1)" || { printf '%s\n' "$SIGNATURE_REPORT" >&2; fail "APK signature verification failed."; }
  printf '%s\n' "$SIGNATURE_REPORT" | grep -q 'Verifies' || fail "apksigner did not confirm signature verification."
  echo "APK signature: verified by apksigner"
else echo "WARNING: apksigner unavailable; APK signer was not verified." >&2; fi
printf 'VERIFY PASSED: package=%s version=%s minSdk=%s abi=arm64-v8a\n' "$PACKAGE_NAME" "$VERSION" "$MIN_SDK"
echo "APK SHA-256: $ACTUAL_SHA"; echo "Build image: $IMAGE"; echo "Branding scope: package ID only; upstream UI remains."
echo "This verification does not install or launch the APK."
