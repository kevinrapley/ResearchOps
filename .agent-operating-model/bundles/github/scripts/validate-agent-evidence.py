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
LIST_FIELDS = [
    "files_read", "files_changed", "contracts_validated", "artifacts_created",
    "gaps_recorded", "waivers_recorded"
]
STATUS_VALUES = {"passed", "failed", "not-run", "timeout", "unavailable", "waived"}
EVIDENCE_STATES = {"claimed", "observed", "verified", "unavailable", "waived"}


def resolve(path_text):
    path = Path(path_text)
    return path if path.exists() else ROOT / path_text


def load(path):
    text = path.read_text(encoding="utf-8")
    return yaml.safe_load(text) if path.suffix in {".yaml", ".yml"} else json.loads(text)


def validate_string_list(data, field, errors):
    if field not in data:
        return
    if not isinstance(data[field], list):
        errors.append(f"{field} must be a list")
        return
    for index, item in enumerate(data[field]):
        if not isinstance(item, str) or not item.strip():
            errors.append(f"{field}[{index}] must be a non-empty string")


def has_observed_execution_detail(item):
    return any(
        key in item and item.get(key) not in (None, "")
        for key in ["returncode", "stdout", "stderr", "evidence"]
    )


def validate_state(value, field, errors):
    if value not in EVIDENCE_STATES:
        errors.append(f"{field} must be one of {sorted(EVIDENCE_STATES)}")


def validate_status(value, field, errors):
    if value not in STATUS_VALUES:
        errors.append(f"{field} must be one of {sorted(STATUS_VALUES)}")


def validate_command_like_items(data, field, errors):
    if field not in data:
        return
    if not isinstance(data[field], list):
        errors.append(f"{field} must be a list")
        return
    for index, item in enumerate(data[field]):
        prefix = f"{field}[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix} must be an object")
            continue
        required_label = "command" if field in {"commands_run", "test_results"} else "name"
        if not isinstance(item.get(required_label), str) or not item.get(required_label, "").strip():
            errors.append(f"{prefix}.{required_label} is required and must be a non-empty string")
        if "status" not in item:
            errors.append(f"{prefix}.status is required")
        else:
            validate_status(item.get("status"), f"{prefix}.status", errors)
        if "state" not in item:
            errors.append(f"{prefix}.state is required")
        else:
            validate_state(item.get("state"), f"{prefix}.state", errors)
        if item.get("state") in {"observed", "verified"} and not has_observed_execution_detail(item):
            errors.append(f"{prefix} with state {item.get('state')} must include returncode, stdout, stderr or evidence")
        if item.get("status") == "passed" and item.get("state") in {"claimed", "unavailable", "waived"}:
            errors.append(f"{prefix} cannot report status passed with state {item.get('state')}")
        if "returncode" in item and item["returncode"] is not None and not isinstance(item["returncode"], int):
            errors.append(f"{prefix}.returncode must be an integer or null")


def validate_evidence_states(data, errors):
    if "evidence_states" not in data:
        return
    if not isinstance(data["evidence_states"], list):
        errors.append("evidence_states must be a list")
        return
    for index, item in enumerate(data["evidence_states"]):
        prefix = f"evidence_states[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{prefix} must be an object")
            continue
        if "state" not in item:
            errors.append(f"{prefix}.state is required")
        else:
            validate_state(item.get("state"), f"{prefix}.state", errors)
        if not isinstance(item.get("rationale"), str) or not item.get("rationale", "").strip():
            errors.append(f"{prefix}.rationale is required and must be a non-empty string")


def validate_accessibility(data, errors):
    if "accessibility" not in data or not isinstance(data["accessibility"], dict):
        return
    acc = data["accessibility"]
    if acc.get("required") is True:
        for field in ["automated_checks", "keyboard_checks", "focus_checks", "screen_reader_smoke_checks", "release_decision"]:
            if not acc.get(field):
                errors.append(f"accessibility.{field} is required when accessibility.required is true")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence")
    args = parser.parse_args()
    data = load(resolve(args.evidence))
    errors = []

    if not isinstance(data, dict):
        errors.append("Evidence root must be an object")
    else:
        missing = REQUIRED - set(data)
        if missing:
            errors.append(f"Evidence missing required fields: {sorted(missing)}")
        for field in LIST_FIELDS:
            validate_string_list(data, field, errors)
        validate_command_like_items(data, "commands_run", errors)
        validate_command_like_items(data, "tests_run", errors)
        validate_command_like_items(data, "test_results", errors)
        validate_evidence_states(data, errors)
        validate_accessibility(data, errors)

    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Agent evidence validation passed.")

if __name__ == "__main__":
    main()
