# GOV.UK design system compliance audit

Date: 2026-04-26
Branch: `design-system/govuk-compliance-baseline`
Scope: ResearchOps public frontend routes and shared UI contracts.

## Purpose

This document is the design-system ledger for moving ResearchOps toward GOV.UK Design System compliance.

It is deliberately separate from `docs/performance/initial-load-audit.md`.

Performance work decides how assets load. Design-system work decides which components, patterns, markup structures, states, and accessibility behaviours the product should use.

## Operating doctrine

ResearchOps must move toward GOV.UK Design System compliance without replacing working global CSS contracts with route-specific clones.

Global styles remain global.

Route-level stylesheets are only for page-specific or deliberately divergent styles that cannot safely live in the global layer.

Before changing CSS or markup for design-system work, classify the affected selector or component as:

- GOV.UK global
- ResearchOps global
- route-specific
- legacy temporary
- obsolete
- uncertain

If the classification is uncertain, do not move or remove it until the route has been inspected in browser.

## Current baseline summary

The current ResearchOps UI is GOV.UK-inspired rather than GOV.UK-compliant.

The product already uses some GOV.UK class names, including headings, buttons in some places, form controls in some places, tables, hints, labels, back links, and tabs-like structures.

The implementation is inconsistent. It also has custom components such as `card`, `section`, `board`, `pill`, `tag`, `btn`, `dropzone`, `kv`, and route-specific stylesheets.

The migration must therefore standardise the global component layer before making large route-level changes.

## Route audit

### Home

Path: `/`

Observed role: journey selection and product orientation.

Current state:

- Uses a consistent ResearchOps header and top navigation.
- Uses card-style journey tiles.
- Uses prominent blue calls to action.
- Does not use the GOV.UK header component or service navigation structure.
- Journey cards are custom and need classification as GOV.UK pattern, ResearchOps global pattern, or page-specific component.

Design-system actions:

- Decide whether journey tiles are a ResearchOps global component or GOV.UK card-like pattern.
- Ensure heading hierarchy, body copy, link text, and CTAs follow GOV.UK content and interaction rules.
- Do not move shared card styles into the home stylesheet unless the card is genuinely home-specific.

### Start research project

Path: `/pages/start/`

Observed role: multi-step project creation.

Current state:

- Uses a multi-step form.
- Uses labels, hints, inputs, selects, and a primary button.
- Some form classes are GOV.UK-like but the full GOV.UK form group, error summary, fieldset, legend, and validation pattern is not yet consistently enforced.
- Focus styling needs to be aligned to GOV.UK focus behaviour.

Design-system actions:

- Migrate form structure to GOV.UK form groups, fieldsets, legends, hints, error messages, and error summary.
- Keep step-specific behaviour in route JavaScript.
- Keep only start-specific layout or assistance panel styles in `public/css/start.css`.

### Projects list

Path: `/pages/projects/`

Observed role: browse and select projects.

Current state:

- Uses project cards with organisation labels, project names, status metadata, descriptions, user group tags, and details links.
- Cards and tags are custom.
- Long research descriptions reduce scanability.

Design-system actions:

- Classify project cards as ResearchOps global cards or convert to a GOV.UK-compatible summary/card pattern.
- Consider GOV.UK summary list for project metadata.
- Consider GOV.UK tag for status and user group values where appropriate.
- Avoid replacing global card styles in `projects.css` unless the difference is route-specific.

### Project dashboard

Path: `/pages/project-dashboard/?id=<project-id>`

Observed role: project hub and operational dashboard.

Current state:

- Uses global `section`, `section__header`, `section__title`, `section__body`, and `section__grid` classes.
- Recent regression showed that replacing these global classes with route-owned classes caused a major visual regression.
- `project-dashboard.css` is now limited to page-specific Mural/status/dialog styles.

Design-system actions:

- Preserve the global section contract until the global component is intentionally changed.
- Convert metadata to GOV.UK summary list only as a deliberate global or route migration.
- Convert custom `btn` uses to GOV.UK buttons in a dedicated button migration.
- Consider whether the navigation board should become a ResearchOps global navigation-card component.

### Reflexive Journal and Analysis

Path: `/pages/projects/journals/?id=<project-id>`

Observed role: journal entries, coding, memos, and analysis.

Current state:

- Uses a tabbed navigation pattern.
- Contains filter chips, action buttons, journal entry cards, code lists, memo filters, and analysis actions.
- The tabs are visually close to GOV.UK tabs but need markup and behaviour confirmation.

Design-system actions:

- Align the tab markup and behaviour with GOV.UK tabs.
- Replace status/filter chips with GOV.UK tags or a documented ResearchOps filter component.
- Confirm buttons use GOV.UK button classes and states.
- Keep Mural-specific sync actions as product-specific behaviour with GOV.UK-compatible UI.

### Study page

Path: `/pages/study?id=<project-id>&sid=<study-id>`

Observed role: study summary, readiness, and setup tasks.

Current state:

- Shows title, study metadata, readiness checks, and setup task cards.
- Readiness rows and setup cards are custom.
- The task state badges are custom.

Design-system actions:

- Consider GOV.UK task list for readiness and setup tasks.
- Consider GOV.UK summary list for study metadata.
- Use GOV.UK tags for readiness states.
- Preserve existing behaviour while changing markup in small PRs.

