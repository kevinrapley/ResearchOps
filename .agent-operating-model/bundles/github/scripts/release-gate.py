#!/usr/bin/env python3
from pathlib import Path
import argparse
import contextlib
import io
import json
import os
import runpy
import shutil
import signal
import sys
import tempfile
import time
import traceback

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("RELEASE_GATE_TIMEOUT_SECONDS", "45"))

class ReleaseGateFailure(Exception):
    def __init__(self, message, command=None, error_type="CommandFailed", returncode=None):
        super().__init__(message)
        self.command = command
        self.error_type = error_type
        self.returncode = returncode

class TimeoutFailure(ReleaseGateFailure):
    pass

def remove_generated_artifacts():
    for path in list(ROOT.rglob("__pycache__")):
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
    for path in list(ROOT.rglob("*.pyc")) + list(ROOT.rglob("*.pyo")):
        path.unlink(missing_ok=True)

@contextlib.contextmanager
def optional_alarm(seconds):
    if not hasattr(signal, "SIGALRM") or seconds is None:
        yield
        return

    def handler(signum, frame):
        raise TimeoutFailure(f"Timed out after {seconds}s", error_type="Timeout")

    old = signal.signal(signal.SIGALRM, handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)

def initialise_report(mode):
    return {
        "gate": "offline-bundle-release",
        "mode": mode,
        "status": "running",
        "started_at_unix": int(time.time()),
        "duration_seconds": 0.0,
        "commands": [],
        "failed_command": None,
        "error": None,
    }

def command_entry(args, started):
    return {
        "command": list(args),
        "status": "unknown",
        "duration_seconds": 0.0,
        "stdout_tail": "",
        "stderr_tail": "",
        "returncode": None,
        "error": None,
        "started_at_unix": int(started),
    }

def write_report(report, path):
    Path(path).write_text(json.dumps(report, indent=2), encoding="utf-8")

def validate_report_file(path):
    old_argv = sys.argv[:]
    old_cwd = Path.cwd()
    sys.argv = ["scripts/validate-release-gate-report.py", str(path)]
    os.chdir(ROOT)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(ROOT / "scripts/validate-release-gate-report.py"), run_name="__main__")
    finally:
        sys.argv = old_argv
        os.chdir(old_cwd)

def run(args, report, timeout=DEFAULT_TIMEOUT_SECONDS):
    started = time.time()
    entry = command_entry(args, started)
    report["commands"].append(entry)
    print("$ " + " ".join(args), flush=True)

    old_argv = sys.argv[:]
    old_cwd = Path.cwd()
    sys.argv = args
    os.chdir(ROOT)
    stdout_text = ""
    try:
        with optional_alarm(timeout):
            with contextlib.redirect_stdout(io.StringIO()) as stdout:
                runpy.run_path(str(ROOT / args[0]), run_name="__main__")
        stdout_text = stdout.getvalue()
        if stdout_text.strip():
            print(stdout_text.strip(), flush=True)
        entry["status"] = "passed"
        entry["returncode"] = 0
        entry["stdout_tail"] = stdout_text[-2000:]
        return stdout_text
    except SystemExit as exc:
        stdout_text = stdout.getvalue() if "stdout" in locals() else ""
        if stdout_text.strip():
            print(stdout_text.strip(), flush=True)
        code = 0 if exc.code in (None, 0) else int(exc.code) if isinstance(exc.code, int) else 1
        entry["stdout_tail"] = stdout_text[-2000:]
        entry["returncode"] = code
        if code == 0:
            entry["status"] = "passed"
            return stdout_text
        entry["status"] = "failed"
        entry["error"] = {"type": "SystemExit", "message": f"exit code {code}", "returncode": code}
        raise ReleaseGateFailure(f"Command failed with exit code {code}: {' '.join(args)}", command=list(args), returncode=code) from exc
    except TimeoutFailure as exc:
        stdout_text = stdout.getvalue() if "stdout" in locals() else ""
        if stdout_text.strip():
            print(stdout_text.strip(), flush=True)
        entry["status"] = "timeout"
        entry["stdout_tail"] = stdout_text[-2000:]
        entry["error"] = {"type": "Timeout", "message": str(exc), "returncode": None}
        raise ReleaseGateFailure(f"Timed out after {timeout}s: {' '.join(args)}", command=list(args), error_type="Timeout") from exc
    except Exception as exc:
        stdout_text = stdout.getvalue() if "stdout" in locals() else ""
        if stdout_text.strip():
            print(stdout_text.strip(), flush=True)
        entry["status"] = "failed"
        entry["stdout_tail"] = stdout_text[-2000:]
        entry["error"] = {
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback_tail": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[-2000:],
        }
        raise ReleaseGateFailure(f"Command failed: {' '.join(args)}: {exc}", command=list(args), error_type=type(exc).__name__) from exc
    finally:
        entry["duration_seconds"] = round(time.time() - started, 3)
        sys.argv = old_argv
        os.chdir(old_cwd)
        remove_generated_artifacts()

