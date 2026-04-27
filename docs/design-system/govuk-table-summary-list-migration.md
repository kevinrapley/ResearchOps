# GOV.UK table and summary list migration

Date: 2026-04-27
Branch: `design-system/govuk-tables-summary-lists-all-routes`
Scope: Global GOV.UK table and summary list foundation, plus safe static and generated table migrations.

## Purpose

This document records the GOV.UK tables and summary lists migration for ResearchOps.

Tables and summary lists are shared component contracts. They must remain global. Route stylesheets may lay out tables inside a page, but they must not define a separate table system.

## Component classification

### Data tables

Target classification: GOV.UK global.

Target file:

- `public/css/govuk/govuk-tables.css`

Use `govuk-table` for tabular data. Use rows, headers and cells with the GOV.UK table class contract.

Do not replace real tables with ARIA table divs when native table markup is possible.

### Summary lists

Target classification: GOV.UK global.

Target file:

- `public/css/govuk/govuk-tables.css`

Use `govuk-summary-list` for key-value metadata. This applies to project and study metadata where values are read-only and not presented as a data table.

## Routes covered

### Project Dashboard

Route:

`/pages/project-dashboard/?id=<project-id>`

Changed file:

- `public/pages/project-dashboard/index.html`

The key information block now uses `govuk-summary-list`.

The existing controller-facing IDs are preserved:

- `kv-service-stage`
- `kv-project-stage`
- `kv-client-name`
- `kv-lead-researcher`
- `kv-lead-email`

### Study

Route:

`/pages/study/?pid=<project-id>&sid=<study-id>`

Changed file:

- `public/pages/study/index.html`

The study metadata block now uses `govuk-summary-list`.

The existing controller-facing IDs are preserved:

- `kv-method`
- `kv-status`
- `kv-studyid`

### Discussion Guides

Route:

`/pages/study/guides/?pid=<project-id>&sid=<study-id>`

Changed file:

- `public/pages/study/guides/index.html`

The static guide list table shell now uses `govuk-table`.

The existing controller-facing `guides-tbody` ID is preserved.

Generated rows in `public/components/guides/guides-page.js` need a follow-up local edit because the connector response for that large controller is truncated.

### Study Participants

Route:

`/pages/study/participants/?pid=<project-id>&sid=<study-id>`

Changed files:

- `public/pages/study/participants/index.html`
- `public/components/participants/participants-page.js`
- `public/pages/study/participants/scheduler.js`

The participants and sessions tables now use native table markup and `govuk-table` classes.

The existing controller-facing IDs are preserved or clarified:

- `participantsTable`
- `participantsTableWrap`
- `participants-tbody`
- `sessionsTable`
- `sessionsTableWrap`
- `sessions-tbody`

Generated rows now use `tr`, `td`, `govuk-table__row` and `govuk-table__cell`.

### Research Outcomes

Route:

`/pages/projects/outcomes/?id=<project-id>`

Changed files:

- `public/pages/projects/outcomes/index.html`
- `public/components/impact-tracker.js`

The impact table already used GOV.UK table classes in the static shell. This pass wires the global table foundation and updates generated rows to use GOV.UK table row and cell classes.

## What did not change

This migration does not convert card lists, task cards, readiness lists or navigation boards into tables.

This migration does not move base table styling into route CSS.

This migration does not change API payloads, Airtable payloads, form submission behaviour, generated record shapes or controller IDs.

## Known follow-up

Generated Discussion Guides rows still need a safe local/full-source edit in:

`public/components/guides/guides-page.js`

A follow-up issue has been opened with exact instructions.

## Validation

Expected commands:

- `npm run validate`
- `npm run lint`

The application-level route-state test is:

`tests/govuk-tables-summary-lists-application-route-state.test.js`

## Manual checks

Check these routes after merge:

- `/pages/project-dashboard/?id=<project-id>`
- `/pages/study/?pid=<project-id>&sid=<study-id>`
- `/pages/study/guides/?pid=<project-id>&sid=<study-id>`
- `/pages/study/participants/?pid=<project-id>&sid=<study-id>`
- `/pages/projects/outcomes/?id=<project-id>`

Confirm that summary metadata renders correctly, table headings align, generated rows appear under the correct columns, and controller-driven content still updates the same fields.
