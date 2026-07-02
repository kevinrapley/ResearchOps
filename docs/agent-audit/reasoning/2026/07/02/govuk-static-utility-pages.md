# GOV.UK static utility pages

Date: 2026-07-02
Branch: `feature/govuk-static-utility-pages`

## Task

Create or restore Nunjucks templates for `/pages/search/`, `/pages/notes/`, `/pages/consent/` and `/pages/sessions/`, and make sure each route uses SASS-owned styling plus GOV.UK Frontend design patterns and components.

## Trace Decision

The active branch prefix `feature/` requires an auditable trace.

## Operating Model

Loaded repository operating-model sources from `AGENTS.md` and `.agent-operating-model/`.

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Conditional bundles not selected:

- `cloudflare`: no Worker, D1, binding or deployment code was changed.
- `airtable-public-api`: no Airtable API behaviour was changed.
- `openai`: no OpenAI API behaviour was changed.
- `mcp-agent-tooling`: no MCP contract or tool integration was changed.
- `mural-public-api`: no Mural API behaviour was changed.

## Work Done

- Added Nunjucks templates for search, notes, consent and sessions under `src/govuk/templates/pages/`.
- Registered the four pages in the GOV.UK page renderer.
- Added one shared SASS source, `src/styles/researchops-utility-pages.scss`, and registered generated CSS targets for the four route stylesheets.
- Regenerated `public/pages/search/index.html`, `public/pages/notes/index.html`, `public/pages/consent/index.html` and `public/pages/sessions/index.html` from GOV.UK templates.
- Reworked the route controllers so dynamic results render GOV.UK summary cards, summary lists, details and tags rather than bespoke card fragments.
- Updated route-state tests to assert Nunjucks ownership, GOV.UK macro usage, generated CSS ownership and route hooks.

## Validation

- `npm run build:generated-css -- public/css/search.css public/css/notes.css public/css/consent.css public/css/sessions.css`: passed.
- `npm run build:govuk-pages`: passed.
- `node --test tests/search-page-route-state.test.js tests/notes-page-route-state.test.js tests/consent-page-route-state.test.js tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js tests/sass-migration-route-state.test.js`: passed with 7 tests passing and 0 failing.
- `npm run format -c`: passed.
- `npm run trace:coverage -- --date 2026-07-02`: passed.
- `curl` local preview checks for `/pages/search/`, `/pages/notes/`, `/pages/consent/` and `/pages/sessions/` on `http://127.0.0.1:4174`: passed with HTTP 200.
- Playwright DOM smoke check against local preview: passed for all four pages with the route container, form, results container and GOV.UK frontend stylesheet present.
- `git diff --check`: passed.
- `npm run lint`: passed with existing repository warnings and 0 errors.
- Final `node --test tests/search-page-route-state.test.js tests/notes-page-route-state.test.js tests/consent-page-route-state.test.js tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js tests/sass-migration-route-state.test.js`: passed with 7 tests passing and 0 failing.
- Browser-comment follow-up for `/pages/search/`: added bottom alignment to utility form rows and hid the search results section until a search has run.
- `npm run build:generated-css -- public/css/search.css public/css/notes.css public/css/consent.css public/css/sessions.css && npm run build:govuk-pages`: passed.
- `node --test tests/search-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`: passed with 3 tests passing and 0 failing.
- Playwright preview check at `http://127.0.0.1:4174/pages/search/`: passed. The results section was hidden initially, visible after clicking Search, and the search input and type select shared the same bottom baseline.
- Final shared-utility route-state sweep `node --test tests/search-page-route-state.test.js tests/notes-page-route-state.test.js tests/consent-page-route-state.test.js tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js tests/sass-migration-route-state.test.js`: passed with 7 tests passing and 0 failing.
- Browser-comment follow-up for `/pages/notes/`: hid the session notes section until notes are loaded for a selected session.
- `npm run build:govuk-pages && node --test tests/notes-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`: passed with 3 tests passing and 0 failing.
- Playwright preview check at `http://127.0.0.1:4174/pages/notes/`: passed. The session notes section was hidden initially and visible after a session was available and notes loaded.
- Browser-comment follow-up for `/pages/consent/`: added a GOV.UK details helper for ISO 8601 retention duration syntax and hid existing consent records until records are available.
- `npm run build:govuk-pages && node --test tests/consent-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`: passed with 3 tests passing and 0 failing.
- Playwright preview check at `http://127.0.0.1:4174/pages/consent/`: passed. The retention helper was present, the records section was hidden with no records and visible after linking consent.
- Browser-comment follow-up for `/pages/sessions/`: replaced the ISO timestamp text input with GOV.UK date input and 24-hour time fields, with ISO conversion handled by the controller, and hid the sessions list until sessions are available.
- `npm run build:generated-css -- public/css/search.css public/css/notes.css public/css/consent.css public/css/sessions.css && npm run build:govuk-pages && node --test tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-page-chrome-navigation-route-state.test.js`: passed with 3 tests passing and 0 failing.
- Playwright preview check at `http://127.0.0.1:4174/pages/sessions/`: passed. The sessions list was hidden initially, shown after creating a session, the ISO timestamp hint was absent and the stored session start date was ISO-formatted internally.
- Browser-comment follow-up for `/pages/consent/`: removed the incorrect "stored in this browser" and "local prototype records" copy from the consent page intro.
- `npm run build:govuk-pages && node --test tests/consent-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed with 2 tests passing and 0 failing.
- Browser-comment follow-up for `/pages/sessions/`: made the Title field label bold using the GOV.UK `govuk-label--s` label class in the Nunjucks input macro.
- `npm run build:govuk-pages && node --test tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed with 2 tests passing and 0 failing.
- Browser-comment follow-up for `/pages/sessions/`: made the Participants field label bold using the GOV.UK `govuk-label--s` label class in the Nunjucks input macro.
- `npm run build:govuk-pages && node --test tests/study-session-route-state.test.js tests/govuk-forms-application-route-state.test.js`: passed with 2 tests passing and 0 failing.
- PR-readiness follow-up: made GOV.UK form route-state label assertions resilient to generated Nunjucks macro whitespace while still requiring `govuk-label`, the correct `for` target and expected label text.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/govuk-forms-application-route-state.test.js`: passed with 1 test passing and 0 failing.
- `npm run lint && npm run build && npm run typecheck --if-present && npm test`: passed. Lint reported existing repository warnings only, build completed, no typecheck script was present, and the Node test suite passed with 273 tests passing and 0 failing.
