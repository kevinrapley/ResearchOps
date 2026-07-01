# Study synthesis flow clarity

Date: 2026-07-01
Branch: `feature/res-9-source-linked-candidate-drafting`

## Task

Amend the Study synthesis page after critical evaluation so the flow between working groups, evidence and themes is tacitly obvious to users.

## Trace decision

The active branch prefix `feature/` requires an auditable trace for repository-affecting work.

## Operating model

Loaded:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
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
- `public/js/synthesize-page.js`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `node_modules/govuk-frontend/dist/govuk/components/task-list/macro.njk`
- `node_modules/govuk-frontend/dist/govuk/components/task-list/template.njk`

## Files modified

- `src/govuk/templates/pages/study-synthesis.njk`
- `public/js/synthesize-page.js`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-flow-clarity.md`
- `docs/agent-audit/reasoning/2026/07/01/study-synthesis-flow-clarity.json`

## Work done

- Added a GOV.UK task-list overview titled `How synthesis works` above the workspace.
- Added three explicit steps: create working groups, add evidence to a group, and create themes from grouped evidence.
- Wired the overview statuses to existing synthesis state so users see counts such as groups, grouped evidence notes and themes.
- Renamed section headings and labels to action-led language.
- Added output subheadings for created groups, evidence notes to group and created themes.
- Moved repository submission into a clearer `Created themes` context.
- Regenerated the static GOV.UK page.
- Updated route-state tests to enforce the new flow contract.

## Validation

- `npm run build:govuk-pages`: passed.
- `npx prettier -w public/js/synthesize-page.js public/css/synthesize.css tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- `npx prettier -w public/pages/study/synthesis/index.html`: passed.
- `npm test -- tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed.
- Playwright desktop check at `1366x900`: passed. The page showed the task-list overview, action-led section headings and dynamic step statuses.
- Playwright interaction check: passed. Selecting evidence and a target group enabled `Add selected evidence`; selecting a grouped-evidence group enabled the theme name field.
- Playwright mobile check at `390x844`: passed. No horizontal overflow or oversized task-list, panel, summary-card, evidence-card or form-group elements were detected.

## Residual risk

The visible local site is served from `/Users/kevin.rapley/ResearchOps`, which is separate from the Codex thread worktree path in the thread context. Existing unrelated dirty files in the served checkout were left unchanged.
