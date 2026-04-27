# ResearchOps component inventory

Date: 2026-04-26
Branch: `design-system/govuk-compliance-baseline`
Scope: Shared frontend classes, route stylesheets, and GOV.UK migration ownership.

## Purpose

This inventory classifies existing ResearchOps UI components before GOV.UK Design System migration work begins.

It prevents route-level stylesheets from becoming a forked design system.

## Classification model

Each component or selector group should be classified as one of:

- GOV.UK global
- ResearchOps global
- route-specific
- legacy temporary
- obsolete
- uncertain

## Hard rule

Do not move or duplicate a shared component into route CSS merely because a page uses it.

If a class is reused across routes, it should remain global or be formally replaced by a GOV.UK component through a planned global migration.

## Current component inventory

### Header and top navigation

Current selectors or files:

- `/partials/header.html`
- `/components/layout.js`
- global header/navigation styles in `public/css/screen.css`

Current classification: ResearchOps global.

Target classification: GOV.UK global or approved ResearchOps global.

Migration decision:

- Preferred target is GOV.UK header plus service navigation.
- Do not implement header changes route by route.
- Header migration must happen through shared partials and global styles.

### Footer

Current selectors or files:

- `/partials/footer.html`
- footer styles in `public/css/screen.css`

Current classification: ResearchOps global.

Target classification: GOV.UK global or approved ResearchOps global.

Migration decision:

- Migrate through shared partials.
- Do not create route-specific footer styles.

### Typography

Current selectors or files:

- `public/css/govuk/govuk-typography.css`
- `public/css/screen.css`
- classes such as `govuk-heading-l`, `govuk-heading-m`, `govuk-heading-s`, `govuk-body`, `lede`

Current classification: mixed GOV.UK global and ResearchOps global.

Target classification: GOV.UK global.

Migration decision:

- Typography should be global.
- Route stylesheets should not redefine heading, paragraph, or body text defaults.

### Colours

Current selectors or files:

- `public/css/govuk/govuk-colours.css`
- `public/css/screen.css`
- route-level CSS files

Current classification: mixed GOV.UK global and route-specific.

Target classification: GOV.UK global with documented ResearchOps exceptions.

Migration decision:

- Focus, link, button, border, warning, success, and error colours should be governed globally.
- Route CSS must not invent focus colours or status colours without a documented component need.

### Buttons

Current selectors:

- `.btn`
- `.btn--outline`
- `.btn--secondary`
- `.govuk-button`
- `.govuk-button--secondary`

Current classification: mixed ResearchOps global and GOV.UK global.

Target classification: GOV.UK global.

Migration decision:

- Migrate custom buttons to GOV.UK button classes through a dedicated global button migration.
- Do not solve button inconsistency in individual route stylesheets.
- Preserve behaviour and disabled states during migration.

### Forms

Current selectors:

- `.govuk-form-group`
- `.govuk-label`
- `.govuk-hint`
- `.govuk-input`
- `.govuk-select`
- `.govuk-textarea`
- route-specific form classes such as `.start-form`, `.outcomes-form`, `.consent-form`, `.sessions-form`, `.notes-editor`

Current classification: mixed GOV.UK global and route-specific.

Target classification: GOV.UK global for base form components; route-specific only for product layout and workflow-specific panels.

Migration decision:

- Full GOV.UK form structure must include form groups, labels, hints, fieldsets, legends, error messages, and error summaries where relevant.
- Route CSS may handle page-specific form layout but not base field styling.

### Error handling

Current selectors:

- inconsistent route-specific error and status areas
- custom error panels
- limited or missing GOV.UK error summary usage

Current classification: legacy temporary.

Target classification: GOV.UK global.

Migration decision:

- Forms with validation should use GOV.UK error summary and inline error messages.
- Error migration should be done route by route with browser validation.

### Cards

Current selectors:

- `.card`
- project cards
- journey cards
- setup task cards

Current classification: ResearchOps global.

Target classification: ResearchOps global unless replaced by a GOV.UK-compatible pattern.

Migration decision:

- Keep `.card` global while auditing.
- Do not duplicate `.card` into route stylesheets.
- Decide whether card variants become named ResearchOps global components.

### Sections

Current selectors:

- `.section`
- `.section__header`
- `.section__title`
- `.section__body`
- `.section__grid`

Current classification: ResearchOps global.

Target classification: ResearchOps global unless replaced by GOV.UK summary list, task list, or other GOV.UK pattern.

Migration decision:

- Preserve this global contract until intentionally replaced.
- Do not rename route markup away from `.section` classes just to avoid cascade issues.
- Route CSS must not duplicate `.section` rules.

### Dashboard navigation board

Current selectors:

