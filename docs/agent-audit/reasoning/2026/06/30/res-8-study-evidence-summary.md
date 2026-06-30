# RES-8 Study readiness and evidence state summary trace

Date: 2026-06-30
Branch: `feature/res-8-study-evidence-summary`
Trace requirement: required because the branch uses the `feature/` prefix.

## Task

Resolve RES-8: add a Study readiness and evidence state summary to the ResearchOps Study page, grounded in existing readiness and synthesis data.

## Operating model

Operating-model files loaded:

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

- `github-diamond` — `.agent-operating-model/bundles/github/`
- `researchops-developer-control` — `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` — `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` — `.agent-operating-model/bundles/govuk-design-system/`

Skipped conditional bundles:

- `cloudflare` — no Worker, routing, binding or deployment implementation changed.
- `openai-platform` — no OpenAI API integration changed.
- `mcp-agent-tooling` — no MCP tooling changed.
- `airtable-public-api` — no Airtable API implementation changed.
- `mural-public-api` — no Mural API implementation changed.

Precedence decisions:

- GitHub Diamond governed branch, trace, mutation and validation discipline.
- ResearchOps Developer Control governed existing route and study-page conventions.
- Multi-Functional Team governed public-sector research readiness and evidence-risk framing.
- GOV.UK Design System governed page structure, summary-list/task-list markup and responsive layout.

## Files read

- Source cron output: `/Users/kevin.rapley/.hermes/cron/output/57515db15702/2026-06-30_19-36-33.md`
- Dispatch state: `/Users/kevin.rapley/.local/share/claude-code-os/dispatch-chats.json`
- `README.md`
- `package.json`
- `src/govuk/templates/pages/study.njk`
- `public/js/study-page.js`
- `src/styles/study-page.scss`
- `tests/study-page-route-state.test.js`
- `visual-walkthrough.synthesis-fixtures.mjs`
- Existing audit trace examples under `docs/agent-audit/reasoning/2026/06/`

## Implementation

- Added an “Evidence state summary” GOV.UK summary-list panel to the Study page aside.
- Added static fallback copy for evidence note count, synthesis state and next action while the route hydrates.
- Extended the Study page controller to load:
  - `/api/synthesis/evidence?study=<studyId>` for captured evidence notes.
  - `/api/synthesis?study=<studyId>` for clusters and themes.
- Added an evidence-state view model that maps study evidence into these user-facing states:
  - No evidence captured.
  - Evidence captured.
  - Clusters drafted.
  - Themes available.
- Wired the Study analysis task status and hint to the evidence state so “Synthesise study evidence” reflects whether evidence is unavailable, available, needs action or ready.
- Added small GOV.UK summary-list styling for the evidence summary key column.
- Regenerated generated CSS and the committed static Study page.
- Extended the route-state regression test to cover the new markup, controller hooks, synthesis API loading and CSS hooks.

## Files modified

- `src/govuk/templates/pages/study.njk`
- `public/js/study-page.js`
- `src/styles/study-page.scss`
- `public/css/study-page.css`
- `public/pages/study/index.html`
- `tests/study-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/30/res-8-study-evidence-summary.md`
- `docs/agent-audit/reasoning/2026/06/30/res-8-study-evidence-summary.json`

## Validation

Passed:

- `npm run build:generated-css && npm run build:govuk-pages`
- `npm test -- tests/study-page-route-state.test.js`
- `npx prettier -c public/js/study-page.js src/styles/study-page.scss tests/study-page-route-state.test.js public/pages/study/index.html public/css/study-page.css`
- `npx eslint public/js/study-page.js tests/study-page-route-state.test.js` — passed with pre-existing console warnings in `public/js/study-page.js`.
- Playwright desktop check against `http://127.0.0.1:4173/pages/study/?id=recVisualStudy001&project=recVisualProject001` with mocked API routes: evidence summary rendered 2 evidence notes, 1 cluster, 1 theme, and the synthesis task status became `Ready`.
- Playwright mobile check at 390px: evidence summary rendered at 360px wide with no horizontal scrolling.
- Playwright empty-evidence check: next action rendered “Capture session evidence before starting synthesis.”
- `npm test` — full test suite passed: 257 tests, 257 pass.
- `npm run generated-css:check`
- `git diff --check`

Not fully passed:

- `npm run lint` failed at repository-wide `prettier -c .` because the untracked `skills/github/github-diamond-standard/references/upstream-bundle/` tree contains 113 pre-existing format warnings. Focused Prettier and ESLint checks on the changed files passed.

## Residual risks

- The Linear web page required login, so RES-8 detail was inferred from the local Dispatch chat, cron evidence and existing Study page implementation rather than direct Linear API content.
- The evidence summary uses the existing synthesis endpoints and degrades to empty arrays if those calls fail; it does not introduce a new backend readiness API.
