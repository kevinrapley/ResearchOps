# Agent audit trace — GitHub bundle release-gate blockers

Date: 2026-05-23

Branch: `fix/github-bundle-release-gate-blockers`

Trace type: operational audit

Status: ready for PR review

## Evidence boundary

This trace records observable repository work to repair structural blockers reported by an external GitHub bundle evaluation.

It does not include private chain-of-thought.

## Scope

This first remediation branch covers the fast release-gate blockers only:

- `github-diamond-bundle`
- `release-gate`
- `template-registry`
- `eval-fixtures`
- `graders`
- `version-validators`

It does not attempt the later hardening work around eval execution, stronger output contracts, broader scenario validation or evidence-state modelling.

## Problem summary

The GitHub Diamond bundle archive failed its own fast release gate.

Known structural blockers included:

- `templates/discussion-template.xml` was empty and invalid XML.
- `template-registry.yaml` referenced missing GitHub templates.
- `evals.yaml` referenced a missing `examples/fixtures/repositories/api-service` fixture repository.
- `examples/scenarios/repo-docs-readme-gap.yaml` referenced a missing `graders/documentation-grader.xml` file.
- `validate-changelog.py` used a stale hard-coded version list.
- `validate-docs-consistency.py` defaulted to a stale bundle version.

The user requested the first remediation PR and asked that missing template registry entries be created rather than removed.

## Work completed

Replaced `templates/discussion-template.xml` with valid XML and a structured discussion-record template.

Created GitHub issue templates:

- `templates/github/.github/ISSUE_TEMPLATE/bug_report.yml`
- `templates/github/.github/ISSUE_TEMPLATE/feature_request.yml`

Created the GitHub pull request template:

- `templates/github/.github/PULL_REQUEST_TEMPLATE/default.md`

Created the GitHub CODEOWNERS template:

- `templates/github/.github/CODEOWNERS`

Created GitHub workflow templates referenced by the registry, including:

- `ci-accessibility.yml`
- `ci-conformance.yml`
- `ci-data-ml.yml`
- `ci-docs-quality.yml`
- `ci-dotnet.yml`
- `ci-go.yml`
- `ci-java.yml`
- `ci-node.yml`
- `ci-performance.yml`
- `ci-php.yml`
- `ci-python.yml`
- `ci-ruby.yml`
- `ci-rust.yml`
- `codeql.yml`
- `dependency-review.yml`
- `file-inventory.yml`
- `release-gate.yml`
- `sbom-cyclonedx.yml`

Created the hardened workflow template used by the offline release gate:

- `templates/github/.github/workflows-hardened/ci-hardened.yml`

Added the missing documentation grader:

- `graders/documentation-grader.xml`

Added the missing API service eval fixture:

- `examples/fixtures/repositories/api-service/README.md`
- `examples/fixtures/repositories/api-service/docs/api/endpoint-catalog.yaml`
- `examples/fixtures/repositories/api-service/examples/payloads/http-json-success.json`
- `examples/fixtures/repositories/api-service/examples/payloads/http-json-error.json`
- `examples/fixtures/repositories/api-service/tests/contract/README.md`

Updated version validators:

- `scripts/validate-changelog.py` now reads `bundle.version` from `prompt.spec.yaml`.
- `scripts/validate-docs-consistency.py` now reads `bundle.version` from `prompt.spec.yaml` unless an explicit `--version` override is provided.

## Compatibility notes

The workflow templates include top-level `permissions`, because `validate-workflow-hardening.py` requires this.

The generated workflow templates use quoted `"on"` keys to avoid YAML 1.1 parsers interpreting `on` as a boolean.

The version validators no longer require future releases to edit stale hard-coded values before validation can pass.

## Validation status

No local release gate was run in this connector-only environment.

Recommended checks:

```bash
cd .agent-operating-model/bundles/github
PYTHONDONTWRITEBYTECODE=1 python scripts/release-gate.py --mode fast --report fast-release-gate-report.json
python scripts/validate-template-registry.py
python scripts/validate-evals.py
python scripts/validate-changelog.py
python scripts/validate-docs-consistency.py
```

## Risks and mitigations

Risk: registry manifest checksums may be stale after adding new bundle files.

Mitigation: the existing GitHub bundle registry-manifest workflow should regenerate `registry-manifest.yaml` on the pull request branch.

Risk: the fast gate may reveal additional blockers after the known structural blockers are removed.

Mitigation: inspect CI logs and patch only release-gate blockers in this first remediation PR. Defer eval-harness hardening and schema tightening to later PRs.
