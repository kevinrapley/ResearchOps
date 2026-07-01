# Report multi-step screenshot ratio

Date: 2026-07-01
Branch: `fix/report-multistep-screenshot-ratio`

## Task

Update report-site screenshots inside multi-flow process pages so each image fills its state-card column and crops to the same landscape ratio as the wider report thumbnails.

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
- `/Users/kevin.rapley/.hermes/skills/github/github-diamond-standard/SKILL.md`

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
- `docs/agent-audit/reasoning/2026/07/01/report-multistep-screenshot-ratio.md`
- `docs/agent-audit/reasoning/2026/07/01/report-multistep-screenshot-ratio.json`

## Work done

- Added a multi-step-only screenshot thumbnail rule.
- Kept ordinary screenshots on the existing 665px crop.
- Set multi-step screenshot links to a `3 / 2` aspect ratio with hidden overflow.
- Set multi-step images to fill that crop box at the state-card column width.
- Applied the same rule to the source visual walkthrough renderer.
- Regenerated the committed `reports-site/index.html` artefact.
- Added renderer coverage for the multi-step crop rule.

## Validation

- `node --test tests/reporting-review-generation-model.test.js tests/reports-site-validation.test.js tests/reporting-site-deploy-route-state.test.js`: passed.
- `node scripts/validate-reports-site.mjs`: passed, validating 46 pages, 81 states and 162 captures.
- Playwright browser measurement: passed. Ordinary thumbnails remained 665px high; the first multi-step thumbnail rendered 353px wide by 235px high with a 1.5 ratio and filled its crop link.
- `npm run lint -- --quiet`: passed with existing ESLint-env deprecation warnings only.
- `npm run validate`: passed.

## Residual risk

The multi-step crop ratio is intentionally fixed at `3 / 2` to match the landscape feel of the wider report thumbnails. It crops vertical full-page screenshots more aggressively, but the full image remains available in the lightbox.
