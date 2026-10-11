# Cromite ARM64 APK baseline

This workflow fetches the official upstream ARM64 APK as a reproducible inspection baseline. It verifies the pinned SHA-256, extracts Android package metadata, and verifies the APK signature with Android SDK build-tools. It does **not** integrate Chromium into the MVM app, rebrand the package, or build MVM Browser.

- Upstream: https://github.com/uazo/cromite
- Pinned release: `v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a`
- Asset: `arm64_ChromePublic.apk` (about 309 MiB)
- Expected SHA-256: `9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071`
- Artifact retention: 7 days; the binary is deliberately not committed to Git.

The artifact contains the APK, its checksum, package metadata, and signature-verification output. A matching digest proves that downloaded bytes match the pinned upstream release asset; it does not establish that the APK is safe for every device, that its signing identity is suitable for MVM, or that redistribution is permitted. Review the package ID, signing certificate, upstream license/NOTICE files, Android compatibility and security patch level before using it beyond baseline analysis.

Run it from GitHub Actions with **Cromite ARM64 APK Baseline → Run workflow**. A successful run exposes the `cromite-arm64-upstream-baseline` artifact for seven days.
