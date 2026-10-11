#!/usr/bin/env python3
"""Read-only weekly snapshot of Chromium/Chrome Android and Cromite release signals.

This script only reads public release metadata. It does not edit the repository,
download APKs, install apps, or provision compute. Network/API failures are
reported in the markdown output and do not become false "up to date" claims.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

CHROME_RSS = "https://chromereleases.googleblog.com/feeds/posts/default?alt=rss"
UA = "MVM-Browser-Upstream-Resource-Watch/1.0"
GITHUB_API = "https://api.github.com"


def fetch_bytes(url: str, accept: str = "*/*") -> bytes:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": accept},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read()


def text_of(parent: ET.Element, path: str) -> str:
    element = parent.find(path)
    return (element.text or "").strip() if element is not None else ""


def element_local_text(parent: ET.Element, name: str) -> str:
    element = next(
        (child for child in list(parent) if child.tag.rsplit("}", 1)[-1] == name),
        None,
    )
    if element is None:
        return ""
    return " ".join(part.strip() for part in element.itertext() if part.strip()).strip()


def android_release_posts() -> list[dict[str, str]]:
    root = ET.fromstring(fetch_bytes(CHROME_RSS))
    root_name = root.tag.rsplit("}", 1)[-1].casefold()
    entries: list[tuple[str, ET.Element]] = []

    if root_name == "feed":
        # Blogger may serve Atom XML even when the URL requests alt=rss.
        entries.extend(
            ("atom", item)
            for item in list(root)
            if item.tag.rsplit("}", 1)[-1] == "entry"
        )
    elif root_name == "rss":
        channel = root.find("./channel")
        if channel is None:
            raise ValueError("Chrome Releases RSS did not contain a channel element.")
        entries.extend(("rss", item) for item in channel.findall("item"))
    else:
        raise ValueError(f"Unexpected Chrome Releases feed root: {root.tag!r}")

    releases: list[dict[str, str]] = []
    for feed_type, item in entries:
        title = element_local_text(item, "title")
        # Exact matching deliberately excludes Beta and Dev posts.
        if title.casefold() != "chrome for android update":
            continue

        description = element_local_text(item, "description")
        if not description:
            description = element_local_text(item, "content")
        if not description:
            description = element_local_text(item, "summary")
        description = html.unescape(description)
        description = re.sub(r"<[^>]+>", " ", description)
        description = re.sub(r"\s+", " ", description).strip()

        match = re.search(
            r"\bChrome\s+(\d+)\s*\(([\d.]+)\)\s+for Android",
            description,
            flags=re.IGNORECASE,
        )
        if match:
            major, version = match.group(1), match.group(2)
        else:
            # Retain source metadata if Google changes the release-note wording.
            major, version = "", "version not parsed"

        # Google titles can be identical for regular and Early Stable posts.
        is_early_stable = bool(
            re.search(r"\bearly stable\b|small percentage of users", description, re.IGNORECASE)
        )
        channel_name = "early stable" if is_early_stable else "stable"

        date = (
            element_local_text(item, "pubDate")
            or element_local_text(item, "published")
            or element_local_text(item, "updated")
        )
        url = element_local_text(item, "link")
        if feed_type == "atom":
            link_element = next(
                (
                    child
                    for child in list(item)
                    if child.tag.rsplit("}", 1)[-1] == "link"
                    and child.attrib.get("rel", "alternate") == "alternate"
                    and child.attrib.get("href")
                ),
                None,
            )
            if link_element is not None:
                url = link_element.attrib["href"]

        releases.append({
            "title": title,
            "version": version,
            "major": major,
            "date": date,
            "url": url,
            "description": description[:500],
            "channel": channel_name,
        })
    return releases


def latest_android_stable_release() -> dict[str, str] | None:
    return next(
        (release for release in android_release_posts() if release["channel"] == "stable"),
        None,
    )


def latest_android_early_stable_release() -> dict[str, str] | None:
    return next(
        (release for release in android_release_posts() if release["channel"] == "early stable"),
        None,
    )

def github_json(url: str) -> Any:
    raw = fetch_bytes(
        url,
        accept="application/vnd.github+json",
    )
    return json.loads(raw.decode("utf-8"))


def latest_github_release(repo: str) -> dict[str, str] | None:
    try:
        value = github_json(f"{GITHUB_API}/repos/{repo}/releases/latest")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise
    return {
        "tag": str(value.get("tag_name", "tag unknown")),
        "published": str(value.get("published_at", "date unknown")),
        "url": str(value.get("html_url", f"https://github.com/{repo}/releases")),
        "name": str(value.get("name") or value.get("tag_name") or "unnamed release"),
    }


def release_list(repo: str) -> list[dict[str, str]]:
    value = github_json(f"{GITHUB_API}/repos/{repo}/releases?per_page=5")
    if not isinstance(value, list):
        raise ValueError(f"Unexpected release list response for {repo}.")
    return [
        {
            "tag": str(item.get("tag_name", "tag unknown")),
            "published": str(item.get("published_at", "date unknown")),
            "url": str(item.get("html_url", f"https://github.com/{repo}/releases")),
        }
        for item in value
    ]


def latest_github_commit(repo: str) -> dict[str, str]:
    value = github_json(f"{GITHUB_API}/repos/{repo}/commits?per_page=1")
    if not isinstance(value, list) or not value:
        raise ValueError(f"No commit metadata returned for {repo}.")
    item = value[0]
    commit = item.get("commit") or {}
    committer = commit.get("committer") or {}
    return {
        "sha": str(item.get("sha", "unknown"))[:12],
        "date": str(committer.get("date", "date unknown")),
        "message": str(commit.get("message", "message unknown")).splitlines()[0],
        "url": str(item.get("html_url", f"https://github.com/{repo}/commits")),
    }


def version_major(tag_or_version: str) -> int | None:
    match = re.search(r"(?:^|[^0-9])v?(\d+)\.", tag_or_version)
    return int(match.group(1)) if match else None


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def strict_report_problems(report: str) -> list[str]:
    """Return critical data-quality failures for scheduled monitoring."""
    problems: list[str] = []
    if "## Data-source warnings" in report:
        problems.append("one or more public metadata sources could not be read")
    if "A version comparison could not be calculated" in report:
        problems.append("the Chrome-vs-Cromite version comparison could not be calculated")
    if "**Version:** version not parsed" in report:
        problems.append("the Chrome Android release version could not be parsed")
    return problems


def render_report() -> str:
    lines = [
        "# MVM Browser — Chromium upstream status",
        "",
        f"Generated: {utc_now()}",
        "",
        "This is a read-only metadata snapshot, not a security audit. A matching major version alone does not prove that all security patches are present.",
        "",
        "## Official Chrome for Android stable channel",
        "",
    ]
    chrome: dict[str, str] | None = None
    early_chrome: dict[str, str] | None = None
    uazo: dict[str, str] | None = None
    qwez_releases: list[dict[str, str]] | None = None
    qwez_commit: dict[str, str] | None = None
    errors: list[str] = []

    try:
        chrome = latest_android_stable_release()
        if chrome is None:
            lines.append("- Could not find a stable Android release entry in the official Chrome Releases feed.")
        else:
            lines += [
                f"- **Version:** {chrome['version']}",
                f"- **Published:** {chrome['date'] or 'date not supplied'}",
                f"- **Source:** {chrome['url'] or CHROME_RSS}",
                "",
                f"Release note excerpt: {chrome['description'] or 'No description supplied.'}",
            ]
    except Exception as error:  # report external outages rather than hiding them
        errors.append(f"Chrome Releases feed: {type(error).__name__}: {error}")
        lines.append("- **Unavailable:** could not read the official Chrome Releases feed.")

    lines += ["", "## Chrome for Android Early Stable (limited rollout)", ""]
    try:
        early_chrome = latest_android_early_stable_release()
        if early_chrome is None:
            lines.append("- No separate Early Stable Android post was found in the feed.")
        else:
            lines += [
                f"- **Preview version:** {early_chrome['version']}",
                f"- **Published:** {early_chrome['date'] or 'date not supplied'}",
                f"- **Source:** {early_chrome['url'] or CHROME_RSS}",
                "",
                f"Release note excerpt: {early_chrome['description'] or 'No description supplied.'}",
            ]
    except Exception as error:
        errors.append(f"Chrome Early Stable feed: {type(error).__name__}: {error}")
        lines.append("- **Unavailable:** could not identify an Early Stable Android post.")

    lines += ["", "## Cromite release signals", ""]
    try:
        uazo = latest_github_release("uazo/cromite")
        if uazo is None:
            lines.append("- uazo/cromite: no GitHub latest-release response.")
        else:
            lines += [
                f"- **uazo/cromite latest release:** [{uazo['tag']}]({uazo['url']})",
                f"- **Published:** {uazo['published']}",
            ]
    except Exception as error:
        errors.append(f"uazo/cromite release API: {type(error).__name__}: {error}")
        lines.append("- **uazo/cromite:** release metadata unavailable.")

    try:
        qwez_releases = release_list("qwez-dev/cromite")
        if qwez_releases:
            item = qwez_releases[0]
            lines += [
                f"- **qwez-dev/cromite latest release:** [{item['tag']}]({item['url']})",
                f"- **Published:** {item['published']}",
            ]
        else:
            lines.append("- **qwez-dev/cromite:** GitHub reports no published Releases for this fork.")
    except Exception as error:
        errors.append(f"qwez-dev/cromite release API: {type(error).__name__}: {error}")
        lines.append("- **qwez-dev/cromite:** release list unavailable.")

    try:
        qwez_commit = latest_github_commit("qwez-dev/cromite")
        lines += [
            f"- **qwez-dev/cromite latest commit:** [{qwez_commit['sha']}]({qwez_commit['url']})",
            f"- **Commit date:** {qwez_commit['date']}",
            f"- **Commit subject:** {qwez_commit['message']}",
        ]
    except Exception as error:
        errors.append(f"qwez-dev/cromite commit API: {type(error).__name__}: {error}")
        lines.append("- **qwez-dev/cromite:** latest commit metadata unavailable.")

    stable_major = int(chrome["major"]) if chrome and chrome.get("major", "").isdigit() else None
    cromite_major = version_major(uazo["tag"]) if uazo else None
    lines += ["", "## Comparison signal", ""]
    if stable_major is not None and cromite_major is not None:
        gap = stable_major - cromite_major
        if gap > 0:
            lines.append(
                f"- The latest observed uazo/cromite release is {gap} major version(s) behind the latest stable Chrome-for-Android post found in the feed (Chrome {stable_major} vs. Cromite {cromite_major}). Review the release commits and security fixes before considering it as a base."
            )
        elif gap == 0:
            lines.append(
                f"- The major versions match (Chrome {stable_major} and Cromite {cromite_major}); this does **not** prove identical patches or complete security parity."
            )
        else:
            lines.append(
                f"- The Cromite release major ({cromite_major}) is higher than the Chrome stable blog entry major ({stable_major}); verify release channel/version mapping manually."
            )
    else:
        lines.append("- A version comparison could not be calculated from the available metadata.")

    lines += [
        "",
        "## Manual review still required",
        "",
        "- Verify the exact Chromium source revision behind the candidate release.",
        "- Review security fixes and patch differences, not just version numbers.",
        "- Confirm licensing, notices, supported Android versions, APK signature and digest before using any binary.",
        "- This workflow does not download, install or modify any browser APK, create cloud resources, or commit changes.",
    ]
    if errors:
        lines += ["", "## Data-source warnings", ""]
        lines.extend(f"- {item}" for item in errors)
        lines.append("- This report is partial because one or more external sources were unavailable.")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="chromium-upstream-status.md",
        help="Path for the generated Markdown report (default: chromium-upstream-status.md).",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a non-zero exit code if critical public source data is incomplete.",
    )
    args = parser.parse_args()

    report = render_report()
    problems = strict_report_problems(report)
    output = Path(args.output)
    output.write_text(report, encoding="utf-8")
    print(report, end="")

    summary_path = __import__("os").environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(report)
            summary.write("\n")

    print(f"\nReport saved to: {output.resolve()}")
    if args.strict and problems:
        print("STRICT CHECK FAILED: " + "; ".join(problems), file=sys.stderr)
        return 1
    if args.strict:
        print("STRICT CHECK PASSED: required Chrome and Cromite version data is available.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
