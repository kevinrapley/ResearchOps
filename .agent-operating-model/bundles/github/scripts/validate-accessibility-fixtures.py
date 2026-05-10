#!/usr/bin/env python3
from pathlib import Path
import runpy
import sys
import io
import contextlib
import os

ROOT = Path(__file__).resolve().parents[1]

def run_validator(args):
    old_argv = sys.argv[:]
    old_cwd = Path.cwd()
    sys.argv = ["scripts/validate-accessibility-evidence.py"] + args
    os.chdir(ROOT)
    try:
        with contextlib.redirect_stdout(io.StringIO()) as out:
            runpy.run_path(str(ROOT / "scripts/validate-accessibility-evidence.py"), run_name="__main__")
        return 0, out.getvalue()
    except SystemExit as exc:
        code = 0 if exc.code in (None, 0) else int(exc.code) if isinstance(exc.code, int) else 1
        return code, out.getvalue() if "out" in locals() else str(exc)
    finally:
        sys.argv = old_argv
        os.chdir(old_cwd)

def expect_pass(args):
    code, output = run_validator(args)
    if code != 0:
        raise AssertionError(f"Expected pass for {args}, got {code}: {output}")

def expect_fail(args):
    code, output = run_validator(args)
    if code == 0:
        raise AssertionError(f"Expected fail for {args}, got pass")

def main():
    expect_pass(["examples/fixtures/accessibility-paths/root-relative/evidence/accessibility-evidence.yaml", "--root", "examples/fixtures/accessibility-paths/root-relative"])
    expect_pass(["examples/fixtures/accessibility-paths/evidence-relative/evidence/evidence.yaml", "--root", "examples/fixtures/accessibility-paths/evidence-relative/empty-root"])
    expect_fail(["examples/fixtures/accessibility-negative/open-critical.yaml", "--root", "examples/fixtures/accessibility-negative"])
    expect_fail(["examples/fixtures/accessibility-negative/lighthouse-low.yaml", "--root", "examples/fixtures/accessibility-negative"])
    expect_fail(["examples/fixtures/accessibility-negative/axe-violations.yaml", "--root", "examples/fixtures/accessibility-negative"])
    expect_fail(["examples/fixtures/accessibility-negative/pa11y-issues.yaml", "--root", "examples/fixtures/accessibility-negative"])
    print("Accessibility fixture validation passed.")

if __name__ == "__main__":
    main()
