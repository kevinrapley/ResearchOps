# Study Subpages GOV.UK Nunjucks Trace

Date: 2026-06-05
Branch: `feature/study-subpages-govuk-nunjucks`
Trace requirement: required because the branch uses the `feature/` prefix.

## Task

Bring these Study subpages into full Nunjucks templating with GOV.UK Frontend and macros:

- `/pages/study/participant-consent/?id=`
- `/pages/study/participants/?id=`
- `/pages/study/guides/?id=`
- `/pages/study/synthesis/?id=`

## Operating Model

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `govuk-design-system`

Reviewed operating-model files before implementation:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

Skipped conditional bundles:

- `cloudflare`: no Worker, D1, R2, deployment or runtime behaviour changed.
- `openai-platform`: no OpenAI API or model behaviour changed.
- `mcp-agent-tooling`: no MCP server or agent-tooling implementation changed.
- `airtable-public-api`: no Airtable API integration changed.
- `mural-public-api`: no Mural API integration changed.

## Team Critique

Interaction design: each subpage should feel like a GOV.UK service page, with task-oriented headings, summary lists, task lists, tables, fieldsets and primary actions rather than bespoke page furniture.

Content design: the page copy should support researcher workflows directly and preserve existing dynamic states without introducing prototype-only hard-coded examples.

Frontend and accessibility: Nunjucks templates should use GOV.UK macros wherever the macros can preserve existing IDs, names, ARIA references and JavaScript hooks. Where a dynamic controller owns list content, the static template should still use GOV.UK class names and semantics.

Researcher use: all four routes should keep their current client-side loading behaviour while the initial HTML moves to the shared ResearchOps GOV.UK layout.

Owner review follow-up: the first PR revision was not strong enough. The Study subpages must use the same breadcrumb attributes as the Study page, rely on breadcrumbs rather than duplicated “Back to study” buttons, keep participant consent within the standard GOV.UK content container, remove the legacy participants pill/card layout, and make discussion guides usable as a clear list-plus-editor workflow.

Owner review follow-up on participants: the Study participants page still needed a fuller researcher workflow. The native date-time control was not GOV.UK aligned, channel preference needed to support multiple checkbox selections, the add-participant form needed to align with the project-level participant capture model, and the page forms were too cramped at tablet and desktop widths.

Owner review follow-up on generated CSS: route-specific CSS must be generated from SCSS sources rather than maintained as loose CSS files.

## Implementation

- Added Nunjucks templates for participant consent, participants, guides and synthesis Study subpages.
- Registered the four templates in `scripts/govuk/render-govuk-pages.mjs` so static pages are generated under `public/pages/study/.../index.html`.
- Re-rendered all GOV.UK pages through the existing renderer.
- Preserved existing dynamic route-loader and component hooks so the subpages still hydrate study/project context and route state from the current scripts.
- Replaced bespoke static page chrome with the shared `layouts/researchops.njk` layout and GOV.UK Frontend stylesheet.
- Used GOV.UK macros for breadcrumbs, buttons, selects, inputs, radios, checkboxes, textareas, summary lists and inset text where they fit the existing controller contracts.
- Kept participant consent and synthesis error summaries as hand-authored GOV.UK error-summary markup because their controllers append messages into exact `ul` hooks that the macro does not expose.
- Updated route-state tests so they assert the GOV.UK macro output and dynamic hooks rather than the previous hand-written static markup.
- Standardised Study subpage breadcrumbs with `schema:BreadcrumbList` attributes and `schema:item` attributes for Project and Study breadcrumb links.
- Removed the “Back to study” buttons from participant consent, discussion guides and synthesis so Study subpages rely on breadcrumbs consistently.
- Updated participant consent hydration so the Study breadcrumb and caption use the actual loaded study title.
- Reworked participants into a clear page header, participant management section, add participant form, scheduled sessions section and schedule form using GOV.UK grid widths.
- Removed the legacy participants `badge`, `pill` and `card` styling from the route stylesheet.
- Reworked discussion guides into full-width “Guides for this study” and “Guide editor” sections while preserving editor, drawer and route-loader hooks.
- Reworked the Study participants page again after owner review so the participant table, add-participant form, sessions table and schedule-session form each have their own full-width task section.
- Aligned the Study participants add form with the project-level add-participant pattern: first name, family name, optional participant reference, contact details, preferred contact methods, access or support needs, restricted-data guidance and “What happens next” content.
- Replaced the single channel preference select on Study participants with GOV.UK checkboxes and updated the controller to submit the selected contact methods.
- Replaced the native `datetime-local` session control with GOV.UK date input fields and separate 24-hour time inputs, then updated scheduling validation and focus behaviour to use those fields.
- Added `src/styles/participants.scss`, registered it in the generated CSS targets manifest and rebuilt `public/css/participants.css` from that source.
- Restored the GOV.UK date and time input width modifiers after the app’s local forms stylesheet by scoping width rules to the Study participants route.
- Added mobile spacing between the create-participant action and the “What happens next” details block.

## Validation

Passed:

- `node scripts/govuk/render-govuk-pages.mjs`
- `node --test tests/participant-consent-route-state.test.js tests/participants-page-route-state.test.js tests/study-guides-route-state.test.js tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `git diff --check`
- `node node_modules/prettier/bin/prettier.cjs --check scripts/govuk/render-govuk-pages.mjs public/pages/study/participant-consent/index.html public/pages/study/participants/index.html public/pages/study/guides/index.html public/pages/study/synthesis/index.html tests/participant-consent-route-state.test.js tests/participants-page-route-state.test.js tests/study-guides-route-state.test.js tests/synthesize-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js docs/agent-audit/reasoning/2026/06/05/study-subpages-govuk-nunjucks.md docs/agent-audit/reasoning/2026/06/05/study-subpages-govuk-nunjucks.json`
- `node --test` with 176 passing tests.
- Browser spot-check at `http://127.0.0.1:8791` confirmed all four converted routes render with the shared GOV.UK main wrapper, breadcrumbs, button styling, table/task/summary-list structures and layout script.
- Browser layout spot-check at `http://127.0.0.1:8792` confirmed the revised pages use the 1020px GOV.UK main content container on desktop, remove Study back buttons, remove legacy participants badges/cards/pills and keep participants in a 2/3 plus 1/3 GOV.UK grid workflow.
- `node --test tests/participants-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js tests/participant-pseudonymised-view-route-state.test.js`
- `node scripts/styles/format-generated-css.mjs --check`
- Browser spot-check at `http://127.0.0.1:8793/pages/study/participants/?id=RECT3O7DT` confirmed the participants route renders with GOV.UK date inputs, three channel checkboxes, no native `datetime-local` input, and two-thirds GOV.UK form columns at desktop and 599px viewport widths.

## Residual Risks

- The generated pages remain static route shells. Their live content still depends on the existing client-side route loaders and APIs.
- Error summary list contents for participant consent and synthesis are still populated dynamically by page controllers; the static template preserves the GOV.UK structure and required hooks rather than attempting to pre-render unknown errors.
- The browser spot-check used a static file server, so `/api/studies` returned 404 during preview. That was expected for this validation path and was not treated as live data verification.
