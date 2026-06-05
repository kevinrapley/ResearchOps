# Study Page GOV.UK Readiness Trace

Date: 2026-06-05  
Branch: `fix/study-page-govuk-readiness`  
Trace requirement: required because the branch uses the `fix/` prefix.

## Task

Bring `/pages/study/?id=<StudyID>&project=<ProjectID>` further into GOV.UK Frontend with Nunjucks macros, remove the redundant back button, make "Edit study" secondary and only make "Begin session" available when full Study readiness is complete.

## Operating Model

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `govuk-design-system`
- `multi-functional-team`

## Team Critique

Researcher use: the page should behave like a working control surface, not a marketing page. The Study title, description and key metadata stay first, then readiness explains what must be completed before fieldwork begins. Breadcrumbs are enough for returning to the project, so the extra "Back to Project" button added visual noise.

Interaction design: "Edit study" is an available maintenance action, not the primary task on this page, so it should be a secondary GOV.UK button. "Begin session" should not look available until the readiness model says every required item is ready.

Accessibility and service safety: disabled-looking links can still be confusing. The session action now starts hidden and is only unhidden when the readiness gate enables it with the real session URL. The task-list row continues to tell researchers what is missing.

## Implementation

- Removed the "Back to Project" button from the Study page Nunjucks template and generated HTML.
- Made the "Edit study" action a secondary GOV.UK button.
- Changed the initial "Begin session" action to be hidden instead of visually disabled.
- Updated the Study page controller so `#link-session` is unhidden only through `enableLink` when all readiness checks pass.
- Stopped the controller from trying to wire the removed `#back-to-project` link.
- Updated the Study page route-state contract for the Nunjucks template, generated HTML and controller.

## Validation

Passed:

- `node --test tests/study-page-route-state.test.js tests/study-child-route-state.test.js`
- `node scripts/govuk/render-govuk-pages.mjs`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `prettier --check` on changed supported files
- `node --test` with 176 passing tests
