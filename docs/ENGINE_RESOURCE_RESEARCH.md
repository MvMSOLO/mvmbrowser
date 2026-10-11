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
   States that Android builds require an x86-64 Linux machine, at least 8 GB RAM (more than 16 GB highly recommended), and at least 100 GB free disk. The official chrome_public_apk target has minSdkVersion 29 (Android 10) for local development; Windows/macOS are not supported for this build flow.

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

| Candidate | Published/configured size | Published price | Assessment |
| --- | --- | --- | --- |
| DigitalOcean Basic Droplet (returned by current account catalogue) | 4 vCPU, 8 GiB RAM, 160 GiB SSD (s-4vcpu-8gb) | $0.07143/hour; $48/month cap | Meets the official bare minimum on paper, but RAM is below the highly recommended 16+ GiB. Actual free space must be rechecked after provisioning; account status currently blocks creation. |
| DigitalOcean CPU-Optimized public price benchmark | 16 vCPU, 32 GiB RAM, 200 GiB SSD | $0.50/hour; $336/month cap | Faster, more comfortable configuration in public pricing; this plan was not present in the current account-visible size catalogue, so availability is unconfirmed. |
| GitHub Actions larger runner | 4 vCPU, 16 GB RAM, 150 GB SSD | Linux 4-core rate is $0.012/minute (about $0.72 per billed hour) | Fits published RAM/disk minimums with moderate CPU; only consider if the account is eligible for paid larger runners. |
| GitHub Actions larger runner | 8 vCPU, 32 GB RAM, 300 GB SSD | Linux 8-core rate is $0.022/minute (about $1.32 per billed hour) | More headroom, but paid larger runners are limited to organizations/enterprises on Team or Enterprise Cloud. |
| GitHub Actions larger runner | 16 vCPU, 64 GB RAM, 600 GB SSD | Linux 16-core rate is $0.042/minute (about $2.52 per billed hour) | More memory/disk headroom, with the highest runner cost in this shortlist. |
| Google Cloud Compute Engine | E2 high-memory machine family includes 8-vCPU/64-GB and other shapes | Region, disk, and network dependent; use the official calculator | Technically possible, but don't pick a machine or estimate a final bill until region and disk are selected. |

Official provider links:
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
- DigitalOcean pricing documentation (per-second billing from 2026, with minimum charge): https://docs.digitalocean.com/products/droplets/details/pricing/
- GitHub larger-runner size table: https://docs.github.com/en/actions/reference/runners/larger-runners
- GitHub Actions runner pricing: https://docs.github.com/en/billing/reference/actions-runner-pricing
- Google Cloud machine families: https://docs.cloud.google.com/compute/docs/general-purpose-machines
- Google Cloud pricing calculator/overview: https://cloud.google.com/products/compute

Important: cloud build machines are paid resources. No instance has been launched and no billing-enabled account has been accessed. DigitalOcean's terms say its services are not intended for users under 18 unless they have sufficient legal consent, permission, and capacity under applicable jurisdiction; account eligibility and any required adult/guardian involvement must be confirmed before using that provider. On the currently returned DigitalOcean Basic 4-vCPU/8-GiB/160-GiB plan, compute would be roughly $0.29 for four billed hours or $0.71 for ten billed hours at $0.07143/hour. The 16-vCPU/32-GiB CPU-Optimized public-price benchmark would be roughly $2 for four billed hours or $5 for ten billed hours at $0.50/hour, but availability of that larger plan is not confirmed in this account. These are compute-only estimates; Chromium checkout/build duration, data transfer, taxes, retained volumes, and snapshots can change the total. DigitalOcean's documentation describes per-second billing with a 60-second/$0.01 minimum. Stop/destroy an ephemeral instance when finished and check for separately retained volumes, snapshots, or other billable resources.



### Connected-account availability check (2026-10-11)

The connected DigitalOcean account API returned an account-status warning that the team's Droplet limit had been reached. Its current Droplet list returned no active Droplets. The size catalogue returned by the integration contained 43 plans. It did include a 4-vCPU/8-GiB/160-GiB Basic plan that meets the published bare minimum on paper, but no returned plan met both the 100+ GiB disk requirement and the recommended 16+ GiB RAM target. This means a suitable build host is **not currently provisionable through the available account state**; do not retry blindly. The 4-vCPU/8-GiB plan is only a low-end fallback, not the preferred build host, and the active account-status warning currently blocks creation. The account owner needs to resolve the quota/status warning in the provider dashboard and confirm that a sufficiently large plan is actually available in the chosen region.

The public price table above is only a market comparison, not a guarantee that the connected account can provision those particular sizes. No new Droplet has been created.

## Recommended implementation sequence

