#!/usr/bin/env python3
from pathlib import Path
import sys, yaml

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {"id","template_path","destination_path","required_for","archetypes","trigger_conditions","associated_contract","associated_graders","copy_mode","required"}

def main():
    data = yaml.safe_load((ROOT / "template-registry.yaml").read_text(encoding="utf-8"))
    errors=[]
    if not isinstance(data, dict) or not isinstance(data.get("templates"), list):
        errors.append("template-registry.yaml must contain a templates list")
    seen=set()
    for entry in data.get("templates", []):
        missing=REQUIRED-set(entry)
        if missing: errors.append(f"{entry.get('id','<unknown>')}: missing fields {sorted(missing)}")
        tid=entry.get("id")
        if tid in seen: errors.append(f"Duplicate template id: {tid}")
        seen.add(tid)
        if not (ROOT / entry.get("template_path","")).is_file():
            errors.append(f"Template file missing: {entry.get('template_path')}")
        contract=entry.get("associated_contract")
        if contract and not (ROOT / contract).is_file():
            errors.append(f"Associated contract missing: {contract}")
        for grader in entry.get("associated_graders", []):
            if not (ROOT / grader).is_file():
                errors.append(f"Associated grader missing: {grader}")
        if entry.get("copy_mode") not in {"copy","render","reference"}:
            errors.append(f"{tid}: invalid copy_mode")
    if errors:
        for e in errors: print(e, file=sys.stderr)
        raise SystemExit(1)
    print("Template registry validation passed.")

if __name__ == "__main__":
    main()
