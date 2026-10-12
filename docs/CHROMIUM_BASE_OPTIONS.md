# MVM Browser — Chromium Base Options (Decision Note)

Research date: 2026-10-12

## Decision

**Selected first implementation path: fork Cromite at source level and adapt the browser into an MVM-branded product.** The existing Android System WebView app remains the stable fallback while the fork is being built and tested.

This is a source-level fork—not an APK embedded into the current app and not a claim that a standalone Chromium engine is already integrated.

Execution checklist: [CROMITE_FORK_EXECUTION_PLAN.md](CROMITE_FORK_EXECUTION_PLAN.md).

## Candidate A — Cromite (selected)

Source: https://github.com/uazo/cromite  
Build notes: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md  
Releases: https://github.com/uazo/cromite/releases

What was verified:
- Cromite describes itself as a Chromium fork with built-in ad blocking and privacy-focused changes.
- It publishes complete Android browser APKs for ARM64, ARM32 and x86-64, and its README states Android 10+ support.
- Its build guide points to a release-specific Docker build image, GN args, and an ordered patch list.
- The repository declares GPL-3.0 for the project; individual patches may carry their own licensing information.
- The source is a full browser project, not a supported Android SDK/AAR for embedding into MVM's existing Kotlin app.

Why selected:
- It already contains a Chromium-based browser shell and a maintained patch/build structure, so MVM can customize a real browser rather than build a browser shell from scratch.
- It provides a clear source fork path for branding and porting MVM-specific features.

Gates before any public distribution:
- Recheck the exact source revision against current Chromium stable and relevant security fixes; the release snapshot examined during this research was behind the then-current stable line.
- Pin source commit, Docker image tag/digest, build args and toolchain revisions.
- Keep license files, copyright notices and third-party attributions. Review GPL obligations and provide the corresponding source and notices as required before distributing modified binaries.
- Confirm build capacity without automatically creating paid infrastructure.
- Produce and verify a real ARM64 APK, then install and test it on an Android 10+ device.

## Candidate B — Vanilla upstream Chromium (fallback/reference)

Source: https://chromium.googlesource.com/chromium/src/  
Build guide: https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md

Advantages:
- Clean upstream baseline with official build documentation.
- Useful if Cromite's patches, security state, licensing, or build process fail the feasibility gates.

Trade-offs:
- Large checkout/build and substantial browser-shell work remain.
- Official Android build documentation calls for x86-64 Linux, at least 8 GB RAM, 100 GB free disk, and recommends more than 16 GB RAM. The local `chrome_public_apk` target is Android 10+.
- It is not a supported drop-in engine library for the existing Kotlin app.

Decision: do not spend resources on a separate vanilla Chromium proof build in parallel unless Cromite fails a documented gate or a specific comparison is needed.

## Candidate C — qwez-dev Cromite maintenance fork (review lead only)

Source: https://github.com/qwez-dev/cromite

A recheck on 2026-10-12 found `build/RELEASE = 148.0.7778.168`, repository last-pushed date 2026-08-24, and no published GitHub release endpoint. This is older than the official uazo/Cromite v153 release and behind current Chrome Android Stable.

Decision: do not switch. A stated maintenance goal is not evidence of freshness; a fork must prove its base version, patch series, build workflow, license, and successful build output.

## Candidate D — Etherdrake Cromite fork (rejected)

Source: https://github.com/Etherdrake/cromite

The repository snapshot was last pushed on 2025-02-13, its `build/RELEASE` reports `133.0.6943.60`, and no published GitHub release endpoint was returned. This baseline is older than both official Cromite v153 and Chrome Android Stable 155.

Decision: reject as an engine baseline; it offers no demonstrated security freshness or reproducible released Android artifact.

## Candidate E — Mozilla GeckoView (not selected)

Source: https://github.com/mozilla/geckoview

GeckoView is an embeddable engine, but it is Gecko rather than Chromium. It does not meet the current requirement for an independently maintained Chromium-based browser.

## Resource and release constraints

- No paid host or paid larger CI runner should be created or triggered without explicit approval.
- The current environment has not produced a modified MVM-branded Cromite APK.
- The existing MVM Android app still uses System WebView.
- Cromite's Android 10+ baseline means the fork prototype should explicitly target Android 10+ unless older-version support is separately engineered and tested.
- A release watcher is only a version signal, not a complete security audit.

## Verification links

- Cromite source and license: https://github.com/uazo/cromite
- Cromite build process: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- Chromium Android build requirements: https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md
- Current MVM execution plan: [CROMITE_FORK_EXECUTION_PLAN.md](CROMITE_FORK_EXECUTION_PLAN.md)
