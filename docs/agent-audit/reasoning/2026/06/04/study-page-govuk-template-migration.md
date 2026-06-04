# Agent trace — Study page GOV.UK template migration

**Date:** 2026-06-04  
**Branch:** `feature/study-govuk-clean`  
**Trace type:** operational audit trace  
**Task:** Migrate `/pages/study/?id=REC…` to a GOV.UK Frontend Nunjucks template using Option A.

## Evidence boundary

This trace records observable repository files, tool actions, implementation decisions, validation status and residual risk. It does not expose private chain-of-thought.

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
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml`
- `docs/design-system/govuk-form-migration.md`

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Cloudflare was not selected because this work changes a static route template, route stylesheet source, browser route-state controller and generated output only. It does not change Worker runtime, deployment routing, bindings, D1, KV or Wrangler configuration.

## Files inspected

- `public/pages/study/index.html`
- `public/css/study-page.css`
- `public/js/study-page.js`
- `public/pages/study/study-desc-controller.js`
- `tests/study-page-route-state.test.js`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `.github/workflows/format-pr.yml`
- `.prettierignore`

## Implementation decisions

### GOV.UK template migration

The study page is moved to `src/govuk/templates/pages/study.njk` and registered in `scripts/govuk/render-govuk-pages.mjs` with output `public/pages/study/index.html`.

The template uses GOV.UK macros for breadcrumbs, buttons, notification banner, summary list, task lists, textarea and details. Study readiness and task sections use `govukTaskList`. Study facts use `govukSummaryList`.

### SCSS source of truth

`src/styles/study-page.scss` is the route stylesheet source. It is registered in `scripts/styles/generated-css-targets.mjs` with output `public/css/study-page.css`.

`public/css/study-page.css` is treated as generated output and is added to the generated CSS workflow commit path and Prettier ignore list.

### Route-state preservation

The controller preserves the canonical `/pages/study/?id=REC…` route and legacy `pid`/`sid` session route behaviour.

The readiness controller now hydrates task-list status and hint IDs such as `study-readiness-description-status` and `study-readiness-description-hint`, rather than removed custom readiness card classes.

### Codex review items

The PR addressed Codex review comments by:

- adding an explicit empty `value` to the GOV.UK textarea macro;
- preserving literal generated CSS target output strings while adding the study target;
- keeping the study readiness markup wired to the controller through explicit status and hint IDs.

## Files modified

- `.github/workflows/format-pr.yml`
- `.prettierignore`
- `public/css/study-page.css`
- `public/js/study-page.js`
- `public/pages/study/index.html`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `src/govuk/templates/pages/study.njk`
- `src/styles/study-page.scss`
- `tests/study-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/04/study-page-govuk-template-migration.md`
- `docs/agent-audit/reasoning/2026/06/04/study-page-govuk-template-migration.json`

`public/css/study-page.css` and `public/pages/study/index.html` are generated artefacts. They are included because the repository commits generated static outputs.

## Validation status

Connector verification completed:

- Confirmed PR #345 is open and mergeable.
- Confirmed the remaining Codex review thread was resolved after restoring literal generated CSS target paths.
- Confirmed `src/govuk/templates/pages/study.njk` includes GOV.UK macros and an explicit textarea value.
- Confirmed `public/js/study-page.js` targets the new GOV.UK task-list readiness IDs.
- Confirmed `scripts/styles/generated-css-targets.mjs` registers `src/styles/study-page.scss` to generate `public/css/study-page.css`.

Required CI and local follow-up checks:

```sh
npm run build:generated-css
npm run build:govuk-pages
node --test tests/study-page-route-state.test.js
npm test
npm run validate
```

## Residual risk

The PR should not be considered fully validated until normal PR checks complete on the latest branch head.
