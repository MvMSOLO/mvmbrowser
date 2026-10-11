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

## Important status

This document records the verified architecture and migration path only. It does **not** claim that Chromium has already been integrated or that the current WebView-based APK has changed engines. The first technical milestone is a reproducible Chromium Android build; UI porting follows that milestone.
