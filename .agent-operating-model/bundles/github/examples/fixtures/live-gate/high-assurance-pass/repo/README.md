# High-assurance live gate passing fixture

This repository is the positive fixture for the GitHub Diamond high-assurance live release gate.

It represents a repository state that should satisfy the high-assurance live-gate profile when the validator is supplied with the required local evidence files.

## Fixture role

This is a live-gate assurance fixture, not a normal starter repository and not a generated eval output.

It is deliberately more complete than `examples/fixtures/repositories/*` because the live gate needs to prove release-readiness controls across repository structure, workflow hardening, SBOM evidence, provenance, accessibility evidence, performance evidence, GitHub settings evidence and trusted attestation verification.

## What this fixture demonstrates

The fixture demonstrates a complete positive release-gate evidence set:

- Repository purpose, contribution and security documentation.
- Node and Python project signals.
- Deterministic test-command evidence.
- Conformance records mapped to high-assurance controls.
- A non-empty gap register with closed non-blocking fixture-quality records.
- File-backed GitHub settings evidence.
- Hardened workflow evidence and action-lock evidence.
- Accessibility evidence that combines automated checks, keyboard checks, focus checks, screen-reader smoke checks, reflow checks and closed defects.
- Performance evidence mapped to an explicit budget.
- SBOM evidence with components, dependencies, licences, PURLs and tool metadata.
- Attestation evidence with subject hashes, SLSA-style provenance, GitHub artifact attestation, Sigstore evidence and DSSE metadata.
- Trusted attestation verification command evidence.

## Immediate root evidence files

The immediate files in this directory are intentionally evidence-bearing. They should not be reduced to placeholder stubs.

| File | Purpose |
| --- | --- |
| `agent-evidence.yaml` | Links files read, files changed, commands, contracts, repository state, GitHub settings, accessibility, performance, SBOM and attestation evidence. |
| `accessibility-evidence.yaml` | Records automated and manual accessibility evidence for the positive release decision. |
| `attestation.json` | Represents synthetic trusted attestation metadata for the release artifact and evidence set. |
| `conformance-matrix.yaml` | Maps high-assurance controls to fixture evidence and expected validator interpretation. |
| `gap-register.yaml` | Records closed non-blocking fixture-quality gaps without creating an active release blocker. |
| `github-settings.yaml` | Represents the expected branch protection, workflow permission, security and deployment-protection posture. |
| `performance-budget.yaml` | Defines release performance thresholds, comparators, tolerances and failure interpretation. |
| `performance-results.yaml` | Records measured synthetic performance outcomes against the explicit budget. |
| `sbom.json` | Provides CycloneDX-style software bill of materials evidence. |
| `sigstore-bundle.json` | Provides fixture-safe Sigstore-style bundle evidence linked to the release artifact. |
| `test-commands.yaml` | Records deterministic command evidence for the positive release-gate fixture. |
| `trusted-attestation-verification.json` | Records trusted verification command evidence for GitHub artifact attestation, Sigstore and SBOM linkage. |
| `workflow-action-lock.yaml` | Records reviewed workflow action evidence for the high-assurance profile. |

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

This fixture proves local validation behaviour. It does not prove that a real external repository has live GitHub API observability, live branch protection, production deployment controls or genuine third-party attestation verification.

Negative live-gate fixtures deliberately remove or weaken one required control at a time so the validator can prove each blocking condition.

## Maintenance rule

Do not make this positive fixture look like a minimal starter repository.

When changing one of the direct root evidence files, keep the evidence realistic, structured and traceable. If a control needs to fail, create or update a `negative-*` fixture instead of weakening this positive fixture.
