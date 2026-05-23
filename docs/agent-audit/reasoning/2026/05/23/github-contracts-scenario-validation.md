# Agent audit trace — GitHub contracts and scenario validation

Date: 2026-05-23

Branch: `fix/github-contracts-scenario-validation`

Trace type: operational audit

Status: ready for PR review

## Evidence boundary

This trace records observable repository work to tighten GitHub Diamond contracts and scenario validation.

It does not include private chain-of-thought.

## Scope

This third remediation branch covers:

- `output-contract`
- `grade-contract`
- `scenario-reference-validation`
- `safe-audit-trail`
- `evidence-state-model`

It follows the first two remediation PRs:

1. fast release-gate structural blockers
2. eval execution trustworthiness

## Problem summary

The prior bundle evaluation found that `output.schema.json` only required `response`.

It also found that `grade.schema.json` only required `score` and `feedback`.

Those contracts were too permissive for a Diamond-standard control bundle.

Scenario files also referenced modes, roles, references, contracts, graders and selected templates, but there was no dedicated validator to fail on stale or missing references.

The bundle used reasoning-trace language, but the safer governance need is an observable audit trail that excludes private chain-of-thought.

The bundle also implied different evidence states, but had no shared contract vocabulary for claimed, observed, verified, unavailable and waived evidence.

## Work completed

Strengthened `output.schema.json` so final outputs must include:

- `response`
- `mode_selected`
- `repository_classification`
- `evidence_read`
- `branch_decision`
- `mutation_strategy`
- `files_changed`
- `commands_run`
- `validation_results`
- `gaps`
- `waivers`
- `risk_decision`
- `pr_readiness`
- `safe_audit_trail`

Added `contracts/evidence-state.schema.json` with the shared evidence-state vocabulary:

- `claimed`
- `observed`
- `verified`
- `unavailable`
- `waived`

Added `contracts/safe-audit-trail.schema.json` requiring:

- task interpretation
- rules loaded
- files inspected
- evidence used
- decisions made
- commands run
- changes made
- errors encountered
- pivots made
- validation results
- remaining gaps
- `chain_of_thought_excluded: true`

Strengthened `grade.schema.json` so grader results must include:

- `grader_id`
- `score`
- `decision`
- `blocking_failures`
- `evidence`
- `deductions`
- `feedback`

Updated `scripts/grade-output.py` so emitted grader results match the tightened grade contract and include evidence-state records.

Registered the new contracts in `prompt.spec.yaml`.

Added `scripts/validate-scenario-references.py` to check scenario references against actual files and the template registry.

Updated `scripts/release-gate.py` so the release gate runs the scenario-reference validator.

Updated `scripts/validate-bundle.py` strict mode so weak output and grade contracts fail explicit contract-strength checks.

Updated `contracts/agent-evidence.schema.json` to allow evidence-state records and evidence-state fields on commands, tests and test results.

## Files changed

- `.agent-operating-model/bundles/github/output.schema.json`
- `.agent-operating-model/bundles/github/grade.schema.json`
- `.agent-operating-model/bundles/github/contracts/evidence-state.schema.json`
- `.agent-operating-model/bundles/github/contracts/safe-audit-trail.schema.json`
- `.agent-operating-model/bundles/github/contracts/agent-evidence.schema.json`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/scripts/grade-output.py`
- `.agent-operating-model/bundles/github/scripts/validate-scenario-references.py`
- `.agent-operating-model/bundles/github/scripts/validate-bundle.py`
- `.agent-operating-model/bundles/github/scripts/release-gate.py`

## Validation status

No local release gate was run in this connector-only environment.

Recommended checks:

```bash
cd .agent-operating-model/bundles/github
python scripts/validate-scenario-references.py
python scripts/validate-bundle.py --strict
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode fast --report fast-release-gate-report.json
```

## Risks and mitigations

Risk: stronger schemas may expose previously tolerated weak outputs or grader results.

Mitigation: `grade-output.py` was updated to emit the tightened shape. `output.schema.json` is a contract for future agent output rather than a validator for existing fixture files.

Risk: scenario-reference validation may reveal existing stale scenario links.

Mitigation: the validator is intentionally wired into the release gate so CI will expose residual drift before merge.

Risk: registry manifest checksums may be stale after adding contract and script files.

Mitigation: the existing GitHub bundle registry-manifest workflow should regenerate `registry-manifest.yaml` on the pull request branch.
