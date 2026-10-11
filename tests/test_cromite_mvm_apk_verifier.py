#!/usr/bin/env python3
"""Behavioral tests for verify-cromite-mvm-apk.sh using synthetic APK fixtures."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import zipfile

PACKAGE = "com.mvmsolo.mvmbrowser"
VERSION = "153.0.8010.37"
COMMIT = "11507ac1061b5ea227806f5e84db5a57df6ccf6a"
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "verify-cromite-mvm-apk.sh"


def run_verifier(apk: Path, metadata: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SCRIPT), str(apk), str(metadata)],
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )


def write_fake_aapt(path: Path) -> None:
    path.write_text(
        "#!/usr/bin/env bash\n"
        "set -eu\n"
        "package=\"${FAKE_PACKAGE:-com.mvmsolo.mvmbrowser}\"\n"
        "printf \"package: name='%s' versionCode='1' versionName='test'\\n\" \"$package\"\n"
        "printf \"sdkVersion:'29'\\ntargetSdkVersion:'36'\\nnative-code: 'arm64-v8a'\\n\"\n",
        encoding="utf-8",
    )
    path.chmod(0o755)


def write_metadata(path: Path, apk: Path) -> None:
    digest = hashlib.sha256(apk.read_bytes()).hexdigest()
    path.write_text(
        f"cromite_version={VERSION}\n"
        f"cromite_commit={COMMIT}\n"
        "build_image=uazo/cromite-build:test\n"
        "target_os=android\n"
        "target_cpu=arm64\n"
        f"mvm_package_name={PACKAGE}\n"
        "branding_status=package-id-only-upstream-ui\n"
        f"apk_sha256={digest}\n",
        encoding="utf-8",
    )


def write_fixture_apk(path: Path) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("AndroidManifest.xml", b"synthetic manifest fixture")
        archive.writestr("classes.dex", b"synthetic dex fixture")


def main() -> int:
    if not SCRIPT.is_file():
        raise SystemExit(f"Missing verifier script: {SCRIPT}")
    with tempfile.TemporaryDirectory(prefix="mvm-cromite-verifier-") as tmp:
        root = Path(tmp)
        bin_dir = root / "bin"
        bin_dir.mkdir()
        aapt = bin_dir / "aapt"
        signer = bin_dir / "apksigner"
        write_fake_aapt(aapt)
        signer.write_text("#!/usr/bin/env bash\necho 'Verifies'\nexit 0\n", encoding="utf-8")
        signer.chmod(0o755)
        apk = root / "synthetic.apk"
        metadata = root / "metadata.txt"
        write_fixture_apk(apk)
        write_metadata(metadata, apk)
        env = os.environ.copy()
        env.update({"AAPT": str(aapt), "APKSIGNER": str(signer)})

        good = run_verifier(apk, metadata, env)
        assert good.returncode == 0, f"valid fixture failed:\n{good.stdout}\n{good.stderr}"
        assert "VERIFY PASSED" in good.stdout
        print("PASS: valid ARM64 MVM package fixture")

        apk.write_bytes(b"tampered after metadata creation")
        tampered = run_verifier(apk, metadata, env)
        assert tampered.returncode != 0 and "checksum" in tampered.stderr.lower(), (
            f"tampered APK was not rejected:\n{tampered.stdout}\n{tampered.stderr}"
        )
        print("PASS: APK checksum tampering is rejected")

        write_fixture_apk(apk)
        write_metadata(metadata, apk)
        env["FAKE_PACKAGE"] = "org.cromite.cromite"
        wrong_package = run_verifier(apk, metadata, env)
        assert wrong_package.returncode != 0 and "package" in wrong_package.stderr.lower(), (
            f"wrong package ID was not rejected:\n{wrong_package.stdout}\n{wrong_package.stderr}"
        )
        print("PASS: non-MVM package ID is rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
