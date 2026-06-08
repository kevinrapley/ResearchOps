# Repository Review Workflows Trace

- Date: 2026-06-08
- Trace layer: operational
- Branch: `feature/repository-review-workflows`
- Branch decision: trace required by `feature/` prefix
- Task summary: replace placeholder repository review pages with curator-only, queue-backed review workbenches for candidate, due-review and withdrawn artefacts, including auditable outcomes and reversible withdrawal handling

## Operating model evidence

- Loaded: `AGENTS.md`
- Loaded: `.agent-operating-model/orchestration.xml`
- Loaded: `.agent-operating-model/bundle-registry.json`
- Loaded: `.agent-operating-model/task-signal-catalog.json`
- Loaded: `.agent-operating-model/selection-rules.json`
- Loaded: `.agent-operating-model/precedence-policy.md`
- Loaded: `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `.agent-operating-model/bundles/openai/`: not needed for this repository workflow change
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP contract changes
- `.agent-operating-model/bundles/airtable-public-api/`: review workflow is D1-backed only
- `.agent-operating-model/bundles/mural-public-api/`: unrelated to repository review routes

## Precedence decisions

- Repository operating model and AGENTS rules took precedence over chat memory.
- The user instruction not to commit generated CSS or HTML output overrode earlier local build habits.
- Cloudflare Worker and ResearchOps bundle rules governed route permissions and D1 service changes.

## Evidence from repository files

- Review routes existed in `src/govuk/data/repository-page.mjs` and `src/govuk/templates/pages/repository-static.njk` but behaved as placeholder pages.
- Repository service seed and schema already contained candidate, due-review and withdrawn repository states in `infra/cloudflare/src/service/repository.js` and `infra/cloudflare/migrations/0015_seed_research_repository.sql`.
- Existing auth permission declarations in `infra/cloudflare/src/worker.js` already used route-permission bootstrap patterns suitable for review APIs.

## Files read

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/pages/repository-static.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/styles/repository.scss`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/repository.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/worker.js`
- `tests/auth-route-permissions.test.js`
- `tests/repository-front-page-route-state.test.js`

## Files changed

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/pages/repository-static.njk`
- `src/styles/repository.scss`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/repository.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/worker.js`
- `tests/repository-review-workbench-route-state.test.js`
- `tests/repository-review-workbench-runtime.test.js`

## Implementation decisions

- Added explicit review-route metadata for candidates, stale review and withdrawn review pages.
- Replaced placeholder content with a review workbench layout that shows queue navigation, item lists, record detail, audit history and review outcome forms.
- Added D1-backed review queue APIs for candidates, due review and withdrawn records.
- Added curator-only action handling for publish, request changes, withdraw, confirm current, update guidance, reinstate and maintain withdrawn outcomes.
- Required review notes for all review actions and required explicit withdrawal reasons where relevant.
- Preserved reversible withdrawal handling by routing reinstated records back to `published` or `candidate` depending on publication-gate state.
- Added queue and action tests at both route-state and runtime levels.

## Assumptions

- Static `/pages/...` routes are served by Pages assets, so practical privilege enforcement for these workbenches is via authenticated API gating plus immediate redirect behaviour in the page controller.
- Existing queue counts and record classification rules remain correct for this first review workflow pass.

## Validation attempted

- `node tests/repository-review-workbench-route-state.test.js`
- `node tests/repository-review-workbench-runtime.test.js`
- `node tests/auth-route-permissions.test.js`
- `node tests/repository-front-page-route-state.test.js`
- `npm run build:govuk-pages`
- `npm run lint`

## Validation results

- Route-state review workbench test: passed
- Runtime review queue and action test: passed
- Auth route permissions test: passed
- Repository front page route-state test: passed
- GOV.UK page build: passed
- Lint: passed with existing repository warnings only
- `npm run format:check`: repository-level generated CSS check reports unrelated pre-existing formatting drift until generated CSS is rebuilt; generated output was not retained in this branch

## Issues and pivots

- Initial implementation only locked the review APIs. I reviewed whether page routes themselves could be server-gated in the current architecture and found the static Pages setup does not expose the same Worker route-permission hook for `/pages/...` assets.
- Adjusted the implementation to use immediate authenticated review-API fetch with redirect on `401` and fallback away from review routes on `403`, rather than claim stronger server-side page blocking than the current deployment model provides.

## Residual risks

- Static review page shells remain directly addressable as URLs even though queue data and actions are curator-only.
- Queue workflow currently depends on D1 being available; there is no Airtable fallback for curator review flows.
- Repository main page still contains curator workbench affordances in static markup, even though actionable data comes back only for curators.
