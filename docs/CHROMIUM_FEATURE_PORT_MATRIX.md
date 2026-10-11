# MVM Browser — Chromium Feature Port Matrix

Status date: 2026-10-11

This matrix maps the current Android app's real feature surface to the work required for a standalone Chromium-based MVM browser. The upstream chrome_public_apk build is a full browser app, not a supported Android AAR that can be dropped into the current MainActivity.

## Current architecture

- Android entry point: android/app/src/main/java/com/mvmsolo/mvmbrowser/MainActivity.kt
- Current engine: Android System WebView.
- Start page: android/app/src/main/assets/home.html.
- Ad/tracker filtering: AdBlocker.kt, a small offline host denylist checked in WebView resource interception.
- Local/offline-file policy: LocalFilePolicy.kt; saved MHTML files are accepted only within the app-private offline-pages folder.
- Current application id: com.mvmsolo.mvmbrowser; minSdk 24 (Android 7).
- Upstream chrome_public_apk: complete Chromium browser shell; official local-development target has minSdkVersion 29 (Android 10+).

Official references:
- https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/architecture.md
- https://chromium.googlesource.com/chromium/src/+/HEAD/weblayer/public/README.md

## Feature-by-feature migration

| Existing MVM capability | Current implementation | Chromium-shell port required | Acceptance checks |
| --- | --- | --- | --- |
| Address bar and navigation | Native EditText; navigateFromAddress() and URL normalization | Port the toolbar/address actions into the Chromium browser activity and navigation controller. Preserve explicit scheme handling; don't pass arbitrary schemes to the renderer. | HTTP/HTTPS works; searches remain searches; unsupported schemes are rejected; certificate errors have no bypass. |
| Back / forward / home | Calls WebView navigation APIs and loads the bundled home URL | Bind MVM controls to Chromium tab/navigation state, not WebView methods. | Controls act on the active tab and reflect its navigation history. |
| Multiple tabs | BrowserTab wraps a WebView; active views are attached/detached from webHost | Use Chromium's tab model and lifecycle. Do not build a second WebView-per-tab layer around Chromium. | Create, switch, close and recover tabs; background tabs don't do unnecessary work; no stale callbacks. |
| MVM start page | home.html and BrowserBridge JavaScript interface | Rebuild as the selected Chromium new-tab/home surface. Prefer native browser actions or a narrowly scoped trusted-origin API over a general JavaScript bridge. | Offline first launch; search/address entry works; buttons target the current tab; remote pages cannot call MVM-only actions. |
| Search results | Native bridge fetches DuckDuckGo HTML and parses result markup | Move provider selection and result rendering into the new-tab/search surface. Treat HTML scraping as brittle and isolate it from navigation. | Unicode, empty query, timeout, malformed response, zero results and safe link opening are tested. |
| Ad and tracker blocking | AdBlocker.shouldBlock(host), a static host list checked by WebView interception | Reimplement at a Chromium network/resource interception point. The WebView callback cannot be reused as-is. Select a maintained rule format and define list-update provenance. | Test ad/tracker requests are blocked; subdomain matching is correct; false positives and updates are documented. |
| Bookmarks | URL set in SharedPreferences | Port into Chromium's bookmark model/profile storage; provide migration or export if current user data must survive. | Add/remove, duplicate URL, restart persistence, long URL and malformed values. |
| History | Timestamp-prefixed URL strings in SharedPreferences, capped at 200 recent entries | Use Chromium history/profile services with a bounded UI query; define an import policy rather than silently dropping history. | Chronological order, duplicate visits, clear-history semantics and the 200-entry policy. |
| Offline pages | WebView.saveWebArchive() stores MHTML in app-private storage | Decide whether MHTML remains supported in the downstream shell. Use a Chromium-supported save/offline-page path where available; retain canonical-path and private-storage constraints. | Save/reopen offline; missing/corrupt archive; traversal/symlink attempt; remote pages cannot embed private archives. |
| Downloads | Android DownloadManager; sanitized filename; HTTP/HTTPS only; WebView cookies and User-Agent copied | Use Chromium's download manager/network stack so authenticated downloads follow the selected profile. Preserve filename and scheme restrictions. | Authenticated/large downloads, cancel/retry, filename edge cases, interrupted transfer, roaming policy, no scheme escape. |
| Clear browsing data | Clears WebView history/cache/form data, DOM storage and cookies; preserves bookmarks/offline files | Map to Chromium profile data-removal APIs. Treat history, cookies, cache, passwords, permissions and site storage as separate categories. | Selected categories clear; unrelated categories remain; open tabs do not restore cleared data. |
| Transport/content security | Mixed content blocked; Safe Browsing where available; SSL errors cancelled; unsupported schemes rejected | Preserve Chromium network security defaults and fail-closed TLS behavior. Review custom schemes, file/content URLs, downloads and external intents. | Invalid TLS, mixed content, malicious redirect, unsupported scheme, private offline file and external intent tests. |
| Local file bridge | BrowserBridge is attached after reaching bundled home asset and removed on remote page start | Avoid exposing it as a remote-page API. If local UI needs a bridge, bind to an exact trusted origin and minimum methods. | Remote origins never see privileged MVM APIs during redirects, history navigation or tab restoration. |
| App identity | com.mvmsolo.mvmbrowser, MVM label/icon, minSdk 24 | Modify downstream Chromium package identity, browser UI, launcher assets and signing policy. Changing the existing Kotlin APK label does not rebrand Chromium. | Package id, launcher label/icon, signature, update identity, distribution metadata and notices agree. |
| Lifecycle/memory | WebViews are destroyed when a tab closes and on activity destruction | Follow Chromium tab/profile lifecycle; do not keep parallel WebViews. Validate suspension, renderer crash recovery and process recreation. | Tab close releases state; resume works; renderer crash can recover; repeated open/close does not leak memory. |

