# Study synthesis GOV.UK markup cleanup

Date: 2026-06-30
Branch: `feature/res-8-study-evidence-summary`

## Task

Tidy the Study synthesis page so the rendered page uses fuller GOV.UK Frontend HTML markup and styles.

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
- `public/js/synthesize-page.js`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `scripts/styles/generated-css-targets.mjs`
- `package.json`

## Files modified

- `src/govuk/templates/pages/study-synthesis.njk`
- `public/js/synthesize-page.js`
- `public/css/synthesize.css`
- `public/pages/study/synthesis/index.html`
- `tests/synthesize-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/30/study-synthesis-govuk-markup-cleanup.md`
- `docs/agent-audit/reasoning/2026/06/30/study-synthesis-govuk-markup-cleanup.json`

## Work done

- Replaced manual static selects with GOV.UK select macro output and set explicit fluid widths for form controls.
- Rendered evidence items as GOV.UK checkbox component markup with GOV.UK tags.
- Rendered cluster and theme cards using GOV.UK summary card and summary list markup.
- Changed theme Submit to repository actions to GOV.UK summary card action links with visually hidden context.
- Reduced the page stylesheet to layout and spacing support, preserving GOV.UK component styling.
- Regenerated `public/pages/study/synthesis/index.html`.
- Extended route-state assertions for the GOV.UK component contract.

## Validation

- `npm run build:govuk-pages`: passed.
- `npx prettier -w public/js/synthesize-page.js public/css/synthesize.css public/pages/study/synthesis/index.html tests/synthesize-page-route-state.test.js`: passed.
- `npm test -- tests/synthesize-page-route-state.test.js`: passed.
- Playwright desktop check at `1366x900`: rendered 4 evidence checkbox rows, 4 GOV.UK summary cards, 5 summary lists, 13 GOV.UK tags and 2 Submit to repository links with no visible error summary.
- Playwright candidate-link check: the first Submit to repository link prefilled title, source project, source study, source synthesis ID, evidence type and evidence maturity.
- Playwright mobile check at `390x844`: no horizontal overflow and no oversized GOV.UK card, evidence or form-group elements.

## Residual risk

The visible local site is served from `/Users/kevin.rapley/ResearchOps`, which is separate from the Codex worktree path in the thread context. This change was made in the served checkout so the page shown in the screenshot changes immediately.
