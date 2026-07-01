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
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
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
- Added a route-scoped select chevron background so the down arrow is centred vertically and inset from the right edge instead of relying on native browser arrow placement.
- Added route-state assertions for the macro, title, exact step text, status hooks, anchors, controller count logic and absence of old select overrides.
- Regenerated the committed static synthesis page.

## Validation

Commands run:

- `npm run build:govuk-pages`
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-pages-render-workflow-state.test.js`
- `npm run build:generated-css`
- `npm run generated-css:check`
- Playwright browser check against `https://research-operations/pages/study/synthesis/?id=recLEDSOpsNeeds01&project=recLEDSResearch01#themes-section`

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
  - screenshot crop at `/tmp/synthesis-select-arrow.png` showed the down arrow centred inside the select

## Residual Risk

- The browser check was run against the local `research-operations` HTTPS server, which is backed by `/Users/kevin.rapley/ResearchOps/public`; the same changes are present in this fix branch and were mirrored to that served checkout for immediate review.
