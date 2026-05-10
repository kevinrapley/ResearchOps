#!/usr/bin/env python3
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_VERSIONS = [
    "2.9.1", "2.9.0", "2.8.9", "2.8.8", "2.8.7", "2.8.6", "2.8.5", "2.8.4", "2.8.3", "2.8.2", "2.8.1", "2.8.0",
    "2.7.0", "2.6.0", "2.5.0", "2.4.0", "2.3.0", "2.2.0",
    "2.1.0", "2.0.0", "1.1.0", "1.0.0",
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", default="CHANGELOG.md")
    args = parser.parse_args()
    path = ROOT / args.path
    text = path.read_text(encoding="utf-8")
    versions = re.findall(r"^## \[([^\]]+)\]", text, flags=re.MULTILINE)
    errors = []
    duplicates = sorted({v for v in versions if versions.count(v) > 1})
    if duplicates:
        errors.append("Duplicate changelog versions: " + ", ".join(duplicates))
    missing = [v for v in REQUIRED_VERSIONS if v not in versions]
    if missing:
        errors.append("Missing changelog versions: " + ", ".join(missing))
    if versions[:len(REQUIRED_VERSIONS)] != REQUIRED_VERSIONS:
        errors.append("Changelog versions are not in required newest-to-oldest order")
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
