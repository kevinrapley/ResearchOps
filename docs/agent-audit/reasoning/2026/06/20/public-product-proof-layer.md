# Public Product Proof Layer

## Run Metadata

- Date: 2026-06-20
- Branch: `feature/public-product-proof-layer`
- Trace decision: required because branch prefix is `feature/`
- Task summary: implement the first public ResearchOps product proof layer before sign-in, then commit, push and open a ready-for-review PR.

## Operating Model Files Loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

## Selected Bundles

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

## Bundles Skipped

- `cloudflare`: no Worker runtime, route handler, binding or deployment change.
- `openai-platform`: no OpenAI API or model integration change.
- `mcp-agent-tooling`: no MCP protocol or tool contract change.
- `airtable-public-api`: no Airtable API change.
- `mural-public-api`: no Mural API change.

## Precedence Decisions

- GitHub Diamond governed branch naming, trace requirement, PR readiness and mixed-worktree staging.
- ResearchOps Developer Control governed generated GOV.UK page conventions and route-state coverage.
- Multi-Functional Team governed public-sector assurance, safe-public-content and user-impact framing.
- GOV.UK Design System governed page structure, phase banner, task-list presentation, button affordance and accessible status text.

## Files Read

- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/start-overview.njk`
- `public/pages/account/register/index.html`
- `visual-walkthrough.config.mjs`
- `tests/govuk-pages-render-workflow-state.test.js`
- `tests/visual-walkthrough-registry-coverage.test.js`
- `tests/start-project-overview-page.test.js`
- `tests/researchops-home-acceptance-sync.test.js`

## Files Created Or Modified

- `src/govuk/templates/pages/product-proof.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `visual-walkthrough.config.mjs`
- `src/govuk/templates/pages/home.njk`
- `public/pages/product-proof/index.html`
- `public/index.html`
- `tests/product-proof-route-state.test.js`
- `tests/pages-advanced-worker-auth-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/20/public-product-proof-layer.md`
- `docs/agent-audit/reasoning/2026/06/20/public-product-proof-layer.json`

## Implementation Summary

- Added `/pages/product-proof/` as a static generated GOV.UK page.
- Added a page-level prototype phase banner that remains visible without depending on the shared header include.
- Added an 8-step lifecycle proof from research project setup through decision impact.
- Added a clearly labelled static fixture with mock lead and publication-boundary copy.
- Added a safety section stating what the public page does not expose.
- Added request-access and start-journey calls to action.
- Added a homepage entry point to the proof page.
- Registered the page with the GOV.UK renderer and visual walkthrough config.
- Added route-state assertions for public availability, fixture rendering, no repository/API endpoints, visual registry coverage and homepage discovery.
- Added a Worker route-state assertion that `/pages/product-proof/` is served without the authenticated static-page preflight.

## Validation

- `npm run build:govuk-pages` passed.
- Initial focused route-state run failed because one assertion expected a formatted paragraph on a single line; the assertion was changed to normalise whitespace.
- `node --test tests/product-proof-route-state.test.js tests/govuk-pages-render-workflow-state.test.js tests/visual-walkthrough-registry-coverage.test.js tests/start-project-overview-page.test.js tests/researchops-home-acceptance-sync.test.js` passed.
- `npx prettier -c ...` passed for parseable changed files. Nunjucks templates are not directly parseable by this repository's Prettier setup and were validated through the GOV.UK page renderer and route-state tests.
- `npm run trace:coverage` passed.
- `npm test -- --ci` was attempted, but Node rejected the unsupported `--ci` option.
- `npm test` passed: 245 tests passed.
- `npm run lint` passed with 0 errors and existing warnings.
- Follow-up Worker route-state coverage passed after confirming the static route was not protected by the Pages Worker.

## Validation Not Run

- Playwright browser walkthrough was not run; the change is a static generated page with route-state, renderer and visual registry coverage.

## Issues And Residual Risks

- Existing local modification in `infra/cloudflare/src/core/auth/passwordless.js` was present before this work and was deliberately left unstaged.
- The proof layer is intentionally static. Future RES-7 increments still need candidate artefact, published artefact, impact and access-governance proof slices.
