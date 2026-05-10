#!/usr/bin/env python3
from pathlib import Path
import argparse
import contextlib
import io
import json
import runpy
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    text = Path(path).read_text(encoding="utf-8")
    return yaml.safe_load(text) if str(path).endswith((".yaml", ".yml")) else json.loads(text)

def run_script(args):
    old_argv = sys.argv[:]
    sys.argv = args
    try:
        with contextlib.redirect_stdout(io.StringIO()) as out:
            runpy.run_path(str(ROOT / args[0]), run_name="__main__")
        return 0, out.getvalue(), ""
    except SystemExit as exc:
        code = 0 if exc.code in (None, 0) else int(exc.code) if isinstance(exc.code, int) else 1
        return code, out.getvalue() if "out" in locals() else "", str(exc)
    finally:
        sys.argv = old_argv

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--output", choices=["yaml", "json"], default="yaml")
    args = parser.parse_args()

    repo = Path(args.repo)
    evidence = load(args.evidence)
    errors = []
    warnings = []

    for rel in evidence.get("files_changed", []):
        if rel.startswith("/"):
            continue
        if not (repo / rel).exists():
            warnings.append(f"evidence.files_changed path is not present in repository: {rel}")

    code, stdout, stderr = run_script(["scripts/verify-repository-state.py", "--repo", str(repo), "--output", "yaml"])
    repo_state = yaml.safe_load(stdout) if stdout.strip() else {}
    if code:
        errors.append("repository state verification failed while checking evidence")

    declared_branch = evidence.get("branch_protection_verification") or {}
    if declared_branch:
        if declared_branch.get("passed") is True and not repo_state.get("direct_state_verified"):
            errors.append("evidence claims branch protection passed but repository state did not verify")
        expected = set(repo_state.get("expected_status_checks") or [])
        declared = set(declared_branch.get("required_status_checks") or [])
        if expected and declared and not expected.issubset(declared):
            errors.append("evidence branch protection status checks do not include selected status checks")

    declared_gh = evidence.get("github_settings_verification") or {}
    if declared_gh and declared_gh.get("passed") is True:
        code, stdout, stderr = run_script(["scripts/verify-github-settings.py", "--repo", str(repo), "--output", "yaml"])
        gh_state = yaml.safe_load(stdout) if stdout.strip() else {}
        if code or not gh_state.get("passed"):
            errors.append("evidence claims GitHub settings passed but verifier did not pass")

    declared_accessibility = evidence.get("accessibility") or {}
    if declared_accessibility.get("required") is True or (repo / "accessibility-evidence.md").exists():
        if not (repo / "accessibility-evidence.md").exists() and not declared_accessibility.get("evidence_file"):
            errors.append("accessibility evidence is required but no evidence file is present")

    result = {
        "repository": str(repo),
        "evidence": str(args.evidence),
        "errors": errors,
        "warnings": warnings,
        "passed": not errors,
    }
    print(json.dumps(result, indent=2) if args.output == "json" else yaml.safe_dump(result, sort_keys=False))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
