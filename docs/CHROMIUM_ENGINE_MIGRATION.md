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

1. **Choose the Chromium base:** use the upstream Chromium Android browser source as the engine/browser base, or a maintained open-source Chromium browser fork whose build and redistribution terms fit the project. Do not vendor an imaginary AAR.
2. **Prove the build environment:** build an unmodified Android Chromium APK in a dedicated Linux environment before porting MVM UI. Chromium's checkout and build are far larger than a normal Gradle project; the current Android APK CI workflow is not sufficient by itself.
3. **Create a reproducible build:** pin the upstream revision, build tools, target ABI(s), and security-update procedure.
4. **Port MVM identity and features:** integrate the MVM brand, new-tab experience, toolbar, tabs, bookmarks, history, and downloads into the Chromium-based browser shell.
5. **Validate before release:** install and test on real Android devices, verify HTTPS/error handling, downloads, tab lifecycle, and produce signed release artifacts only after the debug build passes.

## First build step

A starter script is now committed at [`scripts/build-chromium-android.sh`](../scripts/build-chromium-android.sh). On a dedicated x86-64 Linux machine, it fetches Chromium, installs its official build dependencies, configures an arm64 build, and runs `autoninja -C out/MVM chrome_public_apk`. It expects at least 100 GB of free disk space and recommends 16 GB or more RAM. The source checkout can take hours; this is not suitable for a standard Android Gradle runner or a phone-only build environment.

Before any source download, run the no-cost environment report: `bash scripts/check-chromium-build-host.sh`. It prints CPU, RAM, free disk, and basic Linux-distribution details without installing packages, downloading source, or creating cloud resources.

Run the build only on a host that meets the report's requirements, after confirming available disk/network and the intended cost. For reproducible testing, pass an exact Chromium commit/ref through `CHROMIUM_REVISION`:

```bash
bash scripts/check-chromium-build-host.sh
CHROMIUM_REVISION=<commit-or-ref> bash scripts/build-chromium-android.sh
```

At completion, the script reports the actual Chromium commit, `depot_tools` commit, GN-args SHA-256, and APK SHA-256. It also writes `MVM-Chromium-arm64.metadata.txt` next to the APK with the host OS/architecture and build provenance. When `CHROMIUM_REVISION` is supplied, the script resolves it to an exact commit (using `FETCH_HEAD` for remotely fetched refs) before syncing dependencies. Save the metadata file and build logs together when comparing repeat builds.

The expected output is an unbranded Chromium APK named `MVM-Chromium-arm64.apk` under the chosen Chromium workspace. The script requests noninteractive dependency installation, checks that sudo is usable before a large checkout for non-root users, and syncs dependencies without running hooks twice. The script has been committed, but it has **not** been executed in this environment; do not treat the APK as built or tested yet.

## Important status

The current MVM Browser app still uses Android WebView. The proof APK's Android 10+ minimum means we must explicitly decide whether the future Chromium-based MVM Browser will drop support for Android 7–9 or require substantial custom engineering to preserve those older devices. The first technical milestone is a successful, reproducible upstream Chromium Android build. Only after that build is confirmed should we port MVM identity and features into the Chromium browser shell.
