# Study Consent Forms GOV.UK Template Trace

Date: 2026-06-04  
Branch: `feature/study-consent-forms-govuk-template`  
Trace requirement: required because the branch uses the `feature/` prefix.

## Task

Bring `/pages/study/consent-forms/?id=` in line with GOV.UK frontend using Nunjucks templating and macros where possible, fix the Test Project 1 diary-study loading failure, and make the Study record route work with project ID context.

## Operating Model

Loaded:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

## Precedence

GitHub Diamond governed branch hygiene, trace evidence and validation claims. ResearchOps Developer Control governed Study record route behaviour and project/study context handling. GOV.UK Design System governed the frontend page structure, macro use, form component choices and content hierarchy.

## Implementation

Created `src/govuk/templates/pages/study-consent-forms.njk` and registered it in `scripts/govuk/render-govuk-pages.mjs`.

Updated the committed consent forms page to use GOV.UK frontend page chrome and GOV.UK component structures for breadcrumbs, notification banner, buttons, inputs, selects, textareas and details. Existing editor-specific layout remains in `public/css/consent-forms.css`.

Updated project-dashboard Study links and Study child links so the canonical Study record ID route carries parent project context as `project=<project record id>`. The shared Study route resolver and Study page resolver now use project-scoped study lookup as a fallback if direct Study record lookup fails.

Updated consent form loading so a failure to list saved consent forms no longer blocks the page. The editor opens a new draft and shows a status message that saved forms could not be loaded.

## CI Follow-Up

After PR checks reported failures, reproduced the GOV.UK render workflow locally with the locked renderer dependencies. The Nunjucks environment uses strict undefined handling, and the GOV.UK textarea macro expects `value` to be present. Added explicit empty textarea values, moved notification banner `role` and details `open` state onto the documented macro options, and regenerated `public/pages/study/consent-forms/index.html` from the Nunjucks template.

Updated the breadcrumb/back-link route-state assertion to tolerate renderer whitespace while still checking the `back-to-study` control and text contract.

## Test-Contract Sweep

Updated route-state tests covering:

- consent forms page GOV.UK frontend and editor hooks
- Study child route canonical URL handling
- project-aware Study record links from the dashboard
- Study page and participant consent expectations that consume the shared child-route contract
- GOV.UK form, breadcrumb and page chrome contracts

## Validation

Passed:

- `node --input-type=module` importing `renderAllGovukPages()` from `scripts/govuk/render-govuk-pages.mjs`
- `node --test tests/consent-forms-route-state.test.js tests/study-child-route-state.test.js tests/studies-route-contract.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `node --test` with 175 passing tests

Not run:

- `npm run build:govuk-pages`, because this desktop runtime has no `npm` executable. The canonical renderer was run directly with the bundled Node executable after installing the locked renderer packages locally.

## Residual Risk

CI should provide the workflow-level confirmation with `npm ci`; the canonical renderer now passes locally.