## Suggested implementation order

### Phase 0 — build proof and artifact provenance
1. Run scripts/check-chromium-build-host.sh on dedicated x86-64 Linux with at least 8 GiB RAM and 100 GiB free disk; 16+ GiB RAM is preferred.
2. Pin Chromium and depot_tools revisions, keep GN args/logs/metadata together, and build the unmodified upstream chrome_public_apk.
3. Run scripts/verify-chromium-apk.sh. With Android SDK tools, it checks package metadata and signing as well as hashes.
4. Run scripts/smoke-test-chromium-device.sh without --install. Only after reviewing the selected device serial should the install test be opted into.

### Phase 1 — choose the downstream shell
1. Select upstream Chromium or a reviewed fork only after comparing base revision, maintenance activity, security patches, build reproducibility and license obligations.
2. Establish package id, signing/update policy, Android 10+ support decision, branding and source-patch workflow.
3. Keep the current WebView release usable while the Chromium fork is developed.

### Phase 2 — port high-risk primitives first
1. Navigation and tab lifecycle.
2. TLS/content-security defaults and private-file policy.
3. Downloads, clear-data semantics, bookmarks and history.
4. MVM home/search experience.
5. Ad/tracker filters and offline-page behavior.
6. Brand pass, accessibility, performance and end-to-end regression testing.

### Phase 3 — release gate
Do not call the product “Chromium-powered MVM Browser” until a branded downstream build launches on a real Android device and the acceptance checks above pass. Bootstrap CI tests scripts and synthetic fixtures only; it is not evidence that Chromium has been compiled, installed or device-tested.

## Decisions still open

- Android 7–9: current MVM supports API 24+, but upstream chrome_public_apk is API 29+. Do not silently raise minSdk until dropping older Android support is an explicit product decision.
- Branding route: changing Chromium application id and browser UI is a fork/port project, not just a manifest label edit.
- Ad-blocking rules: decide source, update cadence, licensing and false-positive behavior before replacing the static denylist.
- Data migration: decide whether current bookmarks, history and offline MHTML files must be imported into the Chromium profile.
- Distribution: settle signing-key custody, security update cadence, privacy disclosure, notices and crash-reporting policy before public release.
