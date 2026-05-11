# Validation Report — ResearchOps Developer-Control Prompt Bundle v1.13.0

Validation status: passed.

Last checked: 2026-05-11.

## Scope

This bundle governs ResearchOps platform implementation, repository conventions, routing, service boundaries, integration behaviour, testing, performance, metadata, ethics and PR/logging doctrine.

It is the primary ResearchOps-specific development control bundle after GitHub repository governance.

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

The bundle exposes a full prompt body and prompt spec.

The prompt body loads the ResearchOps platform context, developer control contract, implementation workflow, quality gates, performance rules, integration contracts, API specs, endpoint catalogues, repository conventions, design patterns, example payloads, conformance assets, CI governance, fixture validation, metadata provenance, ethics and PR/logging controls.

The registry and entrypoints align with the canonical bundle directory under `.agent-operating-model/bundles/researchops-developer-control/`.

## Evaluation coverage

The bundle includes regression and red-team test files and a dedicated eval orchestration file.

The strongest coverage is around route availability, endpoint contracts, fixture validation, repository conventions, CI governance and metadata provenance.

## Known gaps

This validation report does not independently re-run every endpoint contract fixture.

Future work should add a bundle-level executable report generator that counts references, modes, roles, templates, tests and known gaps automatically.

## Result

The bundle is suitable for current ResearchOps platform development use.
