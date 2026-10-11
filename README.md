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

## Chromium migration

See [Chromium Engine Migration](docs/CHROMIUM_ENGINE_MIGRATION.md) for the verified architecture, build constraints, and next steps.

## Build locally

Requirements: JDK 17 and Gradle 8.9.

```bash
cd android
gradle --no-daemon assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
