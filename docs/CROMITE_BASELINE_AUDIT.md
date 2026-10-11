# Cromite baseline audit — 2026-10-11

## Result

**Cromite is selected as the prototype/source-fork candidate, but its currently published Android release is not approved as a release-ready security base.**

- Upstream: https://github.com/uazo/cromite
- Build guide: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- Latest release inspected: [v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a](https://github.com/uazo/cromite/releases/tag/v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a)
- Published: 2026-09-15
- ARM64 APK: [arm64_ChromePublic.apk](https://github.com/uazo/cromite/releases/download/v153.0.8010.37-11507ac1061b5ea227806f5e84db5a57df6ccf6a/arm64_ChromePublic.apk)
- Published APK size: 323,809,949 bytes
- Published SHA-256: `9db12af1af021f42b4371e76d0e9fe476a7085bbbbc76bc410a538d028bf6071`
- Official Chrome release information reported Chrome Stable 155.0.8059.39 on 2026-10-06: https://releases.sh/google/chrome-releases
- Therefore the available Cromite release is two major versions behind that stable baseline. This comparison is a warning gate, not a complete CVE audit.

## What this means

1. The APK is useful as a ready browser to inspect UI/behavior on a test device, but it must not be called an integrated MVM engine.
2. Cromite's repository is a patch/build project; its build guide describes release-specific Docker images, GN arguments and an ordered patch list. It is not an Android AAR that can be inserted into the current Kotlin app.
3. The existing MVM script `scripts/build-chromium-android.sh` builds vanilla Chromium. It does not apply Cromite's patch set and must not be reused as a Cromite build command without an explicit implementation.
4. The source fork needs a pinned Cromite revision, its matching build image, source/patch provenance, and a version/security review before producing a public release.
5. The MVM Android app currently has `minSdk 24`; Cromite documents Android 10+ support. A Cromite browser fork must use a separate app target/configuration with Android 10+ minimum unless older support is proven by an actual build and device test.

## Repeatable preflight

Run from a Linux machine with Python 3:

```bash
python3 scripts/check-cromite-release.py --stable-version 155.0.8059.39
```

The script queries the latest GitHub release and blocks when its Chromium version is older than the supplied stable baseline. The stable version must be independently checked against current official release notes before each run.

To verify an APK already downloaded from the official release:

```bash
python3 scripts/check-cromite-release.py --stable-version 155.0.8059.39 --apk /path/to/arm64_ChromePublic.apk
```

The script checks the SHA-256 published by GitHub. A checksum match proves the bytes match the release metadata; it does not prove the browser is security-current.

## Next implementation gate

- [ ] Recheck current Chrome Stable and latest Cromite release.
- [ ] Identify a Cromite release whose Chromium base is current enough for the intended test/release.
- [ ] Read its release-specific build image and patch workflow.
- [ ] Build only on an already-available suitable Linux x86-64 runner; do not create paid infrastructure automatically.
- [ ] Keep MVM branding changes separate from upstream patch/build changes.
- [ ] Preserve GPL-3.0 and third-party notices and review source-distribution obligations.
