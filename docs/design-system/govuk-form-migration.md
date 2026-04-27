# GOV.UK form migration

Date: 2026-04-27
Branch: `design-system/govuk-forms-foundation`
Scope: Global GOV.UK form foundation and migration contract.

## Purpose

This document records the GOV.UK form migration contract for ResearchOps.

Forms are higher risk than buttons because they affect labels, hints, validation, error handling, field grouping, keyboard flow, and controller behaviour.

This migration must therefore preserve field IDs, names, submission behaviour, Airtable payload shapes, and route-controller contracts unless a change is explicitly required and validated.

## Component classification

### Form foundation

Current classification: mixed GOV.UK global, ResearchOps global, and route-specific.

Target classification: GOV.UK global.

Target file:

- `public/css/govuk/govuk-forms.css`

Decision:

`public/css/govuk/govuk-forms.css` is the global GOV.UK form foundation. It defines base GOV.UK form components and must be used before route stylesheets specialise page-specific form layouts.

## Required GOV.UK form components

The global foundation covers:

- `govuk-form-group`
- `govuk-form-group--error`
- `govuk-label`
- `govuk-label--s`
- `govuk-fieldset`
- `govuk-fieldset__legend`
- `govuk-fieldset__legend--s`
- `govuk-hint`
- `govuk-error-message`
- `govuk-input`
- `govuk-input--error`
- `govuk-textarea`
- `govuk-textarea--error`
- `govuk-select`
- `govuk-select--error`
- `govuk-error-summary`
- `govuk-error-summary__title`
- `govuk-error-summary__body`
- `govuk-error-summary__list`
- `govuk-checkboxes__item`
- `govuk-checkboxes__input`
- `govuk-checkboxes__label`
- `govuk-radios__item`
- `govuk-radios__input`
- `govuk-radios__label`
- `govuk-button-group`

## Hard rules

Do not create route-level replacements for GOV.UK base form styling.

Do not move base label, hint, input, textarea, select, error, radio, checkbox, or error-summary styling into route stylesheets.

Route stylesheets may only define page-specific form layout, grid, panel, editor, or workflow spacing.

Do not change field IDs or names while migrating form structure unless the relevant controller and route-state test are updated in the same PR.

Do not change API payloads as part of visual or structural form migration.

## Migration sequence

### Phase 1: foundation

Add the global form foundation:

`public/css/govuk/govuk-forms.css`

Validation should require this file and this migration document.

### Phase 2: stylesheet wiring

Wire the global form foundation into form-heavy routes that already use GOV.UK form classes.

The form stylesheet should load after:

- `public/css/govuk/govuk-typography.css`
- `public/css/govuk/govuk-colours.css`
- `public/css/screen.css`
- `public/css/govuk/govuk-buttons.css` where present

It should load before the route stylesheet.

### Phase 3: structural form migration

Migrate each form surface to complete GOV.UK structure:

- each field in a `govuk-form-group`
- visible `govuk-label` associated with its control
- `govuk-hint` connected through `aria-describedby` where relevant
- `govuk-error-message` connected through `aria-describedby` when validation errors exist
- `govuk-error-summary` for forms with validation
- `govuk-fieldset` and `govuk-fieldset__legend` for grouped fields
- `govuk-radios` or `govuk-checkboxes` structure for grouped choices

This should be done in grouped slices, not one field at a time.

## Priority form surfaces

### Start research project

Route:

`/pages/start/`

Why it is high priority:

- entry route
- multi-step flow
- required fields
- existing validation and inline error containers
- AI assistance controls attached to form fields

Migration target:

- convert each step to complete GOV.UK form-group structure
- convert `error-summary` to GOV.UK error summary
- preserve all current IDs and controller behaviour

### Consent forms

Route:

`/pages/study/consent-forms/`

Why it is high priority:

- high-trust participant-facing content
- validation-sensitive JSON fields
- publish workflow

Migration target:

- complete form groups and error handling
- fieldsets for metadata groups
- maintain preview and source editor behaviour

### Study participants

Route:

`/pages/study/participants/`

Why it is high priority:

- participant contact details
- scheduling workflow
- disabled-state logic based on participant availability

Migration target:

- form groups for Add participant and Schedule session
- fieldsets for grouped contact and scheduling details
- preserve all scheduler controller IDs

### Study session

Route:

`/pages/study/session/`

Why it is high priority:

- live research workflow
- participant selector
- note framework and category fields
- toolbar and note editor interactions

Migration target:

- GOV.UK form groups for selectors
- review toolbar buttons separately as an interaction-pattern pass

### Reflexive Journal and Analysis

Route:

`/pages/projects/journals/`

Why it is high priority:

- journal entry creation
- code and memo management
- analysis search

Migration target:

- full GOV.UK form structure for entry form and retrieval search
- generated forms in `public/js/journal-tabs.js` should be handled in a local/full-source edit due to file size

### Discussion Guides

Route:

`/pages/study/guides/`

Why it is high priority:

- editor toolbar
- title input
- source and preview panels
- variables drawer

Migration target:

- GOV.UK labels, hints, and form groups for title, search, variables, and editor controls
- keep editor split pane as route-specific layout

## Known constraints

Some large JavaScript controllers generate form markup. Do not rewrite them through a connector response if the source is truncated.

If the connector cannot safely rewrite a large generated module, open a follow-up issue with exact manual instructions.

## Validation expectations

Every form migration PR must include:

- `npm run validate`
- `npm run lint`
- route-state tests for migrated markup
- no changes to API payloads unless explicitly documented
- manual browser checks for affected routes

## Manual browser checks

For each migrated form route, check:

- labels are visible and associated with fields
- hints remain visible and useful
- keyboard focus follows a logical order
- focus style uses GOV.UK focus treatment
- validation errors remain perceivable
- submit behaviour still works
- disabled controls remain readable
- field IDs still match controller expectations

## Rollback note

If a form migration breaks behaviour, revert structural markup before reverting the global foundation.

The global foundation should remain unless it is the direct cause of the regression.
