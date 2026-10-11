# MVM Browser — Chromium Distribution and Maintenance Checklist

This checklist is for the point when the first upstream Chromium APK has built and passed device smoke tests. It is not a declaration that a distributable MVM Chromium browser already exists.

## Branding and legal notices

- [ ] Keep MVM branding separate from Google Chrome branding. Do not use Chrome logos, imply Google endorsement, or promote the fork as an official Google product.
- [ ] Review the Chromium top-level BSD 3-Clause license: https://github.com/chromium/chromium/blob/main/LICENSE
- [ ] Do not assume the top-level license describes every bundled component. Generate and inspect the actual third-party license/notice output for the exact Chromium revision and build configuration.
- [ ] Ship required copyright, license, and third-party notices in the places required by each applicable license.
- [ ] Record every local patch and keep corresponding source changes and notices when required by the relevant component's license.
- [ ] Before distributing publicly or commercially, have a qualified adult/project maintainer review legal, trademark, privacy, and app-store requirements.

## Security update policy

- [ ] Pin an exact upstream Chromium revision for every build; record its commit hash and Android target.
- [ ] Subscribe to and monitor official Chromium security and release documentation:
  - https://github.com/chromium/chromium/blob/main/docs/security/updates.md
  - https://github.com/chromium/chromium/blob/main/docs/process/release_cycle.md
- [ ] Establish a repeatable process to merge security updates, rebuild, smoke-test, sign, and publish new MVM builds.
- [ ] Do not distribute a one-off Chromium APK as though it will update itself. Design and test an update/distribution channel before public release.
- [ ] Track the date of each upstream revision and the date each fixed build reaches users. Pause releases if security fixes cannot be kept current.
- [ ] Avoid adding Google API keys or relying on Google-only services until the project explicitly configures and is authorized to use them. The upstream build guide says API keys are optional for most development/testing.

## Build provenance and reproducibility

- [ ] Store the exact Chromium revision, depot_tools revision, GN args, host OS, toolchain versions, build logs, APK SHA-256, and test results for each candidate release.
- [ ] Use a dedicated build host; don't use a small ephemeral GitHub runner as a substitute for a qualified Chromium build machine.
- [ ] Keep signing keys and credentials outside source control and build logs.
- [ ] Ensure public release artifacts are produced only from reviewed source revisions and a reproducible documented process.
- [ ] Test on real Android devices: launch, navigation, HTTPS errors, downloads, tab lifecycle, permissions, orientation, app resume, update behavior, and crash recovery.

## Current state

- The current MVM Browser product remains a Kotlin app using Android System WebView.
- The repository contains a script intended to build upstream Chromium's Chrome public APK target as a proof milestone.
- Neither the Chromium APK build nor the above distribution checks have been completed in this environment.

## Official sources

- Chromium license: https://github.com/chromium/chromium/blob/main/LICENSE
- Chromium third-party library license guidance: https://chromium.googlesource.com/chromium/src/+/main/docs/adding_to_third_party.md
- Chromium Android build guide: https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md
- Chromium security update guidance: https://github.com/chromium/chromium/blob/main/docs/security/updates.md
- Chromium release cycle: https://github.com/chromium/chromium/blob/main/docs/process/release_cycle.md
