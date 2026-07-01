# Study Synthesis Remove Back To Study

## Run Metadata

- Date: 2026-07-01
- Branch: `feature/res-9-source-linked-candidate-drafting`
- Trace decision: required because the branch starts with `feature/`
- Task summary: remove the `Back to study` button from the study synthesis page served at `https://research-operations/pages/study/synthesis/`.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/selection-rules.json`

Selected bundles:

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

## Files Changed

- `src/govuk/templates/pages/study-synthesis.njk`
- `src/styles/synthesize.scss`
- `public/js/synthesize-page.js`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`

## Validation

Commands run:

- `node scripts/styles/build-generated-css.mjs public/css/synthesize.css`
- `npm run build:govuk-pages`
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `npm run generated-css:check`

Results:

- Focused tests passed.
- Generated CSS check passed.
- `https://research-operations/pages/study/synthesis/` no longer contains `Back to study`, `back-to-study` or `synthesis-hero__actions`.
