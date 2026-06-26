# Remove Home Phase Banner Border

## Run Metadata

- Date: 2026-06-26
- Branch: `fix/remove-home-phase-banner-border`
- Trace trigger: `fix/` branch prefix
- Task: remove the unwanted 1px bottom border visible below the home page prototype banner in the Home Office branded view.

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
- GOV.UK Design System governed preserving the phase-banner component content and navigation semantics while removing only the visual border.

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
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`

## Files Modified

- `src/styles/researchops-home.scss`
- `assets/researchops/researchops-home.css`
- `public/assets/researchops/researchops-home.css`
- `tests/researchops-home-hero-layout-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.md`
- `docs/agent-audit/reasoning/2026/06/26/remove-home-phase-banner-border.json`

## Validation

- `node scripts/styles/build-generated-css.mjs assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- Playwright desktop check at `1000x1200`, `/?brand=home-office`: phase banner `border-bottom` computed as `0px none`, `Prototype` tag present, active `Home` nav present, no horizontal scroll.
- Playwright mobile check at `390x900`, `/?brand=home-office`: phase banner `border-bottom` computed as `0px none`, `Prototype` tag present, active `Home` nav present, no horizontal scroll.
- `node --test tests/researchops-home-hero-layout-route-state.test.js`: passed.
- `node scripts/styles/format-generated-css.mjs --check assets/researchops/researchops-home.css public/assets/researchops/researchops-home.css`: passed.
- `npx prettier -c src/styles/researchops-home.scss tests/researchops-home-hero-layout-route-state.test.js`: passed.

## Not Run

- Full `npm test`: not run because the change is a narrow home-page CSS rule with a focused route-state regression test and rendered browser verification.
- Full `npm run validate`: not run for the same scope reason.

## Residual Risk

- The active home navigation strip still has its existing 1px separator. This trace addresses the bottom border on the prototype phase banner that matched the reported lowest horizontal rule.
