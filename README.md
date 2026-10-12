# MVM Browser

MVM Browser is an Android browser project by MvMSOLO.

## Download

Once the release pipeline completes, the latest generated APK will be available here:

**[Download MVM Browser APK](https://github.com/MvMSOLO/mvmbrowser/releases/latest/download/MVM-Browser.apk)**

If that link is not available yet, open [Releases](https://github.com/MvMSOLO/mvmbrowser/releases) or check the [APK build workflow](https://github.com/MvMSOLO/mvmbrowser/actions/workflows/android-apk-release.yml).

**Install/build note:** the current published APK is an installable Android **debug/test build**, not a production-signed Play Store release. Its application ID is `com.mvmsolo.mvmbrowser.debug`. Each GitHub-hosted build can use a different debug signing key, so installing an APK from a different run may require uninstalling the old debug build first. New releases include a `MVM-Browser.apk.sha256` checksum file.

## Current status

- Android APK builds on GitHub Actions.
- Browser UI includes tab navigation and basic browser controls.
- Download handling is implemented through Android DownloadManager.
- **Engine status:** the current app still uses Android System WebView. A bundled standalone Chromium engine is a separate ongoing migration and is not yet included in the APK.

## Chromium migration and research

**Selected direction: fork Cromite at source level and adapt it into an MVM-branded browser.** This does not mean embedding the Cromite APK or its System WebView APK inside the current app.

Start with [Cromite fork execution plan](docs/CROMITE_FORK_EXECUTION_PLAN.md). The plan requires a pinned source revision, security/version review, a reproducible ARM64 build, license compliance, and an on-device smoke test before claiming success. No paid cloud infrastructure should be created without explicit approval.

Implementation tools:
- [Cromite baseline audit](docs/CROMITE_BASELINE_AUDIT.md) — version/security gate and upstream references.
- [Cromite Android build procedure](docs/CROMITE_ANDROID_BUILD.md) — pinned ARM64 build image and requirements.
- [Cromite ARM64 build script](scripts/build-cromite-android.sh) — dry-run by default; only pulls the large image and compiles with explicit `--execute`.
- [Cromite release freshness checker](scripts/check-cromite-release.py) — auto-detects the highest announced Chrome Android Stable/Early Stable version, verifies the configured source pin against the latest Cromite release, and can verify an APK checksum. Stale bases block builds by default.

Supporting research and tooling:

- [Engine migration plan](docs/CHROMIUM_ENGINE_MIGRATION.md) — architecture and integration constraints.
- [Feature port matrix](docs/CHROMIUM_FEATURE_PORT_MATRIX.md) — maps current Kotlin/WebView features to the downstream Chromium shell and acceptance checks.
- [Engine/resource research](docs/ENGINE_RESOURCE_RESEARCH.md) — host requirements, cloud-account constraints, and public pricing comparisons.
- [Chromium base options](docs/CHROMIUM_BASE_OPTIONS.md) — upstream Chromium, Cromite source forks, and GeckoView, including version, maintenance, and licensing caveats.
- [Distribution/security checklist](docs/CHROMIUM_DISTRIBUTION_CHECKLIST.md) — notices, source provenance, and update responsibilities.
- [Read-only build-host checker](scripts/check-chromium-build-host.sh) — checks Linux architecture, effective RAM, and free disk without downloading source.
- [Chromium source cleanliness checker](scripts/check-chromium-source-clean.sh) — rejects tracked/untracked checkout changes that could make build provenance ambiguous.
- [`.gclient` Android-target checker](scripts/check-chromium-gclient-config.sh) — safely confirms the checkout configuration includes Android without executing the config.
- [Chromium version parser](scripts/read-chromium-version.sh) — validates upstream `chrome/VERSION` and produces a strict four-part version string.
- [Vanilla Chromium build script](scripts/build-chromium-android.sh) — builds an upstream arm64 proof APK on a suitable Linux host; it is not the selected product build path unless Cromite fails feasibility review.
- [Manual self-hosted proof-build workflow](.github/workflows/chromium-self-hosted-build.yml) — designed for a specifically labelled Linux runner after explicit confirmation and exact 40-character source/tool commits; it does not create a cloud host.
- [Offline APK verifier](scripts/verify-chromium-apk.sh) — checks APK ZIP integrity, manifest presence, APK/GN-args checksums, and source revision metadata; when `aapt` is available, it also validates package ID, minimum API, and arm64-v8a ABI.
- [Android device smoke-test script](scripts/smoke-test-chromium-device.sh) — checks device authorization, Android API level, and ARM64 compatibility; installation requires `--install` plus interactive confirmation.
- [Upstream version report script](scripts/report-chromium-upstream-status.py) — read-only parser for official Chrome Android release notes and public Cromite release/commit metadata.
- [Weekly upstream resource watch](https://github.com/MvMSOLO/mvmbrowser/actions/workflows/chromium-upstream-watch.yml) — saves a 30-day report artifact and can also be triggered manually.

The bootstrap CI tests script syntax, release/version parsers, `.gclient` Android configuration, source-cleanliness checks, resource/config guards, synthetic APK metadata/signature checks, and a mocked Android-device preflight. It does not compile Chromium or Cromite. The upstream watch is a version signal—not a security audit.

## Native APK account login

The Android APK includes a native email/password sign-in and account-creation screen backed by Better Auth endpoints (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/get-session`, and `/api/auth/sign-out`). Open **Tabs & library → Sign in / Account** and enter the HTTPS origin of the deployed MVM web app that serves these endpoints. Passwords are not saved by the APK; the session cookie is managed by Android's WebView cookie store.

**A live auth deployment is still required.** This repository does not contain a configured production domain or production secrets. The deployment must enable Better Auth, serve `/api/auth/*`, use a persistent database, configure its HTTPS base URL/secret and trusted origin, and have email/password sign-up enabled. A URL is not inferred or hard-coded; validate sign-in, sign-up, session persistence after app restart, and sign-out against the real deployment before calling the product release-ready.

Native profile notes remain device-local and are not AI memory or cross-device sync.

## Build locally

Requirements: JDK 17 and Gradle 8.9.

```bash
cd android
gradle --no-daemon assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
