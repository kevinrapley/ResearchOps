# Agent trace: repository operating model bootstrap

> This is an auditable agent trace generated for a task that included `[reasoning]`. It records task interpretation, corrective branch behaviour, operating-model sources, implementation decisions, validation design and residual risks. It does not expose private chain-of-thought.

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

The ZIP file is treated as the authoritative bundle package. The GitHub connector could confirm the repository path and blob metadata, but it could not extract the binary ZIP contents through text fetch. The implementation therefore validates that the ZIP exists and has a ZIP signature, but does not fabricate internal entry names.

## Bundle selection model

The registry defines these always-load bundles:

- GitHub Diamond
- ResearchOps Developer
- Gold Standard Gov Product Assistant

The registry defines these conditional bundles:

- GOV.UK Design System
- Cloudflare Core Developer
- Airtable Public API
- Mural Public API

Conditional bundles are selected by keyword matching against the task text. The loader returns selected and skipped bundles so agents can explain their operating-model application.

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

## Validation limitation

I have not claimed full local `npm run lint`, `npm run validate` or `npm test` success in this environment. The work is structured so CI can run those commands in the repository context with dependencies installed.

## Residual risks

- The GitHub connector could not unpack `docs/devops/ResearchOps-Bundle-Setup.zip`, so registry entries are based on the bundle identities already provided in the task history and orchestration design rather than inspecting internal ZIP entries.
- The loader uses keyword matching. This is deliberately simple and auditable, but later work may replace it with a stricter manifest extracted from the ZIP package.
- The operating model now creates a repository contract, but an external agent still needs repository access and an instruction to read `AGENTS.md` first.

## Next step

Open a PR from `feature/repo-model-trace` into `main` and let CI provide the definitive lint, validation and test results.
