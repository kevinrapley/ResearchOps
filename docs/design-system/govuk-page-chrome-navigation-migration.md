# GOV.UK page chrome and navigation migration

Date: 2026-05-05
Branch: `fix/project-dashboard-action-routes-govuk-chrome`
Scope: Shared page chrome, refreshed GOV.UK branding, service navigation, skip link, phase banner, footer and main-content targeting.

## Purpose

This document records the GOV.UK page chrome and navigation migration for ResearchOps.

Page chrome is a shared service frame. It must remain global. Route stylesheets may lay out route content, but they must not define independent header, footer, skip-link or service-navigation systems.

ResearchOps must use the current GOV.UK header and Service navigation relationship:

- the GOV.UK header identifies GOV.UK
- the service name and service navigation sit in the Service navigation component
- the GOV.UK header must not contain the service name or service navigation links
- page-specific navigation, breadcrumbs and content come after the global service frame

## Component classification

### Skip link

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The skip link points to `#main-content`.

The shared header helper preserves existing route-facing main IDs where possible. If a page has an unnamed main landmark, it assigns `id="main-content"` to that landmark. If a page already provides `id="main-content"`, it keeps the existing ID and adds `tabindex="-1"` when needed.

### Header

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The shared header now follows the current GOV.UK header pattern and refreshed GOV.UK branding. The header is intentionally limited to the GOV.UK identity.

The header uses:

- `govuk-header`
- `govuk-header__container`
- `govuk-width-container`
- `govuk-header__logo`
- `govuk-header__homepage-link`
- `govuk-header__logotype`

The service name is not placed in the GOV.UK header.

### Service navigation

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The shared service navigation now follows the current GOV.UK Service navigation pattern. It holds the ResearchOps service name and the service-level navigation.

The service navigation uses:

- `govuk-service-navigation`
- `govuk-service-navigation__container`
- `govuk-service-navigation__service-name`
- `govuk-service-navigation__wrapper`
- `govuk-service-navigation__toggle`
- `govuk-service-navigation__list`
- `govuk-service-navigation__item`
- `govuk-service-navigation__item--active`
- `govuk-service-navigation__link`
- `govuk-service-navigation__active-fallback`

The existing `data-active` and `data-nav` contract is preserved. `layout.js` now applies the GOV.UK active state to the list item and sets `aria-current="true"` on the active link.

### Phase banner

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

ResearchOps remains a prototype, so a shared phase banner is included under the service navigation.

The banner warns users not to enter real participant personal data.

### Footer

Target classification: GOV.UK global.

Implemented in:

- `public/partials/footer.html`
- `public/css/govuk/govuk-page-chrome.css`

The shared footer now uses GOV.UK-style footer classes:

- `govuk-footer`
- `govuk-footer__container`
- `govuk-footer__meta`

## CSS ownership

Base page chrome styling lives in:

`public/css/govuk/govuk-page-chrome.css`

Route stylesheets must not recreate shared header, service navigation, skip-link, phase banner or footer behaviour.

The page chrome stylesheet currently provides a static GOV.UK-compatible foundation while ResearchOps does not yet import the full `govuk-frontend` package. A later migration should replace these local approximations with GOV.UK Frontend assets and macro-generated component output.

## What changed

Changed files in this migration area:

- `public/css/govuk/govuk-page-chrome.css`
- `public/partials/header.html`
- `public/partials/footer.html`
- `public/components/layout.js`
- `docs/design-system/govuk-page-chrome-navigation-migration.md`
- `tests/govuk-page-chrome-navigation-route-state.test.js`

## What did not change

This migration does not rewrite every route component.

This migration does not replace every local GOV.UK-style component with the upstream GOV.UK Frontend package.

This migration does not change API payloads, Airtable payloads, or dynamic breadcrumb IDs.

## Wider GOV.UK Design System migration still required

ResearchOps still needs a fuller GOV.UK Design System refresh across the component set.

Priority areas:

- replace local component approximations with GOV.UK Frontend component output where possible
- audit all page templates against the current GOV.UK page template, header and Service navigation patterns
- update form components, error summaries, fieldsets, checkboxes, radios, file upload, summary lists, tables, tags, task lists and notification states against the current examples
- remove legacy component aliases once route-state tests no longer depend on them
- add regression coverage for component-level markup, not just route-level presence checks
- add visual checks for refreshed branding across desktop and mobile

## Manual checks

Check these routes after merge:

- `/`
- `/pages/start/`
- `/pages/projects/`
- `/pages/project-dashboard/?id=<project-id>`
- `/pages/project-dashboard/participants/?pid=<project-id>`
- `/pages/project-dashboard/participants/import/?pid=<project-id>`
- `/pages/study/new/?pid=<project-id>`
- `/pages/study/?pid=<project-id>&sid=<study-id>`
- `/pages/study/guides/?pid=<project-id>&sid=<study-id>`
- `/pages/study/participants/?pid=<project-id>&sid=<study-id>`
- `/pages/projects/outcomes/?id=<project-id>`

Confirm:

- skip link appears on keyboard focus
- skip link moves focus to main content
- header uses the refreshed GOV.UK header treatment
- service name appears in Service navigation, not the GOV.UK header
- active service navigation state remains correct
- mobile service navigation can be expanded and collapsed
- phase banner appears once
- route-specific breadcrumbs and dynamic IDs still work
- no route stylesheet owns shared page chrome styling

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`
- `npm test`

The application-level route-state test is:

`tests/govuk-page-chrome-navigation-route-state.test.js`
