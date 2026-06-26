# Remove Home Phase Banner Border

## Run Metadata

- Date: 2026-06-26
- Branch: `fix/remove-home-phase-banner-border`
- Trace trigger: `fix/` branch prefix
- Task: remove the unwanted horizontal line in the marked home hero phase-banner/header area in the Home Office branded view while preserving unrelated page chrome.

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
- User clarification corrected the scope from moving/containing the rule to removing the marked horizontal rule outright.
- Rendered inspection showed the remaining marked line was not the phase-banner content rule after the first correction; it was retained by the home header/navigation boundary and the Home Office brand header border cascade. The final implementation removes the home header border, home service-navigation bottom border, phase-banner bottom border and phase-banner content border in the loaded cascade.
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
- `src/styles/brands/home-office.scss`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `public/css/brands/home-office.css`
- `src/govuk/templates/pages/home.njk`
- `public/index.html`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`

## Validation

- `node scripts/styles/build-generated-css.mjs assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- `node scripts/styles/build-generated-css.mjs public/css/brands/home-office.css`: passed.
- Playwright rendered check at `2048x512`, `/?brand=home-office`: home header, home service navigation, phase banner and phase-banner content row all computed `border-bottom` as `0px none`; no horizontal scroll.
- Playwright rendered check at `1640x1024`, `/pages/projects/?brand=home-office`: non-hero phase banner retained `border-bottom: 1px solid rgb(203, 203, 203)` on the outer `.govuk-phase-banner`; inner content row retained `border-bottom: 0px none`.
- Playwright screenshot captured at `/tmp/researchops-home-no-marked-line-brand-final.png` and visually inspected: the marked separator line above the `Prototype` row is no longer visible.
- `node --test tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node scripts/styles/format-generated-css.mjs --check assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css public/css/brands/home-office.css`: passed.
- `npx prettier --check src/styles/researchops-home.scss src/styles/brands/home-office.scss public/index.html tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `rg -n "home-phase-banner-contained-20260626|home-phase-banner-no-rule-20260626" src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js`: passed; only the new no-rule cache key appears.
- `git diff --check`: passed.
- GitHub review-thread handling: `+1` reaction added to valid Codex comment `discussion_r3481088318`; GraphQL reply added at `discussion_r3481231786`; GraphQL `resolveReviewThread` returned `isResolved: true`.

## Not Run

- `npm run format -c -- src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: invalid command shape for this repository; it ran the repository formatter with no file changes, then failed because the generated-CSS helper received non-generated CSS targets. Replaced with targeted Prettier and generated-CSS checks above.
- `npx prettier --check src/styles/researchops-home.scss src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`: not used as final evidence because Prettier cannot infer a parser for `.njk` in this repository. Replaced with targeted Prettier checks for parseable files plus `git diff --check` and the focused route-state test for the template.
- Full `npm test`: not run because the change is a narrow home-page CSS rule with a focused route-state regression test and rendered browser verification.
- Full `npm run validate`: not run for the same scope reason.

## Residual Risk

- The active `Home` tab underline remains because it is the selected-navigation affordance, not the marked horizontal separator.
