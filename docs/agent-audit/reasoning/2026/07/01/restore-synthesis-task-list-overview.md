# Restore Synthesis Task List Overview

## Run Metadata

- Date: 2026-07-01
- Branch: `fix/restore-synthesis-task-list-overview`
- Trace decision: required because the branch starts with `fix/`
- Task summary: restore the missing GOV.UK task-list overview titled `How synthesis works`, make its status column reflect synthesis counts and restore GOV.UK select styling including the select arrow placement.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`: no Worker or Cloudflare runtime behaviour changed.
- `openai-platform`: no OpenAI API behaviour changed.
- `mcp-agent-tooling`: no MCP behaviour changed.
- `airtable-public-api`: no Airtable API behaviour changed.
- `mural-public-api`: no Mural API behaviour changed.

Precedence decision:

- GOV.UK Design System governed use of the GOV.UK task-list component.
- ResearchOps developer controls governed the Nunjucks template and generated static HTML update.
- GitHub Diamond governed the fix branch, trace and validation evidence.

## Issue

`docs/agent-audit/reasoning/2026/07/01/study-synthesis-flow-clarity.md` recorded that a GOV.UK task-list overview titled `How synthesis works` had been added. The committed template and generated HTML on `main` did not contain that task list, and the route-state test did not assert it. The overview therefore dropped before commit rather than being removed by the final merge.

## Files Changed

- `src/govuk/templates/pages/study-synthesis.njk`
- `src/styles/govuk.scss`
- `public/pages/study/synthesis/index.html`
- `public/assets/govuk/govuk-frontend.css`
- `public/css/govuk/govuk-forms.css`
- `src/styles/synthesize.scss`
- `public/css/synthesize.css`
- `public/js/synthesize-page.js`
- `public/js/synthesis-route-loader.js`
- `tests/synthesize-page-route-state.test.js`
- `tests/study-child-route-state.test.js`
- `tests/govuk-design-system-baseline-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/restore-synthesis-task-list-overview.md`
- `docs/agent-audit/reasoning/2026/07/01/restore-synthesis-task-list-overview.json`

## Implementation Notes

- Imported the GOV.UK task-list macro in the study synthesis template.
- Added a `How synthesis works` section before the stepped synthesis panels inside the evidence-enabled workspace.
- Made the sequence explicit:
  - `Step 1: Create working groups`
  - `Step 2: Add evidence to a group`
  - `Step 3: Create themes from grouped evidence`
- Linked each task-list item to its corresponding step region.
- Added status spans that the page controller updates from loaded synthesis state.
- Added controller logic so the status column shows `2 working groups`, `4 evidence notes` and `2 themes` for the seeded LEDS study, with blocker text when earlier steps have not been completed.
- Removed the old `/css/govuk/govuk-forms.css` include from the synthesis page so it no longer overrides GOV.UK Frontend select styling.
- Removed the route-level `.govuk-select:disabled` override from `synthesize.scss`.
- Added the select chevron background to the shared GOV.UK stylesheet source in `src/styles/govuk.scss`, regenerated `public/assets/govuk/govuk-frontend.css`, and mirrored the same fix into legacy `public/css/govuk/govuk-forms.css` so the down arrow is centred vertically and inset from the right edge site-wide.
- Kept synthesis-specific CSS free of `.govuk-select` arrow ownership.
- Set evidence cards to `padding: 15px 15px 20px 15px`, made wrapped synthesis tag spacing explicit with `row-gap: 5px` and `column-gap: 5px`, and neutralised the GOV.UK tag component's negative vertical margins for `.synthesis-tag` so the visible row gap is actually 5px.
- Handled Codex review thread `PRRT_kwDOP3Td2M6Nc8Wb` as valid: the route loader still imported `synthesize-page.js` with the earlier `study-synthesis-20260701-codex-comment-fixes` key, so cached controllers could miss task-list status logic.
- Handled Codex review thread `PRRT_kwDOP3Td2M6Nc8We` as valid: the synthesis page still linked `synthesize.css` with the earlier `study-synthesis-20260701-step-output-polish` key, so cached styles could miss the latest spacing and select fixes.
- Added `+1` reactions to both valid Codex comments before remediation.
- Bumped the synthesis script and stylesheet cache keys to `study-synthesis-20260701-cache-refresh` in the Nunjucks template, generated HTML, route loader and route-state tests.
- Added route-state assertions for the macro, title, exact step text, status hooks, anchors, controller count logic, shared GOV.UK select styling and absence of old synthesis select overrides.
- Regenerated the committed static synthesis page.

## Validation

Commands run:

- `npm run build:govuk-pages`
- `npm run build:govuk`
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-pages-render-workflow-state.test.js`
- `npm run build:generated-css`
- `npm run generated-css:check`
- `npm test -- tests/synthesize-page-route-state.test.js`
- `npm test -- tests/synthesize-page-route-state.test.js tests/study-child-route-state.test.js tests/govuk-pages-render-workflow-state.test.js`
- `npm test -- tests/govuk-design-system-baseline-route-state.test.js tests/synthesize-page-route-state.test.js tests/govuk-pages-render-workflow-state.test.js`
- Playwright browser check against `https://research-operations/pages/study/synthesis/?id=recLEDSOpsNeeds01&project=recLEDSResearch01#themes-section`
- Playwright browser check against `https://research-operations/pages/study/synthesis/?id=recLEDSOpsNeeds01&project=recLEDSResearch01#evidence-section`

Results:

- GOV.UK page rendering passed.
- Focused route-state tests passed.
- Generated CSS formatting passed.
- Browser verification showed:
  - `Step 1: Create working groups 2 working groups`
  - `Step 2: Add evidence to a group 4 evidence notes`
  - `Step 3: Create themes from grouped evidence 2 themes`
  - old `/css/govuk/govuk-forms.css` was not loaded
  - both synthesis selects retained `govuk-select govuk-!-width-two-thirds`, 2px black borders, white backgrounds, 40px height and 19px text
  - select arrow CSS used `appearance: none`, `background-position: calc(100% - 10px) 50%`, `background-size: 20px 20px` and `padding-right: 40px`
  - screenshot at `/tmp/synthesis-select-arrow-sitewide.png` showed the down arrow centred inside the select
  - evidence cards computed to `15px 15px 20px 15px` padding
  - initial screenshot crop at `/tmp/synthesis-evidence-card-tags.png` did not show reliable visible separation because GOV.UK tag margins still collapsed the apparent row gap
  - corrected screenshot crop at `/tmp/synthesis-evidence-card-tags-fixed.png` showed the stacked tags separated
  - synthesis tags computed to `row-gap: 5px`, `column-gap: 5px`, `margin-top: 0` and `margin-bottom: 0`; Playwright measured the visual row gap between tag rows as `5`

## Residual Risk

- The browser check was run against the local `research-operations` HTTPS server, which is backed by `/Users/kevin.rapley/ResearchOps/public`; the same changes are present in this fix branch and were mirrored to that served checkout for immediate review.
