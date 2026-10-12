# MVM Browser — Prebuilt Chromium Engine Evaluation

Date checked: 2026-10-11

## Decision

**Evaluate Cefrium in an isolated experiment branch; do not replace the production engine yet.** This is the first candidate found that explicitly provides an Android Gradle SDK for embedding a bundled Chromium engine into an existing app. It could avoid a full local Chromium source build for an initial proof of concept.

Candidate:
- Official project: https://cefrium.com/
- Quickstart: https://cefrium.com/quickstart/
- Releases and Chromium revision mapping: https://cefrium.com/releases/
- About/status: https://cefrium.com/about/
- License/trademark policy: https://cefrium.com/policy/
- Source: https://codeberg.org/cefrium/cef-android
- Maven Central coordinates: `com.cefrium:cefrium-sdk:0.9.4`

## What is promising

- The SDK packages a Chromium-based engine and exposes an Android View API as well as a Compose API.
- Its documented API includes navigation, JavaScript evaluation, cookies, request interception, SSL error handling, permission handlers, zoom, user-agent control, and print-to-PDF.
- Version 0.9.4 release notes identify Chromium 154.0.8037.98 and support for arm64-v8a plus x86_64.
- It publishes signed SHA-256 checksums and third-party notices/SBOMs for release artifacts.
- The SDK is distributed via Maven Central, allowing a version to be pinned for repeatable dependency resolution.

## Blocking compatibility and operational risks

1. **Not production-ready yet.** The maintainer describes the SDK as public beta/pre-1.0; API changes are expected and large-scale production deployment has not yet been established.
2. **The current project toolchain is not compatible as-is.** Cefrium 0.9.4's quickstart requires JDK 25, Gradle 9.7.1, AGP 9.4, and compileSdk 37. MVM Browser currently uses a substantially older Android Gradle toolchain. This must be validated in an isolated branch before any production Gradle upgrade.
3. **Android support baseline rises.** The SDK requires minSdk 29 (Android 10); current MVM Browser targets minSdk 24 (Android 7). A Cefrium build would not preserve support for Android 7–9 without a separate fallback engine strategy.
4. **Large package.** The project documents `libcef.so` at about 203 MB uncompressed for arm64. Final APK/AAB download size and installation/storage impact must be measured on an actual build.
5. **ABI limitations.** Current published SDK supports arm64-v8a and x86_64; do not assume armeabi-v7a / 32-bit ARM is supported.
6. **Licensing and brand.** Cefrium is LGPL-3.0-or-later; underlying CEF/Chromium have their own BSD and third-party notices. Preserve license notices, make corresponding modifications to the LGPL-covered library available as required, and do not use the Cefrium name as MVM's product name or imply Google affiliation.
7. **Security maintenance.** Cefrium states that upstream security fixes arrive with subsequent releases rather than being backported, and its maintenance is best-effort. MVM would need a monitored update/release process and an agreed response to delayed upstream fixes.

## Integration approach

Do not add the dependency to the main branch yet. Use this branch to build a minimal proof-of-concept that:
1. Resolves the pinned 0.9.4 artifact from Maven Central and verifies the published checksum/signature where available.
2. Uses a compatible toolchain only in the experiment branch.
3. Displays a controlled test page using Cefrium's View API inside an Activity; first prove navigation and rendering before migrating MVM UI.
4. Tests HTTPS certificate errors (must fail closed), redirects, downloads, cookies, JS bridge origin rules, request interception, app background/foreground, process death, and low-memory behavior.
5. Measures debug/release APK and AAB size, cold start, memory, scrolling, video playback, and device compatibility.
6. Checks license/NOTICE/SBOM contents and documents the exact engine revision.
7. Keeps the current WebView implementation as the stable fallback until the prototype passes.

## Go / no-go gate

Proceed to a production migration only if:
- the sample resolves and builds under the required toolchain;
- an arm64 Android 10+ device runs it reliably;
- the large native payload is acceptable;
- security and license update processes are workable;
- a product decision explicitly accepts Android 10+ minimum or defines an alternate fallback for Android 7–9.

## Current status

- Created branch: `experiment/cefrium-engine-spike`.
- No SDK dependency has been added to the production app.
- No Cefrium artifact has been downloaded or built in this session.
- This document is an evaluation plan, not a claim that the candidate has passed device testing.

## Official sources

- Quickstart and exact toolchain / size requirements: https://cefrium.com/quickstart/
- Release/Chromium mapping: https://cefrium.com/releases/
- Status and maintenance: https://cefrium.com/about/
- License and redistribution terms: https://cefrium.com/policy/
- Upstream CEF: https://github.com/chromiumembedded/cef
