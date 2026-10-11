# MVM Browser

MVM Browser is an Android browser project by MvMSOLO.

## Download

Once the release pipeline completes, the latest generated APK will be available here:

**[Download MVM Browser APK](https://github.com/MvMSOLO/mvmbrowser/releases/latest/download/MVM-Browser.apk)**

If that link is not available yet, open [Releases](https://github.com/MvMSOLO/mvmbrowser/releases) or check the [APK build workflow](https://github.com/MvMSOLO/mvmbrowser/actions/workflows/android-apk-release.yml).

## Current status

- Android APK builds on GitHub Actions.
- Browser UI includes tab navigation and basic browser controls.
- Download handling is implemented through Android DownloadManager.
- **Engine status:** the current app still uses Android System WebView. A bundled standalone Chromium engine is a separate ongoing migration and is not yet included in the APK.

## Chromium migration and research

MVM Browser is not yet running a bundled Chromium engine. Review the research docs before choosing the next architecture:

- [Engine migration plan](docs/CHROMIUM_ENGINE_MIGRATION.md) — architecture and first proof-build steps.
- [Engine/resource research](docs/ENGINE_RESOURCE_RESEARCH.md) — host requirements, cloud-account constraints, and public pricing comparisons.
- [Chromium base options](docs/CHROMIUM_BASE_OPTIONS.md) — upstream Chromium, Cromite source forks, and GeckoView, including version, maintenance, and licensing caveats.
- [Distribution/security checklist](docs/CHROMIUM_DISTRIBUTION_CHECKLIST.md) — notices, source provenance, and update responsibilities.
- [Read-only build-host checker](scripts/check-chromium-build-host.sh) — checks Linux architecture, effective RAM, and free disk without downloading source.
- [Chromium source cleanliness checker](scripts/check-chromium-source-clean.sh) — rejects tracked/untracked checkout changes that could make build provenance ambiguous.
- [Chromium build script](scripts/build-chromium-android.sh) — builds an upstream arm64 proof APK on a suitable Linux host and writes a metadata sidecar plus the exact GN args; it has not yet been run successfully in this environment.
- [Offline APK verifier](scripts/verify-chromium-apk.sh) — checks APK ZIP integrity, manifest presence, APK/GN-args checksums, and source revision metadata; when `aapt` is available, it also validates package ID, minimum API, and arm64-v8a ABI.
- [Android device smoke-test script](scripts/smoke-test-chromium-device.sh) — checks device authorization, Android API level, and ARM64 compatibility; installation requires `--install` plus interactive confirmation.
- [Upstream version report script](scripts/report-chromium-upstream-status.py) — read-only parser for official Chrome Android release notes and public Cromite release/commit metadata, with a strict mode for incomplete reports.
- [Weekly upstream resource watch](https://github.com/MvMSOLO/mvmbrowser/actions/workflows/chromium-upstream-watch.yml) — runs every Monday at 08:30 UTC, saves a 30-day report artifact, and can also be triggered manually.

The bootstrap CI checks script syntax, tests the report parser without network calls, and verifies that resource guards stop a Chromium checkout before source download. It does not compile Chromium. The live release-watch workflow has been tested against public metadata, but its report is only a version signal—not a security audit.

## Build locally

Requirements: JDK 17 and Gradle 8.9.

```bash
cd android
gradle --no-daemon assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
