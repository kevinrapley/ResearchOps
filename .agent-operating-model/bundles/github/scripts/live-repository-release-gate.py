#!/usr/bin/env python3
from pathlib import Path
import argparse
import json
import os
import subprocess
import sys
import time
import yaml

ROOT = Path(__file__).resolve().parents[1]

def load_policy(path):
    policy_path = Path(path)
    if not policy_path.is_absolute():
        policy_path = ROOT / policy_path
    return yaml.safe_load(policy_path.read_text(encoding="utf-8"))

def controls_for(policy, profile):
    profiles = policy.get("profiles") or {}
    if profile not in profiles:
        raise SystemExit(f"Unknown live release profile: {profile}")
    return (profiles[profile].get("required_controls") or {})

def run(args, timeout, report):
    started = time.time()
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(
        [sys.executable] + args,
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    item = {
        "command": args,
        "returncode": completed.returncode,
        "status": "passed" if completed.returncode == 0 else "failed",
        "duration_seconds": round(time.time() - started, 3),
        "stdout_tail": completed.stdout[-2000:],
        "stderr_tail": completed.stderr[-2000:],
    }
    report["commands"].append(item)
    if completed.stdout.strip():
        print(completed.stdout.strip())
    if completed.stderr.strip():
        print(completed.stderr.strip())
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)

def require_arg(value, name, profile):
    if not value:
        raise SystemExit(f"--{name} is required for live repository profile: {profile}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo-name", required=True)
    parser.add_argument("--profile", default="standard")
    parser.add_argument("--policy", default="templates/repository/live-release-policy.yaml")
    parser.add_argument("--evidence")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--workflow-lock", default="workflow-action-lock.yaml")
    parser.add_argument("--trusted-attestation")
    parser.add_argument("--trusted-attestation-verification")
    parser.add_argument("--sbom")
    parser.add_argument("--accessibility-evidence")
    parser.add_argument("--accessibility-root")
    parser.add_argument("--performance-budget")
    parser.add_argument("--performance-results")
    parser.add_argument("--artifact")
    parser.add_argument("--repo-full-name")
    parser.add_argument("--sigstore-bundle")
    parser.add_argument("--cosign-certificate-identity")
    parser.add_argument("--cosign-certificate-oidc-issuer")
    parser.add_argument("--report", default="live-release-gate-report.json")
    args = parser.parse_args()

    policy = load_policy(args.policy)
    controls = controls_for(policy, args.profile)
    repo = Path(args.repo)
    report = {
        "gate": "live-repository-release",
        "profile": args.profile,
        "policy": args.policy,
        "repository": str(repo),
        "owner": args.owner,
        "repo_name": args.repo_name,
        "status": "running",
        "started_at_unix": int(time.time()),
        "commands": [],
    }
    started = time.time()

    if controls.get("workflow_lock"):
        require_arg(args.workflow_lock, "workflow-lock", args.profile)
        if not (repo / args.workflow_lock).exists():
            raise SystemExit(f"Workflow lock file is required for {args.profile}: {repo / args.workflow_lock}")

    if controls.get("trusted_sbom_attestation"):
        require_arg(args.trusted_attestation, "trusted-attestation", args.profile)
        require_arg(args.sbom, "sbom", args.profile)

    if controls.get("external_attestation_verification"):
        require_arg(args.trusted_attestation_verification, "trusted-attestation-verification", args.profile)
        require_arg(args.artifact, "artifact", args.profile)
        require_arg(args.repo_full_name, "repo-full-name", args.profile)
        require_arg(args.sigstore_bundle, "sigstore-bundle", args.profile)

    if controls.get("accessibility_evidence"):
        require_arg(args.accessibility_evidence, "accessibility-evidence", args.profile)

    if controls.get("performance_evidence"):
        require_arg(args.performance_budget, "performance-budget", args.profile)
        require_arg(args.performance_results, "performance-results", args.profile)

    if controls.get("evidence_to_repository_cross_check"):
        require_arg(args.evidence, "evidence", args.profile)

    try:
        if controls.get("github_api", True):
            run(["scripts/verify-github-settings.py", "--repo", str(repo), "--api", "--require-api", "--owner", args.owner, "--repo-name", args.repo_name], args.timeout, report)
            run(["scripts/verify-repository-state.py", "--repo", str(repo), "--github-api", "--require-github-api", "--github-owner", args.owner, "--github-repo", args.repo_name], args.timeout, report)

        if args.evidence:
            run(["scripts/verify-evidence-against-repo.py", "--repo", str(repo), "--evidence", args.evidence], args.timeout, report)

        lock_file = repo / args.workflow_lock
        if lock_file.exists():
            run(["scripts/validate-workflow-action-lock.py", "--lock-file", str(lock_file), "--release-mode"], args.timeout, report)
            workflow_dir = repo / ".github" / "workflows"
            if workflow_dir.exists() and controls.get("hardened_workflows"):
                run(["scripts/validate-workflow-hardening.py", str(workflow_dir), "--mode", "hardened", "--release-mode", "--lock-file", str(lock_file)], args.timeout, report)

        if args.trusted_attestation and args.sbom:
            run(["scripts/validate-sbom-attestation.py", "--attestation", args.trusted_attestation, "--sbom", args.sbom, "--require-dsse", "--require-slsa", "--require-github-artifact-attestation", "--require-sigstore", "--trusted-mode"], args.timeout, report)

        if args.trusted_attestation_verification:
            run(["scripts/validate-trusted-attestation-verification.py", args.trusted_attestation_verification], args.timeout, report)

        if args.artifact and args.repo_full_name and args.sigstore_bundle:
            command = [
                "scripts/verify-trusted-attestation-commands.py",
                "--artifact", args.artifact,
                "--repo", args.repo_full_name,
                "--sigstore-bundle", args.sigstore_bundle,
            ]
            if args.cosign_certificate_identity:
                command.extend(["--cosign-certificate-identity", args.cosign_certificate_identity])
            if args.cosign_certificate_oidc_issuer:
                command.extend(["--cosign-certificate-oidc-issuer", args.cosign_certificate_oidc_issuer])
            run(command, args.timeout, report)

        if args.accessibility_evidence:
            command = ["scripts/validate-accessibility-evidence.py", args.accessibility_evidence, "--root", args.accessibility_root or str(repo)]
            run(command, args.timeout, report)

        if args.performance_budget and args.performance_results:
            run(["scripts/validate-performance-results.py", "--budget", args.performance_budget, "--results", args.performance_results], args.timeout, report)
            run(["scripts/check-performance-budget.py", "--budget", args.performance_budget, "--results", args.performance_results, "--mode", "blocking"], args.timeout, report)

        report["status"] = "passed"
        print("Live repository release gate passed.")
    finally:
        report["duration_seconds"] = round(time.time() - started, 3)
        if report["status"] == "running":
            report["status"] = "failed"
        Path(args.report).write_text(json.dumps(report, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
