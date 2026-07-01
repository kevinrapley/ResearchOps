# Study Synthesis Step Output Polish

## Run Metadata

- Date: 2026-07-01
- Branch: `feature/res-9-source-linked-candidate-drafting`
- Trace decision: required because the branch starts with `feature/`
- Task summary: refine the study synthesis page so the stepped regions use an equal two-column layout, retain sticky controls, align evidence checkboxes and text, tighten output spacing, reduce created theme heading/action text size, and clean the four LEDS evidence source labels.

## Operating Model

Loaded repository operating-model sources:

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

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`: no Worker runtime or deployment behaviour was changed.
- `openai-platform`: no OpenAI API behaviour was changed.
- `mcp-agent-tooling`: no MCP tooling was changed.
- `airtable-public-api`: no Airtable API code or schema was changed.
- `mural-public-api`: no Mural API code or schema was changed.

Precedence decision:

- GOV.UK Design System rules governed the checkbox geometry, component styling and form layout.
- ResearchOps developer controls governed Sass ownership and generated CSS handling.
- GitHub Diamond governed trace and validation evidence.

## Files Changed

- `src/govuk/templates/pages/study-synthesis.njk`
- `src/styles/synthesize.scss`
- `scripts/styles/generated-css-targets.mjs`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `public/js/synthesize-page.js`
- `tests/synthesize-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-step-output-polish.md`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-step-output-polish.json`

## Implementation Notes

- Added explicit `synthesis-step-layout`, `synthesis-step-controls` and `synthesis-step-output` regions for the cluster, evidence and theme steps.
- Created `src/styles/synthesize.scss` as the source for `public/css/synthesize.css` and registered it in the generated CSS targets.
- Restored sticky positioning for the left-hand controls on desktop.
- Kept columns equal width with `minmax(0, 1fr) minmax(0, 1fr)`.
- Reduced output text, created theme headings and `Submit to repository` links to 16px.
- Tightened the created working groups heading-to-list spacing.
- Preserved GOV.UK checkbox pseudo-element defaults and fixed the evidence card flex layout so evidence note text aligns beside the checkbox.
- Normalised the four LEDS source labels in the page controller:
  - `Force intelligence interview 1` to `Force intelligence interview`
  - `Service operator interview 2` to `Service operator interview`
  - `Data assurance session 3` to `Data assurance session`
  - `Policy and product review 4` to `Policy and product review`

## Validation

Commands run:

- `node scripts/styles/build-generated-css.mjs public/css/synthesize.css`
- `npm run build:govuk-pages`
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`
- `npm run generated-css:check`

Results:

- Focused route-state tests passed.
- Generated CSS formatting check passed.
- Local Playwright visual check passed with mocked LEDS synthesis data.

Visual verification evidence:

- Desktop viewport: 1280 by 900.
- Mobile viewport: 390 by 844.
- Evidence step desktop measurements:
  - left controls width: 495px
  - right output width: 495px
  - left controls position: `sticky`
  - output font size: `16px`
  - theme card title font size: `16px`
  - theme card action font size: `16px`
  - first evidence checkbox: 44px by 44px
  - first evidence source label started on the same row as the checkbox
  - no horizontal overflow
- Mobile measurements:
  - single-column stack
  - output font size: `16px`
  - no horizontal overflow

## Residual Risk

- The local static preview used mocked API responses for the LEDS study because the static file server does not serve Worker API endpoints. The browser check exercised the changed static HTML, CSS and client controller assets.
