# Agent trace — studies linkage and Study routing repair

**Date:** 2026-05-18  
**Branch:** `fix/projects-team-scoped-access`  
**PR:** #252  
**Mode:** `rops-fix`  
**Trace type:** operational audit trace

## Evidence boundary

This records observable repository work. It does not include private reasoning.

## Task

The Project dashboard now opens with the correct Airtable Project record ID, for example `recgdpwEI5hFO7bUZ`. The Studies section now returns linked study records from D1 while Airtable is rate-limited.

The next issue was Study page routing. The dashboard needed to route to a Study page by Study record ID only, for example `/pages/study/?id=rect3o7dt`. The Study page then needed to derive the linked Project record ID from the Study record.

Airtable is rate-limited in preview, so D1 must continue to serve the linked study records while the Airtable source is unavailable.

## Operating model and bundles applied

Loaded sources included `AGENTS.md`, the operating-model orchestration, bundle registry, task-signal catalogue, selection rules, precedence policy, trace policy, and the Airtable Public API bundle.

Selected bundles:

- GitHub Diamond
- ResearchOps Developer Control
- Multi-Functional Team
- GOV.UK Design System
- Cloudflare
- Airtable Public API

## Files inspected

- `public/js/project-dashboard.js`
- `public/js/study-page.js`
- `public/pages/study/index.html`
- `infra/cloudflare/src/service/studies.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/service/participants.js`
- `infra/cloudflare/src/service/impact-internals.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`
- `data/project-studies.csv`
- `tests/project-dashboard-route-state.test.js`
- `tests/studies-route-contract.test.js`

## Findings

The dashboard called `/api/studies?project=rec...`. If that call failed, the client returned an empty array and rendered `No studies yet`.

That meant Airtable rate limits, D1 misses, bad linked-record shape, or route defects were all being presented as a genuine empty state.

The repository already has `infra/cloudflare/src/service/studies.js`. The fix therefore belongs in that file, not a new service file.

The core router still has a legacy direct `GET /api/studies` handler. The Worker entrypoint now intercepts `/api/studies` before that direct handler can run.

The repository fixture `data/project-studies.csv` contains two Test Project 1 studies linked to the Project record. Because Airtable is currently returning 429, those known linked records are the best available seed source for the preview D1 cache.

The Study page error reported by live browser evidence still said `The study page needs a project ID and study ID in the URL.` even though `/api/studies?id=rect3o7dt` returned `ok:true`. That message came from the old `study-page.js` module. The HTML page was still importing `/js/study-page.js` without a cache-busting query string, so the browser or edge cache could continue using the previous module.

## Decisions

1. Keep Airtable Project record IDs beginning `rec` as the canonical project identifier.
2. Keep study logic in `infra/cloudflare/src/service/studies.js`.
3. Read D1 study cache before Airtable unless `refresh=1` is used.
4. Do not use CSV as a runtime read source for Studies.
5. Show a study-load error on the dashboard when linked studies cannot be loaded.
6. Seed preview D1 from repository evidence while Airtable is rate-limited.
7. Allow rec-prefixed Project Studies IDs from the fixture, while still requiring full Airtable Project record IDs for project linkage.
8. Use `/pages/study/?id=<study-record-id>` as the canonical Study page route.
9. Support legacy `/pages/study/?pid=<project-record-id>&sid=<study-record-id>` only if the Study record resolves and the linked Project record ID matches `pid`.
10. Add a versioned module URL for `study-page.js` so the Study page cannot continue executing the stale pid/sid-only JavaScript.

## Changes made

`infra/cloudflare/src/service/studies.js` now:

- validates project IDs as Airtable Project record IDs
- creates and reads `rops_studies_cache`
- reads D1 first for study lists
- paginates Airtable list-record calls
- accepts multiple linked-project field names
- syncs successful Airtable reads into D1
- supports single Study lookup through `/api/studies?id=<study-record-id>`
- returns `studies_unavailable` when no Airtable or D1 study source can serve the request
- exposes `diagnoseProjectLinkedRecords()`
- accepts seeded study identifiers such as `rect3biqr` and `rect3o7dt`

`infra/cloudflare/src/service/index.js` now:

- exposes `readStudy()` from the existing Studies service

`infra/cloudflare/src/worker.js` now:

- routes `/api/studies` and `/api/studies/:id` through the service layer
- exposes `/api/_diag/project-linked-records?project=rec...`

`public/js/project-dashboard.js` now:

- throws structured study-load errors
- renders `Could not load studies` in the Studies panel when the source fails
- keeps the rest of the dashboard usable
- emits canonical Study links as `/pages/study/?id=<study-record-id>`

`public/js/study-page.js` now:

- resolves Study page context from `id`
- calls `/api/studies?id=<study-record-id>`
- derives `projectId` from the returned Study record
- loads the Project record through `/api/projects/<project-record-id>`
- accepts legacy pid/sid URLs only when the loaded Study record confirms the Project link
- uses same-origin API calls for Pages previews

`public/pages/study/index.html` now:

- imports `/js/study-page.js?v=study-record-id-routing-20260518` to force the browser and edge cache to load the updated Study page module

`infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql` now:

- creates `rops_studies_cache`
- seeds the two known Test Project 1 studies linked to `recgdpwEI5hFO7bUZ`
- marks the rows as `preview-seed`
- keeps the seed preview-only

`tests/studies-route-contract.test.js` now pins:

- the studies cache table
- seeded study identifiers
- the diagnostic route
- the dashboard error-rendering path
- the canonical Study route
- the legacy-route resolution guard
- the continued CSV-free runtime policy

## Validation

Known green head before the preview seed work: `76889cef7e684ddc0ecbe94e85f85d9d928c6919`.

Checks green on that head:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate
- Format pull request
- QA — Broken links
- Accessibility audit
- qa-bdd

The preview studies seed and Study route changes pushed newer commits. Checks and the preview deploy need to complete again on the current head.

Latest cache-bust fix head: `7729bacdd3a6f06d55ea6e8556998ab7d50507d3`.

## Residual risks

Airtable remains rate-limited in preview. The seeded D1 studies are intended to preserve preview dashboard behaviour while Airtable is unavailable.

The seeded study identifiers come from repository fixture data rather than a fresh Airtable API read because Airtable is currently returning 429.

The preview seed is not a production migration and must not be treated as the long-term source of truth. A successful Airtable read should refresh the D1 cache when rate limits clear.

Downstream Study subpages still use pid/sid route parameters. The Study landing page now derives Project context from `id`, but child pages need a separate migration if the same canonical route style is required everywhere.

## Rollback notes

Rollback is to revert the commits touching:

- `infra/cloudflare/src/service/studies.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/worker.js`
- `public/js/project-dashboard.js`
- `public/js/study-page.js`
- `public/pages/study/index.html`
- `infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`
- `tests/studies-route-contract.test.js`
- `docs/agent-audit/reasoning/2026/05/18/trace.json`
- this file

No Airtable schema migration was made.

No production D1 migration was made.

## Next validation target

- confirm CI on the current head
- confirm the preview Worker deploy applied the seed migration
- call `/api/_diag/project-linked-records?project=recgdpwEI5hFO7bUZ`
- call `/api/studies?project=recgdpwEI5hFO7bUZ`
- call `/api/studies?id=rect3o7dt`
- reload the dashboard and confirm the Studies panel renders both seeded studies
- open `/pages/study/?id=rect3o7dt` and confirm it renders the Diary Study rather than the stale pid/sid error
- open the legacy URL and confirm it only renders if the Study record's linked Project ID matches `pid`