1. Review docs/CHROMIUM_BASE_OPTIONS.md and decide whether to keep the upstream Chromium baseline or prototype a Cromite browser-shell fork. A browser APK cannot simply be embedded into the current Kotlin/WebView app.
2. Resolve the connected cloud account's quota/status warning and confirm legal/account eligibility before considering paid infrastructure.
3. Select a build host with Linux x86-64, 100+ GB free disk, and at least 8 GB RAM (16+ GB recommended); verify the chosen plan's actual region availability and disk size.
4. Run scripts/check-chromium-build-host.sh before downloading source, then run scripts/build-chromium-android.sh and record host specs, exact upstream revision, commands, logs, duration, and APK SHA-256.
5. Install and launch the unmodified proof APK on an Android 10+ device/emulator before porting MVM UI.
6. Pin a tested Chromium revision and document how security updates will be merged, rebuilt, signed, and distributed.
7. Only after the browser base is proven, plan the MVM branding/UI port, tab and bookmark storage, download handling, permissions, safe browsing strategy, licensing/notices, and release signing. Keep the existing app stable until then.

## Current verification status

- The current MVM Browser Android APK and Release APK CI workflows passed for commit fe9b9b3.
- The current application still uses Android System WebView.
- The Chromium bootstrap CI checks Bash syntax, Python syntax/unit tests for the release reporter, host-preflight pass/fail paths, invalid build paths/configuration, that the build script refuses to fetch source when the disk check fails, the offline verifier's success/failure using a synthetic APK, and the device preflight using a mock ADB device. It deliberately does not attempt an expensive Chromium build. Latest confirmed green run: https://github.com/MvMSOLO/mvmbrowser/actions/runs/38122379153.
- The weekly upstream-watch workflow has successfully fetched live public metadata. In its 2026-10-11 snapshot, Chrome 155 was the regular stable Android release, Chrome 156 was Early Stable/limited rollout, and the latest observed uazo/cromite release was based on Chromium 153. The report is a version signal, not a security audit: https://github.com/MvMSOLO/mvmbrowser/actions/runs/38119448150.
- A scheduled read-only release report runs each Monday at 08:30 UTC and when its own report script/workflow changes: .github/workflows/chromium-upstream-watch.yml. Reports are uploaded as a 30-day artifact; the workflow does not download APKs or create cloud resources.
- The Chromium build script is present but has not been executed here. It checks minimum RAM/disk before checkout, validates paths and configuration before network work, verifies non-interactive sudo before source download, installs dependencies without interactive prompts, runs hooks once after sync, resolves both `CHROMIUM_REVISION` and optional `DEPOT_TOOLS_REVISION` to exact commits, disables depot_tools auto-update when its revision is pinned, and writes Chromium/depot_tools revisions plus APK/GN-args SHA-256 values to a metadata sidecar. It also keeps a copy of the effective GN args beside the APK.
- The offline verifier at scripts/verify-chromium-apk.sh checks the APK ZIP integrity and manifest entry, validates both checksums and metadata target/revision fields, and does not install or launch the APK. Its CI test uses synthetic APK data, not a real Chromium build.
- The device smoke-test script at scripts/smoke-test-chromium-device.sh verifies artifact integrity, authorized ADB connection, Android API 29+, and arm64-v8a compatibility. `--install` requires an interactive confirmation; CI tests only the no-install preflight with a mock ADB device.
- The read-only preflight supports configurable thresholds for CI path tests; its default requirements remain 8 GiB RAM and 100 GiB free disk.
- The upstream watch has been run successfully using the strict completeness check. Its report artifact is saved for 30 days and identifies Chrome regular stable separately from Early Stable, avoiding a false comparison against limited-rollout versions.
- The base-option note compares upstream Chromium, both Cromite source repositories, and GeckoView: docs/CHROMIUM_BASE_OPTIONS.md.
- A read-only host diagnostic is available at scripts/check-chromium-build-host.sh; it does not download or install anything.
- Before any public distribution, review docs/CHROMIUM_DISTRIBUTION_CHECKLIST.md for branding, notices, security updates, and build provenance.
- No Chromium APK has been built or device-tested in this environment, and no cloud host has been provisioned. The CI APK verifier uses synthetic fixture data; it is not evidence of a working Chromium APK.

## Follow-up checklist

- [ ] Resolve the DigitalOcean account quota/status warning and verify a suitable disk/RAM size is actually available via the connected account; the current returned plan list does not include a build-suitable option.
- [ ] If using GitHub larger runners instead, confirm the repository belongs to an eligible paid organization plan and check the complete price for the required runner/duration.
- [ ] Confirm the exact region, hourly rate, disk capacity, budget limit, and cleanup plan before creating any paid resource.
- [ ] Confirm an eligible Linux build host and exact free disk/RAM.
- [ ] Run bash scripts/check-chromium-build-host.sh on the candidate Linux host before any source download.
- [ ] Review the current build script against upstream instructions immediately before running it.
- [ ] Complete the first upstream Chromium build.
- [ ] Run scripts/verify-chromium-apk.sh on the built artifact.
- [ ] Run scripts/smoke-test-chromium-device.sh --serial DEVICE_SERIAL for no-install device compatibility checks.
- [ ] Only after reviewing the device serial, run the smoke-test script with --install to install and launch; then visually verify page rendering.
- [ ] Pin and record both the Chromium revision and the `depot_tools` revision; retain GN args, metadata sidecar, build logs, and APK checksum together.
- [ ] Review the [latest upstream-watch report](https://github.com/MvMSOLO/mvmbrowser/actions/workflows/chromium-upstream-watch.yml) regularly and verify the source version/security fixes, not only major-version numbers.
- [ ] Estimate ongoing build/storage cost only after selecting a specific host and region.
