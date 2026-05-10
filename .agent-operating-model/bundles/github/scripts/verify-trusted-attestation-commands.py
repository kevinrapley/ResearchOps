#!/usr/bin/env python3
import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

def run_command(command, timeout):
    started = time.time()
    completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
    return {
        "command": command,
        "returncode": completed.returncode,
        "duration_seconds": round(time.time() - started, 3),
        "stdout_tail": completed.stdout[-2000:],
        "stderr_tail": completed.stderr[-2000:],
        "passed": completed.returncode == 0,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", required=True)
    parser.add_argument("--repo", required=True, help="GitHub repository in owner/name form.")
    parser.add_argument("--sigstore-bundle", required=True)
    parser.add_argument("--cosign-certificate-identity")
    parser.add_argument("--cosign-certificate-oidc-issuer")
    parser.add_argument("--timeout", type=int, default=60)
    parser.add_argument("--allow-tool-unavailable", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--output", default="trusted-attestation-command-report.json")
    args = parser.parse_args()

    checks = []
    errors = []
    gh_command = ["gh", "attestation", "verify", args.artifact, "--repo", args.repo]
    cosign_command = ["cosign", "verify-blob", args.artifact, "--bundle", args.sigstore_bundle]
    if args.cosign_certificate_identity:
        cosign_command.extend(["--certificate-identity", args.cosign_certificate_identity])
    if args.cosign_certificate_oidc_issuer:
        cosign_command.extend(["--certificate-oidc-issuer", args.cosign_certificate_oidc_issuer])

    for command in [gh_command, cosign_command]:
        tool = command[0]
        if args.dry_run:
            checks.append({
                "command": command,
                "returncode": 0,
                "duration_seconds": 0,
                "stdout_tail": "dry-run",
                "stderr_tail": "",
                "passed": True,
                "dry_run": True,
            })
            continue
        if shutil.which(tool) is None:
            message = f"Required attestation verification tool is unavailable: {tool}"
            result = {
                "command": command,
                "returncode": None,
                "duration_seconds": 0,
                "stdout_tail": "",
                "stderr_tail": message,
                "passed": False,
                "tool_unavailable": True,
            }
            checks.append(result)
            if not args.allow_tool_unavailable:
                errors.append(message)
            continue
        result = run_command(command, args.timeout)
        checks.append(result)
        if not result["passed"]:
            errors.append(f"Command failed: {' '.join(command)}")

    report = {
        "type": "trusted-attestation-command-report",
        "artifact": args.artifact,
        "repo": args.repo,
        "sigstore_bundle": args.sigstore_bundle,
        "checks": checks,
        "passed": not errors,
        "errors": errors,
        "created_at_unix": int(time.time()),
    }
    Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
