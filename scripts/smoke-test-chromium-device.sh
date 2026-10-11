#!/usr/bin/env bash
set -Eeuo pipefail

# Device preflight for a locally built upstream Chromium ARM64 APK.
# Default mode only verifies the artifact and inspects the connected device.
# Installation and launch require --install plus an interactive confirmation.
#
# Usage:
#   bash scripts/smoke-test-chromium-device.sh
#   bash scripts/smoke-test-chromium-device.sh --serial DEVICE_SERIAL
#   bash scripts/smoke-test-chromium-device.sh --install --serial DEVICE_SERIAL

CHROMIUM_ROOT="${CHROMIUM_ROOT:-$HOME/chromium-mvm}"
ADB="${ADB:-}"
SERIAL=""
INSTALL=0

usage() {
  cat <<'USAGE'
Usage: smoke-test-chromium-device.sh [--serial SERIAL] [--install] [--help]

  --serial SERIAL  Select the Android device explicitly when multiple devices are connected.
  --install        After preflight, ask for confirmation, install the APK, and launch an HTTPS test page.
  --help           Show this help.

Without --install, no app is installed or launched.
USAGE
}

while (($#)); do
  case "$1" in
    --serial)
      (($# >= 2)) || { echo "ERROR: --serial requires a value." >&2; exit 2; }
      SERIAL="$2"
      shift 2
      ;;
    --install)
      INSTALL=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "SMOKE TEST BLOCKED: $*" >&2
  exit 1
}

APK="$CHROMIUM_ROOT/MVM-Chromium-arm64.apk"
WRAPPER="$CHROMIUM_ROOT/src/out/MVM/bin/chrome_public_apk"

bash "$(dirname "$0")/verify-chromium-apk.sh" "$APK"

if [[ -z "$ADB" ]]; then
  if command -v adb >/dev/null 2>&1; then
    ADB="$(command -v adb)"
  elif [[ -x "$CHROMIUM_ROOT/src/third_party/android_sdk/public/platform-tools/adb" ]]; then
    ADB="$CHROMIUM_ROOT/src/third_party/android_sdk/public/platform-tools/adb"
  else
    fail "adb was not found; add Android platform-tools to PATH or set ADB."
  fi
fi
if [[ "$ADB" == */* ]]; then
  [[ -x "$ADB" ]] || fail "ADB is not executable: $ADB"
else
  command -v "$ADB" >/dev/null 2>&1 || fail "ADB command was not found: $ADB"
  ADB="$(command -v "$ADB")"
fi
[[ -x "$WRAPPER" ]] || fail "Chromium's generated chrome_public_apk wrapper is missing: $WRAPPER"

DEVICE_OUTPUT="$("$ADB" devices)"
mapfile -t ONLINE_SERIALS < <(printf '%s\n' "$DEVICE_OUTPUT" | awk 'NR > 1 && $2 == "device" {print $1}')

if [[ -n "$SERIAL" ]]; then
  found=0
  for item in "${ONLINE_SERIALS[@]}"; do
    [[ "$item" == "$SERIAL" ]] && found=1
  done
  (( found == 1 )) || fail "Selected serial '$SERIAL' is not an authorized online device. Check adb devices."
elif ((${#ONLINE_SERIALS[@]} == 1)); then
  SERIAL="${ONLINE_SERIALS[0]}"
elif ((${#ONLINE_SERIALS[@]} == 0)); then
  fail "No authorized Android device is connected. Enable USB debugging and accept the device prompt, or start an Android emulator."
else
  printf 'Connected devices:\n' >&2
  printf '  %s\n' "${ONLINE_SERIALS[@]}" >&2
  fail "More than one device is connected; rerun with --serial SERIAL."
fi

ANDROID_SDK="$("$ADB" -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
DEVICE_ABI="$("$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')"
[[ "$ANDROID_SDK" =~ ^[0-9]+$ ]] || fail "Could not read the Android SDK level from device '$SERIAL'."
(( ANDROID_SDK >= 29 )) || fail "Device SDK level is $ANDROID_SDK; chrome_public_apk requires Android 10 / API 29 or newer."
[[ "$DEVICE_ABI" == "arm64-v8a" ]] || fail "Device primary ABI is '$DEVICE_ABI'; this proof APK targets arm64-v8a."

echo "DEVICE READY: $SERIAL"
echo "Android SDK level: $ANDROID_SDK"
echo "Primary ABI: $DEVICE_ABI"
echo "APK and provenance sidecars passed offline verification."

if (( INSTALL == 0 )); then
  echo "Preflight only: no installation or launch was attempted."
  echo "To install and launch, rerun with --install and confirm at the prompt."
  exit 0
fi

[[ -t 0 ]] || fail "--install requires an interactive terminal so the install can be confirmed."
printf "This will install the locally built Chromium APK on device %s and open https://example.com. Continue? [y/N] " "$SERIAL"
read -r answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "Cancelled; no installation performed."; exit 0; }

export ANDROID_SERIAL="$SERIAL"
"$WRAPPER" install
"$WRAPPER" launch https://example.com

echo "INSTALL/LAUNCH COMMANDS COMPLETED. Confirm visually on the device that Chromium opened and the test page rendered."
