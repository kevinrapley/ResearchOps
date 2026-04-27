# GOV.UK button migration

Date: 2026-04-27
Branch: `design-system/govuk-buttons-all-routes`
Scope: Global button foundation and consolidated public-route migration.

## Purpose

This document records the controlled GOV.UK button migration in the ResearchOps GOV.UK Design System migration.

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

They must not be introduced into migrated markup.

They exist so that remaining legacy or generated surfaces can be migrated without breaking unrelated behaviour.

## Migrated routes and surfaces

### Project Dashboard

Route:

`/pages/project-dashboard/?id=<project-id>`

Files changed in the first button slice:

- `public/pages/project-dashboard/index.html`
- `tests/project-dashboard-route-state.test.js`

The Project Dashboard loads:

`/css/govuk/govuk-buttons.css`

Project Dashboard buttons use:

- `govuk-button`
- `govuk-button govuk-button--secondary`

The Project Dashboard route-state test rejects legacy `class="btn` usage on that page.

### Start research project

Route:

`/pages/start/`

Files changed in the second button slice:

- `public/pages/start/index.html`
- `tests/start-page-route-state.test.js`

The Start route loads:

`/css/govuk/govuk-buttons.css`

The Start route already used `govuk-button` for the main step controls. This migration replaced the remaining AI assistance controls that used legacy button classes.

Start route buttons use:

- `govuk-button`
- `govuk-button govuk-button--secondary`

The Start route-state test rejects legacy `class="btn` usage on that page.

### Study

Route:

`/pages/study/`

Files changed:

- `public/pages/study/index.html`
- `tests/study-page-route-state.test.js`

The Study route loads:

`/css/govuk/govuk-buttons.css`

The route now uses GOV.UK button classes for the back action, edit action, description editor controls, and begin-session action.

### Reflexive Journal and Analysis

Route:

`/pages/projects/journals/`

Files changed:

- `public/pages/projects/journals/index.html`

The static Journals page now loads:

`/css/govuk/govuk-buttons.css`

Static analysis, coding-panel, Mural sync, and form actions now use GOV.UK button classes.

### Discussion Guides

Route:

`/pages/study/guides/`

Files changed:

- `public/pages/study/guides/index.html`
- `public/components/guides/variable-manager.js`
- `tests/study-guides-route-state.test.js`

The Guides page now loads:

`/css/govuk/govuk-buttons.css`

Guide list actions, editor toolbar actions, variables drawer actions, and variable-manager generated confirmation actions now use GOV.UK button classes.

### Consent forms

Route:

`/pages/study/consent-forms/`

Files changed:

- `public/pages/study/consent-forms/index.html`

The Consent Forms page now loads:

`/css/govuk/govuk-buttons.css`

Back, create, save, and publish actions now use GOV.UK button classes.

### Study session

Route:

`/pages/study/session/`

Files changed:

- `public/pages/study/session/index.html`

The Study Session route now loads:

`/css/govuk/govuk-buttons.css`

Session controls, note formatting controls, and save-note actions now use GOV.UK button classes.

The stop action uses:

`govuk-button govuk-button--warning`

### Study participants

Route:

`/pages/study/participants/`

Files changed:

- `public/pages/study/participants/index.html`
- `public/components/participants/participants-page.js`
- `public/pages/study/participants/scheduler.js`

The Participants page now loads:

`/css/govuk/govuk-buttons.css`

Static participant/session actions and generated participant/session table actions now use GOV.UK button classes.

### Generated Start assistance controls

Files changed:

- `public/js/start-description-assist.js`
- `public/js/start-objectives-assist.js`

Generated AI rewrite apply buttons now use GOV.UK button classes.

## Known remaining work

The large Journals tab controller still contains some generated entry action controls that use bespoke quiet-link styling, such as `btn-quiet`.

Those controls are not migrated in this slice because the connector response for `public/js/journal-tabs.js` is truncated for large-file rewrites. They should be migrated in a dedicated follow-up when the file can be edited safely through a local checkout or a full-source connector operation.

The large Discussion Guides controller may also contain generated table action buttons such as `link-like`. These are not legacy `.btn` buttons, but they should be reviewed in the next interaction-pattern pass.

## What did not change

This migration does not remove `.btn` from `public/css/screen.css`.

This migration does not change global cards, sections, board navigation, key-value metadata, header navigation, forms, tags, tabs, tables, or focus behaviour outside the button foundation.

This migration does not move button styles into route stylesheets.

## Next work

Recommended next candidates:

1. Open a local-edit follow-up for generated entry actions in `public/js/journal-tabs.js`.
2. Review `link-like`, `filter-chip`, and icon-only close controls as part of an interaction-pattern pass rather than the core button migration.
3. Start the GOV.UK form-structure migration route by route.

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`

Manual browser checks:

- Open `/pages/project-dashboard/?id=<known-project-id>`.
- Open `/pages/start/`.
- Open `/pages/study/?pid=<known-project-id>&sid=<known-study-id>`.
- Open `/pages/projects/journals/?id=<known-project-id>`.
- Open `/pages/study/guides/?pid=<known-project-id>&sid=<known-study-id>`.
- Open `/pages/study/consent-forms/?pid=<known-project-id>&sid=<known-study-id>`.
- Open `/pages/study/session/?pid=<known-project-id>&sid=<known-study-id>`.
- Open `/pages/study/participants/?pid=<known-project-id>&sid=<known-study-id>`.

Check that primary, secondary, warning, disabled, generated, and toolbar actions render correctly.

Also confirm global cards, sections, board navigation, metadata, tab structure, and route-specific layouts have not changed unexpectedly.

## Rollback note

If button styling creates a visual regression, revert the migrated route markup or generated template first.

Do not remove the global button foundation unless it is the source of the regression.
