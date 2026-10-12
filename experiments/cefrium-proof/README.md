# MVM Browser — bundled Chromium proof app

This project is intentionally isolated from the shipping Android app. It is a minimal proof that MVM can embed a prebuilt Chromium engine inside an Android Activity through Cefrium rather than relying on Android System WebView.

## Pinned engine

- SDK: `com.cefrium:cefrium-sdk:0.9.4`
- Embedded engine: Chromium 154.0.8037.98
- Android minimum: API 29 (Android 10)
- Proof ABI: ARM64 (`arm64-v8a`)
- Package ID: `com.mvmsolo.mvmbrowser.cefriumproof`
- Toolchain: JDK 25, Gradle 9.7.1, Android Gradle Plugin 9.4.0, compileSdk 37
- License: Cefrium is LGPL-3.0-or-later; inspect its NOTICE/SBOM and source/redistribution obligations before any public distribution.

The SDK includes a large native engine. This proof build may be substantially larger than the current WebView APK. It is a feasibility build, not a production candidate.

## What the proof does

- Creates a Chromium-backed Surface browser and loads `https://example.com/`.
- Provides back, forward, reload, home, and an address/search field.
- Uses HTTPS as the default for bare hosts and DuckDuckGo for text searches.
- Rejects non-web URL schemes (including `javascript:`, `data:`, `intent:`, and `file:`).
- Leaves invalid TLS certificate errors in the SDK's fail-closed default (cancel).
- Saves/restores the current URL across Activity recreation and closes the native browser in `onDestroy`.
- Includes unit tests for address resolution and runs in GitHub Actions.

## Run in CI

Pushing changes to branch `experiment/cefrium-proof-154` triggers [Cefrium Chromium Engine Proof](../../.github/workflows/cefrium-engine-poc.yml). The job runs unit tests, builds an ARM64 debug APK, verifies its package ID and native `libcef.so`, hashes the APK, and uploads a temporary artifact for seven days.

## Do not merge into the shipping app yet

CI compile success proves only that the dependency can be resolved and an APK packaged. Before migration, install and test on an Android 10+ ARM64 device: navigation/redirects, TLS failures, page forms/keyboard, cookies and auth, download flow, media, permissions, renderer crashes, app resume/process death, memory, cold start, and final download size. Confirm current Chromium security parity and license compliance. The existing production app remains on Android System WebView until that gate passes.

References:
- [Cefrium quickstart](https://cefrium.com/quickstart/)
- [Cefrium release history](https://cefrium.com/releases/)
- [Cefrium API reference](https://cefrium.com/docs/)
- [License and policy](https://cefrium.com/policy/)
