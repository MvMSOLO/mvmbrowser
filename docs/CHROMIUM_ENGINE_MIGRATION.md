# MVM Browser — Chromium Engine Migration

## Decision

MVM Browser's target engine is **a bundled, independently built Chromium browser engine**, not Android's system WebView and not GeckoView.

## Verified upstream constraints

- Chromium's official Android build produces a complete browser APK with the `chrome_public_apk` target.
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

Run it with:

```bash
bash scripts/build-chromium-android.sh
```

The expected output is an unbranded Chromium APK named `MVM-Chromium-arm64.apk` under the chosen Chromium workspace. The script has been committed, but it has **not** been executed in this environment; do not treat the APK as built or tested yet.

## Important status

The current MVM Browser app still uses Android WebView. The first technical milestone is a successful, reproducible upstream Chromium Android build. Only after that build is confirmed should we port MVM identity and features into the Chromium browser shell.
