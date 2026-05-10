#!/usr/bin/env python3
from pathlib import Path
import argparse
import filecmp
import json
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from repository_conditions import build_traits, required_repository_files, select_workflow_templates
from github_settings_verification import semantic_checks, verify_settings

CODEOWNERS_PATHS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]

def load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def all_files(path):
    if not path or not Path(path).exists():
        return set()
    root = Path(path)
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".pyo"}}

def diff_against_baseline(baseline, repo):
    if not baseline:
        return {"created_files": [], "modified_files": [], "deleted_files": []}
    baseline = Path(baseline)
    repo = Path(repo)
    base_files = all_files(baseline)
    repo_files = all_files(repo)
    created = sorted(repo_files - base_files)
    deleted = sorted(base_files - repo_files)
    modified = []
    for rel in sorted(base_files & repo_files):
        try:
            if not filecmp.cmp(baseline / rel, repo / rel, shallow=False):
                modified.append(rel)
        except OSError:
            modified.append(rel)
    return {"created_files": created, "modified_files": modified, "deleted_files": deleted}

def codeowners_present(repo):
    return any((Path(repo) / path).exists() for path in CODEOWNERS_PATHS)

def accessibility_evidence_errors(path):
    if not path.exists():
        return [f"{path.name} is required"]
    text = path.read_text(encoding="utf-8", errors="ignore").lower()
    checks = {
        "automated": ["automated", "axe", "pa11y", "lighthouse"],
        "keyboard": ["keyboard"],
        "focus": ["focus"],
        "screen_reader": ["screen reader", "screen-reader"],
        "release_decision": ["release decision", "pass", "pass_with_gap", "fail"],
    }
    errors = []
    for name, terms in checks.items():
        if not any(term in text for term in terms):
            errors.append(f"accessibility evidence missing {name} coverage")
    if "manual" not in text and "keyboard" not in text:
        errors.append("accessibility evidence must include manual coverage")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--baseline")
    parser.add_argument("--risk-level", default="standard")
    parser.add_argument("--public-service", action="store_true")
    parser.add_argument("--web", action="store_true")
    parser.add_argument("--performance-sensitive", action="store_true")
    parser.add_argument("--release", action="store_true")
    parser.add_argument("--bundle-release", action="store_true")
    parser.add_argument("--github-api", action="store_true")
    parser.add_argument("--require-github-api", action="store_true")
    parser.add_argument("--github-owner")
    parser.add_argument("--github-repo")
    parser.add_argument("--github-token-env", default="GITHUB_TOKEN")
    parser.add_argument("--allow-api-unavailable", action="store_true")
    parser.add_argument("--output", choices=["yaml", "json"], default="yaml")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    traits = build_traits(
        repo,
        public_service=args.public_service,
        web=args.web,
        performance_sensitive=args.performance_sensitive,
        release=args.release,
        bundle_release=args.bundle_release,
    )
    detected, selected = select_workflow_templates(repo, traits)
    required = required_repository_files(args.risk_level, traits)
    present = [rel for rel in required if (repo / rel).exists()]
    missing = [rel for rel in required if not (repo / rel).exists()]
    selected_workflows = [item["destination_path"] for item in selected]
    missing_workflows = [rel for rel in selected_workflows if not (repo / rel).exists()]
    expected_status_checks = [item["required_status_check"] for item in selected if item.get("required_status_check")]

    semantic_errors = []
    semantic_warnings = []
    github_settings_result = {}
    settings_path = repo / "github-settings.yaml"
    if settings_path.exists():
        github_settings_result, github_errors = verify_settings(
            repo,
            settings_path,
            api=args.github_api,
            owner=args.github_owner,
            repo_name=args.github_repo,
            token_env=args.github_token_env,
            allow_api_unavailable=args.allow_api_unavailable,
            require_api=args.require_github_api,
        )
        semantic_errors.extend(github_errors)
        semantic_warnings.extend(github_settings_result.get("warnings", []))
    else:
        semantic_errors.append("github-settings.yaml is required for branch protection verification")

    if (repo / "accessibility-evidence.md").exists() or traits.get("web") or traits.get("public_service"):
        semantic_errors.extend(accessibility_evidence_errors(repo / "accessibility-evidence.md"))

    diff = diff_against_baseline(args.baseline, repo)

    result = {
        "repository": str(repo),
        "risk_level": args.risk_level,
        "traits": traits,
        "required_files_present": present,
        "required_files_missing": missing,
        "detected_languages": detected,
        "selected_workflows": selected_workflows,
        "missing_workflows": missing_workflows,
        "expected_status_checks": expected_status_checks,
        "github_settings": github_settings_result,
        "github_settings_semantic_errors": semantic_errors,
        "github_settings_semantic_warnings": semantic_warnings,
        "codeowners_present": codeowners_present(repo),
        "diff": diff,
        "direct_state_verified": not missing and not missing_workflows and not semantic_errors,
    }
    print(json.dumps(result, indent=2) if args.output == "json" else yaml.safe_dump(result, sort_keys=False))
    if not result["direct_state_verified"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
