import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import report_chromium_upstream_status as status  # noqa: E402


class ChromiumUpstreamStatusTests(unittest.TestCase):
    def test_parses_android_stable_post_from_rss(self):
        feed = b"""<?xml version="1.0" encoding="UTF-8"?>
        <rss><channel>
          <item>
            <title>Chrome for Android Update</title>
            <description><![CDATA[<p>We've just released Chrome 155 (155.0.8059.39) for Android.</p>]]></description>
            <pubDate>Tue, 06 Oct 2026 12:00:00 +0000</pubDate>
            <link>https://chromereleases.googleblog.com/example.html</link>
          </item>
        </channel></rss>"""
        with patch.object(status, "fetch_bytes", return_value=feed):
            result = status.latest_android_stable_release()

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["major"], "155")
        self.assertEqual(result["version"], "155.0.8059.39")
        self.assertIn("example.html", result["url"])

    def test_version_major_handles_release_tags(self):
        self.assertEqual(status.version_major("v153.0.8010.37-abc123"), 153)
        self.assertEqual(status.version_major("155.0.8059.39"), 155)
        self.assertIsNone(status.version_major("not-a-version"))

    def test_report_flags_a_major_version_gap_without_claiming_security_parity(self):
        chrome = {
            "title": "Chrome for Android Update",
            "version": "155.0.8059.39",
            "major": "155",
            "date": "Tue, 06 Oct 2026 12:00:00 +0000",
            "url": "https://example.test/chrome-release",
            "description": "Chrome 155 for Android.",
        }
        release = {
            "tag": "v153.0.8010.37-abc123",
            "published": "2026-09-15T11:51:14Z",
            "url": "https://example.test/cromite-release",
            "name": "Cromite",
        }
        commit = {
            "sha": "e84cc676b7e3",
            "date": "2026-08-24T15:02:45Z",
            "message": "Example commit",
            "url": "https://example.test/commit",
        }
        with (
            patch.object(status, "latest_android_stable_release", return_value=chrome),
            patch.object(status, "latest_github_release", return_value=release),
            patch.object(status, "release_list", return_value=[]),
            patch.object(status, "latest_github_commit", return_value=commit),
            patch.object(status, "utc_now", return_value="2026-10-11 07:00 UTC"),
        ):
            report = status.render_report()

        self.assertIn("2 major version(s) behind", report)
        self.assertIn("does not prove", report)
        self.assertIn("no published Releases", report)
        self.assertIn("e84cc676b7e3", report)


if __name__ == "__main__":
    unittest.main()
