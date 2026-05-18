# Agent trace — studies linkage repair

**Date:** 2026-05-18  
**Branch:** `fix/projects-team-scoped-access`  
**PR:** #252  
**Mode:** `rops-fix`  
**Trace type:** operational audit trace

## Evidence boundary

This records observable repository work. It does not include private reasoning.

## Task

The Project dashboard now opens with the correct Airtable Project record ID, for example `recgdpwEI5hFO7bUZ`. The remaining issue was that the Studies section showed `No studies yet` even though the project has studies in Airtable.

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
- `infra/cloudflare/src/service/studies.js`
- `infra/cloudflare/src/service/participants.js`
- `infra/cloudflare/src/service/impact-internals.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/worker.js`
- `tests/project-dashboard-route-state.test.js`

## Findings

The dashboard called `/api/studies?project=rec...`. If that call failed, the client returned an empty array and rendered `No studies yet`.

That meant Airtable rate limits, D1 misses, bad linked-record shape, or route defects were all being presented as a genuine empty state.

The repository already has `infra/cloudflare/src/service/studies.js`. The fix therefore belongs in that file, not a new service file.

The core router still has a legacy direct `GET /api/studies` handler. The Worker entrypoint now intercepts `/api/studies` before that direct handler can run.

## Decisions

1. Keep Airtable Project record IDs beginning `rec` as the canonical project identifier.
2. Keep study logic in `infra/cloudflare/src/service/studies.js`.
3. Read D1 study cache before Airtable unless `refresh=1` is used.
4. Do not use CSV as a read source for Studies.
5. Show a study-load error on the dashboard when linked studies cannot be loaded.

## Changes made

`infra/cloudflare/src/service/studies.js` now:

- validates project IDs as Airtable record IDs
- creates and reads `rops_studies_cache`
- reads D1 first for study lists
- paginates Airtable list-record calls
- accepts multiple linked-project field names
- syncs successful Airtable reads into D1
- returns `studies_unavailable` when no Airtable or D1 study source can serve the request
- exposes `diagnoseProjectLinkedRecords()`

`infra/cloudflare/src/worker.js` now:

- routes `/api/studies` and `/api/studies/:id` through the service layer
- exposes `/api/_diag/project-linked-records?project=rec...`

`public/js/project-dashboard.js` now:

- throws structured study-load errors
- renders `Could not load studies` in the Studies panel when the source fails
- keeps the rest of the dashboard usable

`tests/studies-route-contract.test.js` pins the service and route contract.

## Validation

Current observed head before this trace note: `2455ff327dfcc49258188d287933cce72ecf2a4e`.

Checks green on that head:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate
- Format pull request
- QA — Broken links
- Accessibility audit
- qa-bdd

## Residual risks

Airtable remains rate-limited in preview. If D1 has no cached studies for the project, the dashboard will now show an honest study-load error instead of `No studies yet`.

Actual linked study data should not be seeded without inspecting the real Airtable Project Studies record IDs and linked Project field values.

## Rollback notes

Rollback is to revert the commits touching:

- `infra/cloudflare/src/service/studies.js`
- `infra/cloudflare/src/worker.js`
- `public/js/project-dashboard.js`
- `tests/studies-route-contract.test.js`
- `docs/agent-audit/reasoning/2026/05/18/trace.json`
- this file

No Airtable schema migration was made.

No production D1 migration was made.
