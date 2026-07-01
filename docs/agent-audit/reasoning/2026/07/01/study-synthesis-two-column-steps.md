# Study synthesis two-column stepped regions

Date: 2026-07-01
Branch: `feature/res-9-source-linked-candidate-drafting`

## Task

Update the Study synthesis page so each stepped region uses a two-column layout on larger screens, with form controls on the left and created or selectable content on the right.

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

## Files read

- `src/govuk/templates/pages/study-synthesis.njk`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `.agent-operating-model/bundles/govuk-design-system/references/govuk-form-affordance-reference.xml`

## Files modified

- `src/govuk/templates/pages/study-synthesis.njk`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-two-column-steps.md`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-two-column-steps.json`

## Work done

- Wrapped each stepped region in a `synthesis-step-layout` container.
- Added `synthesis-step-controls` for the form or selection controls on the left.
- Added `synthesis-step-output` for created working groups, evidence notes and created themes on the right.
- Added responsive CSS so the layout becomes two columns from the GOV.UK desktop breakpoint and remains stacked on mobile.
- Updated the synthesis stylesheet cache key.
- Regenerated the static GOV.UK page.
- Updated route-state tests to assert the new layout classes.

## Validation

- `npm run build:govuk-pages`: passed.
- `npx prettier -w public/css/synthesize.css tests/synthesize-page-route-state.test.js`: passed.
- `npx prettier -w public/pages/study/synthesis/index.html`: passed.
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- Playwright desktop check at `1366x900`: passed. All three stepped regions rendered as two columns with controls on the left and outputs on the right.
- Playwright mobile check at `390x844`: passed. All three stepped regions stacked into one column with no horizontal overflow.
- Playwright interaction check: passed. Selecting evidence and a target group enabled `Add selected evidence`.

## Residual risk

The visible local site is served from `/Users/kevin.rapley/ResearchOps`, which is separate from the Codex thread worktree path in the thread context. Existing unrelated dirty files in the served checkout were left unchanged.
