# GOV.UK Frontend Sass output and service chrome migration trace

- Date: 2026-05-24
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: `chore/` branch, trace required.
- Task: Reinstate the home-page Sass-driven grid output and add explicit GOV.UK Frontend chrome to every registered service page.

## Operating-model files loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond` from `.agent-operating-model/bundles/github/`
- `researchops-developer-control` from `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` from `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` from `.agent-operating-model/bundles/govuk-design-system/`

## Bundles skipped

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## User constraints applied

- Do not manually edit `public/assets/researchops/researchops-home.css`.
- Treat `src/styles/researchops-home.scss` as the source of truth for the home-page 8-step grid and the “What you can do after creating a project” 3-column layout.
- Do not make `/components/layout.js` inject generated GOV.UK Frontend stylesheets into every page.
- Do not use the shared header partial as a global stylesheet injection point.
- Migrate service pages explicitly, using the same page-level GOV.UK Frontend pattern as `/` and `/pages/start/overview/`.
- Defer trace and PR body updates until the code unit is complete.

## Files read

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-gate.yml`
- `src/styles/researchops-home.scss`
- `public/assets/researchops/researchops-home.css`
- `public/components/layout.js`
- `public/partials/header.html`
- `public/partials/footer.html`
- `public/index.html`
- `public/pages/projects/index.html`
- `visual-walkthrough.config.mjs`
- `scripts/researchops-projects-acceptance.mjs`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-frontend-service-pages-route-state.test.js`
- `tests/consent-forms-route-state.test.js`
- `tests/study-child-route-state.test.js`
- `tests/study-page-route-state.test.js`
- `tests/synthesize-page-route-state.test.js`

## Implementation decisions

- Kept `src/styles/researchops-home.scss` as the source of truth for the 8-step home grid and the 3-column next-actions layout.
- Added generated-CSS assertions so `public/assets/researchops/researchops-home.css` must contain the Sass-derived `minmax(0, 1fr)` grid output and the mid-grey vertical rule between next-action columns.
- Ensured Release Gate runs `npm run build --if-present` before unit tests so generated CSS and generated pages are rebuilt before route-state assertions run.
- Added `scripts/govuk/normalise-service-pages.mjs` as a build-time normaliser for registered service pages from `visual-walkthrough.config.mjs`.
- Used npm `postbuild:govuk-pages` so service page normalisation runs after `build:govuk-pages` without changing the asserted `build:govuk-pages` command string.
- Preserved route-specific CSS during normalisation to avoid breaking existing page-level functionality.
- Removed hardcoded GOV.UK header/footer fallbacks from registered pages during normalisation so shared `x-include` chrome is authoritative.
- Added `tests/govuk-frontend-service-pages-route-state.test.js` to assert explicit GOV.UK Frontend chrome on every registered service page.
- Migrated `public/pages/projects/index.html` to the explicit GOV.UK Frontend page pattern.
- Updated stale route-state tests to expect the explicit GOV.UK template and generated GOV.UK Frontend stylesheet.
- Fixed the Projects acceptance generator so `govuk-body-l` and `govuk-body` are treated as distinct class tokens.

## Files modified

- `.github/workflows/release-gate.yml`
- `package.json`
- `scripts/govuk/normalise-service-pages.mjs`
- `scripts/researchops-projects-acceptance.mjs`
- `public/pages/projects/index.html`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-frontend-service-pages-route-state.test.js`
- `tests/consent-forms-route-state.test.js`
- `tests/study-child-route-state.test.js`
- `tests/study-page-route-state.test.js`
- `tests/synthesize-page-route-state.test.js`

## Validation evidence before this trace

On head `ccfbae0d1d993f46a3c4b16d75183f90c511d496`:

- `Accessibility audit (pa11y-ci)` passed.
- `qa-bdd` passed.
- `Format pull request` passed.
- `QA — Broken links (Lychee)` passed.
- `Build and deploy agent documentation Pages` passed.
- `Update GitHub bundle registry manifest` passed.
- `CI` built the Sass and page outputs successfully, ran `postbuild:govuk-pages`, normalised registered service pages, and passed 159 of 160 tests.
- The only observed CI failure was `agent-trace-coverage.test.js`, which required trace artefacts for `2026-05-24`.

## Residual risk

The build-time normaliser covers every page registered in `visual-walkthrough.config.mjs`. If the repository contains additional public HTML files that are not registered as service pages, they are outside this unit and should be covered by a later filesystem-wide page inventory if required.
