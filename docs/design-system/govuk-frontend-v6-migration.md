# GOV.UK Frontend v6 migration

Date: 2026-05-05
Branch: `feature/govuk-frontend-v6-component-migration`
Scope: Dedicated GOV.UK Frontend v6 component migration contract.

## Purpose

This document records the dedicated GOV.UK Frontend v6 migration contract for ResearchOps.

The migration replaces local approximations for forms, buttons, error summaries, fieldsets, radios, checkboxes, file upload, tables, summary lists, tags and notification states with upstream GOV.UK Frontend-compatible markup and styles.

The goal is not to cosmetically restyle isolated pages. The goal is to move ResearchOps towards a single GOV.UK-compatible component contract that can be applied consistently across the service.

## Migration principle

Use upstream GOV.UK Frontend component names, structure and state classes wherever ResearchOps renders GOV.UK components.

Where the platform still contains legacy ResearchOps aliases, such as `.btn` or `.tag`, those aliases must be temporary compatibility bridges. They must not become a second design system.

## Global contract

The canonical migration layer is:

- `public/css/govuk/govuk-frontend-v6.css`

This file loads after existing local CSS so it can neutralise route-level and legacy approximations without requiring a risky one-shot rewrite of every page and controller.

The compatibility layer covers:

- `govuk-button`
- `govuk-button--secondary`
- `govuk-button--warning`
- `govuk-button--start`
- `govuk-button-group`
- `govuk-form-group`
- `govuk-form-group--error`
- `govuk-label`
- `govuk-hint`
- `govuk-error-message`
- `govuk-fieldset`
- `govuk-fieldset__legend`
- `govuk-fieldset__heading`
- `govuk-input`
- `govuk-textarea`
- `govuk-select`
- `govuk-file-upload`
- `govuk-radios`
- `govuk-radios__item`
- `govuk-radios__input`
- `govuk-radios__label`
- `govuk-checkboxes`
- `govuk-checkboxes__item`
- `govuk-checkboxes__input`
- `govuk-checkboxes__label`
- `govuk-error-summary`
- `govuk-error-summary__title`
- `govuk-error-summary__body`
- `govuk-error-summary__list`
- `govuk-table`
- `govuk-table__caption`
- `govuk-table__header`
- `govuk-table__cell`
- `govuk-summary-list`
- `govuk-summary-list__row`
- `govuk-summary-list__key`
- `govuk-summary-list__value`
- `govuk-summary-list__actions`
- `govuk-tag`
- `govuk-tag--grey`
- `govuk-tag--green`
- `govuk-tag--blue`
- `govuk-tag--red`
- `govuk-tag--yellow`
- `govuk-notification-banner`
- `govuk-notification-banner--success`

## Hard rules

Do not add new route-level component approximations.

Do not add new `.btn`, `.tag`, `.table`, `.panel[role="alert"]`, custom radio, custom checkbox, custom file-upload, or custom notification styling when a GOV.UK component contract exists.

Do not use route CSS to override the base GOV.UK form, button, table, summary list, tag, notification banner, radio, checkbox, error-summary, fieldset, or file-upload contracts.

Route stylesheets may only define page-specific layout, composition, spacing, and workflow affordances.

Do not change field IDs, names, generated payload shapes, URL parameters, or controller selectors as part of this migration unless the relevant controller and route-state tests are updated in the same PR.

## Markup expectations

Buttons should use GOV.UK button classes. JavaScript-enhanced buttons should retain their existing IDs and `type` values.

Error summaries should use `govuk-error-summary`, `govuk-error-summary__title`, `govuk-error-summary__body` and `govuk-error-summary__list`.

Field groups should use `govuk-form-group`. Error states should use `govuk-form-group--error` and the matching control error modifier where needed.

Grouped choices should use `govuk-fieldset` with a meaningful legend. Radios and checkboxes should use GOV.UK item, input and label classes.

File upload controls should use `govuk-file-upload` rather than dropzone-only or route-specific input styling.

Tables should use `govuk-table`, `govuk-table__head`, `govuk-table__body`, `govuk-table__row`, `govuk-table__header` and `govuk-table__cell`.

Summary lists should use `govuk-summary-list`, `govuk-summary-list__row`, `govuk-summary-list__key`, `govuk-summary-list__value` and, when required, `govuk-summary-list__actions`.

Status tags should use `govuk-tag` plus GOV.UK tag colour modifiers instead of bespoke pill classes where the tag is expressing a status.

Notification states should use `govuk-notification-banner`. Success states should use `govuk-notification-banner--success`.

## Implementation strategy

This PR deliberately uses a global compatibility layer first.

That keeps the migration safe because many ResearchOps pages still contain route-specific layouts and JavaScript-generated markup. It avoids changing behaviour while bringing the visible component contract closer to GOV.UK Frontend v6.

The next pass should remove legacy aliases once every page and generated controller has upstream-compatible markup.

## Validation expectations

Every GOV.UK Frontend v6 migration change must preserve:

- route-state tests
- generated acceptance criteria contracts
- visual walkthrough registration
- keyboard interaction
- existing controller selectors
- API payload contracts

The release gate should continue to run:

- `npm run validate`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run audit:performance --if-present`
- `npm run audit:security`

## Manual review checklist

Review at least one page for each migrated surface:

- Start a new research project: form groups, buttons, error summary and summary list
- Projects page: cards, tags and project status states
- Project dashboard: action buttons and notification-style states
- Add participant: form groups, select, validation and buttons
- Import participants: file upload, preview table and error summary
- Study participant consent: fieldsets and checkboxes
- Reflexive journals: fieldsets and radios
- Synthesis: tables, controls and disabled states

## Rollback note

If a route breaks, revert the route markup or generated controller first.

Only revert `public/css/govuk/govuk-frontend-v6.css` if the global compatibility layer is the direct cause of the regression.
