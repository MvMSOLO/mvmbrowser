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
- [Chromium base options](docs/CHROMIUM_BASE_OPTIONS.md) — upstream Chromium vs. Cromite vs. GeckoView, including version, maintenance, and licensing caveats.
- [Distribution/security checklist](docs/CHROMIUM_DISTRIBUTION_CHECKLIST.md) — notices, source provenance, and update responsibilities.
- [Read-only build-host checker](scripts/check-chromium-build-host.sh) — checks Linux architecture, effective RAM, and free disk without downloading source.
- [Chromium build script](scripts/build-chromium-android.sh) — builds an upstream arm64 proof APK on a suitable Linux host; it has not yet been run successfully in this environment.

The current script-validation workflow checks Bash syntax and preflight behavior only; it does not compile Chromium.

## Build locally

Requirements: JDK 17 and Gradle 8.9.

```bash
cd android
gradle --no-daemon assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
