# Study synthesis GOV.UK select styling fix

Date: 2026-07-01
Branch: `feature/res-9-source-linked-candidate-drafting`

## Task

Fix the Study synthesis page at `/pages/study/synthesis/?id=recLEDSOpsNeeds01&project=recLEDSResearch01` so its dropdown lists use the correct GOV.UK Frontend select styling.

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
- `public/pages/study/synthesis/index.html`
- `public/css/synthesize.css`
- `public/css/govuk/govuk-forms.css`
- `public/assets/govuk/govuk-frontend.css`
- `tests/synthesize-page-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`

## Files modified

- `src/govuk/templates/pages/study-synthesis.njk`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-govuk-select-styling-fix.md`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-govuk-select-styling-fix.json`

## Work done

- Removed the legacy `/css/govuk/govuk-forms.css` include from the Study synthesis page, because the shared layout already loads full `/assets/govuk/govuk-frontend.css`.
- Removed the page-specific `.govuk-select:disabled` override from `public/css/synthesize.css` so GOV.UK Frontend owns select disabled styling.
- Updated the synthesis page stylesheet cache key.
- Regenerated `public/pages/study/synthesis/index.html`.
- Updated route-state tests to exclude the legacy form stylesheet on the synthesis route and prevent reintroducing the page-specific select disabled override.

## Validation

- `npm run build:govuk-pages`: passed.
- `npx prettier -w public/css/synthesize.css public/pages/study/synthesis/index.html tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- Playwright check against `https://research-operations/pages/study/synthesis/?id=recLEDSOpsNeeds01&project=recLEDSResearch01`: passed. The page loads `/assets/govuk/govuk-frontend.css`, does not load `/css/govuk/govuk-forms.css`, and both dropdowns compute as GOV.UK selects with 40px height, 2px black border, GDS Transport font, white background and no horizontal overflow.

## Residual risk

The visible local site is served from `/Users/kevin.rapley/ResearchOps`, which is separate from the Codex thread worktree path in the thread context. This change was made in the served checkout so the URL reported by the user changes immediately.
