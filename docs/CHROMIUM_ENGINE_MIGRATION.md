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

The current app's capability-by-capability work is tracked in [CHROMIUM_FEATURE_PORT_MATRIX.md](CHROMIUM_FEATURE_PORT_MATRIX.md). Use it as the acceptance checklist for the downstream shell port; the existing WebView features are not automatically inherited by the proof APK.

### Adopted direction: use a complete open-source Chromium browser as the base

The first candidate to evaluate is [Cromite](https://github.com/uazo/cromite), a complete Chromium-based Android browser project, rather than trying to embed its APK inside the existing Kotlin app.

- Its upstream README describes Android ARM64, ARM32, and x86-64 builds and Android 10+ support.
- Its build guide documents a ready-to-build Docker image per release, which may reduce environment setup compared with starting from a raw Chromium checkout. The image is a build environment, not a drop-in engine library.
- The latest release visible during this research was `v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a`, published 2026-09-15. Recheck upstream release freshness and security fixes before adopting it.
- The project declares GPL-3.0 for its patches. A fork/distribution needs a proper license and third-party notice review, and compliance with source-availability and other applicable obligations. Do not copy only the APK or remove its notices.
- Its Android 10+ baseline means this route does not preserve the current MVM app's declared Android 7–9 support without separate engineering.

**Architecture choice:** fork/port MVM features into Cromite's browser source and build a distinct MVM-branded APK. Do not package the Cromite APK as an asset, and do not treat its SystemWebView APK as a library that can be embedded in this app.

Useful upstream references:
- Repository and project status: https://github.com/uazo/cromite
- Latest published release: https://github.com/uazo/cromite/releases/latest
- Build instructions and Docker-image workflow: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- License: https://github.com/uazo/cromite/blob/master/LICENSE

Decision for the next prototype: evaluate Cromite as the downstream source base instead of paying for a separate cloud Chromium build. This avoids maintaining a separate raw-Chromium build path if the project proves suitable, but it does not eliminate compilation, testing, or ongoing security updates. Before shipping any derivative, review the exact source revision, current security state, license requirements, build image provenance, and whether MVM's feature list can be ported cleanly.

1. **Inspect the ready-made release without paying for a build server:** use the upstream release APK only as a temporary reference/test artifact on a compatible Android device. Do not insert the APK into the current app or treat it as an embeddable engine.
2. **Fork the source project under MVM's own identity:** keep the upstream license and notices; change application identity, icons, strings, new-tab UI, and browser branding in source.
3. **Use an existing free build environment if it genuinely has enough RAM/disk.** Do not try to build Chromium on the current constrained environment. If no suitable free environment exists, pause before creating paid infrastructure rather than silently incurring cost.
4. **Port MVM features in small, testable groups:** tabs, bookmarks, history, downloads, offline saves, ad/tracker rules, and the existing MVM start page. Keep a feature matrix and test each port.
5. **Pin upstream revisions and maintain security updates:** record source commit, build inputs, APK checksum, and third-party notices for each test release.
6. **Validate before release:** test on real Android devices, including HTTPS/error handling, downloads, tab lifecycle, app resume, permissions, and update behavior.

## No-paid-server prototype plan

The immediate goal is a zero-cloud-cost feasibility check, not a claim that a customized APK already exists:

- [ ] Inspect Cromite's latest release and source revision; confirm supported Android version and device ABI.
- [ ] Treat the prebuilt release as a reference/test app only; do not re-sign, rename, or redistribute it as MVM.
- [ ] Inspect the source license and build instructions before making a derivative. Cromite declares GPL-3.0 for its patches, so a distributed derivative must comply with the applicable source and notice obligations.
- [ ] Try a build only on an already-available environment that passes `scripts/check-chromium-build-host.sh`; do not create a paid server automatically.
- [ ] If no eligible free build host is available, continue porting/design work in source and defer APK production until a suitable host is available.
- [ ] Keep the existing MVM Browser WebView app working until the source fork produces an installable and tested MVM APK.

A prebuilt APK saves the cost of producing a reference binary, but it cannot replace the source build needed to change application ID, UI, assets, and native browser behavior safely.

## First build step

A starter script is now committed at [`scripts/build-chromium-android.sh`](../scripts/build-chromium-android.sh). On a dedicated x86-64 Linux machine, it fetches Chromium, installs its official build dependencies, configures an arm64 build, and runs `autoninja -C out/MVM chrome_public_apk`. It expects at least 100 GB of free disk space and recommends 16 GB or more RAM. The source checkout can take hours; this is not suitable for a standard Android Gradle runner or a phone-only build environment.

Before any source download, run the no-cost environment report: `bash scripts/check-chromium-build-host.sh`. It prints CPU, RAM, free disk, and basic Linux-distribution details without installing packages, downloading source, or creating cloud resources.

Run the build only on a host that meets the report's requirements, after confirming available disk/network and the intended cost. For reproducible testing, pin both Chromium and `depot_tools` to a known commit or ref. When `DEPOT_TOOLS_REVISION` is supplied, the script checks out that tool version and disables its auto-update; without it, the default auto-update behavior remains enabled:

```bash
bash scripts/check-chromium-build-host.sh
CHROMIUM_REVISION='PUT_FULL_CHROMIUM_COMMIT_SHA_HERE' DEPOT_TOOLS_REVISION='PUT_FULL_DEPOT_TOOLS_COMMIT_SHA_HERE' bash scripts/build-chromium-android.sh
```

At completion, the script reports the Chromium four-part version from chrome/VERSION, actual Chromium commit, `depot_tools` commit, GN-args SHA-256, and APK SHA-256. The offline verifier requires a valid MAJOR.MINOR.BUILD.PATCH value in the metadata. It also writes `MVM-Chromium-arm64.metadata.txt` and copies the effective GN args to `MVM-Chromium-arm64.args.gn` next to the APK. When `CHROMIUM_REVISION` is supplied, the script resolves it to an exact commit (using `FETCH_HEAD` for remotely fetched refs) before syncing dependencies. When `DEPOT_TOOLS_REVISION` is supplied, it does the same for `depot_tools` and records whether automatic tool updates were disabled. Save the APK, metadata, GN args file, and build logs together when comparing repeat builds.

Before any installation attempt, run the offline verifier against the output:

```bash
bash scripts/verify-chromium-apk.sh
```

The verifier checks the APK ZIP integrity, root Android manifest entry, both SHA-256 digests, target ABI/OS, and full Chromium/`depot_tools` commit IDs. When Android Build Tools `aapt` is available, it additionally checks the package ID, `minSdkVersion` (API 29+), and `arm64-v8a` native code. When `aapt` is unavailable it clearly notes that binary-manifest checks were skipped. It does not download, install, or launch anything. A successful verifier result confirms local artifact integrity and provenance fields, not that Chromium will launch correctly on a device.

When a real Android 10+ ARM64 device is connected with USB debugging authorized, run the device preflight:

```bash
bash scripts/smoke-test-chromium-device.sh --serial DEVICE_SERIAL
```

It validates the build wrapper and device API/ABI without installing. Only after reviewing the target serial, opt into the install-and-launch test:

```bash
bash scripts/smoke-test-chromium-device.sh --install --serial DEVICE_SERIAL
```

The `--install` mode requires an interactive confirmation before it installs the locally built APK and opens `https://example.com`. After it completes, visually confirm that the page rendered; the script cannot certify UI rendering by command success alone.

The expected output is an unbranded Chromium APK named `MVM-Chromium-arm64.apk` under the chosen Chromium workspace. The script requests noninteractive dependency installation, checks that sudo is usable before a large checkout for non-root users, and syncs dependencies without running hooks twice. It also invokes the source-cleanliness guard before dependency installation and again after sync/hooks.

After the checkout is present, these read-only diagnostics can be run separately:

```bash
bash scripts/check-chromium-source-clean.sh "$HOME/chromium-mvm/src"
bash scripts/check-chromium-gclient-config.sh "$HOME/chromium-mvm/.gclient"
bash scripts/read-chromium-version.sh "$HOME/chromium-mvm/src/chrome/VERSION"
```

The build automatically runs the latter two checks at the appropriate points; these separate commands are useful when diagnosing an existing checkout. The two revision values in the build example must be replaced with real full 40-character Git commit SHAs.

A manual workflow is also available at [chromium-self-hosted-build.yml](../.github/workflows/chromium-self-hosted-build.yml). It requires a runner labelled self-hosted, linux, x64, chromium-builder with enough RAM/disk, noninteractive dependency-install permissions, and two full 40-character commit SHAs. It only accepts a dispatch from main with confirm_build=yes; it uploads the APK plus provenance files for 14 days. It does not provision infrastructure and does not install the APK on a device. The script has been committed, but it has **not** been executed in this environment; do not treat the APK as built or tested yet.

## Important status

The current MVM Browser app still uses Android WebView. The proof APK's Android 10+ minimum means we must explicitly decide whether the future Chromium-based MVM Browser will drop support for Android 7–9 or require substantial custom engineering to preserve those older devices. The first technical milestone is a successful, reproducible upstream Chromium Android build. Only after that build is confirmed should we port MVM identity and features into the Chromium browser shell.
