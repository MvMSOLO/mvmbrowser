# MVM Browser — Engine Resource Research

Research date: 2026-10-11

This note tracks realistic engine and build-resource options for moving MVM Browser beyond Android System WebView. Findings are based on official upstream documentation; availability and compatibility should be rechecked before implementation.

## Executive decision

**Preferred target remains an independently built Chromium Android browser.** There is no verified, supported drop-in Android AAR that embeds the complete current Chrome/Chromium browser engine into this Kotlin app. Do not add a random package claiming to be “Chromium WebView” without checking source, maintenance, licensing, security update cadence, ABI support, and whether it actually ships its own engine.

## Option matrix

| Option | What it gives us | Main constraint | Current decision |
| --- | --- | --- | --- |
| Android System WebView | Existing app integration, OS-provided engine updates | Not an independently bundled engine; rendering version depends on device/provider | Keep for current stable app while researching |
| GeckoView | Mozilla Gecko engine embedded in an Android app; official Maven repository and Android Components | Changes engine family to Gecko, not Chromium; integration and APK size/testing work required | Evaluate only as a fallback if the independent-engine requirement changes |
| Chromium Android source (chrome_public_apk) | Upstream Chromium browser build, real Chromium code and rendering engine | Large source/build, Linux x86-64 required; not a simple Gradle dependency or drop-in view | Preferred proof-of-build milestone |
| Chromium WebLayer/WebEngine material | Upstream embedding work related to Chromium | Historical WebLayer docs mark API deprecated; WebEngine docs describe evolving integration and implementation constraints | Do not rely on it as a stable standalone SDK without fresh upstream confirmation |
| Unverified third-party “Chromium AAR” | Potentially convenient integration | May wrap system WebView, be stale, lack source, or miss security updates | Reject until independently verified |

## Official resources

1. **Chromium Android build guide**  
   https://chromium.googlesource.com/chromium/src/+/main/docs/android_build_instructions.md  
   States that Android builds require an x86-64 Linux machine, at least 8 GB RAM (more than 16 GB highly recommended), and at least 100 GB free disk. The official build target includes chrome_public_apk; Windows/macOS are not supported for this build flow.

2. **Chromium Linux build guide**  
   https://github.com/chromium/chromium/blob/main/docs/linux/build_instructions.md  
   Provides the wider Linux build requirements and notes swap recommendations for lower-memory systems.

3. **GeckoView quick start (Mozilla source)**  
   https://github.com/mozilla-firefox/firefox/blob/main/mobile/android/docs/geckoview/consumer/geckoview-quick-start.md  
   Documents embedding GeckoView, Mozilla's Maven repository, and Java 17 support. This is a genuine embeddable engine alternative, but it is Gecko, not Chromium.

4. **GeckoView project documentation**  
   https://github.com/mozilla/geckoview  
   Official documentation and entry point for GeckoView API and contributor guidance.

5. **Chromium WebEngine public API notes**  
   https://chromium.googlesource.com/chromium/src/+/HEAD/weblayer/public/README.md  
   Describes an API/implementation model tied to the Android WebView APK and says the public API is under development. This is not evidence of a ready-made, self-contained Chromium AAR suitable for MVM Browser.

6. **Chromium Android architecture**  
   https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/architecture.md  
   Background for distinguishing Android WebView from a browser built from Chromium source.

## Build environment requirements

- OS/architecture: Linux x86-64; Ubuntu is the primary documented development environment.
- RAM: 16 GB or more recommended; official guide states 8 GB minimum.
- Storage: at least 100 GB free before checkout/build; allow extra headroom for caches and artifacts.
- Tools: Git, Python, Chromium depot_tools, build dependencies, GN and Ninja/Siso via the official workflow.
- Android target: arm64 for the first proof APK; add other ABIs only after the first build is reproducible.
- Network: fast and stable connection; checkout and dependency synchronization can take hours.
- CI note: the current Android Gradle workflows prove the existing WebView app builds; they do not prove Chromium source can be built.

## Build-host options and current public price snapshot

Prices below are a research snapshot as of 2026-10-11, before taxes, optional storage, or other provider-specific charges. Check the provider's calculator and account eligibility before launching anything.

