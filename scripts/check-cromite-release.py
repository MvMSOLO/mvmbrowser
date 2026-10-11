#!/usr/bin/env python3
"""Audit Cromite freshness and verify the exact source pin before a build.

By default the Chrome baseline is taken from the official Chrome Releases feed.
The highest announced Android Stable/Early Stable version is used conservatively.
This tool does not download or install APKs.

Exit codes:
  0 = current version gate passed, or an explicit stale prototype override passed
  1 = metadata, source-feed, checksum, or usage error
  2 = Cromite's Chromium base is behind Chrome Android Stable/Early Stable
  3 = the configured source pin is not the latest published Cromite release
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

RELEASE_API = "https://api.github.com/repos/uazo/cromite/releases/latest"
TAG_RE = re.compile(r"^v?(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)-([0-9a-f]{40})$")
SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")


def version_tuple(value: str) -> tuple[int, int, int, int]:
    match = re.fullmatch(r"(\\d+)\\.(\\d+)\\.(\\d+)\\.(\\d+)", value.strip())
    if not match:
        raise ValueError(f"Invalid version {value!r}; expected MAJOR.MINOR.BUILD.PATCH")
    return tuple(int(part) for part in match.groups())


def latest_chrome_android_baseline() -> dict[str, str]:
    """Read Google's Android release notes and return the highest public Stable rollout."""
    report_script = Path(__file__).with_name("report-chromium-upstream-status.py")
    spec = importlib.util.spec_from_file_location("mvm_chrome_upstream_status", report_script)
    if spec is None or spec.loader is None:
        raise ValueError("Could not load the shared Chrome Android release-feed parser.")
    status = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(status)

    try:
        releases = status.android_release_posts()
    except (OSError, ValueError, ET.ParseError) as exc:
        raise ValueError(f"Could not read the official Chrome Android release feed: {exc}") from exc

    candidates: list[tuple[tuple[int, int, int, int], dict[str, str]]] = []
    for release in releases:
        if release.get("channel") not in {"stable", "early stable"}:
            continue
        try:
            parsed_version = version_tuple(str(release.get("version", "")))
        except ValueError:
            continue
        candidates.append((parsed_version, release))

    if not candidates:
        raise ValueError(
            "The official Chrome Releases feed did not contain a parseable Android Stable release. "
            "Build is blocked until the baseline can be verified."
        )

    _, selected = max(candidates, key=lambda pair: pair[0])
    return {
        "version": selected["version"],
        "channel": selected["channel"],
        "date": selected.get("date", "date unknown"),
        "url": selected.get("url", "https://chromereleases.googleblog.com/"),
    }


def get_release(path: str | None) -> dict[str, Any]:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    request = urllib.request.Request(
        RELEASE_API,
        headers={"Accept": "application/vnd.github+json", "User-Agent": "MVM-Browser-Cromite-Audit"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--stable-version",
        help=(
            "Explicit verified Chrome Android baseline, e.g. 155.0.8059.39. "
            "If omitted, use the highest version in Google's Android Stable/Early Stable release feed."
        ),
    )
    parser.add_argument("--release-json", help="Optional saved GitHub latest-release JSON; defaults to querying GitHub")
    parser.add_argument("--apk", help="Optional downloaded ARM64 APK to verify against the release SHA-256")
    parser.add_argument("--pinned-version", help="Exact Cromite Chromium version configured by the build script")
    parser.add_argument("--pinned-commit", help="Exact 40-character Cromite release commit configured by the build script")
    parser.add_argument(
        "--allow-stale-prototype",
        action="store_true",
        help="Explicitly permit an outdated latest release for isolated prototype/build-pipeline testing only",
    )
    args = parser.parse_args()

    try:
        if (args.pinned_version is None) != (args.pinned_commit is None):
            raise ValueError("--pinned-version and --pinned-commit must be supplied together.")

        release = get_release(args.release_json)
        tag = str(release.get("tag_name", ""))
        match = TAG_RE.fullmatch(tag)
        if not match:
            raise ValueError(f"Unexpected Cromite release tag format: {tag!r}")
        cromite_version = tuple(int(part) for part in match.groups()[:4])
        release_commit = match.group(5).lower()

        if args.pinned_version is not None and args.pinned_commit is not None:
            pinned_version = version_tuple(args.pinned_version)
            if not SHA_RE.fullmatch(args.pinned_commit):
                raise ValueError("Pinned Cromite commit must be exactly 40 hexadecimal characters.")
            if pinned_version != cromite_version or args.pinned_commit.lower() != release_commit:
                print(
                    "GATE BLOCKED: the configured Cromite build pin does not match the latest published release. "
                    f"Configured={args.pinned_version}-{args.pinned_commit}; latest={tag}. "
                    "Update and review the source version/commit before building.",
                    file=sys.stderr,
                )
                return 3

        assets = {asset.get("name"): asset for asset in release.get("assets", [])}
        apk_asset = assets.get("arm64_ChromePublic.apk")
        if not apk_asset:
            raise ValueError("Latest Cromite release has no arm64_ChromePublic.apk asset")

        print(f"Cromite release: {tag}")
        print(f"Published: {release.get('published_at', 'unknown')}")
        print(f"APK URL: {apk_asset.get('browser_download_url', 'missing')}")
        print(f"APK bytes: {apk_asset.get('size', 'unknown')}")
        digest = apk_asset.get("digest") or ""
        if digest.startswith("sha256:"):
            digest = digest.split(":", 1)[1]
        if digest:
            print(f"Published APK SHA-256: {digest}")

        if args.apk:
            if not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
                raise ValueError("GitHub release metadata does not include a valid SHA-256 digest")
            hasher = hashlib.sha256()
            with open(args.apk, "rb") as apk_file:
                for chunk in iter(lambda: apk_file.read(1024 * 1024), b""):
                    hasher.update(chunk)
            actual = hasher.hexdigest()
            print(f"Local APK SHA-256: {actual}")
            if actual.lower() != digest.lower():
                raise ValueError("Local APK checksum does not match the published release digest")
            print("APK checksum: PASS")

        if args.stable_version:
            stable_version = args.stable_version.strip()
            baseline_source = "explicit --stable-version input"
        else:
            baseline = latest_chrome_android_baseline()
            stable_version = baseline["version"]
            baseline_source = (
                f"Google Chrome Android {baseline['channel']} feed, "
                f"{baseline.get('date', 'date unknown')}"
            )

        stable = version_tuple(stable_version)
        print(f"Chrome Android baseline: {stable_version}")
        print(f"Baseline source: {baseline_source}")

        if cromite_version < stable:
            message = (
                "Cromite's Chromium base is older than the current Chrome Android Stable/Early Stable baseline. "
                "Do not treat it as release-ready or use it for sensitive browsing."
            )
            if args.allow_stale_prototype:
                print(f"PROTOTYPE ONLY OVERRIDE: {message} Public release remains blocked.", file=sys.stderr)
                print("Version gate: OVERRIDDEN FOR NON-RELEASE PROTOTYPE TESTING ONLY")
                return 0
            print(f"GATE BLOCKED: {message}", file=sys.stderr)
            return 2

        if args.allow_stale_prototype:
            print("Note: prototype override was supplied but is not needed; the version gate passed.")
        print("Version gate: PASS (version comparison only; security fixes still require review)")
        return 0
    except (OSError, ValueError, KeyError, json.JSONDecodeError, ET.ParseError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
