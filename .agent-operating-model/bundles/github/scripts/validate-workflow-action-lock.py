#!/usr/bin/env python3
from pathlib import Path
import argparse
import re
import yaml

FULL_SHA = re.compile(r"^[0-9a-fA-F]{40}$")
PLACEHOLDER_SHAS = {
    "0000000000000000000000000000000000000000",
    "1111111111111111111111111111111111111111",
    "ffffffffffffffffffffffffffffffffffffffff",
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lock-file", required=True)
    parser.add_argument("--release-mode", action="store_true")
    args = parser.parse_args()

    data = yaml.safe_load(Path(args.lock_file).read_text(encoding="utf-8")) or {}
    errors = []
    actions = data.get("actions") or {}
    if not actions:
        errors.append("workflow action lock file must contain actions")
    for action, entry in actions.items():
        sha = entry.get("sha")
        if not sha or not FULL_SHA.match(str(sha)):
            errors.append(f"{action}: sha must be a full 40-character SHA")
        if args.release_mode and sha in PLACEHOLDER_SHAS:
            errors.append(f"{action}: placeholder SHA is not allowed in release mode")
        if not entry.get("classification"):
            errors.append(f"{action}: classification is required")
        if args.release_mode and not entry.get("reviewed_by"):
            errors.append(f"{action}: reviewed_by is required in release mode")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Workflow action lock validation passed.")

if __name__ == "__main__":
    main()
