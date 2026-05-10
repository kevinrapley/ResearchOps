#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "task_id", "mode", "files_read", "files_changed", "commands_run",
    "contracts_validated", "artifacts_created", "gaps_recorded", "waivers_recorded"
}

def resolve(path_text):
    path = Path(path_text)
    return path if path.exists() else ROOT / path_text

def load(path):
    text = path.read_text(encoding="utf-8")
    return yaml.safe_load(text) if path.suffix in {".yaml", ".yml"} else json.loads(text)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence")
    args = parser.parse_args()
    data = load(resolve(args.evidence))
    errors = []
    missing = REQUIRED - set(data)
    if missing:
        errors.append(f"Evidence missing required fields: {sorted(missing)}")
    for field in ["files_read", "files_changed", "contracts_validated", "artifacts_created", "gaps_recorded", "waivers_recorded"]:
        if field in data and not isinstance(data[field], list):
            errors.append(f"{field} must be a list")
    for field in ["commands_run", "tests_run"]:
        if field in data:
            if not isinstance(data[field], list):
                errors.append(f"{field} must be a list")
            else:
                for index, item in enumerate(data[field]):
                    if not isinstance(item, dict) or "status" not in item:
                        errors.append(f"{field}[{index}] must contain status")
                    elif item["status"] not in {"passed", "failed", "not-run"}:
                        errors.append(f"{field}[{index}].status must be passed, failed, or not-run")
    if "accessibility" in data and isinstance(data["accessibility"], dict):
        acc = data["accessibility"]
        if acc.get("required") is True:
            for field in ["automated_checks", "keyboard_checks", "focus_checks", "screen_reader_smoke_checks", "release_decision"]:
                if not acc.get(field):
                    errors.append(f"accessibility.{field} is required when accessibility.required is true")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Agent evidence validation passed.")

if __name__ == "__main__":
    main()
