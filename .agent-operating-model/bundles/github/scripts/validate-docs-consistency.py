#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]


def bundle_version():
    spec = yaml.safe_load((ROOT / "prompt.spec.yaml").read_text(encoding="utf-8"))
    version = spec.get("bundle", {}).get("version")
    if not version:
        raise SystemExit("Could not read bundle.version from prompt.spec.yaml")
    return str(version)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--readme", default="README.md")
    parser.add_argument("--version")
    args = parser.parse_args()
    expected_version = args.version or bundle_version()
    text = (ROOT / args.readme).read_text(encoding="utf-8")
    errors = []
    if f"Version: {expected_version}" not in text:
        errors.append(f"README missing current Version: {expected_version}")
    if not re.search(rf"\bVersion\s+{re.escape(expected_version)}\b", text):
        errors.append(f"README current release section does not mention Version {expected_version}")
    if "## Current release" not in text:
        errors.append("README missing Current release section")
    if "release-gate report" not in text.lower():
        errors.append("README missing release-gate report coverage")
    if "live repository release gate" not in text.lower():
        errors.append("README missing live repository release gate coverage")
    if "trusted attestation" not in text.lower():
        errors.append("README missing trusted attestation coverage")
    if "accessibility" not in text.lower():
        errors.append("README missing accessibility assurance coverage")
    if "workflow hardening" not in text.lower():
        errors.append("README missing workflow hardening coverage")
    if "Codex" not in text and "automated review" not in text:
        errors.append("README missing automated review comment handling coverage")
    for stale in [
        "Current release\n\nVersion 2.8",
        "broken v2.9.2 integration",
        "fixes itself",
    ]:
        if stale in text:
            errors.append(f"README contains stale wording: {stale}")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Documentation consistency validation passed.")


if __name__ == "__main__":
    main()
