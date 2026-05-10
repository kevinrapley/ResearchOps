#!/usr/bin/env python3
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--readme", default="README.md")
    parser.add_argument("--version", default="2.9.1")
    args = parser.parse_args()
    text = (ROOT / args.readme).read_text(encoding="utf-8")
    errors = []
    if f"Version: {args.version}" not in text:
        errors.append(f"README missing current Version: {args.version}")
    forbidden = [
        "Version 2.9.0 is a",
        "Version 2.8.9 is a",
        "Version 2.8.8 is a",
    ]
    for phrase in forbidden:
        if phrase in text:
            errors.append(f"README contains stale phrase: {phrase}")
    required = [
        "validate-release-gate-report.py",
        "live-release-policy.yaml",
        "validate-live-release-policy.py",
        "trusted-attestation-verification.json",
        "validate-trusted-attestation-verification.py",
        "Trusted attestation requires both metadata validation and external verification evidence",
        "Release-gate reports are first-class artefacts",
        "High-assurance, regulated and public-service profiles require GitHub API verification",
        "validate-accessibility-evidence.py accessibility-evidence.yaml --root .",
        "validate-live-gate-fixtures.py",
    ]
    for phrase in required:
        if phrase not in text:
            errors.append(f"README missing expected phrase: {phrase}")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Documentation consistency validation passed.")

if __name__ == "__main__":
    main()
