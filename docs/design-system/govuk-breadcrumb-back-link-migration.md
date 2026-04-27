# GOV.UK breadcrumb and back-link migration

Date: 2026-04-27
Branch: `design-system/govuk-breadcrumbs-back-links-all-routes`
Scope: Route-level breadcrumbs, parent links and back-link styling.

## Purpose

This document records the GOV.UK breadcrumb and back-link migration for ResearchOps.

Breadcrumbs and back links are orientation patterns. They must not be treated as decorative navigation. Breadcrumbs show hierarchy. Back links return to a parent or previous step.

## Component classification

### Breadcrumbs

Target classification: GOV.UK global.

Implemented through:

- `public/css/govuk/govuk-page-chrome.css`
- route-level `nav.govuk-breadcrumbs` markup

The route-level breadcrumb contract uses:

```html
<nav class="govuk-breadcrumbs" aria-label="Breadcrumb">
  <ol class="govuk-breadcrumbs__list">
    <li class="govuk-breadcrumbs__list-item">
      <a class="govuk-breadcrumbs__link" href="/pages/projects/">Projects</a>
    </li>
    <li class="govuk-breadcrumbs__list-item" aria-current="page">Current page</li>
  </ol>
</nav>
```

Dynamic project and study links preserve their controller-owned IDs.

Examples:

- `breadcrumb-project`
- `breadcrumb-study`
- `project-link`

### Back links and parent links

Target classification: GOV.UK global for styling, route-owned for destination.

Implemented through:

- `public/css/govuk/govuk-page-chrome.css`
- route-level links where a parent route is useful

Visible arrow characters such as `←` must not be placed in link text. The global back-link style owns arrow presentation.

Where the link is styled as a button for a route action toolbar, the visible label still avoids decorative arrow characters.

## Routes covered

### Project Dashboard

Route:

`/pages/project-dashboard/?id=<project-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves `breadcrumb-project`.

### Research Outcomes

Route:

`/pages/projects/outcomes/?id=<project-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves `breadcrumb-project`.

The parent link text is `Back to project dashboard` without a decorative arrow in the markup.

### Journals

Route:

`/pages/projects/journals/?id=<project-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves `project-link`.

### Study

Route:

`/pages/study/?pid=<project-id>&sid=<study-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves `breadcrumb-project`.

The parent link text is `Back to Project` without a decorative arrow in the markup.

### Discussion Guides

Route:

`/pages/study/guides/?pid=<project-id>&sid=<study-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves:

- `breadcrumb-project`
- `breadcrumb-study`

The parent link text is `Back to Study` without a decorative arrow in the markup.

### Consent Forms

Route:

`/pages/study/consent-forms/?pid=<project-id>&sid=<study-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves:

- `breadcrumb-project`
- `breadcrumb-study`

The parent link text is `Back to Study` without a decorative arrow in the markup.

### Participants

Route:

`/pages/study/participants/?pid=<project-id>&sid=<study-id>`

The breadcrumb now uses `govuk-breadcrumbs` markup and preserves:

- `breadcrumb-project`
- `breadcrumb-study`

## What did not change

This migration does not rewrite route controllers.

This migration does not change project, study, participant or outcome payloads.

This migration does not remove controller-owned IDs.

This migration does not replace workflow action buttons with back links unless doing so is safe for existing route behaviour.

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`

The route-state test is:

`tests/govuk-breadcrumb-back-link-route-state.test.js`

## Manual checks

Check these routes after merge:

- `/pages/project-dashboard/?id=<project-id>`
- `/pages/projects/outcomes/?id=<project-id>`
- `/pages/projects/journals/?id=<project-id>`
- `/pages/study/?pid=<project-id>&sid=<study-id>`
- `/pages/study/guides/?pid=<project-id>&sid=<study-id>`
- `/pages/study/consent-forms/?pid=<project-id>&sid=<study-id>`
- `/pages/study/participants/?pid=<project-id>&sid=<study-id>`

Confirm that breadcrumbs render as a list, dynamic project and study links still populate, and no visible link text includes decorative arrows.
