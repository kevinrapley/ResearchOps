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

Address the failing accessibility audit without adding new CSS files and without hand-authoring a separate header stylesheet. The accessibility workflow must generate `public/assets/govuk/govuk-frontend.css` from `src/styles/govuk.scss` before pa11y audits the static site.

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
- `public/partials/header.html`
- `public/index.html`
- `public/pages/projects/index.html`

## Files modified

- `public/assets/govuk/govuk-frontend.css`
- `.github/workflows/accessibility.yml`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.md`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.json`

## Files created

- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.md`
- `docs/agent-audit/reasoning/2026/05/27/govuk-frontend-css-artifact.json`

## Implementation decisions

- Removed the explicit Sass source path reference from the CSS fallback comment because repository tests reject known Sass diagnostic signatures.
- Added `.govuk-details` coverage required by existing GOV.UK baseline tests.
- Investigated the accessibility audit failure and found that the pa11y workflow installed dependencies but served `public/` without first running the Sass build.
- Added an accessibility workflow step that runs `npm run build:govuk` after `npm ci` and before the static server starts.
- Kept the fix within the existing GOV.UK Sass build path. No new `.css` files were added.
- Did not add page-level stylesheet links to work around the audit issue.

## Validation attempted

Validation inferred from repository review comments, workflow logs and existing test assertions:

- `tests/deploy-asset-paths.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-design-system-baseline-route-state.test.js`
- `.github/workflows/accessibility.yml` now generates GOV.UK CSS from Sass before pa11y starts

## Validation not run

No local runtime execution was available through the GitHub mutation tooling path. The local container could not clone the repository because outbound DNS resolution for GitHub was unavailable.

## Residual risks

The accessibility workflow should now audit the Sass-generated GOV.UK Frontend CSS rather than the pre-build committed artifact. GitHub Actions still needs to complete on the updated commit to confirm the pa11y failure is resolved.
