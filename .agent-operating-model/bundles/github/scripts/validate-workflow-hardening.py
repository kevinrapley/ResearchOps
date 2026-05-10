#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import yaml

FIRST_PARTY_OWNERS = {"actions", "github"}
VERIFIED_THIRD_PARTY_ALLOWLIST = {
    "ruby/setup-ruby",
    "shivammathur/setup-php",
    "dtolnay/rust-toolchain",
}
FULL_SHA = re.compile(r"^[0-9a-fA-F]{40}$")
PLACEHOLDER_SHAS = {
    "0000000000000000000000000000000000000000",
    "1111111111111111111111111111111111111111",
    "ffffffffffffffffffffffffffffffffffffffff",
}

def load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def collect_uses(data):
    refs = []
    def walk(value):
        if isinstance(value, dict):
            if "uses" in value:
                refs.append(str(value["uses"]))
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for item in value:
                walk(item)
    walk(data)
    return refs

def classify(ref):
    if ref.startswith("./") or ref.startswith("../"):
        return "local"
    if ref.startswith("docker://"):
        return "docker"
    if "/" not in ref:
        return "unknown"
    action = ref.split("@", 1)[0]
    owner = action.split("/", 1)[0]
    if owner in FIRST_PARTY_OWNERS:
        return "first-party"
    if action in VERIFIED_THIRD_PARTY_ALLOWLIST:
        return "verified-third-party"
    return "third-party"

def ref_pin(ref):
    if "@" not in ref:
        return None
    return ref.rsplit("@", 1)[1]

def load_lock(path):
    if not path:
        return {}
    lock_path = Path(path)
    if not lock_path.exists():
        raise SystemExit(f"Workflow action lock file not found: {lock_path}")
    data = yaml.safe_load(lock_path.read_text(encoding="utf-8")) or {}
    return data.get("actions") or {}

def lock_sha_for(lock, action):
    entry = lock.get(action) or {}
    return entry.get("sha")

def validate(path, mode, validation_scope, lock):
    errors = []
    warnings = []
    data = load_yaml(path)
    if "permissions" not in data:
        errors.append(f"{path}: top-level permissions are required")
    text = Path(path).read_text(encoding="utf-8")
    if "pull_request_target" in text:
        errors.append(f"{path}: pull_request_target requires explicit security review and is disallowed by default")
    if re.search(r"\|\|\s*true", text):
        errors.append(f"{path}: silent failure pattern '|| true' is not allowed")

    classifications = []
    for ref in collect_uses(data):
        kind = classify(ref)
        pin = ref_pin(ref)
        action = ref.split("@", 1)[0]
        classifications.append({"ref": ref, "classification": kind, "pin": pin})

        if pin in PLACEHOLDER_SHAS:
            message = f"{path}: placeholder SHA is not a valid release pin: {ref}"
            if validation_scope == "template":
                warnings.append(message)
            else:
                errors.append(message)

        if kind == "third-party":
            warnings.append(f"{path}: third-party action detected: {ref}")

        if mode in {"hardened", "third-party-pinned"} and kind in {"third-party", "verified-third-party", "first-party"}:
            if not (pin and FULL_SHA.match(pin)):
                message = f"{path}: {kind} action must be pinned by full SHA in {mode} mode: {ref}"
                if validation_scope == "template":
                    warnings.append(message)
                else:
                    errors.append(message)

        if lock and kind in {"third-party", "verified-third-party", "first-party"}:
            expected = lock_sha_for(lock, action)
            if not expected:
                errors.append(f"{path}: action missing from workflow action lock file: {action}")
            elif pin != expected:
                errors.append(f"{path}: action pin does not match lock file for {action}: workflow={pin}, lock={expected}")

        if kind == "docker" and mode in {"hardened", "third-party-pinned"}:
            errors.append(f"{path}: docker actions require explicit review in {mode} mode: {ref}")
    return errors, warnings, classifications

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default=".github/workflows")
    parser.add_argument("--mode", choices=["standard", "third-party-pinned", "hardened"], default="standard")
    parser.add_argument("--template-mode", action="store_true", help="Validate templates without treating placeholder pins as release blockers.")
    parser.add_argument("--release-mode", action="store_true", help="Validate release-ready workflows. Placeholder SHAs are blocking.")
    parser.add_argument("--lock-file")
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()

    validation_scope = "release" if args.release_mode else "template" if args.template_mode else "release"
    lock = load_lock(args.lock_file) if args.lock_file else {}

    root = Path(args.path)
    if root.is_file():
        files = [root]
    elif root.is_dir():
        files = sorted(list(root.glob("*.yml")) + list(root.glob("*.yaml")))
    else:
        raise SystemExit(f"Workflow path not found: {root}")

    errors = []
    warnings = []
    report = []
    for wf in files:
        wf_errors, wf_warnings, classifications = validate(wf, args.mode, validation_scope, lock)
        errors.extend(wf_errors)
        warnings.extend(wf_warnings)
        report.append({"workflow": str(wf), "actions": classifications})

    if args.report:
        print(yaml.safe_dump({"mode": args.mode, "validation_scope": validation_scope, "workflows": report, "warnings": warnings}, sort_keys=False))
    else:
        for warning in warnings:
            print(f"warning: {warning}")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Workflow hardening validation passed.")

if __name__ == "__main__":
    main()
