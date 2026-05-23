#!/usr/bin/env python3
from pathlib import Path
import argparse
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "scripts" / "validate-agent-evidence.py"


def collect_evidence_files(scope):
    paths = []
    for base in scope:
        candidate = ROOT / base
        if candidate.is_file() and candidate.name == "agent-evidence.yaml":
            paths.append(candidate)
        elif candidate.is_dir():
            paths.extend(candidate.rglob("agent-evidence.yaml"))
    return sorted(set(paths))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--scope",
        action="append",
        default=["examples/fixtures", "examples/eval-outputs"],
        help="Bundle-relative file or directory to scan for agent-evidence.yaml. May be provided more than once.",
    )
    args = parser.parse_args()

    evidence_files = collect_evidence_files(args.scope)
    if not evidence_files:
        print("No agent-evidence.yaml files found.")
        raise SystemExit(1)

    failures = []
    for path in evidence_files:
        rel = path.relative_to(ROOT).as_posix()
        result = subprocess.run(
            [sys.executable, str(VALIDATOR), rel],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            failures.append((rel, result.stdout, result.stderr))
            print(f"FAIL {rel}")
            if result.stdout:
                print(result.stdout.rstrip())
            if result.stderr:
                print(result.stderr.rstrip(), file=sys.stderr)
        else:
            print(f"PASS {rel}")

    if failures:
        print(f"Agent evidence fixture validation failed for {len(failures)} file(s).")
        raise SystemExit(1)

    print(f"Agent evidence fixture validation passed for {len(evidence_files)} file(s).")


if __name__ == "__main__":
    main()
