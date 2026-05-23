# Agent audit trace — GitHub eval execution trust

Date: 2026-05-23

Branch: `fix/github-eval-execution-trust-v2`

Trace type: operational audit

Status: ready for PR review

## Evidence boundary

This trace records observable repository work to make GitHub Diamond eval execution trustworthy.

It does not include private chain-of-thought.

## Scope

This second remediation branch covers eval execution trustworthiness only:

- `github-diamond-bundle`
- `eval-harness`
- `test-command-execution`
- `observed-evidence`
- `release-gate-regression`

It does not attempt the third remediation work around stricter output schemas, broader scenario-reference validation, safe-audit-trail schema design or evidence-state modelling.

## Problem summary

The eval harness previously passed each test command entry directly to `subprocess.run`.

That was unsafe because `test-commands.yaml` may contain structured command objects. In that case the harness could pass the whole object to the shell rather than executing the object’s `command` value.

This created a false-pass risk where evals appeared to run validation while not executing the intended command.

## Work completed

Updated `scripts/run-eval-harness.py` so command execution now goes through explicit normalisation.

The harness now accepts two command forms:

- legacy string commands
- structured command objects with a required non-empty string `command` field

Structured command objects now fail closed if malformed.

The harness now records observed execution evidence:

- command ID
- command string
- purpose
- working directory
- timeout
- start and finish timestamps
- duration
- return code
- stdout
- stderr
- stdout tail
- stderr tail
- expectation result
- expectation failure details

The harness now validates expected command outcomes:

- `expected_status`
- `expected_returncode`
- `expected_stdout`
- `expected_stderr`
- `expected_stdout_contains`
- `expected_stderr_contains`

Updated `examples/eval-outputs/instantiate-multi-language-repo-pass/test-commands.yaml` so every command is executable in the release-gate environment.

Replaced the descriptive Python command with:

```bash
python -I -m unittest discover -s tests -p 'test_*.py'
```

Added a deterministic Python unittest fixture at:

`examples/eval-outputs/instantiate-multi-language-repo-pass/tests/test_python_fixture.py`

Updated `agent-evidence.yaml` so command evidence, test results and file references match the executable command set.

Added `scripts/validate-eval-harness-execution.py` as a regression validator.

The validator proves that:

- structured command objects execute their `command` field
- stdout expectation mismatches fail the eval
- malformed command objects fail closed

Wired the new validator into `scripts/release-gate.py` before the normal eval harness invocation.

## Files changed

- `.agent-operating-model/bundles/github/scripts/run-eval-harness.py`
- `.agent-operating-model/bundles/github/scripts/validate-eval-harness-execution.py`
- `.agent-operating-model/bundles/github/scripts/release-gate.py`
- `.agent-operating-model/bundles/github/examples/eval-outputs/instantiate-multi-language-repo-pass/test-commands.yaml`
- `.agent-operating-model/bundles/github/examples/eval-outputs/instantiate-multi-language-repo-pass/tests/test_python_fixture.py`
- `.agent-operating-model/bundles/github/examples/eval-outputs/instantiate-multi-language-repo-pass/agent-evidence.yaml`

## Compatibility notes

Legacy string commands remain supported.

Structured command objects are now supported explicitly and safely.

`test-commands.yaml` no longer contains descriptive non-executable command placeholders.

The Python fixture uses the standard library `unittest` module rather than requiring `pytest` to be installed in the release-gate environment.

## Validation status

No local release gate was run in this connector-only environment.

Recommended checks:

```bash
cd .agent-operating-model/bundles/github
python scripts/validate-eval-harness-execution.py
python scripts/run-eval-harness.py --eval-id instantiate-multi-language-repo --output-dir examples/eval-outputs/instantiate-multi-language-repo-pass --evidence examples/eval-outputs/instantiate-multi-language-repo-pass/agent-evidence.yaml --run-tests --github-api --allow-api-unavailable --format json
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode fast --report fast-release-gate-report.json
```

## Risks and mitigations

Risk: making the harness execute real commands may expose previously hidden fixture weaknesses.

Mitigation: the positive eval fixture commands were converted to deterministic executable commands that do not require third-party dependencies.

Risk: registry manifest checksums may be stale after script and fixture edits.

Mitigation: the existing GitHub bundle registry-manifest workflow should regenerate `registry-manifest.yaml` on the pull request branch.
