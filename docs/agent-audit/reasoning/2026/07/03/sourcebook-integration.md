# Sourcebook Integration

## Run metadata

- Date: 2026-07-03
- Branch: `feature/sourcebook-integration`
- Base: `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add authenticated read endpoints under `/api/sourcebook`, surface mapped Sourcebook clauses in logged-in GOV.UK pages and add a five-layer North Star governance evaluator.

## Operating model evidence

- Loaded `AGENTS.md`.
- Loaded `.agent-operating-model/orchestration.xml`.
- Loaded `.agent-operating-model/bundle-registry.json`.
- Loaded `.agent-operating-model/task-signal-catalog.json`.
- Loaded `.agent-operating-model/selection-rules.json`.
- Loaded `.agent-operating-model/bootstrap-checklist.md`.
- Loaded `.agent-operating-model/precedence-policy.md`.
- Loaded `.agent-operating-model/trace-policy.md`.
- Loaded `.agent-operating-model/trace-layers.md`.
- Loaded `.agent-operating-model/github-mutation-policy.md`.
- Verified selected bundle directories contain `prompt.spec.yaml` and `prompt.body.xml`.

## Bundle selection

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api` were not implementation-control bundles for this change because it does not add model calls, MCP contracts or external provider APIs.

## Precedence decisions

- GitHub Diamond governed branch creation, trace requirement, changed-file plausibility, validation and PR readiness.
- ResearchOps Developer Control governed Worker/service placement, authenticated route registration and keeping Sourcebook logic inside the platform service boundary.
- Multi-Functional Team governed public-sector assurance framing, evidence traceability and human-accountable use of Sourcebook clauses.
- Cloudflare governed Worker route behaviour, valid `Response` objects, runtime-safe read endpoints and no hard-coded secrets.
- GOV.UK Design System governed the Nunjucks component integration, semantic aside placement and generated page styling.

## Files read

- Repository operating model source files and selected bundle prompt files.
- Existing Worker route-permission declarations and API dispatch.
- Existing `ResearchOpsService` composition.
- Existing Sourcebook index JSON and Sourcebook validation tests.
- Existing route-state test patterns.
- Existing GOV.UK page renderer, Nunjucks page templates and generated stylesheet targets.

## Files created

- `infra/cloudflare/src/service/sourcebook.js`
- `tests/sourcebook-api.test.js`
- `tests/sourcebook-api-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/03/sourcebook-integration.md`
- `docs/agent-audit/reasoning/2026/07/03/sourcebook-integration.json`
- `sourcebook/sourcebook-route-mappings.json`
- `src/govuk/templates/macros/sourcebook-context.njk`
- `src/styles/_sourcebook-context.scss`
- `src/styles/account-team-access.scss`
- `public/css/account-team-access.css`
- `tests/sourcebook-context-route-state.test.js`

## Files modified

- `.gitignore`
- `.prettierignore`
- `eslint.config.js`
- `tests/auth-foundation-route-state.test.js`
- `tests/sourcebook-api-route-state.test.js`
- `tests/sourcebook-api.test.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/service/sourcebook.js`
- `infra/cloudflare/src/worker.js`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `src/govuk/data/sourcebook.mjs`
- `src/govuk/templates/pages/account-team-access.njk`
- `src/govuk/templates/pages/consent.njk`
- `src/govuk/templates/pages/role-assignments.njk`
- `src/styles/auth-role-assignments.scss`
- `src/styles/researchops-utility-pages.scss`
- `public/css/auth-role-assignments.css`
- `public/css/consent.css`
- `public/css/notes.css`
- `public/css/search.css`
- `public/css/sessions.css`
- `public/pages/account/team-access/index.html`
- `public/pages/consent/index.html`
- `public/pages/team/role-assignments/index.html`
- `tests/auth-role-assignment-ui-route-state.test.js`
- `tests/auth-team-access-request-route-state.test.js`
- `tests/consent-page-route-state.test.js`

## Implementation decisions

