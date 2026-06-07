# Repository preview latency trace

## Task summary

Investigate the reported lag on the ResearchOps repository preview, try the deployed preview directly, and reduce the repository page latency without regressing seeded data behaviour.

## Run metadata

- Date: 2026-06-07
- Branch: `fix/repository-preview-latency`
- Base: `pr-369`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `.agent-operating-model/bundles/openai/` because this task did not change model integration behaviour.
- `.agent-operating-model/bundles/mcp-agent-tooling/` because no MCP contract changes were required in repository code.
- `.agent-operating-model/bundles/airtable-public-api/` because Airtable remained fallback-only and the latency issue was in the D1-backed path.
- `.agent-operating-model/bundles/mural-public-api/` because the task did not touch Mural integration.

## Precedence decisions

- Repository operating-model and branch-trace rules overrode the previous ad hoc `pr-369` working branch, so the change was continued on an approved `fix/` branch.
- Production latency took precedence over the earlier client-only optimisation that depended on `hydrate=full`.
- Real runtime evidence took precedence over assumption: the preview URL was attempted directly before changing code.

## Files read

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `infra/cloudflare/src/service/repository.js`
- `public/js/repository-page.js`
- `public/js/repository-static-page.js`
- `tests/repository-front-page-route-state.test.js`
- `docs/implementation/repository-front-page-integration.md`

## Files changed

- `infra/cloudflare/src/service/repository.js`
- `src/govuk/templates/pages/repository.njk`
- `public/js/repository-page.js`
- `public/js/repository-static-page.js`
- `tests/repository-front-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/07/repository-preview-latency.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-preview-latency.json`

## Evidence from repository files

- The repository service was running `ensureTables(...)` on the hot read path for list and detail requests.
- The repository list route still loaded and materialised the full published set before filtering even when the page only needed one page of results.
- The repository front page and browse pages both requested `/api/repository?hydrate=full` on initial load.
- After the first optimisation pass, the repository list route still fanned out into many D1 queries per request: count, page rows, tags, five facet queries, metrics queries and queue counts.
- Chrome traces from the authenticated preview showed the biggest delay was still in `/api/repository` and `/api/repository?hydrate=full`, each taking about two to three seconds while first paint stayed below 100ms.
- The repository landing page was still issuing two initial API requests in parallel because the inline prefetch hit `/api/repository` while the page module requested `/api/repository?hydrate=full`.

## Tool limitations

- The in-app browser could not observe the same preview state as the user because `https://feature-research-repository.researchops.pages.dev/` redirected this session to Cloudflare Access sign-in.
- No authenticated user tab was available to reuse inside the shared browser session.

## Implementation decisions

- Cache repository schema assurance per D1 binding instance so live read requests do not repeat `CREATE TABLE IF NOT EXISTS` and index checks.
- Move the D1-backed list route to query only the requested page plus current page tags on the hot path.
- Keep `hydrate=full` support only as an explicit opt-in response shape instead of the default page-loading contract.
- Change the repository landing page and deeper browse pages to request paged API data for the current UI state instead of hydrating the entire catalogue up front.
- Keep seeded-tag filtering and current browse/history behaviour intact while changing the data-loading strategy.
- After reproducing the remaining lag on the live preview, collapse the repository list route back to one published-row query plus one tag query, then derive filters, metrics, pagination and filtered results in memory to remove repeated D1 round-trip cost.
- Trim the list-route payload so repository pages do not receive full artefact limits and provenance identifiers on every card when only the detail page needs them.
- Restore linked recommendation metrics by counting recommendation tag rows from D1-backed tag data rather than inferring from visible tag labels.
- Start the initial repository request from inline page script and let the page modules consume that prefetched response so the worker request can overlap with page script loading.
- Cache the published D1 repository snapshot in Worker memory for a short TTL so repeated filter requests and detail reads reuse one prepared dataset instead of rebuilding the same published set on every request.
- Invalidate the published snapshot cache after candidate creation so governed write paths do not leave repository reads stale.
- Align the inline Nunjucks prefetch with the hydrated request path so the page no longer pays for both `/api/repository` and `/api/repository?hydrate=full` on first load.

