# Validation Report — GitHub Diamond Bundle v2.9.5

Validation status: proactive test-contract impact sweep update in progress.

Last checked: 2026-06-04.

Version 2.9.5 is the current GitHub Diamond bundle version. It adds a proactive test-contract impact sweep rule for change, update, migration, refactor and generated-output work before PR readiness is claimed.

The current validation focus is bundle version consistency, registry-manifest alignment, trace coverage and normal ResearchOps validation.

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

Bundle version consistency:

```bash
npm run agent:bundle-versions:validate
```

Current expected status: pass.

Bundle registry validation:

```bash
npm run agent:bundles:validate
```

Current expected status: pass after registry manifest update.

Operating-model validation:

```bash
npm run agent:model:validate
```

Current expected status: pass.

Repository validation:

```bash
npm run validate
```

Current expected status: pending CI confirmation.

## 2.9.5 validation focus

- `prompt.spec.yaml` declares version `2.9.5`.
- `prompt.body.xml` declares version `2.9.5`.
- `README.md` declares version `2.9.5`.
- `CHANGELOG.md` includes `2.9.5+researchops.2026-06-04`.
- `references/test-contract-impact-sweep.xml` is registered as an always-loaded GitHub Diamond reference.
- `registry-manifest.yaml` must point to version `2.9.5` and include current hashes for changed bundle files.
