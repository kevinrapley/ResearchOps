# Agent audit trace — High-assurance pass root fixtures

Date: 2026-05-23

Branch: `fix/high-assurance-pass-root-fixtures`

Trace type: operational audit

Status: ready for PR review

## Evidence boundary

This trace records observable repository work to expand immediate root files in the high-assurance live-gate positive fixture.

It does not include private chain-of-thought.

## Scope

This work covered the GitHub Diamond bundle live-gate fixture area only:

- `github-diamond-bundle`
- `live-gate-fixtures`
- `high-assurance-positive-fixture`
- `fixture-evidence-quality`
- `root-fixture-files`

The scope was limited to immediate files under:

`.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/`

Nested `.github/`, `docs/`, `results/` and `templates/` directories were not edited.

## Operating model

Selected bundles:

- `github`
- `researchops-developer-control`
- `multi-functional-team`

Branch policy applied:

`fix/` branches require audit trace artefacts under `docs/agent-audit/reasoning/YYYY/MM/DD`.

## Problem summary

Several immediate root files in the high-assurance positive live-gate fixture were still slim placeholder-style examples.

That fixture is the positive high-assurance case. Its root evidence files should show realistic synthetic release-gate evidence rather than bare schema-minimum records.

The issue was specifically about files directly inside the `repo/` directory. Nested fixture directories remain a separate review area.

## Work completed

Expanded `conformance-matrix.yaml` with control-to-evidence records for repository evidence, workflows, GitHub settings, action locks, SBOM, attestation, accessibility, performance, test commands, gaps and agent evidence.

Expanded `gap-register.yaml` with closed non-blocking fixture-quality records while keeping the top-level schema-compatible `gaps` key only.

Expanded `performance-budget.yaml` and `performance-results.yaml` with thresholds, comparators, tolerances, measurements, provenance and release-gate interpretation.

Expanded `sbom.json` into CycloneDX-style evidence with metadata, components, dependencies, licences, PURLs, services and release-gate properties.

Expanded `sigstore-bundle.json`, `attestation.json` and `trusted-attestation-verification.json` with fixture-safe supply-chain, provenance and verification evidence.

Expanded `accessibility-evidence.yaml` with automated checks, keyboard tests, focus checks, screen-reader smoke checks, assistive technology matrix, reflow checks and closed defects.

Expanded `package.json` and `pyproject.toml` so Node and Python project signals explain their deterministic fixture role.

Aligned `agent-evidence.yaml` with the expanded root evidence set and removed contradictions around accessibility, performance, SBOM and attestation evidence.

Expanded `README.md` and `RECENT_LEARNINGS.md` to document the root evidence file contract and maintenance rules.

## Files changed

- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/accessibility-evidence.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/agent-evidence.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/attestation.json`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/conformance-matrix.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/gap-register.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/github-settings.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/package.json`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/performance-budget.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/performance-results.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/pyproject.toml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/README.md`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/RECENT_LEARNINGS.md`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/sbom.json`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/sigstore-bundle.json`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/test-commands.yaml`
- `.agent-operating-model/bundles/github/examples/fixtures/live-gate/high-assurance-pass/repo/trusted-attestation-verification.json`

## Static compatibility checks

The following compatibility constraints were preserved:

- `conformance-matrix.yaml` preserves the required top-level `records` key.
- `gap-register.yaml` preserves the required top-level `gaps` key and does not add disallowed sibling keys.
- `agent-evidence.yaml` remains within the top-level keys permitted by `agent-evidence.schema.json`.
- `accessibility-evidence.yaml` keeps `release_decision: pass` and links to existing results files.
- `performance-budget.yaml` preserves `budgets` as the top-level collection.
- `performance-results.yaml` preserves `measurements` as the top-level collection.
- `test-commands.yaml` keeps top-level `commands` as shell command strings for harness compatibility.
- Expanded command detail is recorded under `command_evidence`.
- `attestation.json` has its `sbom_sha256` aligned to the expanded `sbom.json`.

## Validation status

No local Python, Node or release-gate validation was run in this connector-only environment.

CI should run the GitHub bundle validators on the pull request.

Recommended checks:

```bash
cd .agent-operating-model/bundles/github
python scripts/validate-live-gate-fixtures.py
python scripts/validate-agent-evidence.py examples/fixtures/live-gate/high-assurance-pass/repo/agent-evidence.yaml
python scripts/validate-sbom.py --path examples/fixtures/live-gate/high-assurance-pass/repo/sbom.json --min-components 1 --require-dependencies --require-licences --require-purls --require-tool-metadata
python scripts/validate-sbom-attestation.py --attestation examples/fixtures/live-gate/high-assurance-pass/repo/attestation.json --sbom examples/fixtures/live-gate/high-assurance-pass/repo/sbom.json --min-subject-files 1 --require-dsse --require-slsa --require-github-artifact-attestation --require-sigstore --trusted-mode
python scripts/validate-performance-results.py --budget examples/fixtures/live-gate/high-assurance-pass/repo/performance-budget.yaml --results examples/fixtures/live-gate/high-assurance-pass/repo/performance-results.yaml
```

## Risks and mitigations

Risk: the fixture validator may contain undocumented assumptions about very slim input shapes.

Mitigation: existing required top-level keys were preserved, and records were expanded with additional nested evidence rather than changing the fixture role.

Risk: registry manifest checksums may be stale after these edits.

Mitigation: the existing GitHub bundle registry-manifest automation should update SHA-256 checksums on the pull request branch if configured to run for bundle changes.
