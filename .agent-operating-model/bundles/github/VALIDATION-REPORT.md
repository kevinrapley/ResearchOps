# Validation Report — GitHub Diamond Bundle v2.9.3

Validation status: full-release-readiness remediation in progress.

Last checked: 2026-05-23.

Version 2.9.3 is now a fast-gate clean candidate. The fast release gate passes after the structural release-gate, eval-harness and contract-validation remediation work.

The remaining release-readiness focus is the full release gate. The latest external archive evaluation identified a full-gate performance adapter mismatch where adapter output did not satisfy the canonical metrics expected by pytest-benchmark and Go benchmark performance budgets.

## Scope

This bundle governs GitHub repository operation, branch hygiene, pull-request discipline, CI, release gates, evidence handling, attestation, repository settings, workflow hardening, performance budget assurance and live repository assurance.

The examples, fixtures, templates, contracts, graders and validation scripts are part of the bundle assurance surface because they teach and enforce how agents should apply modes, roles, references, contracts, evidence expectations and release-gate checks.

## Entrypoints checked

Checked entrypoints:

- `README.md`
- `CHANGELOG.md`
- `prompt.spec.yaml`
- `prompt.body.xml`
- `evals.yaml`
- `tests.regression.yaml`
- `tests.redteam.yaml`
- `variables.schema.json`
- `output.schema.json`
- `grade.schema.json`
- `registry-manifest.yaml`

## Structural checks

Expected before release:

- XML, JSON and YAML parse successfully
- XML roots declare their module version
- manifest hashes are regenerated and checked
- manifest coverage includes scenarios, expected outputs, anti-examples, fixtures, payloads and performance examples
- transient citation markers are absent
- changelog order and uniqueness are preserved
- documentation consistency is preserved
- template registry validation passes
- scenario reference validation passes
- eval definition validation passes
- agent evidence validation enforces command, status, evidence-state and execution-detail semantics
- direct repository-state verification passes
- GitHub settings verification passes
- release-gate pass and fail report validation passes
- structured accessibility evidence validation passes
- high-assurance live gate fixture validation passes
- performance adapters emit canonical metrics required by their budget files

## Current gate position

Fast release gate:

```bash
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode fast --report fast-release-gate-report.json
```

Current expected status: pass.

Full release gate:

```bash
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode full --report full-release-gate-report.json
```

Previous status: failed before this remediation branch.

Previous blocker:

- pytest-benchmark adapter emitted per-test metrics only, while the budget expected `response_time_mean_seconds` and `response_time_max_seconds`
- Go benchmark adapter emitted per-benchmark metrics only, while the budget expected `handler_ns_per_op`

Remediation in this branch:

- pytest-benchmark now emits canonical roll-up metrics using the maximum mean and maximum max values across benchmark entries
- Go benchmark now emits `handler_ns_per_op` using the maximum `ns/op` value across benchmark entries
- detailed per-test and per-benchmark metrics are preserved as diagnostic measurements

## Evaluation coverage

The v2.9.3 examples are organised into:

- `examples/scenarios/`
- `examples/expected-outputs/`
- `examples/anti-examples/`
- `examples/fixtures/`
- `examples/payloads/`
- `examples/performance-inputs/`
- `examples/performance-results/`

Scenarios define realistic user prompts, repository context, expected mode selection, roles, references, contracts, graders, required evidence and failure conditions where relevant.

Expected outputs show acceptable response shape without redundant example title headings.

Anti-examples are limited to genuine incorrect behaviours. Placeholder examples are not treated as anti-examples.

Fixture, payload and performance examples have been expanded to exercise validators, adapters and release-gate evidence paths with realistic synthetic data rather than minimal placeholder records.

## Known gaps

No manifest-only blocker is currently recorded. Manifest validation should be treated as passed only after the registry-manifest automation has regenerated hashes for this branch.

The full release gate should be re-run after performance adapter roll-up metrics, prompt assembly coverage and agent-evidence validation hardening are applied.

The `references/github-tooling-mutation-policy.xml` module remains at version `1.0.0`. This is treated as module-versioning rather than bundle-version drift, but should remain visible in release review.

## Result

The GitHub Diamond bundle v2.9.3 is suitable for release-candidate review only after the full release gate passes.

The current branch addresses the known full-gate performance adapter blocker and the secondary assurance issues around validation reporting, prompt assembly coverage and agent-evidence validation strength.