# GOV.UK generated CSS button typography correction

- Date: 2026-05-24
- Repository: `kevinrapley/ResearchOps`
- Pull request: #262
- Branch: `chore/govuk-frontend-integration`
- Branch trace decision: trace required.

## Task

Ensure GOV.UK button typography on migrated GOV.UK Frontend pages is owned by the generated GOV.UK Frontend stylesheet rather than the legacy compatibility stylesheet.

## User direction

The user rejected a runtime cascade guard and clarified that this spike should move away from legacy compatibility behaviour and toward full GOV.UK Frontend usage.

## Changes made

- Removed legacy GOV.UK compatibility stylesheet injection from `public/components/layout.js`.
- Removed `/css/govuk/govuk-frontend-v6.css` from `public/partials/html-head.html`.
- Kept migrated pages loading `/assets/govuk/govuk-frontend.css` as the source of GOV.UK typography and component styling.
- Updated the GOV.UK Frontend route-state tests to assert that `layout.js` does not inject the legacy compatibility stylesheet.
- Updated baseline assertions to match the generated GOV.UK Frontend CSS typography rule using quoted `GDS Transport`.
- Restored the Start overview Nunjucks source button target to `/pages/start/` so the build preserves the existing creation-form journey.
- Updated the Start overview route-state test to accept valid GOV.UK start-button macro output with multiple classes.

## Files modified

- `public/components/layout.js`
- `public/partials/html-head.html`
- `src/govuk/templates/pages/start-overview.njk`
- `tests/govuk-design-system-baseline-route-state.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/start-project-overview-page.test.js`

## Validation evidence

On head `677bc5c50eef9c65d4049a977946ffef35d0d38b`, these workflows passed:

- `CI`
- `Validate ResearchOps`
- `Accessibility audit (pa11y-ci)`
- `qa-bdd`
- `Release Gate`
- `Format pull request`
- `QA — Broken links (Lychee)`
- `Build and deploy agent documentation Pages`
- `Update GitHub bundle registry manifest`

## Residual risk

Legacy pages that have not yet been migrated may still depend on legacy clone CSS through their own committed page assets. This correction prevents migrated GOV.UK Frontend pages from having their generated component typography overridden by runtime compatibility injection.
