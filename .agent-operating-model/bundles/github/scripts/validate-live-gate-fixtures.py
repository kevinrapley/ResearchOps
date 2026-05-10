#!/usr/bin/env python3
from pathlib import Path
import argparse
import yaml

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_HIGH_ASSURANCE = [
    "workflow-action-lock.yaml",
    "attestation.json",
    "trusted-attestation-verification.json",
    "accessibility-evidence.yaml",
    "performance-budget.yaml",
    "performance-results.yaml",
    "sbom.json",
    "agent-evidence.yaml",
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", default="examples/fixtures/live-gate")
    args = parser.parse_args()
    base = ROOT / args.fixtures
    errors = []
    positive = base / "high-assurance-pass" / "repo"
    for rel in REQUIRED_HIGH_ASSURANCE:
        if not (positive / rel).exists():
            errors.append(f"high-assurance positive fixture missing {rel}")
    if not (positive / ".github" / "workflows").exists():
        errors.append("high-assurance positive fixture missing .github/workflows")
    negative_dirs = sorted(base.glob("negative-*"))
    expected = {
        "negative-missing-workflow-lock",
        "negative-placeholder-workflow-sha",
        "negative-missing-trusted-sbom-attestation",
        "negative-offline-test-attestation",
        "negative-missing-external-attestation-verification",
        "negative-missing-accessibility-evidence",
        "negative-missing-performance-evidence",
        "negative-missing-github-api-observability",
    }
    found = {d.name for d in negative_dirs}
    missing = sorted(expected - found)
    if missing:
        errors.append("missing high-assurance negative fixtures: " + ", ".join(missing))
    for d in negative_dirs:
        fixture = yaml.safe_load((d / "fixture.yaml").read_text(encoding="utf-8"))
        if fixture.get("expected") != "fail":
            errors.append(f"{d.name} must be an expected fail fixture")
        if fixture.get("profile") != "high-assurance":
            errors.append(f"{d.name} must use high-assurance profile")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Live gate fixture validation passed.")

if __name__ == "__main__":
    main()
