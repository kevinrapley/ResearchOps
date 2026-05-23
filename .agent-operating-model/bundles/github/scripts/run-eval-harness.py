#!/usr/bin/env python3
from pathlib import Path
import argparse
import contextlib
import filecmp
import io
import json
import os
import runpy
import subprocess
import sys
import time
import yaml

ROOT = Path(__file__).resolve().parents[1]
STDIO_TAIL_LIMIT = 1000


def all_files(path):
    if not path.exists():
        return set()
    return {p.relative_to(path).as_posix() for p in path.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".pyo"}}


def diff_paths(baseline, output):
    base_files = all_files(baseline)
    out_files = all_files(output)
    created = sorted(out_files - base_files)
    deleted = sorted(base_files - out_files)
    modified = []
    for rel in sorted(base_files & out_files):
        try:
            if not filecmp.cmp(baseline / rel, output / rel, shallow=False):
                modified.append(rel)
        except OSError:
            modified.append(rel)
    return created, modified, deleted


def path_satisfied(prefix, created, modified, output):
    prefix = prefix.rstrip("/")
    if any(f == prefix or f.startswith(prefix + "/") for f in created + modified):
        return True
    return (output / prefix).exists()


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


def load_test_commands(repo):
    path = Path(repo) / "test-commands.yaml"
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    commands = data.get("commands", [])
    if not isinstance(commands, list):
        raise ValueError("test-commands.yaml field 'commands' must be a list")
    return commands


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalise_command(raw, index):
    if isinstance(raw, str):
        command = raw.strip()
        if not command:
            raise ValueError(f"test command #{index + 1} is empty")
        return {
            "id": f"command-{index + 1}",
            "command": command,
            "purpose": None,
            "expected_status": "passed",
            "expected_returncode": 0,
            "expected_stdout": None,
            "expected_stderr": None,
            "expected_stdout_contains": [],
            "expected_stderr_contains": [],
        }

    if not isinstance(raw, dict):
        raise ValueError(f"test command #{index + 1} must be a string or object")

    command = raw.get("command")
    if not isinstance(command, str) or not command.strip():
        raise ValueError(f"test command #{index + 1} object must include a non-empty string 'command' field")

    expected_status = str(raw.get("expected_status", "passed")).lower()
    if expected_status not in {"passed", "failed"}:
        raise ValueError(f"test command #{index + 1} expected_status must be 'passed' or 'failed'")

    expected_returncode = raw.get("expected_returncode")
    if expected_returncode is not None and not isinstance(expected_returncode, int):
        raise ValueError(f"test command #{index + 1} expected_returncode must be an integer when provided")
    if expected_returncode is None and expected_status == "passed":
        expected_returncode = 0

    return {
        "id": str(raw.get("id") or f"command-{index + 1}"),
        "command": command.strip(),
        "purpose": raw.get("purpose"),
        "expected_status": expected_status,
        "expected_returncode": expected_returncode,
        "expected_stdout": raw.get("expected_stdout"),
        "expected_stderr": raw.get("expected_stderr"),
        "expected_stdout_contains": as_list(raw.get("expected_stdout_contains")),
        "expected_stderr_contains": as_list(raw.get("expected_stderr_contains")),
    }


def expectation_failures(spec, returncode, stdout, stderr, timed_out=False):
    failures = []
    if timed_out:
        failures.append("command timed out")
        return failures

    observed_status = "passed" if returncode == 0 else "failed"
    expected_status = spec["expected_status"]
    expected_returncode = spec["expected_returncode"]

    if expected_returncode is not None:
        if returncode != expected_returncode:
            failures.append(f"expected return code {expected_returncode}, observed {returncode}")
    elif expected_status == "failed" and returncode == 0:
        failures.append("expected command to fail, observed return code 0")
    elif expected_status == "passed" and returncode != 0:
        failures.append(f"expected command to pass, observed return code {returncode}")

    if observed_status != expected_status and expected_returncode is None:
        failures.append(f"expected status {expected_status}, observed {observed_status}")

    if spec["expected_stdout"] is not None and str(spec["expected_stdout"]) not in stdout:
        failures.append(f"expected stdout to contain: {spec['expected_stdout']}")
    if spec["expected_stderr"] is not None and str(spec["expected_stderr"]) not in stderr:
        failures.append(f"expected stderr to contain: {spec['expected_stderr']}")
    for item in spec["expected_stdout_contains"]:
        if str(item) not in stdout:
            failures.append(f"expected stdout to contain: {item}")
    for item in spec["expected_stderr_contains"]:
        if str(item) not in stderr:
            failures.append(f"expected stderr to contain: {item}")

    return failures


