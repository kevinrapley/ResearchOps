# GOV.UK button migration

Date: 2026-04-27
Branch: `design-system/govuk-buttons-global-contract`
Scope: Global button foundation and first route migration.

## Purpose

This document records the first controlled button migration slice in the ResearchOps GOV.UK Design System migration.

It follows the baseline rule that global component contracts must remain global.

Route stylesheets must not create button systems for individual pages.

## Component classification

### Button foundation

Current classification: mixed ResearchOps global and GOV.UK global.

Target classification: GOV.UK global.

Current files:

- `public/css/screen.css`
- `public/css/govuk/govuk-buttons.css`

Target file:

- `public/css/govuk/govuk-buttons.css`

Decision:

`public/css/govuk/govuk-buttons.css` is the global GOV.UK button foundation. It defines GOV.UK button classes and temporary aliases for legacy `btn` classes while pages are migrated.

## Legacy aliases

The following legacy classes remain supported temporarily:

- `.btn`
- `.btn--secondary`
- `.btn--outline`

These aliases are transitional.

They must not be introduced into newly migrated markup.

They exist so that routes can be migrated incrementally without breaking remaining legacy pages.

## First migrated route

Route:

`/pages/project-dashboard/?id=<project-id>`

Files changed:

- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`

The Project Dashboard now loads:

`/css/govuk/govuk-buttons.css`

Project Dashboard buttons now use:

- `govuk-button`
- `govuk-button govuk-button--secondary`

The Project Dashboard route-state test rejects legacy `class="btn` usage on that page.

## What did not change

This PR does not remove `.btn` from `public/css/screen.css`.

This PR does not migrate every route.

This PR does not change global cards, sections, board navigation, key-value metadata, header navigation, forms, tags, or focus behaviour outside the button foundation.

## Next routes to migrate

Recommended next candidates:

1. `/pages/start/`
2. `/pages/study/`
3. `/pages/projects/journals/`
4. `/pages/study/guides/`

Each route should be migrated with route-state tests and manual browser validation.

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`

Manual browser check:

- Open `/pages/project-dashboard/?id=<known-project-id>`.
- Confirm primary and secondary button styling matches the GOV.UK button foundation.
- Confirm disabled Mural setup button remains readable.
- Confirm global sections, cards, board navigation, and dropzone styling have not changed unexpectedly.

## Rollback note

If button styling creates a visual regression, revert the Project Dashboard markup first.

Do not remove the global button foundation unless it is the source of the regression.
