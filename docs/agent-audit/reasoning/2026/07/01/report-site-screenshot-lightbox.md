# Report site screenshot lightbox

Date: 2026-07-01
Branch: `fix/report-site-screenshot-lightbox`

## Task

Crop every screenshot preview in the reporting site to the same visible height of 665px and open the full screenshot in a scrollable modal lightbox when selected.

## Trace decision

The active branch prefix `fix/` requires an auditable trace for repository-affecting work.

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

- `cloudflare`: no Worker, Pages deployment, binding or runtime configuration changed.
- `openai-platform`: no OpenAI API integration changed.
- `mcp-agent-tooling`: no MCP tooling changed.
- `airtable-public-api`: no Airtable API implementation changed.
- `mural-public-api`: no Mural API implementation changed.

## Files modified

- `scripts/render-reporting-review-site.mjs`
- `scripts/visual-walkthrough.mjs`
- `reports-site/index.html`
- `tests/reporting-review-generation-model.test.js`
- `docs/agent-audit/reasoning/2026/07/01/report-site-screenshot-lightbox.md`
- `docs/agent-audit/reasoning/2026/07/01/report-site-screenshot-lightbox.json`

## Work done

- Set screenshot preview images to a consistent visible 665px height using top-aligned object-fit cropping.
- Wrapped screenshots in lightbox links while keeping the existing image paths for direct fallback.
- Added a modal dialog with a scrollable image body, close button, Escape handling and focus restoration.
- Applied the same behavior to both the reporting review renderer and the raw visual walkthrough renderer.
- Regenerated the committed `reports-site/index.html` artefact.
- Added a renderer test covering the crop CSS, lightbox markup and click/Escape behavior.

## Validation

- `node --test tests/reporting-review-generation-model.test.js tests/reports-site-validation.test.js tests/reporting-site-deploy-route-state.test.js`: passed.
- `node scripts/validate-reports-site.mjs`: passed, validating 46 pages, 81 states and 162 captures.
- Playwright browser check: passed. First screenshot preview rendered at exactly 665px, the lightbox opened, full image was taller than the modal body and the body used `overflow: auto`.
- `npm run lint -- --quiet`: passed with existing ESLint-env deprecation warnings only.
- `npm run validate`: passed.

## Residual risk

The modal is intentionally small and static. It provides keyboard close and focus return, but it does not implement a full focus trap because this report is a static review artefact rather than the primary service application.
