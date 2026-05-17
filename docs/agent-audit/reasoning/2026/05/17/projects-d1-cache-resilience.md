# Agent trace — Projects D1 cache resilience

**Date:** 2026-05-17  
**Branch:** `fix/projects-team-scoped-access`  
**PR:** #252  
**Mode:** `rops-fix`  
**Primary lenses:** developer, QA, security, DevOps

## Task summary

Continue fixing the Projects page and Project dashboard data-source issue after runtime evidence showed `/api/projects` was no longer leaking CSV fragments but was returning `503 projects_unavailable` because Airtable returned `airtable_http_429` and D1 had no usable project cache.

## Sources inspected

- `infra/cloudflare/src/service/project-record-routes.js`
- `.github/workflows/deploy-worker.yml`
- `tests/projects-route-contract.test.js`
- `scripts/agent-trace/assert-trace-coverage.mjs`
- live browser evidence supplied in chat showing `airtable_http_429`

## Decision

Treat this as a source-resilience defect, not a UI defect.

The Projects API must not use CSV for project cards. It should use Airtable as the authoritative source and D1 as the read-through cache. Airtable rate limiting must not bring down the project list once D1 has cached records.

## Change applied

Updated `infra/cloudflare/src/service/project-record-routes.js` to:

- add `payload_json` to the `rops_projects_cache` table so D1 can hold the full normalised project payload
- read D1 cache first unless `refresh=1` is present
- sync full Airtable project payloads into D1 after successful Airtable reads
- return D1 projects with `x-rops-source: d1` when the cache is populated
- expose `x-rops-upstream-warning` when D1 is served after an upstream Airtable failure
- include a D1 empty-cache diagnostic when both Airtable and D1 cannot serve projects
- allow single project reads to fall back to D1 when Airtable is unavailable or rate-limited
- keep CSV fallback disabled for `/api/projects` and `/api/projects/:id`

## Validation observed

After the first resilience commit, `Worker CI` failed at `npm run validate` because trace coverage now expects a trace directory for the current date, `docs/agent-audit/reasoning/2026/05/17/`.

This trace file and the paired JSON file were added to satisfy the branch trace policy before continuing validation.

## Residual risks

- If the preview D1 cache is empty and Airtable remains rate-limited, the endpoint will correctly return `503 projects_unavailable` with diagnostics. A successful Airtable read or an authorised D1 cache seed is still needed to populate preview D1.
- The current change improves resilience after cache population. It does not by itself bypass Airtable rate limiting when D1 has never been populated.
- Tests still need to be read after this trace commit. Any contract or formatter failures must be repaired before claiming the PR is coherent.

## Next validation target

- `npm run validate` via CI
- Worker CI
- `/api/projects?limit=200` on the current Pages preview after deployment
- `/pages/projects/` card rendering
- `/pages/project-dashboard/?id=rec...` navigation