### Discussion guides

Path: `/pages/study/guides/`

Observed role: guide list and Markdown editor.

Current state:

- Uses a table, toolbar actions, editor panes, drawers, and preview.
- Some parts are necessarily product-specific.
- The editor layout should remain page-specific, but controls should use GOV.UK form and button patterns where possible.

Design-system actions:

- Keep the editor split pane as a route-specific component.
- Ensure toolbar buttons, guide title input, table headings, and form labels follow GOV.UK patterns.
- Preserve existing drawer structure and IDs.

### Notes

Path: `/pages/notes/`

Observed role: session note capture.

Current state:

- Uses cards, select, textarea, tags input, save button, and rendered notes area.
- Simple and close to GOV.UK forms, but not fully validated against GOV.UK form group and error patterns.

Design-system actions:

- Migrate note form to full GOV.UK form-group markup.
- Use GOV.UK error summary for failed save or missing required fields.
- Keep note-specific editor spacing in `public/css/notes.css` only where divergent.

### Consent

Path: `/pages/consent/`

Observed role: link consent to sessions and list consent records.

Current state:

- Uses a card-based form and existing records panel.
- Inputs and selects are visually aligned but need stronger GOV.UK form structure.

Design-system actions:

- Use GOV.UK form groups, labels, hints, selects, and inputs consistently.
- Add error summary and inline errors for required fields.
- Consider GOV.UK table or summary list for consent records.

### Sessions

Path: `/pages/sessions/`

Observed role: create and list sessions.

Current state:

- Uses form controls and card wrappers.
- The public route currently showed a mismatch during browser review: some direct URLs appeared to resolve to unexpected route content.

Design-system actions:

- Confirm route mapping before UI migration.
- Migrate form structure to GOV.UK form groups.
- Preserve route-state tests for the legacy session contract.

### Search

Path: `/pages/search/`

Observed role: query and filter content.

Current state:

- Uses a query panel and results panel.
- Browser review suggested possible route/content mismatch with Sessions.

Design-system actions:

- Confirm route mapping before UI migration.
- Migrate search form to GOV.UK label, input, select, and button patterns.
- Ensure results use GOV.UK-compatible headings, list, or table patterns.

### Synthesis

Path: `/pages/synthesize/`

Observed role: evidence clustering and theme publishing.

Current state:

- Uses two-column evidence and cluster panels.
- Uses inputs, selects, textareas, and buttons.
- Much of the layout is route-specific.

Design-system actions:

- Keep the two-column workspace as route-specific if needed.
- Migrate form controls to GOV.UK markup.
- Use GOV.UK error handling for empty cluster names and publish failures.

### Outcomes

Path: `/pages/projects/outcomes/?id=<project-id>`

Observed role: impact and ROI tracking.

Current state:

- Has dedicated `outcomes.css` and external bootstrap module.
- Uses GOV.UK table and form classes in places.
- The page should be reviewed after the design-system form migration.

Design-system actions:

- Preserve external module and route CSS contracts.
- Migrate the impact form to complete GOV.UK form group and error summary structure.
- Keep outcomes-specific table scrolling and impact layout only in `outcomes.css`.

## Cross-route issues

### Header and navigation

The current header is custom. It should be migrated to GOV.UK header and service navigation, or documented as an approved ResearchOps internal product header.

Given the target is absolute GOV.UK Design System compliance, the preferred direction is to migrate to GOV.UK header and service navigation.

### Buttons

The repository still uses custom `btn`, `btn--outline`, and `btn--secondary` classes.

These should be migrated to GOV.UK button classes in a dedicated migration.

Do not mix custom and GOV.UK button semantics indefinitely.

### Forms

Forms must be migrated to complete GOV.UK form structures.

Using only `govuk-input` or `govuk-select` is not sufficient.

Required structures include form groups, labels, hints, fieldsets, legends, error messages, and error summaries.

### Focus states

Focus states must follow GOV.UK behaviour.

Route-level focus colour overrides should be treated as suspect unless there is an accessibility reason and documented approval.

### Cards, panels, and sections

The repository has useful ResearchOps patterns such as `card`, `section`, `board`, `kv`, and `dropzone`.

Do not remove them until they are classified.

Some may become documented ResearchOps global components built on GOV.UK principles.

### Tags and pills

Custom `pill` and `tag` components should be reviewed.

Status labels should use GOV.UK tags unless a different ResearchOps component is justified.

Filter chips may need to remain a ResearchOps global component if GOV.UK does not provide the exact interaction.

## Recommended migration sequence

1. Establish this baseline and component inventory.
2. Add validation to protect the baseline.
3. Migrate buttons globally.
4. Migrate form structures route by route.
5. Migrate header and navigation.
6. Migrate tabs, tags, task lists, summary lists, and tables.
7. Retire obsolete custom CSS only after browser validation.

## Validation expectations

Every design-system migration PR should include:

- route-state tests where markup or loading contracts change
- `npm run validate`
- `npm run lint`
- manual browser inspection of the changed route
- an audit note in this document or a follow-up entry linked from this document

## Immediate next PR after this baseline

The next implementation PR should be:

`design-system/govuk-buttons-global-contract`

Purpose:

- inventory custom button usage
- establish a global mapping from custom button classes to GOV.UK button classes
- migrate one low-risk route or shared pattern first
- validate in browser before wider rollout
