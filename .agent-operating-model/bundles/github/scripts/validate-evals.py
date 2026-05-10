#!/usr/bin/env python3
from pathlib import Path
import yaml, sys

ROOT=Path(__file__).resolve().parents[1]
REQUIRED={"id","prompt","fixture_repo","expected_files","graders","minimum_score","blocking_failures"}

def main():
    data=yaml.safe_load((ROOT/"evals.yaml").read_text(encoding="utf-8"))
    errors=[]
    if not isinstance(data, dict) or not isinstance(data.get("evals"), list):
        errors.append("evals.yaml must contain an evals list")
    for ev in data.get("evals", []):
        missing=REQUIRED-set(ev)
        if missing: errors.append(f"{ev.get('id','<unknown>')}: missing fields {sorted(missing)}")
        if not (ROOT / ev.get("fixture_repo","")).exists():
            errors.append(f"{ev.get('id')}: fixture missing {ev.get('fixture_repo')}")
        if not isinstance(ev.get("expected_files"), list):
            errors.append(f"{ev.get('id')}: expected_files must be a list")
        if not isinstance(ev.get("graders"), list) or not ev.get("graders"):
            errors.append(f"{ev.get('id')}: graders must be a non-empty list")
        for grader in ev.get("graders", []):
            if not (ROOT / "graders" / f"{grader}.xml").is_file():
                errors.append(f"{ev.get('id')}: grader missing {grader}")
        score=ev.get("minimum_score")
        if not isinstance(score,(int,float)) or score < 0 or score > 1:
            errors.append(f"{ev.get('id')}: minimum_score must be 0..1")
    if errors:
        for e in errors: print(e, file=sys.stderr)
        raise SystemExit(1)
    print("Eval validation passed.")

if __name__=="__main__":
    main()
