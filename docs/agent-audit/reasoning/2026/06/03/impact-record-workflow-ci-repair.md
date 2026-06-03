# Agent trace — Impact record workflow CI repair

**Date:** 2026-06-03  
**Branch:** `feature/impact-record-workflow`  
**Trace type:** operational audit trace  
**Task:** Fix failing tests on PR #338 and align generated CSS handling with repository policy.

## Evidence boundary

This trace records observable repository actions, files changed, workflow outcomes and residual risks. It does not expose private chain-of-thought.

## Operating model loaded

Loaded files:

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`
- `cloudflare`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Initial CI failures observed

For PR head `0eb846eef325acde72372010fcc0c6acf697616e`, the failing workflows were:

- `Format pull request`
- `CI`
- `Validate ResearchOps`
- `Worker CI`
- `Release Gate`

The first concrete failures were formatting and route-state drift:

- `src/styles/outcomes.scss` needed Prettier formatting.
- `tests/impact-records-d1-runtime.test.js` needed Prettier formatting.
- `tests/govuk-frontend-integration-route-state.test.js` still asserted the old build chain and did not include generated outcomes CSS handling.
- Generated ResearchOps CSS drifted after Sass generation.

Later Release Gate artifacts exposed additional route-state and test-contract drift:

- `tests/projects-page-route-state.test.js` still expected the old top-level `build:projects` chain.
- `tests/deploy-asset-paths.test.js` still expected compressed preview CSS rather than formatted generated CSS.
- `scripts/validate.sh` still expected `generated-css:check` to include the clean-tree assertion after the generated-CSS script split.

## User correction applied

The user clarified that generated `.css` files must not be edited directly by the agent. The required workflow is:

1. Sass `.scss` generates consumer-facing `.css`.
2. The generated CSS is formatted to the repository stylesheet convention.
3. The generated CSS is automatically committed to the branch.
4. PR checks test the generated CSS conformance.

The earlier direct `public/css/outcomes.css` write attempt did not become the PR head. No subsequent direct CSS file edit was made by the agent.

## Files changed

Source and test formatting:

- `src/styles/outcomes.scss`
- `tests/impact-records-d1-runtime.test.js`
- `tests/deploy-asset-paths.test.js`

Generated CSS tooling:

- `scripts/styles/generated-css-targets.mjs`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/format-generated-css.mjs`
- `scripts/styles/assert-generated-css-clean.mjs`

Repository scripts and checks:

- `package.json`
- `.prettierignore`
- `scripts/validate.sh`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/outcomes-page-route-state.test.js`
- `tests/projects-page-route-state.test.js`

Workflow automation:

- `.github/workflows/format-pr.yml`

## Implementation decisions

### Generated CSS manifest

A manifest was added for ResearchOps-owned generated CSS targets:

- `src/styles/researchops-home.scss` → `assets/researchops/researchops-home.css`
- `src/styles/researchops-home.scss` → `public/assets/researchops/researchops-home.css`
- `src/styles/projects.scss` → `public/css/projects.css`
- `src/styles/project-dashboard.scss` → `public/css/project-dashboard.css`
- `src/styles/outcomes.scss` → `public/css/outcomes.css`

Vendor, minified and legacy static CSS were not added to that manifest.

### Build chain

`npm run build` now runs:

```sh
npm run build:govuk && npm run build:generated-css && npm run build:govuk-pages
```

`build:generated-css` compiles the ResearchOps-owned Sass targets, then formats the generated CSS outputs.

### Generated CSS conformance

`npm run lint` now builds and formats generated CSS in the CI workspace before running formatting and ESLint checks. `npm run format:check` runs stock Prettier for repository files and then runs the generated CSS conformance check. Generated ResearchOps CSS is ignored by stock Prettier and checked by `scripts/styles/format-generated-css.mjs` because the repository CSS convention uses indented closing braces that stock Prettier does not emit.

### Clean generated artefact gate

The clean-tree assertion was split into a separate script:

```sh
npm run generated-css:clean
```

This keeps the clean generated-artifact gate available for the formatter workflow and local release checks without making ordinary CI fail before the branch formatter has had a chance to regenerate CSS in the workspace.

### Formatter workflow

`.github/workflows/format-pr.yml` now runs the generated CSS build and format step, then commits the generated CSS paths back to the relevant same-repository work branch when generated CSS changes exist. It is guarded so `pull_request_target` does not run untrusted fork code.

## Validation status

Validated through GitHub Actions observation only. Local validation was not available in this connector session.

For PR head `bc33cc7531a4487cc6d41eede6be7ce4c6850e18`, all observed PR-triggered checks completed successfully:

- `CI`
- `Validate ResearchOps`
- `Worker CI`
- `Release Gate`
- `Accessibility audit (pa11y-ci)`
- `qa-bdd`
- `QA — Broken links (Lychee)`
- `Build and deploy agent documentation Pages`
- `Bundle version consistency`
- `Render GOV.UK pages`

## Residual risk

The PR-triggered validation suite is green at head `bc33cc7531a4487cc6d41eede6be7ce4c6850e18`. The remaining operational risk is that the branch formatter workflow runs partly outside the pull-request workflow listing used by the connector, so its push-triggered generated-CSS commit behaviour should still be monitored on future branches that change Sass sources.