| Candidate | Published configuration | Published price | Assessment |
| --- | --- | --- | --- |
| DigitalOcean CPU-Optimized Droplet | 16 vCPU, 32 GiB RAM, 200 GiB SSD | $0.50/hour; $336/month cap shown in current price table | Best initial cloud candidate on price/spec balance, if the chosen region offers it. A 200-GiB disk leaves practical headroom beyond Chromium's 100-GB free-space minimum. |
| GitHub Actions larger runner | 8 vCPU, 32 GB RAM, 300 GB SSD | Linux 8-core rate shown as $0.022/minute (about $1.32 per billed hour) | Convenient ephemeral CI worker, but confirm the account/repository can use paid larger runners. Build logs and timeouts need to be managed. |
| GitHub Actions larger runner | 16 vCPU, 64 GB RAM, 600 GB SSD | Linux 16-core rate shown as $0.042/minute (about $2.52 per billed hour) | More memory/disk headroom, but higher cost; requires an appropriate billing setup. |
| Google Cloud Compute Engine | E2 high-memory machine family includes 8-vCPU/64-GB and other shapes | Region, disk, and network dependent; use the official calculator | Technically possible, but don't pick a machine or estimate a final bill until region and disk are selected. |

Official provider links:
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
- DigitalOcean pricing documentation: https://docs.digitalocean.com/products/droplets/details/pricing/
- GitHub larger-runner size table: https://docs.github.com/en/actions/reference/runners/larger-runners
- GitHub Actions runner pricing: https://github.com/github/docs/blob/main/content/billing/reference/actions-runner-pricing.md
- Google Cloud machine families: https://docs.cloud.google.com/compute/docs/general-purpose-machines
- Google Cloud pricing calculator/overview: https://cloud.google.com/products/compute

Important: cloud build machines are paid resources. No instance has been launched and no billing-enabled account has been accessed. On DigitalOcean's published CPU-Optimized plan, the compute line item would be roughly $2 for four billed hours or $5 for ten billed hours at the listed $0.50/hour, but Chromium checkout/build duration is not yet known; do not treat these as total build-cost guarantees. Stop/destroy an ephemeral instance when finished and check for separately retained volumes, snapshots, or other billable resources.

## Recommended implementation sequence

1. Identify a Linux x86-64 build host with 100+ GB free disk and 16+ GB RAM (or a suitable self-hosted machine).
2. Run scripts/build-chromium-android.sh and record the host specs, upstream revision, commands, duration, failures, and APK checksum.
3. Install and launch the unmodified proof APK on an Android device/emulator before porting MVM UI.
4. Pin a tested Chromium revision and document how security updates will be merged and rebuilt.
5. Decide whether to integrate MVM features into Chromium's browser shell or maintain a downstream fork. Keep current app behavior until a working prototype is verified.
6. Only then plan the MVM branding/UI port, tab and bookmark storage, download handling, permissions, safe browsing strategy, and release signing.

## Current verification status

- The current MVM Browser Android APK and Release APK CI workflows passed for commit fe9b9b3.
- The current application still uses Android System WebView.
- The Chromium build script is present but has not been executed here. It now checks minimum RAM/disk before checkout and uses fetch --nohooks so dependencies are installed before Chromium hooks run.
- A read-only host diagnostic is available at scripts/check-chromium-build-host.sh; it does not download or install anything.
- Before any public distribution, review docs/CHROMIUM_DISTRIBUTION_CHECKLIST.md for branding, notices, security updates, and build provenance.
- No Chromium APK, benchmark, device test, or cloud-host availability is claimed by this research note.

## Follow-up checklist

- [ ] Select a host: DigitalOcean CPU-Optimized 16-vCPU/32-GiB/200-GiB is the current cost-focused candidate; GitHub larger runners are an alternative if the account supports them.
- [ ] Confirm the exact region, hourly rate, disk capacity, budget limit, and cleanup plan before creating any paid resource.
- [ ] Confirm an eligible Linux build host and exact free disk/RAM.
- [ ] Run bash scripts/check-chromium-build-host.sh on the candidate Linux host before any source download.
- [ ] Review the current build script against upstream instructions immediately before running it.
- [ ] Complete the first upstream Chromium build.
- [ ] Install and smoke-test the APK.
- [ ] Record upstream revision and checksum.
- [ ] Estimate ongoing build/storage cost only after selecting a specific host and region.
