# GOV.UK page chrome and navigation migration

Date: 2026-04-27
Branch: `design-system/govuk-page-chrome-navigation-all-routes`
Scope: Shared page chrome, service navigation, skip link, phase banner, footer and main-content targeting.

## Purpose

This document records the GOV.UK page chrome and navigation migration for ResearchOps.

Page chrome is a shared service frame. It must remain global. Route stylesheets may lay out route content, but they must not define independent header, footer, skip-link or service-navigation systems.

## Component classification

### Skip link

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The skip link points to `#main-content`.

The shared header helper preserves existing route-facing main IDs. If a page already has a main ID such as `main` or `content`, the helper inserts a small `#main-content` target before the main landmark. If a page has an unnamed main landmark, it assigns `id="main-content"` to that landmark.

### Header

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The shared header now uses GOV.UK-style service header classes:

- `govuk-header`
- `govuk-header__container`
- `govuk-header__service-name`
- `govuk-header__link`
- `govuk-header__service-description`

### Service navigation

Target classification: GOV.UK global.

Implemented in:

- `public/partials/header.html`
- `public/css/govuk/govuk-page-chrome.css`

The shared service navigation now uses GOV.UK-style service navigation classes:

- `govuk-service-navigation`
- `govuk-service-navigation__container`
- `govuk-service-navigation__list`
- `govuk-service-navigation__item`
- `govuk-service-navigation__link`

The existing `data-active` and `data-nav` contract is preserved so `layout.js` continues to set active navigation state.

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

## What changed

Changed files:

- `public/css/govuk/govuk-page-chrome.css`
- `public/partials/header.html`
- `public/partials/footer.html`
- `docs/design-system/govuk-page-chrome-navigation-migration.md`
- `tests/govuk-page-chrome-navigation-route-state.test.js`
- `scripts/validate.sh`

## What did not change

This migration does not rewrite route content.

This migration does not change page controllers, API payloads, Airtable payloads, or dynamic breadcrumb IDs.

This migration does not rename existing route-facing main IDs such as `main` or `content`.

## Manual checks

Check these routes after merge:

- `/`
- `/pages/start/`
- `/pages/projects/`
- `/pages/project-dashboard/?id=<project-id>`
- `/pages/study/?pid=<project-id>&sid=<study-id>`
- `/pages/study/guides/?pid=<project-id>&sid=<study-id>`
- `/pages/study/participants/?pid=<project-id>&sid=<study-id>`
- `/pages/projects/outcomes/?id=<project-id>`

Confirm:

- skip link appears on keyboard focus
- skip link moves focus to main content
- header and footer are visually consistent
- active service navigation state remains correct
- phase banner appears once
- route-specific breadcrumbs and dynamic IDs still work
- no route stylesheet owns shared page chrome styling

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`

The application-level route-state test is:

`tests/govuk-page-chrome-navigation-route-state.test.js`
