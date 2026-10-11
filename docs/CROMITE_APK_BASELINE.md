# Cromite ARM64 APK baseline

This workflow fetches the official upstream ARM64 APK as a reproducible inspection baseline. It verifies the pinned SHA-256, extracts Android package metadata, and verifies the APK signature with Android SDK build-tools. It does **not** integrate Chromium into the MVM app, rebrand the package, or build MVM Browser.

## Verified result

- Upstream: https://github.com/uazo/cromite
- Pinned release: `v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a`
- Asset: `arm64_ChromePublic.apk` (about 309 MiB)
- SHA-256: `9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071` — matched in GitHub Actions
- Android package: `org.cromite.cromite`
- Version: `153.0.8010.37` (versionCode `801003702`)
- Minimum SDK: 29; target SDK: 36
- ABI: `arm64-v8a`
- Signature: APK Signature Scheme v2 verified; one signer, `CN=CromiteOrg`
- Signer certificate SHA-256: `633fa41d8211d6d0916a819b89668c6de92e64232da67f9d16fd81c3b7e923ff`
- Artifact: https://github.com/MvMSOLO/mvmbrowser/actions/runs/38134510258/artifacts/11700790997
- Artifact expires: 2026-10-18; the binary is deliberately not committed to Git.

## Engineering decision

Do not rename the APK file and call it MVM Browser. The verified binary has the upstream package ID `org.cromite.cromite` and is signed with the upstream Cromite certificate. An MVM-branded release needs a source-level build with an MVM application ID, branding/resources, a separate MVM signing key, and a reviewed set of upstream patches. The upstream APK is useful for behavior/reference inspection only, and its package/signing identity should not be represented as MVM's.

A matching digest proves that downloaded bytes match the pinned upstream release asset; it does not establish that the APK is safe for every device, that its signing identity is suitable for MVM, or that redistribution is permitted. Review the package ID, signing certificate, upstream license/NOTICE files, Android compatibility and security patch level before using it beyond baseline analysis.

Run it from GitHub Actions with **Cromite ARM64 APK Baseline → Run workflow**. A successful run exposes the `cromite-arm64-upstream-baseline` artifact for seven days.
