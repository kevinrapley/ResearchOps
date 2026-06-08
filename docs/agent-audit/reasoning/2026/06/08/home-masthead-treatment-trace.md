# Home Masthead Treatment Trace

- Date: 2026-06-08
- Trace layer: operational
- Branch: `feature/home-masthead-treatment`
- Branch decision: trace required by `feature/` prefix
- Task summary: apply the repository landing page masthead treatment to the ResearchOps home page, remove the home breadcrumb, and add a high-fidelity ResearchOps SVG illustration that communicates research operations through planning, recruitment, moderated sessions, notes, evidence and service dashboard artefacts.

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
- `public/images/repository-masthead-illustration.svg`
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
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/design-system/govuk-compliance-audit.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-front-page-nunjucks-sass.md`
- GOV.UK Design System home page and image URL evidence.
- DWP Design System home page and image URL evidence.

## Files created or modified

- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/index.html`
- `public/assets/researchops/researchops-home.css`
- `assets/researchops/researchops-home.css`
- `public/images/home-masthead-researchops-illustration.svg`
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.md`
- `docs/agent-audit/reasoning/2026/06/08/home-masthead-treatment-trace.json`

## Implementation decisions

- Reused the repository page's route-scoped masthead treatment, but removed the home breadcrumb because it is not needed on the home page.
- Kept the home body marker `researchops-home-front-page` in the GOV.UK renderer context.
- Kept the inverse header, service navigation and phase-banner styling route-scoped to the home page.
- Added a decorative SVG to the home masthead, hidden from assistive technology with empty alt text and `role="presentation"`.
- Built the SVG around recognisable research operations artefacts: study plan card, participant operations panel, moderated session panel, live notes card, evidence trail and ResearchOps service dashboard.
- Used the same crisp flat vector approach as the repository illustration: grouped SVG structure, GOV.UK palette, connected dotted workflow paths and detailed UI artefacts rather than a low-fidelity icon.
- Added explicit image dimensions in the Nunjucks and rendered HTML to avoid overflow in the one-third masthead column.
- Diagnosed the failing unit tests from the release-gate artifact: `tests/govuk-frontend-integration-route-state.test.js` expected an exact `class="govuk-template__body"` body class and failed when the rendered home page correctly carried the route-scoped marker as an additional body class.
- Updated that test to assert the GOV.UK body class as a token so route body markers are allowed.

## Validation attempted

- GitHub compare from `main` to `feature/home-masthead-treatment`: branch is ahead and changed-file scope was inspected.
- Release-gate artifact inspection identified the failing assertion.
- CI passed on Node 20 and Node 22 after the assertion was updated.
- Worker CI passed after the assertion was updated.
- Release Gate passed after the assertion was updated.
- Accessibility audit, Render GOV.UK pages, Lychee, BDD and Validate ResearchOps also passed.
- PR review threads were checked before and after the follow-up work; no review threads were present at the time of checking.

## Residual risks

- The home masthead should still be checked visually in browser at desktop and mobile widths.
