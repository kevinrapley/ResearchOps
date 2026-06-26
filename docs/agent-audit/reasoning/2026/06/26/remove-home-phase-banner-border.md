# Remove Home Phase Banner Border

## Run Metadata

- Date: 2026-06-26
- Branch: `fix/remove-home-phase-banner-border`
- Trace trigger: `fix/` branch prefix
- Task: remove the unwanted left-extending 1px line immediately below the home page `Prototype` phase tag in the Home Office branded hero view while preserving the normal non-hero phase-banner border.

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
- GOV.UK Design System governed preserving the phase-banner component content and navigation semantics while containing the visual border to the phase-banner content row.
- User clarification corrected the scope from removing the whole phase-banner bottom rule to removing only the full-width overrun to the left of the `Prototype` tag.
- Codex PR review comment `discussion_r3481088318` was valid: the home stylesheet cache key needed bumping so the corrected CSS is reliably served. The comment was acknowledged with a `+1` reaction before remediation.

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
- `src/govuk/templates/pages/home.njk`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `public/index.html`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `public/css/govuk/govuk-page-chrome.css`
- `public/css/brands/home-office.css`

## Files Modified

- `src/styles/researchops-home.scss`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`

## Validation

- `node scripts/styles/build-generated-css.mjs assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- Playwright rendered check at `1640x1024`, `/?brand=home-office`: outer phase banner `border-bottom` computed as `0px none`; inner phase-banner content row computed as `display: flex`, `width: 1020px`, `padding-bottom: 10px`, `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`; content row left edge matched the `Prototype` tag left edge at `310px`.
- Playwright rendered check at `1640x1024`, `/pages/projects/?brand=home-office`: non-hero phase banner retained `border-bottom: 1px solid rgb(203, 203, 203)` on the outer `.govuk-phase-banner`; inner content row retained `border-bottom: 0px none`.
- Playwright mobile check at `390x900`, `/?brand=home-office`: no horizontal scroll; outer phase banner `border-bottom` computed as `0px none`; inner content row computed as `width: 360px`, `padding-bottom: 10px`, `border-bottom: 1px solid rgba(255, 255, 255, 0.35)`.
- Playwright screenshot captured at `/tmp/researchops-home-phase-banner-after.png` and visually inspected: the line below the `Prototype` row no longer appears in the left margin; the normal separator above the phase banner remains.
- `node --test tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node scripts/styles/format-generated-css.mjs --check assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- `npx prettier --check src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `npx prettier --check src/styles/researchops-home.scss public/index.html tests/researchops-home-hero-layout-route-state.test.js docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`: passed.
- `rg -n "home-explainer-no-bg-20260617|home-phase-banner-contained-20260626" src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js`: passed; only the new cache key appears.
- `git diff --check`: passed.

## Not Run

- `npm run format -c -- src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: invalid command shape for this repository; it ran the repository formatter with no file changes, then failed because the generated-CSS helper received non-generated CSS targets. Replaced with targeted Prettier and generated-CSS checks above.
- `npx prettier --check src/styles/researchops-home.scss src/govuk/templates/pages/home.njk public/index.html tests/researchops-home-hero-layout-route-state.test.js docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`: not used as final evidence because Prettier cannot infer a parser for `.njk` in this repository. Replaced with targeted Prettier checks for parseable files plus `git diff --check` and the focused route-state test for the template.
- Full `npm test`: not run because the change is a narrow home-page CSS rule with a focused route-state regression test and rendered browser verification.
- Full `npm run validate`: not run for the same scope reason.

## Residual Risk

- The active home navigation strip still has its existing 1px separator above the phase banner. This trace now addresses only the line immediately below the `Prototype` tag row, as clarified by the user.
