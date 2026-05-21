# Validation Report — GitHub Diamond Bundle v2.9.3

Validation status: pending final manifest regeneration.

Last checked: 2026-05-21.

Version 2.9.3 refreshes the bundle examples layer. It promotes placeholder-style examples into concrete scenarios, expected outputs and behavioural anti-examples while preserving the v2.9.2 assurance model.

## Scope

This bundle governs GitHub repository operation, branch hygiene, pull-request discipline, CI, release gates, evidence handling, attestation, repository settings, workflow hardening and live repository assurance.

The examples refresh is part of the bundle assurance surface because examples teach how agents should apply modes, roles, references, contracts, graders and evidence expectations.

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
- XML roots declare `version="2.9.3"`
- manifest hashes are regenerated and checked
- manifest coverage includes the new scenario, expected-output and anti-example files
- transient citation markers are absent
- changelog order and uniqueness are preserved
- documentation consistency is preserved
- template registry validation still passes
- eval definition validation still passes
- agent evidence validation still passes
- direct repository-state verification still passes
- GitHub settings verification still passes
- release-gate pass and fail report validation still passes
- structured accessibility evidence validation still passes
- high-assurance live gate fixture validation still passes

## Example coverage

The v2.9.3 examples are organised into:

- `examples/scenarios/`
- `examples/expected-outputs/`
- `examples/anti-examples/`

Scenarios define realistic user prompts, repository context, expected mode selection, roles, references, contracts, graders, required evidence and failure conditions.

Expected outputs show acceptable response shape without redundant example title headings.

Anti-examples are limited to genuine incorrect behaviours. Placeholder examples are not treated as anti-examples.

## Known gaps

The final blocking requirement for this branch is manifest regeneration after all source edits are complete.

## Result

The GitHub Diamond bundle v2.9.3 is suitable for review once `registry-manifest.yaml` is regenerated and the release metadata is aligned with the final source tree.
