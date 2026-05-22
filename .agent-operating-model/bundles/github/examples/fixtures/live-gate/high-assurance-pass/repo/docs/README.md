# Docs

This directory is part of the high-assurance live-gate passing fixture.

It provides supporting documentation for the local fixture evidence used by the live release gate. The root README explains the fixture at repository level; this directory is for longer-form notes that would normally support a real release decision.

## Fixture role

This is not general repository documentation.

It exists to show that the positive high-assurance fixture has a documentation surface for release evidence, assurance notes and operational context.

## Expected contents in a real repository

A real high-assurance repository would expand this area with:

- release readiness notes
- rollback and recovery notes
- operational support notes
- accessibility test notes
- performance evidence interpretation
- SBOM and attestation interpretation
- live GitHub settings verification notes

## Boundary

The fixture documentation must stay safe and synthetic.

Do not add real production endpoints, real incident routes, real credentials, real security contacts or real deployment secrets here.

## Validator relationship

The live gate primarily consumes structured files such as `agent-evidence.yaml`, `accessibility-evidence.yaml`, `performance-budget.yaml`, `performance-results.yaml`, `sbom.json`, `attestation.json`, and `trusted-attestation-verification.json`.

This documentation provides human context for those files. It should not be the sole evidence source for high-assurance validation.
