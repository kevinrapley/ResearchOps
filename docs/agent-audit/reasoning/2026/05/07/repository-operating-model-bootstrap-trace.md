# Agent trace: repository operating model bootstrap

> This is an auditable agent trace generated for a task that included `[reasoning]`. It records task interpretation, corrective branch behaviour, operating-model sources, implementation decisions, review correction, validation design and residual risks. It does not expose private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260507-repo-model-bootstrap`
- Date: 2026-05-07
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/repo-model-trace`
- Abandoned branch: `feature/repo-agent-model`
- Trigger token detected: `[reasoning]`

## User task

The user asked to make the repository the operating-model source of truth, so agents do not require bundles to be re-attached and do not rely on conversation memory for repository-affecting work.

The user also asked for a fresh branch from `main`, completed implementation work and a new PR.

## Corrective branch behaviour

Work initially began on `feature/repo-agent-model`. The user paused the work because that branch was one commit ahead and two commits behind `main`, and because `[reasoning]` had not been honoured with a trace.

Corrective action:

- stopped work on `feature/repo-agent-model`
- confirmed it was diverged
- created `feature/repo-model-trace` from current `main`
- reapplied the `AGENTS.md` bootstrap change cleanly
- added this trace as a first-class artefact

## Operating-model files loaded or referenced

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `docs/devops/ResearchOps-Bundle-Setup.zip`

The ZIP file is treated as the authoritative bundle package. The GitHub connector could confirm the repository path and blob metadata, but it could not extract the binary ZIP contents through text fetch. A PR review then supplied the manifest IDs declared by `ResearchOps-Bundle-Setup/multi-bundle-orchestration.xml`, and the registry, orchestration XML, validator and regression test were updated to match those IDs.

## Bundle selection model

The registry defines these always-load bundles:

- `github-diamond`
- `researchops-developer`
- `gov-product-assistant-gold-standard`

The registry defines these conditional bundles:

- `govuk-design-system`
- `cloudflare-core-developer`
- `airtable-public-api-developer`
- `mural-public-api-developer`

Conditional bundles are selected by keyword matching against the task text. The loader returns selected and skipped bundles so agents can explain their operating-model application.

## Review correction

The open PR received a P2 review comment stating that the registry IDs must match the authoritative ZIP manifest IDs. The shortened IDs were:

- `gold-standard-gov-product`
- `airtable-public-api`
- `mural-public-api`

They were replaced with the manifest IDs:

- `gov-product-assistant-gold-standard`
- `airtable-public-api-developer`
- `mural-public-api-developer`

The correction was applied to:

- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/orchestration.xml`
- `scripts/agent-operating-model/validate-operating-model.mjs`
- `tests/agent-operating-model-regression.test.js`
- this trace report
- this trace summary JSON

## Implementation decisions

### Make `AGENTS.md` the entry point

`AGENTS.md` now contains a mandatory bootstrap section. This gives repository-aware agents a stable first file to read.

### Add `.agent-operating-model/`

The new directory contains the orchestration XML, bundle registry, checklist and policies. This moves bundle selection out of chat ritual and into repository-controlled files.

### Add executable validation

The new validators make the operating model checkable:

- `npm run agent:model`
- `npm run agent:bundles:validate`
- `npm run agent:model:validate`

The main repository validation script now calls the operating-model validator.

### Add regression coverage

A regression test checks that always-load bundles are selected, conditional bundles are selected from task text and `AGENTS.md` references the repository operating-model sources.

## Files created or modified

Created:

- `.agent-operating-model/README.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/bundle-registry.schema.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `scripts/agent-operating-model/load-operating-model.mjs`
- `scripts/agent-operating-model/validate-bundle-registry.mjs`
- `scripts/agent-operating-model/validate-operating-model.mjs`
- `tests/agent-operating-model-regression.test.js`
- `docs/agent-audit/reasoning/2026/05/07/repository-operating-model-bootstrap-trace.md`
- `docs/agent-audit/reasoning/2026/05/07/repository-operating-model-bootstrap-trace.json`

Modified:

- `AGENTS.md`
- `.prettierignore`
- `package.json`
- `scripts/validate.sh`

## Validation designed

The new validation checks that:

- required operating-model files exist
- `AGENTS.md` references the operating-model sources
- the bundle registry is structurally valid
- the bundle package exists and has a ZIP signature
- package scripts exist
- the loader selects expected bundles for a representative mixed task
- the orchestration XML contains the manifest-aligned bundle IDs

## Validation limitation

I have not claimed full local `npm run lint`, `npm run validate` or `npm test` success in this environment. The work is structured so CI can run those commands in the repository context with dependencies installed.

## Residual risks

- The GitHub connector could not itself unpack `docs/devops/ResearchOps-Bundle-Setup.zip`; the manifest ID correction is based on the PR review comment that identified the IDs declared in `ResearchOps-Bundle-Setup/multi-bundle-orchestration.xml`.
- The loader uses keyword matching. This is deliberately simple and auditable, but later work may replace it with a stricter manifest extracted from the ZIP package.
- The operating model now creates a repository contract, but an external agent still needs repository access and an instruction to read `AGENTS.md` first.

## Next step

Let CI provide the definitive lint, validation and test results for PR #207.