- `.board`
- `.board__item`

Current classification: ResearchOps global.

Target classification: ResearchOps global or GOV.UK-compatible card navigation pattern.

Migration decision:

- Keep global while auditing.
- Do not move `.board` into Project Dashboard route CSS.
- If replaced, replace globally and update affected routes deliberately.

### Key-value metadata

Current selectors:

- `.kv`
- `.kv__list`
- `.kv__term`
- `.kv__desc`

Current classification: ResearchOps global.

Target classification: likely GOV.UK summary list.

Migration decision:

- Consider replacing with GOV.UK summary list in a dedicated metadata migration.
- Do not duplicate key-value styles in route stylesheets.

### Lists

Current selectors:

- `.list-unstyled`
- `.list-divided`

Current classification: ResearchOps global.

Target classification: ResearchOps global or GOV.UK list/table/summary pattern depending on use.

Migration decision:

- Preserve as global while auditing.
- Convert to GOV.UK lists, tables, task lists, or summary lists where the pattern is clearer.

### Tags and pills

Current selectors:

- `.tag`
- `.pill`
- `.pill--neutral`
- filter chip-like controls

Current classification: mixed ResearchOps global and route-specific.

Target classification: GOV.UK tag for statuses; ResearchOps global for filter chips if needed.

Migration decision:

- Status labels should move toward GOV.UK tags.
- Filter chips need a documented ResearchOps component if kept.
- Do not use route CSS to invent new pill styles without classification.

### Tabs

Current selectors:

- journal tab navigation classes
- tab-like link groups

Current classification: mixed ResearchOps global and route-specific.

Target classification: GOV.UK tabs where behaviour matches tabbed content.

Migration decision:

- Reflexive Journal tabs should be checked against GOV.UK tabs markup and keyboard behaviour.
- Do not migrate visual tabs without verifying accessible tab semantics.

### Tables

Current selectors:

- `.govuk-table`
- `.govuk-table__head`
- `.govuk-table__row`
- `.govuk-table__header`
- route-specific table wrappers

Current classification: GOV.UK global with route-specific wrappers.

Target classification: GOV.UK global.

Migration decision:

- Keep GOV.UK table classes.
- Keep horizontal scroll wrappers route-specific only where needed.

### Dropzone

Current selectors:

- `.dropzone`

Current classification: ResearchOps global or uncertain.

Target classification: ResearchOps global unless replaced by file upload pattern.

Migration decision:

- Do not move `.dropzone` into a route stylesheet while it may be shared.
- Review against GOV.UK file upload component.

### Dialogs

Current selectors:

- `#study-dialog`
- dialog-specific form and backdrop rules

Current classification: route-specific.

Target classification: route-specific or ResearchOps global modal/dialog component if reused.

Migration decision:

- Keep `#study-dialog` styles route-specific until a shared dialog pattern exists.
- Confirm keyboard, focus management, and close behaviour.

### Route stylesheets

Current files:

- `public/css/projects.css`
- `public/css/project-dashboard.css`
- `public/css/search.css`
- `public/css/notes.css`
- `public/css/consent.css`
- `public/css/sessions.css`
- `public/css/synthesize.css`
- `public/css/start.css`
- `public/css/outcomes.css`
- `public/css/study-page.css`
- `public/css/guides.css`
- `public/css/participants.css`

Current classification: route-specific files with mixed selector ownership.

Target classification: route-specific files containing only page-specific or divergent styles.

Migration decision:

- Audit each file before pruning.
- Do not assume every selector in a route stylesheet belongs there.
- Remove route-level duplicates only after browser validation.

## Migration backlog

### Priority 1: Global button migration

Target branch:

`design-system/govuk-buttons-global-contract`

Goal:

- Map `.btn`, `.btn--outline`, and `.btn--secondary` to GOV.UK button usage.
- Migrate low-risk pages first.
- Update validation tests.

### Priority 2: Form structure migration

Target branch:

`design-system/govuk-form-structure-start`

Goal:

- Start with `/pages/start/` because it is an entry route and has a contained multi-step form.
- Add error summary and field-level error contract.

### Priority 3: Header and service navigation

Target branch:

`design-system/govuk-header-service-navigation`

Goal:

- Replace or formalise the current ResearchOps header.
- Keep implementation in shared partials and global CSS.

### Priority 4: Summary lists and task lists

Target branch:

`design-system/govuk-summary-task-patterns`

Goal:

- Replace key-value metadata and readiness rows where GOV.UK summary list or task list is the correct pattern.

## Validation guardrail

Design-system route-state tests should protect global component ownership.

Where a component is classified as global, tests should prevent route stylesheets from redefining that component unless the PR explicitly changes the classification.
