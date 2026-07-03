# Sourcebook Integration

## Run metadata

- Date: 2026-07-03
- Branch: `feature/sourcebook-integration`
- Base: `main`
- Trace decision: required because `feature/` branches require auditable traces for repository-affecting work.
- Task summary: add authenticated read endpoints under `/api/sourcebook` so logged-in ResearchOps areas can list pillars, look up clauses and query clauses by route, evidence type, trigger and pillar.

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

Skipped bundles:

- `govuk-design-system`, `openai-platform`, `mcp-agent-tooling`, `airtable-public-api` and `mural-public-api` were not implementation-control bundles for this change because it adds Worker read endpoints and Sourcebook service shaping without changing GOV.UK page rendering, model calls, MCP contracts or external provider APIs.

## Precedence decisions

- GitHub Diamond governed branch creation, trace requirement, changed-file plausibility, validation and PR readiness.
- ResearchOps Developer Control governed Worker/service placement, authenticated route registration and keeping Sourcebook logic inside the platform service boundary.
- Multi-Functional Team governed public-sector assurance framing, evidence traceability and human-accountable use of Sourcebook clauses.
- Cloudflare governed Worker route behaviour, valid `Response` objects, runtime-safe read endpoints and no hard-coded secrets.

## Files read

- Repository operating model source files and selected bundle prompt files.
- Existing Worker route-permission declarations and API dispatch.
- Existing `ResearchOpsService` composition.
- Existing Sourcebook index JSON and Sourcebook validation tests.
- Existing route-state test patterns.

## Files created

- `infra/cloudflare/src/service/sourcebook.js`
- `tests/sourcebook-api.test.js`
- `tests/sourcebook-api-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/03/sourcebook-integration.md`
- `docs/agent-audit/reasoning/2026/07/03/sourcebook-integration.json`

## Files modified

- `.gitignore`
- `.prettierignore`
- `eslint.config.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/worker.js`

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

## Residual risks

- The API derives some trigger labels from current Sourcebook text and metadata; future stronger Sourcebook governance should make triggers first-class clause metadata.
- This branch adds the read API foundation only; logged-in UI affordances that surface the clauses in context can build on these endpoints separately.
