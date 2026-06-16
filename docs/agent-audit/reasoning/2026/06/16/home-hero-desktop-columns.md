# Home hero desktop columns

## Task summary

Update the ResearchOps home page masthead so the desktop hero text column is 55% wide and the adjacent SVG illustration column is 45% wide, with the SVG fitting that 45% space.

## Run metadata

- Date: 2026-06-16
- Branch: `feature/domain-brand-routing`
- Trace required: yes, because `feature/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `.agent-operating-model/bundles/cloudflare/`: no Worker, Pages routing, binding or deployment behaviour changed.
- `.agent-operating-model/bundles/openai/`: no OpenAI API, model or AI route behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP protocol or agent tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: no Airtable API behaviour changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, surgical mutation and validation evidence.
- ResearchOps Developer Control governed source-first changes to Nunjucks and Sass plus generated deploy assets.
- Multi-Functional Team governed public-sector service usability and readability of the home page hero.
- GOV.UK Design System governed preserving the GOV.UK grid structure while applying route-specific desktop width overrides.

## Files read

- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `public/index.html`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/deploy-asset-paths.test.js`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/generated-css-targets.mjs`

## Files created or modified

- `src/govuk/templates/pages/home.njk`
- `src/styles/researchops-home.scss`
- `public/index.html`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/16/home-hero-desktop-columns.md`
- `docs/agent-audit/reasoning/2026/06/16/home-hero-desktop-columns.json`

## Decisions

- Added a dedicated `researchops-home-hero__content-column` class to the existing GOV.UK two-thirds text column.
- Kept the existing `researchops-home-hero__image-column` and `researchops-home-hero__image` hooks for the SVG column and image.
- Overrode the GOV.UK desktop grid widths at `40.0625em` so the content column is `55%` and the image column is `45%`.
- Removed desktop horizontal padding from the image column so the SVG fills the 45% column rather than only the padded inner area.
- Kept mobile behaviour unchanged by applying the width and padding overrides only inside the desktop media query.
- Regenerated both committed home stylesheet outputs and the rendered home page.

## Validation attempted

- `node --test tests/researchops-home-hero-layout-route-state.test.js tests/deploy-asset-paths.test.js` passed.
- `npx prettier -c src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js public/index.html public/assets/researchops/researchops-home.css assets/researchops/researchops-home.css` passed.
- Browser measurement at 1280px viewport passed: text column `55%`, image column `45%`, SVG fills image column.
- `npm test -- --test-reporter=spec` passed with 227 tests.

## Existing local changes

- `infra/cloudflare/src/core/auth/passwordless.js` was already modified locally and was left untouched and unstaged.

## Residual risks

- `npm run validate` was not run during this pass.
