#!/usr/bin/env python3
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
import yaml

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "scripts/run-eval-harness.py"
BASE_OUTPUT_FIXTURE = ROOT / "examples/eval-outputs/instantiate-multi-language-repo-pass"


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def run_harness(repo, eval_id="eval-harness-regression", expect_success=True):
    completed = subprocess.run(
        [
            sys.executable,
            str(HARNESS),
            "--eval-id",
            eval_id,
            "--output-dir",
            str(repo),
            "--run-tests",
            "--format",
            "json",
            "--github-api",
            "--allow-api-unavailable",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if expect_success and completed.returncode != 0:
        raise AssertionError(f"Harness failed unexpectedly\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}")
    if not expect_success and completed.returncode == 0:
        raise AssertionError(f"Harness passed unexpectedly\nSTDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}")
    output = completed.stdout.strip()
    return completed, json.loads(output) if output else {}


def create_eval_fixture(tmpdir, commands_yaml, eval_id="eval-harness-regression"):
    fixture = tmpdir / "fixture"
    output = tmpdir / "output"
    fixture.mkdir()
    shutil.copytree(BASE_OUTPUT_FIXTURE, output)
    write(output / "test-commands.yaml", commands_yaml)
    original = ROOT / "evals.yaml"
    backup = original.read_text(encoding="utf-8")
    data = yaml.safe_load(backup)
    data["evals"].append({
        "id": eval_id,
        "description": "Temporary eval harness regression fixture",
        "fixture_repo": str(fixture),
        "expected_files": ["README.md"],
        "expected_changed_paths": [],
        "graders": [],
        "minimum_score": 1.0,
    })
    original.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    return original, backup, output


def restore(path, content):
    path.write_text(content, encoding="utf-8")


def test_structured_command_executes_command_field():
    with tempfile.TemporaryDirectory() as raw_tmp:
        tmpdir = Path(raw_tmp)
        evals_path, backup, output = create_eval_fixture(
            tmpdir,
            textwrap.dedent(
                """
                commands:
                  - id: should-run-command-field
                    command: python -I -S -c "print('structured command executed')"
                    expected_status: passed
                    expected_returncode: 0
                    expected_stdout: structured command executed
                """
            ).strip() + "\n",
        )
        try:
            _completed, result = run_harness(output)
        finally:
            restore(evals_path, backup)

    test_results = result.get("test_results", [])
    assert len(test_results) == 1, test_results
    assert test_results[0]["command"] == "python -I -S -c \"print('structured command executed')\""
    assert test_results[0]["expectation_met"] is True
    assert "structured command executed" in test_results[0]["stdout"]


def test_expected_stdout_mismatch_fails():
    with tempfile.TemporaryDirectory() as raw_tmp:
        tmpdir = Path(raw_tmp)
        evals_path, backup, output = create_eval_fixture(
            tmpdir,
            textwrap.dedent(
                """
                commands:
                  - id: stdout-mismatch
                    command: python -I -S -c "print('actual output')"
                    expected_status: passed
                    expected_stdout: missing output
                """
            ).strip() + "\n",
        )
        try:
            _completed, result = run_harness(output, expect_success=False)
        finally:
            restore(evals_path, backup)

    assert result.get("decision") == "fail"
    assert any("Test expectation failed" in item for item in result.get("blocking_failures", []))
    assert result["test_results"][0]["expectation_met"] is False
    assert result["test_results"][0]["expectation_failures"]


def test_malformed_command_object_fails_closed():
    with tempfile.TemporaryDirectory() as raw_tmp:
        tmpdir = Path(raw_tmp)
        evals_path, backup, output = create_eval_fixture(
            tmpdir,
            textwrap.dedent(
                """
                commands:
                  - id: missing-command-field
                    expected_status: passed
                """
            ).strip() + "\n",
        )
        try:
            _completed, result = run_harness(output, expect_success=False)
        finally:
            restore(evals_path, backup)

    assert result.get("decision") == "fail"
    assert any("must include a non-empty string 'command' field" in item for item in result.get("blocking_failures", []))


def main():
    tests = [
        test_structured_command_executes_command_field,
        test_expected_stdout_mismatch_fails,
        test_malformed_command_object_fails_closed,
    ]
    for test in tests:
        test()
    print("Eval harness execution validation passed.")


if __name__ == "__main__":
    main()
