#!/usr/bin/env python3
"""Audit the latest Cromite Android release against a supplied Chrome Stable version.

This is a release gate, not a build tool. It does not download or install APKs.
Exit codes: 0 = version gate passed; 1 = metadata/checksum/usage error;
2 = Cromite is behind the supplied Chrome Stable baseline.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

RELEASE_API = "https://api.github.com/repos/uazo/cromite/releases/latest"
TAG_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)\.(\d+)-([0-9a-f]{40})$")


def version_tuple(value: str) -> tuple[int, int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)\.(\d+)", value.strip())
    if not match:
        raise ValueError(f"Invalid version {value!r}; expected MAJOR.MINOR.BUILD.PATCH")
    return tuple(int(part) for part in match.groups())


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
    parser.add_argument("--stable-version", required=True, help="Verified current Chrome Stable version, e.g. 155.0.8059.39")
    parser.add_argument("--release-json", help="Optional saved GitHub latest-release JSON; defaults to querying GitHub")
    parser.add_argument("--apk", help="Optional already-downloaded ARM64 APK to verify against the release SHA-256")
    args = parser.parse_args()

    try:
        stable = version_tuple(args.stable_version)
        release = get_release(args.release_json)
        tag = str(release.get("tag_name", ""))
        match = TAG_RE.fullmatch(tag)
        if not match:
            raise ValueError(f"Unexpected Cromite release tag format: {tag!r}")
        cromite_version = tuple(int(part) for part in match.groups()[:4])
        assets = {asset.get("name"): asset for asset in release.get("assets", [])}
        apk_asset = assets.get("arm64_ChromePublic.apk")
        if not apk_asset:
            raise ValueError("Latest Cromite release has no arm64_ChromePublic.apk asset")

        print(f"Cromite release: {tag}")
        print(f"Published: {release.get('published_at', 'unknown')}")
        print(f"Chrome Stable baseline supplied: {args.stable_version}")
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

        if cromite_version < stable:
            print(
                "GATE BLOCKED: Cromite's Chromium base is older than the supplied Chrome Stable baseline. "
                "Use only for non-sensitive prototype/reference testing; do not treat it as a release-ready MVM base.",
                file=sys.stderr,
            )
            return 2

        print("Version gate: PASS (version comparison only; security fixes still require review)")
        return 0
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
