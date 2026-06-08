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
- Preview testing showed due-review route state still exposed generic generated IDs such as `seeded-published-001`, unlike the named candidate and withdrawn records.

## Files read

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/pages/repository-static.njk`
- `src/govuk/templates/pages/repository.njk`
- `src/styles/repository.scss`
- `public/js/repository-static-page.js`
- `public/js/repository-static/browse.js`
- `public/js/repository-static/candidate.js`
- `public/js/repository-static/review.js`
- `public/js/repository-static/shared.js`
- `infra/cloudflare/src/service/repository.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0015_seed_research_repository.sql`
- `infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql`
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
- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0015_seed_research_repository.sql`
- `infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql`
- `tests/repository-review-workbench-route-state.test.js`
- `tests/repository-review-workbench-runtime.test.js`
- `tests/repository-front-page-route-state.test.js`
- `tests/repository-seed-taxonomy-labels.test.js`

## Implementation decisions

- Added explicit review-route metadata for candidates, stale review and withdrawn review pages.
- Replaced placeholder content with a review workbench layout that shows queue navigation, item lists, record detail, audit history and review outcome forms.
- Added D1-backed review queue APIs for candidates, due review and withdrawn records.
- Added curator-only action handling for publish, request changes, withdraw, confirm current, update guidance, reinstate and maintain withdrawn outcomes.
- Required review notes for all review actions and required explicit withdrawal reasons where relevant.
- Preserved reversible withdrawal handling by routing reinstated records back to `published` or `candidate` depending on publication-gate state.
- Replaced the custom review queue navigation with GOV.UK tabs rendered in the Nunjucks template and wired client navigation to those tabs.
- Limited review queue responses to 10 items per page and added queue pagination support through the review API and page controller.
- Reworked the tab implementation so each GOV.UK tab panel contains its own queue-specific workbench shell, with unique list, detail and pagination targets.
- Wired review tab selection to update the page title, lead paragraph, supporting body text, breadcrumb current item and document title so the whole page context follows the selected queue.
- Refactored the 946-line `public/js/repository-static-page.js` into a small module entrypoint plus shared, browse, candidate and review modules.
- Checked adjacent repository frontend scripts and kept `repository-page.js` and `repository-artefact-page.js` unchanged because they are smaller and not directly part of the expanding static review/browse implementation.
- Corrected review queue URL state so selected artefact IDs are written back to the active queue route instead of the previously loaded route.
- Replaced generic generated published seed IDs with deterministic route IDs made from service area, user group, method and risk area, so due-review URLs use meaningful artefact identifiers.
- Added a seed refresh guard that deletes only the old generated `seeded-published-*` demo records before reinserting semantic generated records, leaving curated named artefacts untouched.
- Updated generated seed tag cleanup and taxonomy guards to use `source_project_id LIKE 'proj-seeded-%'` provenance instead of user-facing ID prefixes.
- Removed static review-check, review-outcome and withdrawal-reason copy from the review route page data.
- Aligned queue and selected-record panels with matching bordered containers so their top borders land on the same line.
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
- `npm run format:check`
- Local browser check for Candidate, Due review and Withdrawn review tab page-context switching
- Local browser check after the static repository module split
- Local SQLite application of `0001`, `0014`, `0015` and `0016` migrations with a due-review queue ID probe

## Validation results

- Route-state review workbench test: passed
- Runtime review queue and action test: passed
- Auth route permissions test: passed
- Repository front page route-state test: passed
- GOV.UK page build: passed
- Format check: passed
- Lint: passed with existing repository warnings only
- Local browser check confirmed the H1, lead, body text, breadcrumb current item and document title update when switching from Due review to Candidate artefacts and Withdrawn artefacts.
- Local browser check confirmed the refactored module entrypoint still loads and Candidate tab switching still updates page context and visible panel state.
- Local SQLite migration probe passed with 100 published records, 0 `seeded-published-*` published records and first due-review ID `applications-assisted-digital-users-content-testing-confidence-and-comprehension`.

## Issues and pivots

- Initial implementation only locked the review APIs. I reviewed whether page routes themselves could be server-gated in the current architecture and found the static Pages setup does not expose the same Worker route-permission hook for `/pages/...` assets.
- Adjusted the implementation to use immediate authenticated review-API fetch with redirect on `401` and fallback away from review routes on `403`, rather than claim stronger server-side page blocking than the current deployment model provides.
- Codex review identified that stale-queue `confirm_current` and `update_guidance` could persist an overdue `reviewDueAt`, leaving the record immediately due for review again.
- While fixing that path, runtime coverage exposed a second defect: underscore-based outcome values such as `confirm_current` were normalised with slug rules and rejected by the service. The action parser was updated to preserve underscores for review outcomes.
- The requested GOV.UK pagination macro can only be rendered as a placeholder at template-build time because queue totals are runtime data. The template now owns the pagination shell and the page controller updates it with live queue state after fetch.
- The first tabs pass still left inactive queues as placeholder panels, which is why only one tab displayed real workbench content. The tab panels were then expanded to provide queue-specific workbench shells inside each GOV.UK tab panel.
- Moving a single workbench node between tab panels proved brittle with the GOV.UK tabs runtime. The implementation now renders one shell per queue and scopes script updates to `[data-review-workbench]`, avoiding both empty selected panels and duplicate IDs.
- A later review found that the workbench tab changed but the page-level route context remained on the initially loaded queue. The controller now updates the route-level copy and document metadata as part of the active-tab state.
- The static repository script had grown to 946 lines while accumulating browse, candidate and review behaviours. It was split into focused modules before further review work was added.
- A subsequent preview check showed stale selected-record IDs could remain attached to the old queue path. The review controller now writes selected IDs using `reviewPathnameForQueue(queueKey)` and corrects the path even when the selected ID has not changed.
- A later preview check showed the due-review selected record still used `seeded-published-001`. The seed now refreshes old generated published records and uses semantic generated IDs for due-review route state.

## Residual risks

- Static review page shells remain directly addressable as URLs even though queue data and actions are curator-only.
- Queue workflow currently depends on D1 being available; there is no Airtable fallback for curator review flows.
- Repository main page still contains curator workbench affordances in static markup, even though actionable data comes back only for curators.
