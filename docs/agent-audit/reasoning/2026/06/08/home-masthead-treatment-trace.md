# Home Masthead Treatment Trace

- Date: 2026-06-08
- Trace layer: operational
- Branch: `feature/home-masthead-treatment`
- Branch decision: trace required by `feature/` prefix
- Task summary: apply the repository landing page masthead treatment to the ResearchOps home page, including a route-scoped body marker, inverse service navigation, inverse phase banner, breadcrumb trail, brand-colour masthead and source/rendered route-state coverage.

## Operating model evidence

- Loaded: `README.md`
- Loaded: `AGENTS.md`
- Loaded: `RECENT_LEARNINGS.md`
- Loaded: `.agent-operating-model/orchestration.xml`
- Loaded: `.agent-operating-model/bundle-registry.json`
- Loaded: `.agent-operating-model/task-signal-catalog.json`
- Loaded: `.agent-operating-model/selection-rules.json`
- Loaded: `.agent-operating-model/bootstrap-checklist.md`
- Loaded: `.agent-operating-model/precedence-policy.md`
- Loaded: `.agent-operating-model/trace-policy.md`
- Loaded: `.agent-operating-model/trace-layers.md`
- Loaded: `.agent-operating-model/behavioural-evals.json`
- Loaded: `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no Worker, D1, Pages Function or deployment behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API or schema behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Files read

- `src/govuk/templates/pages/repository.njk`
- `src/govuk/templates/macros/repository.njk`
- `src/styles/repository.scss`
- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/format-generated-css.mjs`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `assets/researchops/researchops-home.css`
- `public/partials/header.html`
- `tests/repository-front-page-route-state.test.js`
- `tests/govuk-page-chrome-navigation-route-state.test.js`
- `docs/design-system/govuk-compliance-audit.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-front-page-nunjucks-sass.md`

## Files created or modified

- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `assets/researchops/researchops-home.css`
- `tests/home-front-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.md`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.json`

## Implementation decisions

- Reused the repository page pattern rather than creating a new global masthead component.
- Added `researchops-home-front-page` through the GOV.UK renderer context so the body marker is present at render time.
- Kept the inverse header, service navigation and phase-banner styling route-scoped to the home page.
- Moved only the home title, lead and introductory body text into the masthead.
- Kept the start guidance, project sequence and next-action cards below the masthead in the normal content container.
- Added a home breadcrumb trail inside the masthead so the home page follows the same chrome treatment as the repository landing page.
- Updated committed generated home HTML and both generated home CSS outputs because the home route still commits these generated artefacts.
- Added route-state coverage for source template, renderer context, Sass, committed HTML and committed generated CSS.

## Validation attempted

- GitHub compare from `main` to `feature/home-masthead-treatment`: branch is ahead and changed-file scope was inspected.
- Static route-state assertions were added in `tests/home-front-page-route-state.test.js`.

## Validation not run

- `npm run build`, `npm test`, `npm run format:check`, `npm run generated-css:check`, `npm run lint` and browser checks were not run in this session because the repository was edited through the GitHub connector and no local checkout with dependencies was available.

## Residual risks

- The generated CSS was manually aligned to the Sass source and the existing generated CSS formatter style. A full local `npm run build:researchops` or `npm run build` should be run before merge.
- The home page breadcrumb is a single current-page item. This matches the requested treatment but should be checked visually in browser against the repository masthead.
