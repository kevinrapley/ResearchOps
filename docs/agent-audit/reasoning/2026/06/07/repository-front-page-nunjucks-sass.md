# Research repository front page Nunjucks and Sass trace

## Task summary

Build the ResearchOps research repository front page on a new branch using Nunjucks and Sass, with macros for components and design patterns.

## Run metadata

- Date: 2026-06-07
- Branch: `feature/repository-front-page-nunjucks-sass`
- Trace required: yes, because `feature/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
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

- `.agent-operating-model/bundles/cloudflare/`: no Worker, route proxy, deployment or binding behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement and changed-file verification.
- ResearchOps Developer Control governed the placement of Nunjucks templates, generated CSS registration and GOV.UK page renderer registration.
- GOV.UK Design System governed use of GOV.UK Frontend macros, page structure and route-specific Sass.
- Multi-Functional Team governed service framing: the repository is a curated, authenticated evidence destination, not a raw research archive.

## Files read

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/projects.njk`
- `public/partials/header.html`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`

## Files created or modified

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/macros/repository.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/styles/repository.scss`
- `public/css/repository.css`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `public/partials/header.html`
- `tests/repository-front-page-route-state.test.js`
- `docs/implementation/repository-front-page-integration.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-front-page-nunjucks-sass.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-front-page-nunjucks-sass.json`

## Decisions

- Use `/pages/repository/` as the canonical page route.
- Add `Research repository` to shared service navigation.
- Keep repository page content in `src/govuk/data/repository-page.mjs` so the template stays structural.
- Use `src/govuk/templates/macros/repository.njk` for page-specific design pattern macros.
- Register `src/styles/repository.scss` in the generated CSS target manifest.
- Add a route-state test that pins the template, macro imports, renderer registration, CSS target and navigation contract.

## Validation attempted

- GitHub branch creation succeeded after retrying from the current `main` head.
- GitHub compare confirmed the branch is ahead of `main` and the changed-file list is focused on the repository front page.
- Repository-local commands were not run in this environment.

## Residual risks

- Full repository CI has not been run locally in this session.
- The page is registered in the renderer and the generated CSS target list, but live preview deployment should be checked after CI completes.
