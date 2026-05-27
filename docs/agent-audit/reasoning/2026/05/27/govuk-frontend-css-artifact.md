# GOV.UK frontend CSS artifact trace

## Run metadata

- Date: 2026-05-27
- Branch: `fix/govuk-frontend-css-artifact`
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Original task summary

Repair the committed `public/assets/govuk/govuk-frontend.css` artifact so deployed environments do not serve Sass compiler diagnostics instead of GOV.UK Frontend-compatible CSS.

Address pull request review findings from Codex:

1. Remove blocked Sass diagnostic path text from the committed CSS fallback comment.
2. Add `.govuk-details` styles expected by repository GOV.UK baseline tests.

Address the failing accessibility audit and the runtime screenshot showing GOV.UK page chrome styles falling out.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/trace-policy.md`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Files read

- `AGENTS.md`
- `.agent-operating-model/trace-policy.md`
- `public/assets/govuk/govuk-frontend.css`
- `src/styles/govuk.scss`
- `package.json`
- `package-lock.json`
- `.github/workflows/accessibility.yml`
- `tests/deploy-asset-paths.test.js`
- `public/partials/header.html`
- `public/index.html`
- `public/pages/projects/index.html`

## Files modified

- `public/assets/govuk/govuk-frontend.css`
- `.github/workflows/accessibility.yml`
- `tests/deploy-asset-paths.test.js`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.md`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.json`

## Files created

- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.md`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.json`

## Implementation decisions

- Removed explicit Sass source path text from the committed CSS fallback comment because repository tests reject known Sass diagnostic signatures.
- Added `.govuk-details` coverage required by existing GOV.UK baseline tests.
- Added runtime selectors that were missing in the screenshot: `.govuk-header`, `.govuk-service-navigation`, `.govuk-phase-banner` and `.govuk-grid-row`.
- Kept the accessibility workflow step that runs `npm run build:govuk` after `npm ci` and before the static server starts.
- Removed the attempted generated-CSS auto-commit workflow step after it failed in GitHub Actions.
- Tightened `tests/deploy-asset-paths.test.js` so the committed asset must contain GOV.UK page chrome selectors required by static pages.

## Validation attempted

Validation inferred from repository review comments, workflow logs and existing test assertions:

- `tests/deploy-asset-paths.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-design-system-baseline-route-state.test.js`
- `.github/workflows/accessibility.yml` now generates GOV.UK CSS from Sass before pa11y starts

## Validation not run

No local full repository test run was completed through the GitHub mutation tooling path.

## Residual risks

The committed CSS remains a deploy-safe fallback rather than the full generated GOV.UK Frontend distribution. It now includes the page chrome selectors shown missing in the runtime screenshot. GitHub Actions still needs to complete on the updated commit to confirm all checks remain green.
