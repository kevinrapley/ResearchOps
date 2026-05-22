# Contributing

This fixture is used to exercise the high-assurance live release gate.

Changes to this repository fixture should preserve the relationship between the positive fixture and the negative live-gate fixtures. The positive fixture should contain the full evidence set. Each negative fixture should remove, weaken or invalidate one control at a time.

## Working rule

Do not make this fixture look like a normal starter repository.

It is a release-gate assurance fixture. Its purpose is to give validators enough structured evidence to prove high-assurance release behaviour.

## Evidence expectations

When changing this fixture, review the following files together:

- `agent-evidence.yaml`
- `workflow-action-lock.yaml`
- `attestation.json`
- `trusted-attestation-verification.json`
- `accessibility-evidence.yaml`
- `performance-budget.yaml`
- `performance-results.yaml`
- `sbom.json`
- `.github/workflows/`

## Review expectations

A change should explain which high-assurance requirement it affects.

A change should not weaken the positive fixture unless a matching negative fixture proves the expected failure.

A change should not claim live repository assurance unless the evidence is either present in the fixture or explicitly represented as simulated fixture evidence.
