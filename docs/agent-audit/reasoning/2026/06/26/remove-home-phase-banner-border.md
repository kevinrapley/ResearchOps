# Remove Home Phase Banner Border

## Run Metadata

- Date: 2026-06-26
- Branch: `fix/remove-home-phase-banner-border`
- Trace trigger: `fix/` branch prefix
- Task: remove the unwanted full-width horizontal line below the `Prototype` phase-banner row on Home Office branded hero pages while preserving the normal header, navigation and content-row borders.

## Operating Model

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
- `/Users/kevin.rapley/.hermes/skills/github/github-diamond-standard/SKILL.md`
- `/Users/kevin.rapley/.hermes/skills/software-development/frontend-visual-verification/SKILL.md`

Selected bundles:

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `cloudflare`
- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Decisions

- GitHub Diamond governed branch naming, trace creation, validation, commit, push and PR readiness.
- ResearchOps Developer Control governed generated CSS parity for `src/styles/researchops-home.scss`, `assets/researchops/researchops-home.css` and `public/assets/researchops/researchops-home.css`.
- Multi-Functional Team governed keeping the user-facing change narrowly scoped to the reported visual defect.
- GOV.UK Design System governed preserving the phase-banner component content and navigation semantics while removing decorative separator rules in the marked home hero area.
- User clarification corrected the scope: restore the borders removed by the previous overbroad attempt and remove only the marked full-width line below the `Prototype` phase-banner row.
- Rendered inspection showed the desired content-row border should remain constrained to the GOV.UK width container. The final implementation restores the Home Office header border, restores the Home service-navigation bottom border, restores the phase-banner content-row border, keeps the outer phase-banner bottom border removed, and extends the full-bleed phase-banner background 1px below the clipped edge so the line no longer appears outside the content row.
- Follow-up clarification identified the same defect on `/pages/repository/` and confirmed the hero treatment should be shared. The final implementation moved the active service-navigation and phase-banner hero rules into `src/styles/_hero-phase-banner.scss`, then included that shared mixin from the Home and Repository route stylesheets.
- Codex PR review comment `discussion_r3481088318` was valid: the home stylesheet cache key needed bumping so the corrected CSS is reliably served. The comment was acknowledged with a `+1` reaction before remediation, replied to with validation evidence at `discussion_r3481231786`, and resolved.

## Files Read

- `README.md`
- `RECENT_LEARNINGS.md`
- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `.github/workflows/render-govuk-pages.yml`
- `package.json`
- `public/index.html`
- `public/partials/header.html`
- `public/js/brand-variant.js`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/layouts/researchops.njk`
- `src/styles/researchops-home.scss`
- `src/styles/brands/home-office.scss`
- `src/govuk/templates/pages/home.njk`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `public/css/brands/home-office.css`
- `public/index.html`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `public/css/govuk/govuk-page-chrome.css`
- `public/css/brands/home-office.css`

## Files Modified

- `src/styles/researchops-home.scss`
- `src/styles/_hero-phase-banner.scss`
- `src/styles/repository.scss`
- `src/styles/brands/home-office.scss`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `public/css/repository.css` (ignored generated output for local rendered verification)
- `public/css/brands/home-office.css`
- `src/govuk/templates/pages/home.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/govuk/templates/pages/repository-static.njk`
- `public/index.html`
- `public/pages/repository/**/index.html` (ignored generated output for local rendered verification)
- `tests/researchops-home-hero-layout-route-state.test.js`
- `tests/repository-front-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`

## Validation

- `node scripts/styles/build-generated-css.mjs assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- `node scripts/styles/build-generated-css.mjs public/css/repository.css`: passed.
- `node scripts/styles/build-generated-css.mjs public/css/brands/home-office.css`: passed.
- Playwright rendered check at `2048x512`, `/?brand=home-office`: Home Office header computed `border-bottom: 4px solid rgb(115, 34, 130)`; Home service navigation computed `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`; outer phase banner computed `border-bottom: 0px none` and `clip-path: inset(0px -2048px -1px)`; phase-banner content row computed `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`.
- Playwright rendered check at `2048x512`, `/pages/repository/?brand=home-office`: Home Office header computed `border-bottom: 4px solid rgb(115, 34, 130)`; Research Repository service navigation computed `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`; outer phase banner computed `border-bottom: 0px none` and `clip-path: inset(0px -2048px -1px)`; phase-banner content row computed `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`.
- Playwright rendered check at `1640x1024`, `/pages/projects/?brand=home-office`: non-hero phase banner retained `border-bottom: 1px solid rgb(203, 203, 203)` on the outer `.govuk-phase-banner`; inner content row retained `border-bottom: 0px none`.
- Playwright screenshot captured at `/tmp/researchops-home-seam-check.png` and visually inspected: the line below the `Prototype` row is constrained to the content width, with no left or right full-width extension.
- Playwright screenshot captured at `/tmp/researchops-repository-seam-check.png` and visually inspected: the repository phase-banner line below the `Prototype` row is constrained to the content width, with no left or right full-width extension.
- Screenshot pixel samples at the phase-banner content border row for Home and Repository: outside-left and outside-right pixels were the plain brand purple `(115, 34, 130, 255)` while an inside-content pixel was the border tint `(164, 111, 173, 255)`.
- `node --test tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node --test tests/repository-front-page-route-state.test.js`: passed.
- `node scripts/styles/format-generated-css.mjs --check assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css public/css/repository.css public/css/brands/home-office.css`: passed.
- `npx prettier --check src/styles/_hero-phase-banner.scss src/styles/researchops-home.scss src/styles/repository.scss src/styles/brands/home-office.scss public/index.html tests/researchops-home-hero-layout-route-state.test.js tests/repository-front-page-route-state.test.js docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`: passed.
- `rg -n "home-phase-banner-contained-20260626|home-phase-banner-no-rule-20260626" src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js`: passed; neither stale cache key remains.
- `git diff --check`: passed.
- GitHub review-thread handling: `+1` reaction added to valid Codex comment `discussion_r3481088318`; GraphQL reply added at `discussion_r3481231786`; GraphQL `resolveReviewThread` returned `isResolved: true`.

## Not Run

- `npm run format -c -- src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: invalid command shape for this repository; it ran the repository formatter with no file changes, then failed because the generated-CSS helper received non-generated CSS targets. Replaced with targeted Prettier and generated-CSS checks above.
- `npx prettier --check src/styles/researchops-home.scss src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`: not used as final evidence because Prettier cannot infer a parser for `.njk` in this repository. Replaced with targeted Prettier checks for parseable files plus `git diff --check` and the focused route-state test for the template.
- Full `npm test`: not run because the change is a narrow home-page CSS rule with a focused route-state regression test and rendered browser verification.
- Full `npm run validate`: not run for the same scope reason.

## Residual Risk

- The active `Home` tab underline remains because it is the selected-navigation affordance, not the marked horizontal separator.
