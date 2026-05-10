#!/usr/bin/env python3
from pathlib import Path
import json
import os
import urllib.request
import urllib.error
import yaml
import sys

ROOT = Path(__file__).resolve().parents[1]
CODEOWNERS_PATHS = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]

def load_yaml(path):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))

def codeowners_present(repo):
    repo = Path(repo)
    return any((repo / path).exists() for path in CODEOWNERS_PATHS)

def selected_status_checks(repo):
    sys.path.insert(0, str(ROOT / "scripts"))
    from repository_conditions import build_traits, select_workflow_templates
    traits = build_traits(Path(repo))
    _, selected = select_workflow_templates(Path(repo), traits)
    return [item["required_status_check"] for item in selected if item.get("required_status_check")]

def github_api_get(url, token, default=None, strict=False):
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status = getattr(response, "status", getattr(response, "code", 200))
            body = response.read()
            if status == 204 or not body:
                return {}
            return json.loads(body.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if strict:
            reason = "insufficient token permissions" if exc.code == 403 else "not observable"
            raise RuntimeError(f"GitHub API {reason} under required verification: {url} returned HTTP {exc.code}") from exc
        if exc.code in {403, 404} and default is not None:
            return default
        raise

def semantic_checks(repo, settings, required_status_checks=None):
    errors = []
    warnings = []
    bp = settings.get("branch_protection") or {}
    security = settings.get("security_features") or {}
    actions = settings.get("actions_policy") or {}

    if not settings.get("default_branch"):
        errors.append("default_branch is required")

    review_count = bp.get("required_approving_review_count", bp.get("required_reviews", 0))
    if int(review_count or 0) < 1:
        errors.append("branch_protection.required_approving_review_count or required_reviews must be at least 1")

    if bp.get("require_pull_request_reviews") is False:
        errors.append("branch_protection.require_pull_request_reviews must not be false")

    if bp.get("require_code_owner_reviews") is True and not codeowners_present(repo):
        errors.append("CODEOWNERS file is required when code owner reviews are required")

    if bp.get("require_status_checks") is False:
        errors.append("branch_protection.require_status_checks must not be false")

    required = set(bp.get("required_status_checks") or [])
    expected = set(required_status_checks or selected_status_checks(repo))
    missing_status = sorted(expected - required)
    if missing_status:
        errors.append("branch_protection.required_status_checks missing selected checks: " + ", ".join(missing_status))

    if bp.get("allow_force_pushes") is not False:
        errors.append("branch_protection.allow_force_pushes must be false")

    if bp.get("allow_deletions") is not False:
        errors.append("branch_protection.allow_deletions must be false")

    if bp.get("require_conversation_resolution") is False:
        errors.append("branch_protection.require_conversation_resolution must not be false")

    if bp.get("require_signed_commits") is False:
        warnings.append("branch_protection.require_signed_commits is not enabled")

    if bp.get("linear_history") is not True:
        warnings.append("branch_protection.linear_history is not enabled")

    if settings.get("workflow_permissions") not in {"read", "restricted", "read-only"}:
        errors.append("workflow_permissions should be read, read-only, or restricted")

    if actions.get("allowed_actions") in {None, "all"}:
        warnings.append("actions_policy.allowed_actions should restrict third-party actions")

    for feature in ["dependabot", "secret_scanning", "push_protection", "code_scanning", "dependency_review"]:
        if security.get(feature) is not True:
            warnings.append(f"security_features.{feature} is not enabled")

    return errors, warnings

def inspect_github_api(owner, repo_name, branch, token, strict=False):
    base = f"https://api.github.com/repos/{owner}/{repo_name}"
    repo = github_api_get(base, token, strict=strict)
    protection = github_api_get(f"{base}/branches/{branch}/protection", token, default={}, strict=strict)
    required_reviews = protection.get("required_pull_request_reviews") or {}
    required_status = protection.get("required_status_checks") or {}
    contexts = required_status.get("contexts") or []
    checks = required_status.get("checks") or []
    check_names = [item.get("context") for item in checks if item.get("context")]
    review_count = required_reviews.get("required_approving_review_count", 0)

    rulesets = github_api_get(f"{base}/rulesets", token, default=[], strict=strict)
    environments = github_api_get(f"{base}/environments", token, default={}, strict=strict)
    actions_permissions = github_api_get(f"{base}/actions/permissions", token, default={}, strict=strict)
    codeowners_errors = github_api_get(f"{base}/codeowners/errors", token, default={"errors": []}, strict=strict)
    vulnerability_alerts = github_api_get(f"{base}/vulnerability-alerts", token, default={}, strict=strict)
    automated_security = github_api_get(f"{base}/automated-security-fixes", token, default={}, strict=strict)
    secret_scanning = github_api_get(f"{base}/secret-scanning/alerts?state=open&per_page=1", token, default=[], strict=strict)
    dependabot_alerts = github_api_get(f"{base}/dependabot/alerts?state=open&per_page=1", token, default=[], strict=strict)

    branch_protection = {
        "require_pull_request_reviews": bool(required_reviews),
        "required_reviews": review_count,
        "required_approving_review_count": review_count,
        "dismiss_stale_reviews": required_reviews.get("dismiss_stale_reviews"),
        "require_code_owner_reviews": required_reviews.get("require_code_owner_reviews"),
        "require_status_checks": bool(contexts or check_names),
        "required_status_checks": sorted(set(contexts + check_names)),
        "linear_history": (protection.get("required_linear_history") or {}).get("enabled"),
        "allow_force_pushes": (protection.get("allow_force_pushes") or {}).get("enabled"),
        "allow_deletions": (protection.get("allow_deletions") or {}).get("enabled"),
        "require_conversation_resolution": (protection.get("required_conversation_resolution") or {}).get("enabled"),
        "require_signed_commits": (protection.get("required_signatures") or {}).get("enabled"),
    }

    deployment_protections = []
    for env in environments.get("environments", []) if isinstance(environments, dict) else []:
        deployment_protections.append({
            "name": env.get("name"),
            "protection_rules": env.get("protection_rules") or [],
            "deployment_branch_policy": env.get("deployment_branch_policy"),
        })

    observed = {
        "default_branch": repo.get("default_branch"),
        "branch_protection": branch_protection,
        "rulesets": rulesets if isinstance(rulesets, list) else rulesets.get("rulesets", []),
        "environments": deployment_protections,
        "codeowners": {
            "api_checked": True,
            "errors": codeowners_errors.get("errors", []) if isinstance(codeowners_errors, dict) else [],
        },
        "actions_policy": {
            "allowed_actions": actions_permissions.get("allowed_actions"),
            "enabled_repositories": actions_permissions.get("enabled_repositories"),
            "default_workflow_permissions": actions_permissions.get("default_workflow_permissions"),
            "can_approve_pull_request_reviews": actions_permissions.get("can_approve_pull_request_reviews"),
        },
        "security_features": {
            "vulnerability_alerts_observed": vulnerability_alerts == {} or bool(vulnerability_alerts),
            "dependabot_security_updates_observed": automated_security == {} or bool(automated_security),
            "secret_scanning_open_alert_sample": len(secret_scanning) if isinstance(secret_scanning, list) else None,
            "dependabot_open_alert_sample": len(dependabot_alerts) if isinstance(dependabot_alerts, list) else None,
        },
        "verification_method": "api",
    }
    return observed

def api_semantic_checks(api_state, expected_status_checks):
    errors = []
    warnings = []
    bp = api_state.get("branch_protection") or {}
    actions = api_state.get("actions_policy") or {}
    codeowners = api_state.get("codeowners") or {}
    required = set(bp.get("required_status_checks") or [])
    expected = set(expected_status_checks or [])
    missing = sorted(expected - required)
    if missing:
        errors.append("api.branch_protection.required_status_checks missing selected checks: " + ", ".join(missing))
    if int(bp.get("required_approving_review_count") or 0) < 1:
        errors.append("api.branch_protection requires at least one approving review")
    if bp.get("require_code_owner_reviews") is not True:
        warnings.append("api.branch_protection.require_code_owner_reviews is not enabled")
    if codeowners.get("errors"):
        errors.append("api.CODEOWNERS has errors")
    if actions.get("default_workflow_permissions") not in {"read", "read_repository"}:
        warnings.append("api.actions.default_workflow_permissions is not read-only")
    if actions.get("allowed_actions") in {None, "all"}:
        warnings.append("api.actions.allowed_actions is not restricted")
    if bp.get("require_conversation_resolution") is not True:
        warnings.append("api.branch_protection.required_conversation_resolution is not enabled")
    if bp.get("require_signed_commits") is not True and bp.get("linear_history") is not True:
        warnings.append("api.branch_protection should require signed commits or linear history")
    if not api_state.get("rulesets"):
        warnings.append("api.rulesets not found or not configured")
    if not api_state.get("environments"):
        warnings.append("api.environments not found or no deployment protections configured")
    return errors, warnings

def verify_settings(local_repo, settings_path, api=False, owner=None, repo_name=None, branch=None, token_env="GITHUB_TOKEN", allow_api_unavailable=False, require_api=False):
    local_repo = Path(local_repo)
    settings = load_yaml(settings_path)
    branch = branch or settings.get("default_branch") or "main"
    expected_checks = selected_status_checks(local_repo)
    file_errors, warnings = semantic_checks(local_repo, settings, expected_checks)
    api_state = None
    api_errors = []
    api_warnings = []
    verification_method = "file"

    if api or require_api:
        token = os.environ.get(token_env)
        if not owner or not repo_name:
            api_errors.append("--owner and --repo-name are required for API inspection")
        elif not token:
            api_errors.append(f"{token_env} is not set")
        else:
            try:
                api_state = inspect_github_api(owner, repo_name, branch, token, strict=require_api)
                observed_errors, observed_warnings = api_semantic_checks(api_state, expected_checks)
                api_errors.extend(observed_errors)
                api_warnings.extend(observed_warnings)
                verification_method = "file-and-api"
            except Exception as exc:
                api_errors.append(str(exc))
        if api_errors:
            if require_api or not allow_api_unavailable:
                file_errors.extend([f"github_api:{error}" for error in api_errors])
            else:
                verification_method = "file-api-unavailable"

    warnings.extend([f"api:{warning}" for warning in api_warnings])
    result = {
        "repository": str(local_repo),
        "settings_file": str(settings_path),
        "verification_method": verification_method,
        "expected_status_checks": expected_checks,
        "file_state_errors": file_errors,
        "warnings": warnings,
        "api_state": api_state,
        "api_errors": api_errors,
        "api_warnings": api_warnings,
        "api_required": require_api,
        "api_requested": api or require_api,
        "passed": not file_errors,
    }
    return result, file_errors