def run_one_test(repo, raw_command, index, timeout):
    spec = normalise_command(raw_command, index)
    started = time.time()
    result = {
        "id": spec["id"],
        "command": spec["command"],
        "purpose": spec["purpose"],
        "cwd": str(Path(repo)),
        "timeout_seconds": timeout,
        "started_at_unix": int(started),
        "duration_seconds": 0.0,
        "expected_status": spec["expected_status"],
        "expected_returncode": spec["expected_returncode"],
        "expected_stdout": spec["expected_stdout"],
        "expected_stderr": spec["expected_stderr"],
        "status": "unknown",
        "returncode": None,
        "stdout": "",
        "stderr": "",
        "stdout_tail": "",
        "stderr_tail": "",
        "expectation_met": False,
        "expectation_failures": [],
    }

    try:
        completed = subprocess.run(spec["command"], cwd=repo, shell=True, capture_output=True, text=True, timeout=timeout)
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
        failures = expectation_failures(spec, completed.returncode, stdout, stderr)
        result.update({
            "status": "passed" if completed.returncode == 0 else "failed",
            "returncode": completed.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "stdout_tail": stdout[-STDIO_TAIL_LIMIT:],
            "stderr_tail": stderr[-STDIO_TAIL_LIMIT:],
            "expectation_met": not failures,
            "expectation_failures": failures,
        })
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode(errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode(errors="replace")
        result.update({
            "status": "timeout",
            "returncode": None,
            "stdout": stdout,
            "stderr": stderr,
            "stdout_tail": stdout[-STDIO_TAIL_LIMIT:],
            "stderr_tail": stderr[-STDIO_TAIL_LIMIT:],
            "expectation_met": False,
            "expectation_failures": expectation_failures(spec, None, stdout, stderr, timed_out=True),
        })
    finally:
        result["duration_seconds"] = round(time.time() - started, 3)
        result["finished_at_unix"] = int(time.time())

    return result


def run_tests(repo, timeout):
    results = []
    for index, raw_command in enumerate(load_test_commands(repo)):
        results.append(run_one_test(repo, raw_command, index, timeout))
    return results


def add_github_api_args(base, args):
    if args.github_api:
        base.append("--api" if base[0].endswith("verify-github-settings.py") else "--github-api")
    if args.require_github_api:
        base.append("--require-api" if base[0].endswith("verify-github-settings.py") else "--require-github-api")
    if args.github_owner:
        base += ["--owner" if base[0].endswith("verify-github-settings.py") else "--github-owner", args.github_owner]
    if args.github_repo:
        base += ["--repo-name" if base[0].endswith("verify-github-settings.py") else "--github-repo", args.github_repo]
    if args.allow_api_unavailable:
        base.append("--allow-api-unavailable")
    return base


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--evidence")
    parser.add_argument("--format", choices=["yaml", "json"], default="yaml")
    parser.add_argument("--risk-level", default="standard")
    parser.add_argument("--public-service", action="store_true")
    parser.add_argument("--web", action="store_true")
    parser.add_argument("--performance-sensitive", action="store_true")
    parser.add_argument("--run-tests", action="store_true")
    parser.add_argument("--test-timeout", type=int, default=30)
    parser.add_argument("--github-api", action="store_true")
    parser.add_argument("--require-github-api", action="store_true")
    parser.add_argument("--github-owner")
    parser.add_argument("--github-repo")
    parser.add_argument("--allow-api-unavailable", action="store_true")
    args = parser.parse_args()

    evals = yaml.safe_load((ROOT / "evals.yaml").read_text(encoding="utf-8"))["evals"]
    target = next((item for item in evals if item["id"] == args.eval_id), None)
    if not target:
        raise SystemExit(f"Unknown eval id: {args.eval_id}")

    baseline = ROOT / target["fixture_repo"]
    output = Path(args.output_dir)
    blocking = []
    evidence = [f"Baseline fixture: {target['fixture_repo']}"]
    created, modified, deleted = diff_paths(baseline, output)

    missing_expected = [path for path in target.get("expected_files", []) if not (output / path).exists()]
    if missing_expected:
        blocking.append("Missing expected files: " + ", ".join(missing_expected))

    for prefix in target.get("expected_changed_paths", []):
        if not path_satisfied(prefix, created, modified, output):
            blocking.append(f"Expected changed path not satisfied: {prefix}")

    verify_args = ["scripts/verify-repository-state.py", "--repo", str(output), "--baseline", str(baseline), "--risk-level", args.risk_level, "--output", "yaml"]
    if args.public_service:
        verify_args.append("--public-service")
    if args.web:
        verify_args.append("--web")
    if args.performance_sensitive:
        verify_args.append("--performance-sensitive")
    verify_args = add_github_api_args(verify_args, args)
    code, stdout, stderr = run_script(verify_args)
    repository_state = yaml.safe_load(stdout) if stdout.strip() else {}
    if code:
        blocking.append("Direct repository state verification failed: " + (stderr or stdout).strip())
    else:
        evidence.append("Direct repository state verification passed")

    github_args = add_github_api_args(["scripts/verify-github-settings.py", "--repo", str(output), "--output", "yaml"], args)
    code, stdout, stderr = run_script(github_args)
    github_settings = yaml.safe_load(stdout) if stdout.strip() else {}
    if code:
        blocking.append("GitHub settings verification failed: " + (stderr or stdout).strip())
    else:
        evidence.append("GitHub settings verification passed")

    test_results = []
    if args.run_tests:
        try:
            test_results = run_tests(output, args.test_timeout)
            if not test_results:
                blocking.append("No test commands found for --run-tests")
            failed_expectations = [item for item in test_results if not item.get("expectation_met")]
            if failed_expectations:
                blocking.append("Test expectation failed: " + ", ".join(item["command"] for item in failed_expectations))
        except Exception as exc:
            blocking.append(f"Test execution failed: {exc}")

    grader_results = []
    evidence_crosscheck = {}
    if args.evidence:
        code, stdout, stderr = run_script(["scripts/validate-agent-evidence.py", args.evidence])
        if code:
            blocking.append("Agent evidence validation failed: " + (stderr or stdout).strip())

        code, stdout, stderr = run_script(["scripts/verify-evidence-against-repo.py", "--repo", str(output), "--evidence", args.evidence])
        evidence_crosscheck = yaml.safe_load(stdout) if stdout.strip() else {}
        if code:
            blocking.append("Evidence cross-check failed: " + (stderr or stdout).strip())

        for grader in target.get("graders", []):
            code, stdout, stderr = run_script(["scripts/grade-output.py", "--grader", grader, "--evidence", args.evidence])
            if code:
                blocking.append(f"Grader {grader} execution failed: {(stderr or stdout).strip()}")
            else:
                result = yaml.safe_load(stdout)
                grader_results.append(result)
                if result.get("decision") == "fail":
                    blocking.append(f"Grader {grader} failed")

    score = sum(item.get("score", 0) for item in grader_results) / len(grader_results) if grader_results else (0.0 if blocking else 1.0)
    if score < target.get("minimum_score", 0):
        blocking.append(f"Score {score:.3f} below minimum {target['minimum_score']}")

    result = {
        "eval_id": args.eval_id,
        "score": round(score, 3),
        "decision": "pass" if not blocking else "fail",
        "blocking_failures": blocking,
        "evidence": evidence,
        "created_files": created,
        "modified_files": modified,
        "deleted_files": deleted,
        "generated_files": sorted(all_files(output)),
        "repository_state": repository_state,
        "github_settings": github_settings,
        "test_results": test_results,
        "evidence_crosscheck": evidence_crosscheck,
        "grader_results": grader_results,
    }
    print(json.dumps(result, indent=2) if args.format == "json" else yaml.safe_dump(result, sort_keys=False))
    if blocking:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
