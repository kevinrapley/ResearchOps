#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]
VERSION_HEADING = re.compile(r"^## \[([^\]]+)\]", flags=re.MULTILINE)
SEMVER_PREFIX = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:[+-].*)?$")


def bundle_version():
    spec = yaml.safe_load((ROOT / "prompt.spec.yaml").read_text(encoding="utf-8"))
    version = spec.get("bundle", {}).get("version")
    if not version:
        raise SystemExit("Could not read bundle.version from prompt.spec.yaml")
    return str(version)


def version_key(value):
    match = SEMVER_PREFIX.match(value)
    if not match:
        return None
    return tuple(int(part) for part in match.groups())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default="CHANGELOG.md")
    parser.add_argument("--version")
    args = parser.parse_args()
    expected_version = args.version or bundle_version()
    path = ROOT / args.path
    text = path.read_text(encoding="utf-8")
    versions = VERSION_HEADING.findall(text)
    errors = []

    if not versions:
        errors.append("No changelog version headings found")

    duplicates = sorted({version for version in versions if versions.count(version) > 1})
    if duplicates:
        errors.append("Duplicate changelog versions: " + ", ".join(duplicates))

    if not any(version == expected_version or version.startswith(f"{expected_version}+") for version in versions):
        errors.append(f"Missing changelog entry for current bundle version: {expected_version}")

    keyed_versions = [(version, version_key(version)) for version in versions]
    invalid_versions = [version for version, key in keyed_versions if key is None]
    if invalid_versions:
        errors.append("Invalid changelog version headings: " + ", ".join(invalid_versions))

    numeric_keys = [key for _version, key in keyed_versions if key is not None]
    if numeric_keys != sorted(numeric_keys, reverse=True):
        errors.append("Changelog versions are not in newest-to-oldest semantic version order")

    first_key = numeric_keys[0] if numeric_keys else None
    expected_key = version_key(expected_version)
    if first_key and expected_key and first_key != expected_key:
        errors.append(f"Newest changelog entry {versions[0]} does not match current bundle version {expected_version}")

    forbidden = [
        "broken v2.9.1 integration",
        "fixes the broken v2.9.1",
        "All notable changes to this bundle will be documented in this file.",
    ]
    for phrase in forbidden:
        if phrase in text:
            errors.append(f"Forbidden stale phrase found: {phrase}")

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Changelog validation passed.")


if __name__ == "__main__":
    main()
