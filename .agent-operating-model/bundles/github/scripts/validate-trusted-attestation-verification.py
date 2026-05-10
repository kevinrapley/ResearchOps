#!/usr/bin/env python3
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence")
    parser.add_argument("--schema", default="contracts/trusted-attestation-verification.schema.json")
    parser.add_argument("--allow-dry-run", action="store_true")
    args = parser.parse_args()
    evidence = json.loads(Path(args.evidence).read_text(encoding="utf-8"))
    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = ROOT / schema_path
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors = []
    try:
        from jsonschema import Draft7Validator
        for error in sorted(Draft7Validator(schema).iter_errors(evidence), key=lambda e: list(e.path)):
            path = ".".join(str(p) for p in error.path) or "$"
            errors.append(f"schema:{path}: {error.message}")
    except Exception as exc:
        errors.append(f"jsonschema validation failed to run: {exc}")
    checks = evidence.get("checks", [])
    if evidence.get("passed") is not True:
        errors.append("trusted attestation verification evidence must have passed: true")
    valid_checks = [
        c for c in checks
        if c.get("passed") and (args.allow_dry_run or not c.get("dry_run")) and not c.get("tool_unavailable")
    ]
    if not any("gh" in (c.get("command") or [""])[0] for c in valid_checks):
        errors.append("successful gh attestation verify evidence is required")
    if not any("cosign" in (c.get("command") or [""])[0] for c in valid_checks):
        errors.append("successful cosign verify-blob evidence is required")
    if not args.allow_dry_run:
        for index, check in enumerate(checks):
            if check.get("dry_run"):
                errors.append(f"checks[{index}] dry-run evidence is not trusted verification")
            if check.get("tool_unavailable"):
                errors.append(f"checks[{index}] tool-unavailable evidence is not trusted verification")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Trusted attestation verification evidence validation passed.")

if __name__ == "__main__":
    main()