## Assumptions

- The user-facing lag is dominated by avoidable repository read work rather than by unusually slow client rendering of the current page shell.
- Preview D1 and Pages runtime performance will materially improve once repeated schema checks and full-catalogue hydration are removed from the default path.

## Validation attempted

- In-app browser navigation to `https://feature-research-repository.researchops.pages.dev/`
- Browser inspection of open authenticated tabs
- In-app browser timing of the authenticated `fix-repository-preview-laten` repository page
- In-app browser timing of same-origin `/api/repository` requests on the authenticated preview
- `node --check public/js/repository-page.js`
- `node --check public/js/repository-static-page.js`
- `node --check infra/cloudflare/src/service/repository.js`
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/repository-front-page-route-state.test.js tests/repository-seed-taxonomy-labels.test.js tests/repository-artefact-detail-seed-tag-guard.test.js`
- `npm test`
- `npm run lint`
- Trace inspection of `/Users/kevin.rapley/Downloads/Trace-20260608T001110.json.gz.devtools`
- Trace inspection of `/Users/kevin.rapley/Downloads/Trace-20260608T001245.json.gz.devtools`
- Trace inspection of `/Users/kevin.rapley/Downloads/Trace-20260608T001348.json.gz.devtools`
- Trace inspection of `/Users/kevin.rapley/Downloads/Trace-20260608T001413.json.gz.devtools`
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/repository-front-page-route-state.test.js tests/repository-seed-taxonomy-labels.test.js tests/repository-artefact-detail-seed-tag-guard.test.js tests/auth-sign-in-route-state.test.js`

## Validation not run and why

- Live post-change preview timing was not run because the updated code has not yet been deployed from this branch.
- Authenticated browser validation against the preview content was not possible because Cloudflare Access intercepted the session and no authenticated tab was available.
- The full repository test suite still has an unrelated failure in `tests/deploy-asset-paths.test.js`, which asserts a generated GOV.UK CSS formatting contract outside the repository Worker path changed here.

## Issues and pivots

- The initial browser attempt proved the preview URL was not directly observable in this environment, so the investigation pivoted to repository runtime code and test-backed optimisation.
- Creating an approved branch initially failed because `.git` write access was not available; the permission was then requested and granted for this turn.
- The first repository preview alias guesses were wrong; the live Pages host was `fix-repository-preview-laten.researchops.pages.dev`.
- Cloudflare Access authentication alone was not enough; the ResearchOps app sign-in route also had to be completed before the repository page could be timed honestly.

## Live measurements

- Preview repository page shell reached `domcontentloaded` in about `188ms`.
- The repository page replaced placeholders with live data about `4.5s` after `domcontentloaded`.
- Same-origin authenticated `/api/repository` responses were about `3.3s`.
- After the page was warm, an applied method filter updated visible results in about `500ms`.
- After the first optimisation deploy, the page shell improved to about `117ms`, the page hydrate dropped to about `3.5s`, but same-origin `/api/repository` still remained about `3.34s`.
- Warm filter updates after the first optimisation deploy were about `251ms`.
- After the payload-trimming deploy, linked recommendations returned to `12`, but the front-page hydrate was still about `4.3s`, so first-load latency was still not acceptable.
- Chrome trace samples on 2026-06-08 showed first contentful paint and largest contentful paint around `69ms` to `81ms`, while `/api/repository` and `/api/repository?hydrate=full` still consumed about `2.1s` to `2.7s`.

## Residual risks

- The live preview could still show some first-request cold-start cost from Cloudflare runtime startup, which this repository change does not remove.
- Filter interactions now depend on fast paged API responses rather than an already-hydrated client catalogue, so any future D1 query regressions will be more visible.
- Airtable fallback still materialises its published set in memory; that remains acceptable because the reported lag path was the D1-backed preview.
- The live preview still needs one more measurement pass after the payload-trimming commit is deployed because the acceptable-speed threshold has not yet been reached.
- Queue counts for curator users still run as a separate D1 query on list responses, so curator-mode pages may keep a small residual gap versus the non-curator path.
