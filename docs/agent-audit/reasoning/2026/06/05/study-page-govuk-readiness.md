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

## Codex Review Follow-Up

Review thread `PRRT_kwDOP3Td2M6HVVet` / comment `PRRC_kwDOP3Td2M7IZFiI` was legitimate. The Study page now hides the session action in markup, so the `study-page.js` cache key needed to change to prevent browsers from reusing the previous controller version that enabled the link without clearing `hidden`.

Follow-up implementation:

- Bumped `studyPageScriptVersion` to `study-readiness-session-gate-20260605`.
- Regenerated `public/pages/study/index.html` so the modulepreload and script URL carry the new Study page controller version.
- Updated the Study page route-state test to assert the new versioned script URL.

## Prototype Review Follow-Up

The multidisciplinary review of the standalone prototype settled on a GOV.UK grid implementation rather than custom column widths. The Study page now uses `govuk-grid-row` with two `govuk-grid-column-one-half` columns so the 50/50 split and gutter come from GOV.UK Frontend.

Follow-up implementation:

- Moved Study details and the "Before you can begin a session" gate into the left half-width GOV.UK column.
- Moved the full Study readiness task list into the right half-width GOV.UK column.
- Added a GOV.UK inset text gate that summarises blocking setup tasks and keeps "Begin session" hidden until readiness is complete.
- Updated the controller so the gate summary, blocker links and project caption are populated from the loaded study context.
- Changed the readiness status row to use "Ready" when the study status is present.
- Changed "Synthesize study evidence" to "Synthesise study evidence".
- Removed custom page and readiness max-width overrides so the layout relies on GOV.UK container and grid widths.

## Validation

Passed:

- `node --test tests/study-page-route-state.test.js tests/study-child-route-state.test.js`
- `node scripts/govuk/render-govuk-pages.mjs`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `prettier --check` on changed supported files
- `node --test` with 176 passing tests

Additional Codex review follow-up validation passed:

- `node --test tests/study-page-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `node scripts/govuk/render-govuk-pages.mjs`
- `prettier --check` on changed supported files
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `node --test`

Additional prototype review follow-up validation passed:

- `node --test tests/study-page-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `node scripts/govuk/render-govuk-pages.mjs`
- `node scripts/styles/format-generated-css.mjs --check`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `prettier --check` on changed supported files
- `node --test` with 176 passing tests
