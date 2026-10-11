# Cromite Android ARM64 build procedure

## Pinned upstream inputs

- Cromite source commit: `11507ac1061b5ea227806f5e84db5a57df6ccf6a`
- Chromium version: `153.0.8010.37`
- Official build image: `uazo/cromite-build:153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a`
- Upstream prebuilt APK SHA-256: `9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071`
- Upstream build guide: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- Upstream build workflow: https://github.com/uazo/cromite/blob/master/.github/workflows/build_cromite.yaml

The upstream guide says the build image includes a Chromium source checkout and that the Cromite patches are applied in the source-image preparation workflow. The MVM script deliberately uses that published build image rather than accidentally invoking our separate vanilla-Chromium builder.

## MVM package identity overlay

Before GN generation, the build script verifies that the pinned source contains exactly one upstream `chrome_public_manifest_package = "org.bromite.bromite"` declaration, replaces only that package value with `com.mvmsolo.mvmbrowser`, and checks the produced APK's package metadata and ARM64 ABI with `aapt`. It fails closed if the source context differs or the APK metadata does not match. This aligns the package ID with the existing MVM Android Gradle `applicationId`; it does **not** rebrand the app label, icons, settings UI or new-tab page. Those remain separate work in the source fork at https://github.com/MvMSOLO/mvm-cromite/tree/mvm-branding-bootstrap.

The output is named `MVM-Cromite-153.0.8010.37-arm64-MVM-package.apk`. Metadata explicitly records `branding_status=package-id-only-upstream-ui`. Verify signing and licensing before any install or redistribution.

## Observed build-image blocker — 2026-10-11

The upstream-watch job for this branch attempted `docker manifest inspect` on the exact pinned image `uazo/cromite-build:153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a` and could not verify its manifest. The job emitted a warning and deliberately did not pull an image or start compilation. See [the run log](https://github.com/MvMSOLO/mvmbrowser/actions/runs/38139634564). This result is **UNKNOWN/BLOCKED**, not proof the tag definitively does not exist: registry, manifest, or access failures can look the same here.

The public [Cromite build-image page](https://hub.docker.com/r/uazo/cromite-build) currently surfaces an older recent tag, while the current Cromite release page is on 153. The separate [uazo/chromium image](https://hub.docker.com/r/uazo/chromium/tags) lists Chromium 154, but that vanilla/source image is **not a safe substitute** for the release-matched Cromite build image: it does not prove the right Cromite patch stack has been applied. Keep the version/commit pair pinned. The build script fails closed before `docker pull` if the exact manifest cannot be inspected.

Before running `--execute`, recheck the exact pinned manifest and arrange an eligible Linux x86-64 Docker host with enough free disk/RAM. If the exact image remains unavailable, follow the upstream [build workflow](https://github.com/uazo/cromite/blob/master/.github/workflows/build_cromite.yaml) and its image-preparation path on an already available suitable host; do not silently substitute vanilla Chromium or create paid infrastructure. No Chromium source compilation or MVM APK has been completed yet.

## Safe execution

The script defaults to a dry run. It does not pull an image or compile unless the user explicitly supplies `--execute`.

```bash
bash scripts/build-cromite-android.sh
bash scripts/build-cromite-android.sh --execute
```

Requirements: x86-64 Linux, Docker Engine, network access, at least 150 GiB free disk (configurable with `CROMITE_MIN_FREE_GIB`), and 16 GiB RAM or more recommended. The full compile can take hours and may consume substantial disk and bandwidth. The script does not provision a cloud machine or start a paid service.

Output is written under `artifacts/cromite/` by default, or to `OUTPUT_DIR` if supplied. Build metadata and a SHA-256 checksum are written beside the APK.

## Important release gates

- The exact 153 Cromite build-image manifest was not verified by the 2026-10-11 upstream-watch run. This is a build blocker until a fresh manifest check succeeds; the green watch workflow means the metadata report worked, not that the image or APK build succeeded.
- This pinned upstream Chromium base is 153.0.8010.37 and is behind the Chrome Stable baseline recorded in `CROMITE_BASELINE_AUDIT.md`. This is a reproducibility/prototype build, not an approval for sensitive browsing or public release.
- The upstream APK hash only identifies the upstream release artifact. A locally built APK must have its own checksum; it will not be expected to match the upstream APK byte-for-byte.
- Inspect signing with Android `apksigner` before installing. The script does not assume the upstream release signing key is available.
- This build overrides only the Android package ID to `com.mvmsolo.mvmbrowser`. App label, icons, strings, settings UI, start page, signing, and MVM feature-porting remain incomplete; do not call it a finished MVM Browser.
- Preserve GPL-3.0 and third-party license notices and comply with corresponding source-distribution obligations.
