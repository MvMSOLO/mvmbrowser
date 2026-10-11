# MVM Browser — Cromite Source-Fork Execution Plan

Research date: 2026-10-11

## Decision

**Adopt Cromite as the first source-fork candidate for MVM Browser.** Do not continue treating a vanilla Chromium proof APK as the main product path unless Cromite fails a defined feasibility gate.

- Upstream source: https://github.com/uazo/cromite
- Build guide: https://github.com/uazo/cromite/blob/master/docs/HOW_TO_BUILD.md
- Release history: https://github.com/uazo/cromite/releases
- Existing MVM app: https://github.com/MvMSOLO/mvmbrowser

This decision is for source-level adaptation, not embedding a Cromite APK or System WebView APK inside the current Kotlin app. Cromite is a complete browser project.

## Important constraints

1. **No paid infrastructure without explicit approval.** First inspect free/available runners and validate capacity. Do not silently provision cloud resources or trigger paid larger runners.
2. **No fake build claims.** A documentation or CI check is not a Chromium compile. Do not report an MVM APK as built until an actual build artifact has passed integrity checks and a device smoke test.
3. **Security freshness is a release gate.** Check the exact Chromium base version and security patch state immediately before pinning a source revision. A successful build does not by itself mean the result is safe or current.
4. **Android baseline changes.** Cromite documents Android 10+ support. MVM's current minSdk is lower; the fork prototype should explicitly target Android 10+ unless a tested engineering plan proves older support is viable.
5. **License compliance is mandatory.** Cromite identifies GPL-3.0 for its project, with some patches carrying their own notices/licensing. Preserve upstream copyright and license files, record all third-party notices, and review source-offer/distribution obligations before publishing binaries. Do not remove attribution or imply the derivative is proprietary if the license does not permit that.
6. **Identity and secrets.** Use a distinct MVM application ID, app label, icons, signing key, update channel, and data directory. Never reuse upstream signing credentials or expose signing secrets in logs/workflows.
7. **Upstream updates.** Keep a recorded upstream remote/revision and a repeatable rebase/patch workflow. Security fixes must be reviewed and incorporated regularly.

## Milestones

### M0 — Source and release audit
- [ ] Read Cromite README, build guide, release metadata, license, patch list, and workflow.
- [ ] Record the chosen source commit, Chromium version, build-image tag/digest if available, and APK ABI.
- [ ] Compare the source's Chromium version with current stable and review relevant security fixes.
- [ ] Confirm the current build workflow can run on an already-available runner without paid provisioning.
- [ ] Produce a short decision report; no binary changes yet.

**Acceptance:** source revision, version, license, runner capacity, and build procedure are recorded; unresolved security or license questions block distribution.

### M1 — Reproducible baseline build
- [ ] Build the upstream Cromite Android ARM64 target from the pinned source/build image on an eligible Linux x86-64 host.
- [ ] Save logs and provenance: source commit, Chromium version, build image, build args, toolchain revisions, APK SHA-256.
- [ ] Verify APK integrity, package metadata, ABI, and install/launch on a real Android 10+ ARM64 device.
- [ ] Keep the baseline unmodified for comparison.

**Acceptance:** real APK produced, verifier passes, and an on-device launch/render smoke test is observed. A CI green check alone is insufficient.

### M2 — MVM identity fork
- [ ] Change app label, application/package ID, icons, product strings, first-run screen, new-tab/start page, and branding.
- [ ] Keep engine and browser behavior otherwise as close to the baseline as possible.
- [ ] Ensure user data directories and update endpoints do not collide with upstream Cromite.
- [ ] Preserve license and third-party notices; add an accurate fork attribution and source-availability instructions.

**Acceptance:** MVM-branded APK installs alongside the reference build without package/data collisions; core navigation still works.

### M3 — Feature port
Use the existing [feature port matrix](CHROMIUM_FEATURE_PORT_MATRIX.md) as the acceptance checklist. Port in small groups:
- [ ] MVM start page and search/address bar.
- [ ] Tab switcher and tab lifecycle.
- [ ] Bookmarks and history.
- [ ] Downloads and permission/error handling.
- [ ] Offline save and any remaining MVM-specific features.

**Acceptance:** each feature has a reproducible test and no regression in HTTPS navigation, process recovery, downloads, and tab lifecycle.

### M4 — Release pipeline
- [ ] Pin source and build inputs.
- [ ] Produce SBOM/third-party notice bundle and source offer/link required by applicable license obligations.
- [ ] Publish checksums and build provenance with every test release.
- [ ] Define Chromium/Cromite security update cadence and a documented rollback path.
- [ ] Keep release signing material in protected secrets; never commit it.

**Acceptance:** clean build from recorded inputs and a release checklist completed by a human reviewer.

## First technical action

Do not blindly clone the full source or start a paid runner. Inspect the current upstream workflow and its Docker image/version mapping, then choose a pinned revision. The existing scripts and workflows in this repository were initially designed around vanilla Chromium and must be audited before reuse for Cromite; they are not proof that a Cromite build has succeeded.

## Status

- Decision: Cromite source fork is the selected direction.
- Existing MVM app: still uses Android System WebView.
- Chromium/Cromite APK: no modified MVM-branded APK is claimed as built or tested.
- Infrastructure: do not create paid cloud resources without explicit approval.
