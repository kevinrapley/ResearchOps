# Agent trace — Journal co-occurrence table and chart

**Date:** 2026-06-12  
**Trace type:** operational audit trace  
**Branch:** `feature/journal-cooccurrence-chart`  
**Related work:** Reflexive Journals — code co-occurrence display

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation run and residual risk.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/precedence-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

Selection rationale:

- GitHub governance is in scope because this task creates a feature branch and PR.
- ResearchOps Developer Control is in scope because this changes the ResearchOps journal analysis UI.
- Multi-functional Team is in scope because this is a user-facing public-sector research operations journey.
- GOV.UK Design System is in scope because the table and view switch use GOV.UK Frontend component classes.
- Cloudflare is in scope because the deployed surface is Cloudflare Pages and the chart submodule is part of the repository shipped through the Pages workflow.

## Task summary

Improve the code co-occurrence output in Reflexive Journal and Analysis so researchers can inspect the same co-occurrence weights as either a GOV.UK Frontend table or a chart-style ranked view.

Update the ONS Charts submodule to the requested working commit and select the most suitable chart pattern for code-pair weights.

## Implementation summary

- Updated the `charts` submodule from `9455c5525bf545411834c271375a77115b759813` to `758806bcfd61d7c00f18c0c357294e746f1974d6`.
- Selected the ONS `bar-chart` template as the best fit because code co-occurrence data is ranked categorical name/value data and long code-pair labels need horizontal space.
- Replaced the plain co-occurrence table with GOV.UK Frontend table markup.
- Added a GOV.UK radio control that lets the researcher switch between table and chart views without changing the underlying data.
- Rendered the chart view from the strongest 20 co-occurring code pairs using the same name/value shape as the ONS bar chart and the ONS `oceanBlue` palette colour.
- Added route-state coverage for the GOV.UK table classes, ONS chart selection, submodule commit and display switch hooks.
- CI follow-up: changed the submodule assertion to read the parent repository gitlink instead of reading files inside `charts`, because GitHub Actions checks out this repository with `submodules: false` for the failing unit-test jobs.

## Files changed

- `charts`
- `public/js/caqdas-interface.js`
- `tests/journal-cooccurrence-display-route-state.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/12/journal-cooccurrence-chart.md`
- `docs/agent-audit/reasoning/2026/06/12/journal-cooccurrence-chart.json`

## Validation run

```bash
node --test tests/journal-cooccurrence-display-route-state.test.js tests/journal-secondary-actions-route-state.test.js tests/analysis-d1-cooccurrence-runtime.test.js
npm run format:check
npm test
npm run lint
npm run agent:model:validate
npm run agent:bundles:validate
```

CI follow-up after failed PR checks:

```bash
node --test tests/journal-cooccurrence-display-route-state.test.js tests/journal-secondary-actions-route-state.test.js tests/analysis-d1-cooccurrence-runtime.test.js
npm run format:check
npm test
npm run validate
npm run lint
```

Validation results:

- Focused co-occurrence tests passed: 5 tests.
- Full test suite passed: 213 tests.
- Format check passed.
- Lint passed with the repository's existing warning set: 0 errors, 260 warnings.
- Operating model validation passed.
- Bundle registry validation passed.
- CI follow-up validation passed after the test was made submodule-checkout independent.

## Browser verification limitation

An additional browser automation check was attempted against a local static server with a stubbed co-occurrence API response.

It could not complete because the Playwright Chromium binary is not installed in the local browser cache, and the available Microsoft Edge app aborts when launched headlessly in this sandbox. The automated route-state tests cover the rendered GOV.UK table markup, selected ONS chart template evidence and view-switch hooks.

## Residual risk

The ONS Charts submodule files are not currently served directly from `public/`, so this PR selects and mirrors the ONS `bar-chart` data pattern locally rather than embedding the submodule example page. A future asset-pipeline change could expose chart templates directly if the product needs full upstream ONS chart runtime embedding.

GitHub Actions does not check out submodule working trees for the unit-test jobs, so tests must verify the `charts` gitlink in the parent repository rather than reading files inside the submodule.
