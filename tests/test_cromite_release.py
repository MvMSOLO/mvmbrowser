import contextlib
import hashlib
import importlib.util
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check-cromite-release.py"
SPEC = importlib.util.spec_from_file_location("check_cromite_release", SCRIPT)
AUDIT = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(AUDIT)

SHA = "a" * 40


def release(version="153.0.8010.37", digest=None, commit=SHA):
    version_tag = f"v{version}-{commit}"
    return {
        "tag_name": version_tag,
        "published_at": "2026-09-15T11:51:14Z",
        "assets": [{
            "name": "arm64_ChromePublic.apk",
            "size": 10,
            "digest": "sha256:" + (digest or "0" * 64),
            "browser_download_url": "https://example.invalid/arm64_ChromePublic.apk",
        }],
    }


class CromiteReleaseAuditTests(unittest.TestCase):
    def run_main(self, args, payload, baseline=None):
        output = io.StringIO()
        with contextlib.ExitStack() as stack:
            stack.enter_context(mock.patch.object(AUDIT, "get_release", return_value=payload))
            stack.enter_context(mock.patch.object(sys, "argv", ["check-cromite-release.py", *args]))
            if baseline is not None:
                stack.enter_context(
                    mock.patch.object(AUDIT, "latest_chrome_android_baseline", return_value=baseline)
                )
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                code = AUDIT.main()
        return code, output.getvalue()

    def test_version_tuple(self):
        self.assertEqual(AUDIT.version_tuple("155.0.8059.39"), (155, 0, 8059, 39))

    def test_rejects_bad_version(self):
        with self.assertRaises(ValueError):
            AUDIT.version_tuple("155.0.bad.39")

    def test_blocks_release_behind_stable(self):
        code, output = self.run_main(["--stable-version", "155.0.8059.39"], release())
        self.assertEqual(code, 2)
        self.assertIn("GATE BLOCKED", output)

    def test_auto_baseline_uses_android_early_stable_when_newer(self):
        payload = release(version="156.0.8078.25")
        baseline = {
            "version": "156.0.8078.25",
            "channel": "early stable",
            "date": "2026-10-07",
            "url": "https://chromereleases.googleblog.com/example",
        }
        code, output = self.run_main([], payload, baseline=baseline)
        self.assertEqual(code, 0)
        self.assertIn("Chrome Android baseline: 156.0.8078.25", output)
        self.assertIn("early stable", output)

    def test_pinned_version_and_commit_must_match_latest_release(self):
        code, output = self.run_main(
            [
                "--stable-version", "153.0.8010.37",
                "--pinned-version", "153.0.8010.37",
                "--pinned-commit", "b" * 40,
            ],
            release(),
        )
        self.assertEqual(code, 3)
        self.assertIn("does not match the latest published release", output)

    def test_requires_pinned_version_and_commit_together(self):
        code, output = self.run_main(
            ["--stable-version", "153.0.8010.37", "--pinned-version", "153.0.8010.37"],
            release(),
        )
        self.assertEqual(code, 1)
        self.assertIn("must be supplied together", output)

    def test_stale_release_can_only_pass_with_explicit_prototype_override(self):
        code, output = self.run_main(
            ["--stable-version", "155.0.8059.39", "--allow-stale-prototype"],
            release(),
        )
        self.assertEqual(code, 0)
        self.assertIn("PROTOTYPE ONLY OVERRIDE", output)
        self.assertIn("Public release remains blocked", output)

    def test_passes_equal_version_and_checks_apk_digest(self):
        content = b"sample APK bytes for checksum test"
        digest = hashlib.sha256(content).hexdigest()
        payload = release(version="155.0.8059.39", digest=digest)
        with tempfile.NamedTemporaryFile() as apk:
            apk.write(content)
            apk.flush()
            code, output = self.run_main(
                ["--stable-version", "155.0.8059.39", "--apk", apk.name],
                payload,
            )
        self.assertEqual(code, 0)
        self.assertIn("APK checksum: PASS", output)
        self.assertIn("Version gate: PASS", output)

    def test_rejects_checksum_mismatch(self):
        payload = release(version="155.0.8059.39", digest="0" * 64)
        with tempfile.NamedTemporaryFile() as apk:
            apk.write(b"not the published APK")
            apk.flush()
            code, output = self.run_main(
                ["--stable-version", "155.0.8059.39", "--apk", apk.name],
                payload,
            )
        self.assertEqual(code, 1)
        self.assertIn("checksum does not match", output)


if __name__ == "__main__":
    unittest.main()
