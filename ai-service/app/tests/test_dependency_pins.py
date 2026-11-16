"""Regression checks for security-relevant pins in ai-service/requirements.txt.

The service installs its dependencies from this manifest, so the manifest must
resolve certifi and langgraph-sdk at or above the versions that carry the
security fixes.
"""

from pathlib import Path

REQUIREMENTS = Path(__file__).resolve().parents[2] / "requirements.txt"

MINIMUM_VERSIONS = {
    "certifi": (2026, 10, 18),
    "langgraph-sdk": (0, 4, 4),
}


def _pinned_versions():
    pins = {}
    for raw_line in REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or "==" not in line:
            continue
        name, version = line.split("==", 1)
        pins[name.strip().lower()] = version.strip()
    return pins


def test_security_pins_are_at_or_above_fixed_versions():
    pins = _pinned_versions()

    for package, minimum in MINIMUM_VERSIONS.items():
        assert package in pins, f"{package} is not pinned in {REQUIREMENTS}"
        version = tuple(int(part) for part in pins[package].split("."))
        assert version >= minimum, (
            f"{package} is pinned at {pins[package]}, expected >= "
            f"{'.'.join(str(part) for part in minimum)}"
        )