- Added read-only Sourcebook service methods that expose Sourcebook metadata, pillar summaries, clause lookup and clause search without introducing a mutable storage path.
- Added authenticated Worker routes for `/api/sourcebook`, `/api/sourcebook/pillars`, `/api/sourcebook/clauses` and `/api/sourcebook/clauses/:id`.
- Added a `sourcebook.view` permission to researcher, research lead and team admin roles so Sourcebook guidance can be surfaced in logged-in operational contexts.
- Kept clause query dimensions explicit: `pillar`, `route`, `evidence`, `trigger`, `type`, `status`, `q`, `limit`, `offset` and `includeText`.
- Changed `includeText` from a boolean-style flag to explicit response modes: `summary`, `title`, `full` and `verbose`.
- Preserved paragraph spacing for `full` and `verbose` clause text by formatting the clause heading and summary as separate paragraphs.
- Derived operational trigger tags from explicit clause metadata where available, plus stable Sourcebook evidence, route and pillar signals.
- Returned template details and related app routes in clause DTOs so logged-in UI surfaces can connect a clause to templates and application context.
- Added `.wrangler/` to ignore lists so local Cloudflare generated bundles do not pollute format or lint checks.
- Addressed Codex review thread `PRRT_kwDOP3Td2M6OQuwS` by bootstrapping research-data auth declarations before `/api/me`, `/api/me/identity` and `/api/me/permissions` resolve their authenticated context.
- Added route-state coverage so `/api/me` continues to seed declarations before returning permission lists that include `sourcebook.view`.
- Added a first-class route-to-clause map with conditional mappings so logged-in surfaces can request Sourcebook clauses by both route and operational condition.
- Added `condition` as a clause query dimension while keeping existing route-only queries compatible.
- Returned `routeMappings` metadata in clause DTOs, including condition ids, labels, descriptions, mapping source and strength.
- Moved curated route-to-clause mappings into `sourcebook/sourcebook-route-mappings.json` so the Worker API and GOV.UK Nunjucks renderer use the same mapping source.
- Added a bespoke `SourcebookContext` Nunjucks macro that renders an aside with clause type badge, pillar metadata, clause link, summary text and conditional trigger labels.
- Added `sourcebookContextForRoute()` in the GOV.UK Sourcebook data layer to resolve mapped clauses by route and condition for page rendering.
- Surfaced Sourcebook context on consent, team access request and role assignment pages where users are about to change consent or access state.
- Added shared Sourcebook context Sass and generated route CSS, including a dedicated account team access stylesheet.
- Added `GET /api/sourcebook/evaluate` as a read-only Sourcebook governance engine endpoint.
- Added a deterministic five-layer North Star evaluator: North Star rule, operating context, Sourcebook clauses, evidence readiness and governance action.
- Added `providedEvidence` support to the evaluator so callers can distinguish matched clauses from evidence-ready decisions.
- Returned auditable governance outcomes such as `ready-with-required-controls`, `needs-evidence` and `no-sourcebook-match` without making an ungrounded AI judgement.

## Validation evidence

- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed: 9 tests, 9 pass.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed after the `includeText` mode change: 12 tests, 12 pass.
- `npm test` passed after the `includeText` mode change: 343 tests, 343 pass.
- `npm run validate` passed after the `includeText` mode change.
- `npm run format:check` passed.
- `git diff --check` passed.
- `npm test` passed: 340 tests, 340 pass.
- `npm run sourcebook:validate` passed and validated 9 Sourcebook pages and 164 links.
- `npm run lint` passed with existing warnings only.
- `npm run trace:coverage` passed and confirmed trace coverage for `feature/sourcebook-integration`.
- `npm run validate` passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/auth-foundation-route-state.test.js tests/sourcebook-api-route-state.test.js tests/sourcebook-api.test.js` passed after the Codex review fix: 13 tests, 13 pass.
- `npm run format:check` passed after the Codex review fix.
- `git diff --check` passed after the Codex review fix.
- `npm run trace:coverage` passed after the Codex review fix and confirmed trace coverage for `feature/sourcebook-integration`.
- `npm run validate` passed after the Codex review fix.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed after conditional route mappings: 14 tests, 14 pass.
- `npm run format:check` passed after conditional route mappings.
- `git diff --check` passed after conditional route mappings.
- `npm run trace:coverage` passed after conditional route mappings and confirmed trace coverage for `feature/sourcebook-integration`.
- `npm run validate` passed after conditional route mappings.
- `npm run build:generated-css` passed after adding the Nunjucks Sourcebook context component.
- `npm run build:govuk-pages` passed after adding the Nunjucks Sourcebook context component.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js tests/sourcebook-context-route-state.test.js tests/consent-page-route-state.test.js tests/auth-team-access-request-route-state.test.js tests/auth-role-assignment-ui-route-state.test.js` passed after adding the Nunjucks Sourcebook context component: 20 tests, 20 pass.
- `npm run format:check` passed after adding the Nunjucks Sourcebook context component.
- `git diff --check` passed after adding the Nunjucks Sourcebook context component.
- `npm run trace:coverage` passed after adding the Nunjucks Sourcebook context component and confirmed trace coverage for `feature/sourcebook-integration`.
- `npm run validate` passed after adding the Nunjucks Sourcebook context component.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/sourcebook-api.test.js tests/sourcebook-api-route-state.test.js` passed after adding the North Star governance evaluator: 16 tests, 16 pass.
- `npm run format:check` passed after adding the North Star governance evaluator.
- `git diff --check` passed after adding the North Star governance evaluator.
- `npm run trace:coverage` passed after adding the North Star governance evaluator and confirmed trace coverage for `feature/sourcebook-integration`.
- `npm run validate` passed after adding the North Star governance evaluator.

## Residual risks

- The API derives some trigger labels from current Sourcebook text and metadata; future stronger Sourcebook governance should make triggers first-class clause metadata.
- Conditional route mappings are currently curated in a separate Sourcebook mapping JSON file; future Sourcebook governance can promote them into the Sourcebook index if they become author-owned content.
- Initial contextual surfacing is limited to consent and access-control journeys; other logged-in surfaces can adopt the component through the same route and condition mapping.
- The North Star evaluator is deterministic and evidence-declaration based; it does not verify uploaded evidence artefacts or replace human governance sign-off.