def add_common_checks(report, positive, evidence, timeout):
    run(["scripts/validate-bundle.py"], report, timeout)
    run(["scripts/validate-bundle.py", "--strict"], report, timeout)
    run(["scripts/validate-evals.py"], report, timeout)
    run(["scripts/validate-template-registry.py"], report, timeout)
    run(["scripts/validate-changelog.py"], report, timeout)
    run(["scripts/validate-docs-consistency.py"], report, timeout)
    run(["scripts/validate-agent-evidence.py", "examples/agent-evidence.example.yaml"], report, timeout)
    run(["scripts/validate-agent-evidence.py", evidence], report, timeout)

    selection_yaml = run(["scripts/select-ci-templates.py", "--repo", positive], report, timeout)
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as tmp:
        tmp.write(selection_yaml)
        selection_path = tmp.name
    run(["scripts/validate-selected-template-set.py", "--selection", selection_path, "--skip-required-non-workflow"], report, timeout)

    run(["scripts/verify-repository-state.py", "--repo", positive, "--github-api", "--allow-api-unavailable"], report, timeout)
    run(["scripts/verify-github-settings.py", "--repo", positive, "--api", "--allow-api-unavailable"], report, timeout)
    run(["scripts/verify-evidence-against-repo.py", "--repo", positive, "--evidence", evidence], report, timeout)
    run(["scripts/run-eval-harness.py", "--eval-id", "instantiate-multi-language-repo", "--output-dir", positive, "--evidence", evidence, "--run-tests", "--github-api", "--allow-api-unavailable"], report, timeout)

    run(["scripts/validate-accessibility-evidence.py", "examples/fixtures/accessibility-evidence-structured.yaml", "--root", "."], report, timeout)
    run(["scripts/validate-accessibility-fixtures.py"], report, timeout)
    run(["scripts/validate-workflow-hardening.py", "templates/github/.github/workflows", "--mode", "standard"], report, timeout)
    run(["scripts/validate-workflow-hardening.py", "templates/github/.github/workflows-hardened", "--mode", "hardened", "--template-mode"], report, timeout)
    run(["scripts/validate-workflow-action-lock.py", "--lock-file", "templates/github/workflow-action-lock.example.yaml"], report, timeout)
    run(["scripts/validate-workflow-hardening.py", "examples/fixtures/workflows-release-mode-pass/.github/workflows", "--mode", "hardened", "--release-mode", "--lock-file", "examples/fixtures/workflows-release-mode-pass/workflow-action-lock.yaml"], report, timeout)
    run(["scripts/validate-live-release-policy.py"], report, timeout)
    run(["scripts/validate-github-api-fixtures.py"], report, timeout)
    run(["scripts/validate-trusted-attestation-verification.py", "examples/fixtures/trusted-attestation-verification-pass.json"], report, timeout)
    run(["scripts/validate-live-gate-fixtures.py"], report, timeout)
    run(["scripts/validate-release-gate-report.py", "examples/fixtures/release-gate-report-pass.json"], report, timeout)
    run(["scripts/validate-release-gate-report.py", "examples/fixtures/release-gate-report-fail.json"], report, timeout)
    run(["scripts/validate-release-gate-termination.py"], report, timeout)

