# MVM Browser — Chromium Base Options (Decision Note)

Research date: 2026-10-11

## Executive recommendation

Keep the raw upstream Chromium proof build as the reference milestone, but evaluate Cromite as a downstream browser-shell candidate before committing to a long-term fork strategy. Do not try to use either browser APK as a drop-in Gradle library: both are complete browser apps, not a supported Android SDK for embedding.

## Candidate A — Upstream Chromium

Source: https://chromium.googlesource.com/chromium/src/

Advantages:
- Cleanest upstream baseline and no extra third-party browser patches.
- Official Android build documentation and a clear chrome_public_apk proof target.
- Best for identifying what upstream Chromium itself supports.

Trade-offs:
- Large checkout and build; the official guide currently requires x86-64 Linux, at least 8 GB RAM, and 100 GB free disk (more than 16 GB RAM is highly recommended).
- The current local-development chrome_public_apk target requires Android 10+.
- It is a whole browser app. Turning it into a branded MVM product means porting/changing browser shell code and maintaining those patches.

Official guide: https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md

## Candidate B — Cromite

Source: https://github.com/uazo/cromite
Build notes: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
Releases: https://github.com/uazo/cromite/releases

What was verified:
- Its README describes it as a Chromium fork with integrated ad blocking and privacy-focused changes.
- It publishes full Android browser APK assets for ARM64 and other architectures, rather than only a WebView wrapper.
- Its build documentation provides GN args/patch-list references and describes a ready-to-build Docker image per release.
- The latest stable release returned by GitHub during this research was v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a, published 2026-09-15. Its arm64_ChromePublic.apk asset is about 309 MiB with published SHA-256 9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071.

Advantages:
- Provides a working Chromium browser shell and a patch/release process to study.
- Built-in ad blocking/privacy features may reduce the amount of browser plumbing MVM needs to create from scratch.
- The release APK can be a reference smoke-test artifact, after confirming that the release is current enough for security needs and verifying the digest.

Trade-offs:
- Its own README states Android support is Android 10 and above; this does not preserve MVM's current Android 7+ support target.
- Its APK is around 309 MiB. It is a complete application package, not an Android library to embed inside the existing MVM Kotlin app.
- Rebranding requires understanding and maintaining browser UI/source patches, update process, licensing and notices. Its extra privacy/ad-blocking patches create additional behavior to review.
- The last stable release observed in this snapshot is dated 2026-09-15. A release being available does not itself prove it contains every latest Chromium security fix; check the upstream version and release history again before selecting it.

## Candidate C — Mozilla GeckoView

Source: https://github.com/mozilla/geckoview
Quick start: https://github.com/mozilla-firefox/firefox/blob/main/mobile/android/docs/geckoview/consumer/geckoview-quick-start.md

GeckoView is a genuine embeddable browser engine, but it is Gecko, not Chromium. It only meets the product goal if MVM's requirement changes from “independent Chromium” to “independent embeddable engine.” It should not be chosen silently as a substitute.

## Recommended decision process

1. Do not provision a paid host until eligibility, account limits, and spending have been cleared by the account owner/adult where required.
2. Use a published Cromite APK only as an optional comparison artifact. Before relying on it, verify its SHA-256, signing certificate, source release tag, Chromium version, and security patch status. Do not install a binary just because a web page links to it.
3. Compare Cromite's browser-shell approach against the raw Chromium source tree; estimate the MVM branding/UI port from source code rather than assuming an APK can be embedded.
4. Keep the existing WebView app stable during experiments.
5. After selecting a base, pin the source revision, target ABI/minimum Android version, build configuration, license notices, update cadence, and APK provenance.

## Current blockers and status

- DigitalOcean's connected account API currently reports a quota/status warning and zero listed active droplets; no new paid resource has been created.
- The current tool environment is not large enough for a Chromium source checkout/build.
- MVM Browser still uses Android System WebView.
- No Cromite APK has been downloaded, installed, modified, or claimed as tested in this workflow.

## Verification links

- Chromium Android build requirements: https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md
- Cromite repository and version/platform scope: https://github.com/uazo/cromite
- Cromite build process: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- Exact release and assets: https://github.com/uazo/cromite/releases/tag/v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a
