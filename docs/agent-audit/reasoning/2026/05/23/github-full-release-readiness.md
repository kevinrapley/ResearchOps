# Agent audit trace — GitHub full release readiness

Date: 2026-05-23

Branch: `fix/github-full-release-readiness`

Trace type: operational audit

Status: ready for PR review

## Evidence boundary

This trace records observable repository work to address the revised `github.zip` evaluation and move the GitHub Diamond bundle from fast-gate clean to full-release ready.

It does not include private chain-of-thought.

## Scope

This remediation branch covers:

- full release-gate performance adapter blockers
- validation report accuracy
- prompt specification assembly coverage
- agent-evidence validation strength

It follows the earlier remediation PRs that repaired structural fast-gate blockers, eval execution trustworthiness, and contract/scenario validation.

## Problem summary

The revised bundle evaluation found that the fast release gate passes, but the full release gate fails.

The primary blocker was a performance adapter metric mismatch.

The pytest-benchmark adapter emitted per-test metrics such as:

- `test_repository_conformance_endpoint_mean_seconds`
- `test_repository_conformance_endpoint_max_seconds`
- `test_release_gate_summary_build_mean_seconds`
- `test_release_gate_summary_build_max_seconds`

The pytest-benchmark budget expected canonical metrics:

- `response_time_mean_seconds`
- `response_time_max_seconds`

The Go benchmark adapter emitted per-benchmark metrics such as:

- `BenchmarkRepositoryConformanceHandler-8_ns_per_op`
- `BenchmarkReleaseGateSummaryHandler-8_ns_per_op`
- `BenchmarkEvidenceIndexLookup-8_ns_per_op`

The Go benchmark budget expected:

- `handler_ns_per_op`

Secondary blockers were:

- stale `VALIDATION-REPORT.md`
- incomplete `prompt.spec.yaml` assembly coverage
- weak `validate-agent-evidence.py` semantics

## Work completed

Updated `scripts/performance-adapters.py` so pytest-benchmark preserves detailed per-test metrics and also emits canonical roll-up metrics:

- `response_time_mean_seconds`
- `response_time_max_seconds`

The roll-up strategy uses the maximum value across benchmark entries. This is conservative for a release gate.

Updated `scripts/performance-adapters.py` so Go benchmark preserves detailed per-benchmark `ns/op` metrics and also emits the canonical budget metric:

- `handler_ns_per_op`

The roll-up strategy uses the maximum `ns/op` value across benchmark entries.

Updated `VALIDATION-REPORT.md` so it no longer states that manifest regeneration is the only blocker. It now records the fast-gate/full-gate position and the performance adapter remediation.

Updated `prompt.spec.yaml` so bundle assembly coverage includes:

- `references/github-best-practices.xml`
- `graders/documentation-grader.xml`
- `contracts/accessibility-evidence.schema.json`
- `contracts/live-release-policy.schema.json`
- `contracts/release-gate-report.schema.json`
- `contracts/trusted-attestation-verification.schema.json`

Updated `scripts/validate-bundle.py --strict` so prompt specification assembly coverage is checked against actual files in:

- `references/*.xml`
- `contracts/*.schema.json`
- `graders/*.xml`

Updated `scripts/validate-agent-evidence.py` so command-like evidence must include:

- command or name
- status
- state
- execution detail where the state is `observed` or `verified`

The validator now recognises the schema vocabulary:

- `passed`
- `failed`
- `not-run`
- `timeout`
- `unavailable`
- `waived`

It also recognises the evidence-state vocabulary:

- `claimed`
- `observed`
- `verified`
- `unavailable`
- `waived`

Updated the agent evidence fixtures so verified passed commands include explicit state and execution detail.

## Files changed

- `.agent-operating-model/bundles/github/scripts/performance-adapters.py`
- `.agent-operating-model/bundles/github/VALIDATION-REPORT.md`
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/scripts/validate-bundle.py`
- `.agent-operating-model/bundles/github/scripts/validate-agent-evidence.py`
- `.agent-operating-model/bundles/github/examples/agent-evidence.example.yaml`
- `.agent-operating-model/bundles/github/examples/eval-outputs/instantiate-multi-language-repo-pass/agent-evidence.yaml`

## Validation status

No local full release gate was run in this connector-only environment.

Recommended checks:

```bash
cd .agent-operating-model/bundles/github
python scripts/validate-agent-evidence.py examples/agent-evidence.example.yaml
python scripts/validate-agent-evidence.py examples/eval-outputs/instantiate-multi-language-repo-pass/agent-evidence.yaml
python scripts/validate-bundle.py --strict
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode full --report full-release-gate-report.json
```

## Risks and mitigations

Risk: the full gate may reveal a later adapter mismatch after pytest-benchmark and Go benchmark roll-ups are fixed.

Mitigation: the full gate exercises all performance adapters. Any further mismatch should be handled as a concrete adapter/budget alignment defect.

Risk: stronger agent-evidence validation may expose weak fixture records.

Mitigation: the release-gate evidence fixtures have been updated with explicit state and execution details.

Risk: registry manifest checksums may be stale after script and evidence edits.

Mitigation: the existing GitHub bundle registry-manifest workflow should regenerate `registry-manifest.yaml` on the pull request branch.
