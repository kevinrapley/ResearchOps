# Study synthesis Sass-generated stylesheet

Date: 2026-07-01
Branch: `feature/res-9-source-linked-candidate-drafting`

## Task

Move `public/css/synthesize.css` under the generated Sass pipeline and apply the requested stepped-layout refinements: smaller output text, equal-width columns and evidence checkboxes visibly to the left of evidence notes.

## Trace decision

The active branch prefix `feature/` requires an auditable trace for repository-affecting work.

## Operating model

Loaded:

- `AGENTS.md`
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

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`: no Worker, binding, runtime or deployment implementation changed.
- `openai-platform`: no OpenAI API integration changed.
- `mcp-agent-tooling`: no MCP tooling changed.
- `airtable-public-api`: no Airtable API implementation changed.
- `mural-public-api`: no Mural API implementation changed.

## Files modified

- `src/styles/synthesize.scss`
- `public/css/synthesize.css`
- `scripts/styles/generated-css-targets.mjs`
- `src/govuk/templates/pages/study-synthesis.njk`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-sass-generated-stylesheet.md`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-sass-generated-stylesheet.json`

## Work done

- Added `src/styles/synthesize.scss` as the source of truth for the synthesis route stylesheet.
- Registered `src/styles/synthesize.scss` to generate `public/css/synthesize.css`.
- Regenerated `public/css/synthesize.css` through `node scripts/styles/build-generated-css.mjs public/css/synthesize.css`.
- Scoped output-column text to 16px.
- Changed desktop stepped regions to equal-width columns.
- Kept GOV.UK checkbox structure with the visible checkbox box to the left of evidence note text.
- Updated route-state tests to assert the Sass source and generated CSS target registration.

## Validation

- `node scripts/styles/build-generated-css.mjs public/css/synthesize.css`: passed.
- `npm run generated-css:check`: passed.
- `npm run build:govuk-pages`: passed.
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- Playwright desktop check at `1366x900`: passed. All stepped regions had equal-width columns, output text computed at 16px, and evidence note text remained to the right of the visible checkbox box.
- Playwright mobile check at `390x844`: passed. Stepped regions stacked with no horizontal overflow.

## Note

`npm run generated-css:clean` reports a diff while this branch intentionally contains uncommitted generated CSS changes. This is expected until the generated stylesheet changes are committed.
