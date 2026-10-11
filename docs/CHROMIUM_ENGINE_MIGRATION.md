# MVM Browser — Chromium Engine Migration

## Decision

MVM Browser's target engine is **a bundled, independently built Chromium browser engine**, not Android's system WebView and not GeckoView.

## Verified upstream constraints

- Chromium's official Android build produces a complete browser APK with the `chrome_public_apk` target.
- The official build guide states that `chrome_public_apk` has `minSdkVersion=29` (Android 10) for local development. MVM Browser currently has `minSdk 24`; this is a real compatibility decision, not just a UI port.
- Chromium does not publish a supported Android AAR/SDK that can simply be added to this existing Kotlin app to embed the full Chrome engine.
- The official WebLayer/WebEngine material describes a different integration model and should not be treated as a stable, self-contained Chromium SDK for this app.
- Therefore, replacing `WebView` with a Gradle dependency is not a valid implementation plan.

References:
- https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/architecture.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/weblayer/public/README.md

## Implementation path

The current app's capability-by-capability work is tracked in [CHROMIUM_FEATURE_PORT_MATRIX.md](CHROMIUM_FEATURE_PORT_MATRIX.md). Use it as the acceptance checklist for the downstream shell port; the existing WebView features are not automatically inherited by the proof APK.

1. **Choose the Chromium base:** use the upstream Chromium Android browser source as the engine/browser base, or a maintained open-source Chromium browser fork whose build and redistribution terms fit the project. Do not vendor an imaginary AAR.
2. **Prove the build environment:** build an unmodified Android Chromium APK in a dedicated Linux environment before porting MVM UI. Chromium's checkout and build are far larger than a normal Gradle project; the current Android APK CI workflow is not sufficient by itself.
3. **Create a reproducible build:** pin the upstream revision, build tools, target ABI(s), and security-update procedure.
4. **Port MVM identity and features:** integrate the MVM brand, new-tab experience, toolbar, tabs, bookmarks, history, and downloads into the Chromium-based browser shell.
5. **Validate before release:** install and test on real Android devices, verify HTTPS/error handling, downloads, tab lifecycle, and produce signed release artifacts only after the debug build passes.

## First build step

A starter script is now committed at [`scripts/build-chromium-android.sh`](../scripts/build-chromium-android.sh). On a dedicated x86-64 Linux machine, it fetches Chromium, installs its official build dependencies, configures an arm64 build, and runs `autoninja -C out/MVM chrome_public_apk`. It expects at least 100 GB of free disk space and recommends 16 GB or more RAM. The source checkout can take hours; this is not suitable for a standard Android Gradle runner or a phone-only build environment.

Before any source download, run the no-cost environment report: `bash scripts/check-chromium-build-host.sh`. It prints CPU, RAM, free disk, and basic Linux-distribution details without installing packages, downloading source, or creating cloud resources.

Run the build only on a host that meets the report's requirements, after confirming available disk/network and the intended cost. For reproducible testing, pin both Chromium and `depot_tools` to a known commit or ref. When `DEPOT_TOOLS_REVISION` is supplied, the script checks out that tool version and disables its auto-update; without it, the default auto-update behavior remains enabled:

```bash
bash scripts/check-chromium-build-host.sh
CHROMIUM_REVISION='PUT_FULL_CHROMIUM_COMMIT_SHA_HERE' DEPOT_TOOLS_REVISION='PUT_FULL_DEPOT_TOOLS_COMMIT_SHA_HERE' bash scripts/build-chromium-android.sh
```

At completion, the script reports the Chromium four-part version from chrome/VERSION, actual Chromium commit, `depot_tools` commit, GN-args SHA-256, and APK SHA-256. The offline verifier requires a valid MAJOR.MINOR.BUILD.PATCH value in the metadata. It also writes `MVM-Chromium-arm64.metadata.txt` and copies the effective GN args to `MVM-Chromium-arm64.args.gn` next to the APK. When `CHROMIUM_REVISION` is supplied, the script resolves it to an exact commit (using `FETCH_HEAD` for remotely fetched refs) before syncing dependencies. When `DEPOT_TOOLS_REVISION` is supplied, it does the same for `depot_tools` and records whether automatic tool updates were disabled. Save the APK, metadata, GN args file, and build logs together when comparing repeat builds.

Before any installation attempt, run the offline verifier against the output:

```bash
bash scripts/verify-chromium-apk.sh
```

The verifier checks the APK ZIP integrity, root Android manifest entry, both SHA-256 digests, target ABI/OS, and full Chromium/`depot_tools` commit IDs. When Android Build Tools `aapt` is available, it additionally checks the package ID, `minSdkVersion` (API 29+), and `arm64-v8a` native code. When `aapt` is unavailable it clearly notes that binary-manifest checks were skipped. It does not download, install, or launch anything. A successful verifier result confirms local artifact integrity and provenance fields, not that Chromium will launch correctly on a device.

When a real Android 10+ ARM64 device is connected with USB debugging authorized, run the device preflight:

```bash
bash scripts/smoke-test-chromium-device.sh --serial DEVICE_SERIAL
```

It validates the build wrapper and device API/ABI without installing. Only after reviewing the target serial, opt into the install-and-launch test:

```bash
bash scripts/smoke-test-chromium-device.sh --install --serial DEVICE_SERIAL
```

The `--install` mode requires an interactive confirmation before it installs the locally built APK and opens `https://example.com`. After it completes, visually confirm that the page rendered; the script cannot certify UI rendering by command success alone.

The expected output is an unbranded Chromium APK named `MVM-Chromium-arm64.apk` under the chosen Chromium workspace. The script requests noninteractive dependency installation, checks that sudo is usable before a large checkout for non-root users, and syncs dependencies without running hooks twice. It also invokes the source-cleanliness guard before dependency installation and again after sync/hooks.

After the checkout is present, these read-only diagnostics can be run separately:

```bash
bash scripts/check-chromium-source-clean.sh "$HOME/chromium-mvm/src"
bash scripts/check-chromium-gclient-config.sh "$HOME/chromium-mvm/.gclient"
bash scripts/read-chromium-version.sh "$HOME/chromium-mvm/src/chrome/VERSION"
```

The build automatically runs the latter two checks at the appropriate points; these separate commands are useful when diagnosing an existing checkout. The two revision values in the build example must be replaced with real full 40-character Git commit SHAs.

A manual workflow is also available at [chromium-self-hosted-build.yml](../.github/workflows/chromium-self-hosted-build.yml). It requires a runner labelled self-hosted, linux, x64, chromium-builder with enough RAM/disk, noninteractive dependency-install permissions, and two full 40-character commit SHAs. It only accepts a dispatch from main with confirm_build=yes; it uploads the APK plus provenance files for 14 days. It does not provision infrastructure and does not install the APK on a device. The script has been committed, but it has **not** been executed in this environment; do not treat the APK as built or tested yet.

## Important status

The current MVM Browser app still uses Android WebView. The proof APK's Android 10+ minimum means we must explicitly decide whether the future Chromium-based MVM Browser will drop support for Android 7–9 or require substantial custom engineering to preserve those older devices. The first technical milestone is a successful, reproducible upstream Chromium Android build. Only after that build is confirmed should we port MVM identity and features into the Chromium browser shell.