def add_performance_checks(report, timeout, full=False):
    run(["scripts/check-performance-budget.py", "--budget", "templates/repository/performance-budget-template.yaml", "--results", "examples/performance-results/node-results.yaml", "--mode", "blocking"], report, timeout)
    run(["scripts/validate-performance-results.py", "--budget", "templates/repository/performance-budget-template.yaml", "--results", "examples/performance-results/node-results.yaml"], report, timeout)
    if not full:
        return
    adapter_inputs = [
        ("pytest-benchmark", "examples/performance-inputs/pytest-benchmark.json", "templates/repository/performance-budget-pytest-benchmark.yaml"),
        ("go-bench", "examples/performance-inputs/go-bench.txt", "templates/repository/performance-budget-go-bench.yaml"),
        ("lighthouse", "examples/performance-inputs/lighthouse.json", "templates/repository/performance-budget-lighthouse.yaml"),
        ("k6", "examples/performance-inputs/k6-summary.json", "templates/repository/performance-budget-k6.yaml"),
        ("autocannon", "examples/performance-inputs/autocannon.json", "templates/repository/performance-budget-autocannon.yaml"),
        ("jmeter", "examples/performance-inputs/jmeter.jtl", "templates/repository/performance-budget-jmeter.yaml"),
        ("gatling", "examples/performance-inputs/gatling.json", "templates/repository/performance-budget-gatling.yaml"),
        ("artillery", "examples/performance-inputs/artillery.json", "templates/repository/performance-budget-artillery.yaml"),
    ]
    for adapter, input_path, budget_path in adapter_inputs:
        with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as tmp:
            adapter_output = tmp.name
        run(["scripts/performance-adapters.py", "--type", adapter, "--input", input_path, "--output", adapter_output, "--profile", "templates/repository/performance-metric-profiles.yaml"], report, timeout)
        run(["scripts/validate-performance-results.py", "--budget", budget_path, "--results", adapter_output], report, timeout)
        run(["scripts/check-performance-budget.py", "--budget", budget_path, "--results", adapter_output, "--mode", "advisory"], report, timeout)

def add_sbom_checks(report, timeout, full=False):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        positive_sbom_path = tmp.name
    run(["scripts/generate-sbom.py", "--root", "examples/eval-outputs/instantiate-multi-language-repo-pass", "--output", positive_sbom_path], report, timeout)
    run(["scripts/validate-sbom.py", "--path", positive_sbom_path, "--min-components", "0", "--require-tool-metadata"], report, timeout)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        non_empty_sbom_path = tmp.name
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        attestation_path = tmp.name
    run(["scripts/generate-sbom.py", "--root", "examples/fixtures/sbom-non-empty", "--output", non_empty_sbom_path], report, timeout)
    run(["scripts/validate-sbom.py", "--path", non_empty_sbom_path, "--min-components", "1", "--require-dependencies", "--require-licences", "--require-purls", "--require-tool-metadata"], report, timeout)
    run(["scripts/generate-sbom-attestation.py", "--sbom", non_empty_sbom_path, "--subject", "examples/fixtures/sbom-non-empty", "--output", attestation_path, "--attestation-mode", "offline-test", "--dsse", "--slsa", "--github-artifact-attestation", "--sigstore"], report, timeout)
    run(["scripts/validate-sbom-attestation.py", "--attestation", attestation_path, "--sbom", non_empty_sbom_path, "--min-subject-files", "1", "--require-dsse", "--require-slsa", "--require-github-artifact-attestation", "--require-sigstore"], report, timeout)

def offline_bundle_release_gate(mode, timeout, inject_failure=False, report=None):
    positive = "examples/eval-outputs/instantiate-multi-language-repo-pass"
    evidence = f"{positive}/agent-evidence.yaml"
    report = report or initialise_report(mode)
    started = time.time()
    try:
        add_common_checks(report, positive, evidence, timeout)
        add_performance_checks(report, timeout, full=(mode == "full"))
        add_sbom_checks(report, timeout, full=(mode == "full"))
        if inject_failure:
            run(["scripts/fail-intentionally.py"], report, timeout)
        report["status"] = "passed"
    except ReleaseGateFailure as exc:
        report["status"] = "failed"
        report["failed_command"] = exc.command
        report["error"] = {"type": exc.error_type, "message": str(exc), "returncode": exc.returncode}
        raise
    finally:
        report["duration_seconds"] = round(time.time() - started, 3)
        remove_generated_artifacts()
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["fast", "full"], default="fast")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--report", default="release-gate-report.json")
    parser.add_argument("--inject-failure", action="store_true")
    args = parser.parse_args()

    old_cwd = Path.cwd()
    os.chdir(ROOT)
    remove_generated_artifacts()
    report = initialise_report(args.mode)
    try:
        try:
            report = offline_bundle_release_gate(args.mode, args.timeout, inject_failure=args.inject_failure, report=report)
        except ReleaseGateFailure as exc:
            write_report(report, ROOT / args.report)
            validate_report_file(ROOT / args.report)
            print(f"Release gate failed: {exc}", flush=True)
            raise SystemExit(1)
        write_report(report, ROOT / args.report)
        validate_report_file(ROOT / args.report)
    finally:
        remove_generated_artifacts()
        os.chdir(old_cwd)

    print(f"Release gate passed. Report written to {args.report}", flush=True)

if __name__ == "__main__":
    main()
