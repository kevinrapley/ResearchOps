#!/usr/bin/env python3
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]

def validate_custom(data):
    errors = []
    if data.get("status") == "failed":
        if not data.get("failed_command"):
            errors.append("failed report must include failed_command")
        if not data.get("error"):
            errors.append("failed report must include structured error")
        if not data.get("commands"):
            errors.append("failed report must include command history")
        else:
            failed_entries = [c for c in data["commands"] if c.get("status") in {"failed", "timeout"}]
            if not failed_entries:
                errors.append("failed report must include a failed or timeout command entry")
    for index, command in enumerate(data.get("commands", [])):
        if "duration_seconds" not in command:
            errors.append(f"commands[{index}] missing duration_seconds")
        if "stdout_tail" not in command:
            errors.append(f"commands[{index}] missing stdout_tail")
        if "stderr_tail" not in command:
            errors.append(f"commands[{index}] missing stderr_tail")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report")
    parser.add_argument("--schema", default="contracts/release-gate-report.schema.json")
    args = parser.parse_args()
    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    schema_path = Path(args.schema)
    if not schema_path.is_absolute():
        schema_path = ROOT / schema_path
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors = []
    try:
        from jsonschema import Draft7Validator
        validator = Draft7Validator(schema)
        for error in sorted(validator.iter_errors(report), key=lambda e: list(e.path)):
            path = ".".join(str(p) for p in error.path) or "$"
            errors.append(f"schema:{path}: {error.message}")
    except Exception as exc:
        errors.append(f"jsonschema validation failed to run: {exc}")
    errors.extend(validate_custom(report))
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Release gate report validation passed.")

if __name__ == "__main__":
    main()
