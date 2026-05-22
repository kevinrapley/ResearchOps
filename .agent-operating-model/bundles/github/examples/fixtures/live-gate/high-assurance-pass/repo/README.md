# High-assurance live gate passing fixture

This repository is a positive fixture for the GitHub Diamond live release gate.

It represents a repository state that should satisfy the high-assurance live-gate profile when the validator is supplied with the required evidence files.

## Fixture role

This is a live-gate assurance fixture, not a normal seed repository and not a generated eval output.

It is deliberately more complete than `examples/fixtures/repositories/*` because the live gate needs to prove release-readiness controls across repository structure, workflow hardening, SBOM evidence, provenance, accessibility evidence, performance evidence and trusted attestation verification.

## Expected validator interpretation

The validator should treat this fixture as the positive high-assurance case.

The repository contains the required high-assurance artefacts:

- `workflow-action-lock.yaml`
- `attestation.json`
- `trusted-attestation-verification.json`
- `accessibility-evidence.yaml`
- `performance-budget.yaml`
- `performance-results.yaml`
- `sbom.json`
- `agent-evidence.yaml`
- `.github/workflows/`

## Assurance boundary

This fixture proves local validation behaviour. It does not prove a real external repository has live GitHub API observability, live branch protection or real production deployment controls.

Negative live-gate fixtures deliberately remove or weaken one required control at a time so the validator can prove each blocking condition.
