# Repository breadcrumbs and content follow-up trace

## Task summary

Follow up merged PR #366 by adding GOV.UK breadcrumbs to repository pages, removing broad API-route explanatory copy, and replacing the generic artefact detail heading with the artefact title when data loads.

## Run metadata

- Date: 2026-06-07
- Branch: `fix/repository-breadcrumbs-content`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no runtime, deployment, D1 or Worker behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, changed-file verification and PR readiness.
- ResearchOps Developer Control governed source-owned Nunjucks, generated-output checks and route-state test coverage.
- GOV.UK Design System governed use of the breadcrumbs macro and removal of broad internal implementation copy.
- Multi-Functional Team governed keeping user-facing copy focused on repository evidence use rather than implementation mechanics.

## Files read

- `src/govuk/templates/pages/repository.njk`
- `src/govuk/templates/pages/repository-static.njk`
- `src/govuk/data/repository-page.mjs`
- `public/js/repository-artefact-page.js`
- `tests/repository-front-page-route-state.test.js`
- Existing GOV.UK breadcrumb templates for comparison.

## Files created or modified

- `src/govuk/templates/pages/repository.njk`
- `src/govuk/templates/pages/repository-static.njk`
- `src/govuk/data/repository-page.mjs`
- `public/js/repository-artefact-page.js`
- `tests/repository-front-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/07/repository-breadcrumbs-content.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-breadcrumbs-content.json`

## Decisions

- Put breadcrumbs inside the page content because the shared layout does not render `beforeContent` for these repository pages.
- Use the GOV.UK breadcrumbs macro for the repository landing page and the shared static repository template.
- Remove the generic repository API explanatory section from static repository pages.
- Replace the static detail heading text with `detailHeading or title`.
- Update the artefact detail script so the page-level detail heading is replaced with the loaded artefact title.
- Keep the published repository API error copy on the landing page because it is a runtime failure message, not the removed static implementation guidance.

## Validation attempted

- Focused repository route-state test passed.
- JavaScript syntax check for `public/js/repository-artefact-page.js` passed.
- `npm run build` passed and rendered all repository pages.
- Generated output check confirmed 14 repository `index.html` files and 14 with GOV.UK breadcrumb markup.
- Text search confirmed the removed static API route copy and `Selected artefact` heading no longer appear in repository source or generated repository pages.
- Browser smoke check against local rendered pages confirmed breadcrumbs on the repository landing page, service-area browse page, artefact detail route and candidate artefact page, with the removed static API copy absent.
- `npm run format:check` passed.
- `npm run trace:coverage` passed.
- `npm run validate` passed.
- `npm test` passed with 187 tests.
- `npm run lint` passed with existing warnings and no errors.

## Residual risks

- The generic `/pages/repository/artefacts/` route cannot know the selected artefact title until the API response returns, so it renders `Repository artefact` initially and then updates the detail heading from the loaded artefact title. The local static browser check could verify the initial heading and source-backed update hook, but not the API-populated title without a running repository API.
