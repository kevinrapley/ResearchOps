#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]
HIGH_ASSURANCE_REQUIRED = [
    "github_api",
    "workflow_lock",
    "hardened_workflows",
    "trusted_sbom_attestation",
    "external_attestation_verification",
    "accessibility_evidence",
    "performance_evidence",
    "evidence_to_repository_cross_check",
]

def load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def validate_schema(data, schema_path):
    errors = []
    try:
        from jsonschema import Draft7Validator
    except Exception as exc:
        return [f"jsonschema is required for live release policy validation: {exc}"]
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    validator = Draft7Validator(schema)
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        path = ".".join(str(p) for p in error.path) or "$"
        errors.append(f"schema:{path}: {error.message}")
    return errors

def validate_profile_requirements(data):
    errors = []
    profiles = data.get("profiles") or {}
    for profile_name in ["high-assurance", "regulated", "public-service"]:
        controls = (profiles.get(profile_name) or {}).get("required_controls") or {}
        for control in HIGH_ASSURANCE_REQUIRED:
            if controls.get(control) is not True:
                errors.append(f"{profile_name}.required_controls.{control} must be true")
    standard_controls = (profiles.get("standard") or {}).get("required_controls") or {}
    if standard_controls.get("github_api") is not True:
        errors.append("standard.required_controls.github_api must be true")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", default="templates/repository/live-release-policy.yaml")
    parser.add_argument("--schema", default="contracts/live-release-policy.schema.json")
    args = parser.parse_args()
    policy_path = Path(args.policy)
    if not policy_path.is_absolute():
        policy_path = ROOT / policy_path
    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = ROOT / schema_path
    data = load_yaml(policy_path)
    errors = validate_schema(data, schema_path) + validate_profile_requirements(data)
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Live release policy validation passed.")

if __name__ == "__main__":
    main()
