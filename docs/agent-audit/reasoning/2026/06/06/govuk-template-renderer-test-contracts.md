# GOV.UK template renderer test contracts

## Task summary

Update the test contract so route-state tests that inspect renderer-managed GOV.UK pages validate the Nunjucks templates and renderer registry rather than reading committed generated HTML directly.

## Run metadata

- Date: 2026-06-06
- Branch: `test/govuk-template-renderer-contracts`
- Trace required: yes, because `test/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, test-contract impact sweep and PR readiness checks.
- ResearchOps Developer Control governed the route-state test pattern and repository-specific generated output policy.
- GOV.UK Design System governed the GOV.UK template and renderer contract.
- Cloudflare governed the build-artifact direction because Cloudflare Pages now runs `npm run build` before deploy.
- Multi-Functional Team governed service risk framing: tests should support safe migration without weakening route assurance.

## Files read

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `package.json`
- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/projects.njk`
- `tests/project-dashboard-route-state.test.js`
- `tests/projects-page-route-state.test.js`
- `tests/study-page-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`
- `docs/deployment/generated-html-policy.md`

## Files created or modified

- `package.json`
- `tests/helpers/generated-govuk-page-source.mjs`
- `tests/govuk-generated-html-test-source-route-state.test.js`
- `docs/deployment/generated-html-policy.md`
- `docs/agent-audit/reasoning/2026/06/06/govuk-template-renderer-test-contracts.md`
- `docs/agent-audit/reasoning/2026/06/06/govuk-template-renderer-test-contracts.json`

## Decisions

- Added a Node test preloader instead of rewriting each route-state test by hand.
- The preloader intercepts `fs.readFileSync` only for outputs registered in `govukPages` from `scripts/govuk/render-govuk-pages.mjs`.
- The preloader renders those pages in memory from Nunjucks templates and the renderer registry, with the same GOV.UK template loaders and `govukAttributes` helper used by the renderer.
- Legacy static page tests continue to read their committed `public/` files because they are not renderer-managed GOV.UK pages.
- Updated the generated HTML policy to say tests that inspect renderer-managed pages should load from templates and the renderer registry rather than committed generated HTML.
- Added a route-state test that pins the preloader, package test script and renderer exports.

## Validation attempted

- Repository-local commands were not run in this environment.
- Added `tests/govuk-generated-html-test-source-route-state.test.js` for CI to validate the helper and package test script.
- The implementation is intended to be validated by the existing `npm test` CI path.

## Residual risks

- Some workflows or ad hoc commands that run `node --test tests/specific-file.test.js` directly will not use the package-level `--import` preloader unless they call `npm test` or include the import flag. A later sweep can update targeted workflow commands if CI reveals any direct invocations.
- The helper renders pages without Prettier formatting because tests should not depend on committed generated formatting. Structural assertions should continue to prefer source and renderer contracts.
