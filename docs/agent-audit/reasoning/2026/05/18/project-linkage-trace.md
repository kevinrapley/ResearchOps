# Agent trace — project linkage and team label repair

**Date:** 2026-05-18  
**Trace type:** operational audit trace  
**Branch:** `fix/projects-team-scoped-access`  
**PR:** #252  
**Mode:** `rops-fix`  
**Primary lenses:** developer, QA, security, DevOps, research operations

## Evidence boundary

This trace records observable repository work, implementation decisions, files inspected, validation evidence, issues encountered and residual risks.

It does not record private reasoning. It records the operational explanation needed for repository review.

## Task summary

Continue PR #252 after the project list API had been corrected away from CSV fragments and was returning five D1-backed projects keyed by Airtable record IDs.

The user identified two remaining concerns:

- the Projects page still showed `Unassigned team` even though `/api/projects` returned `teamName: "Home Office Biometrics"`
- other project-linked records must move away from PID-style project identifiers and use Airtable record IDs beginning `rec`

## Context at the start of this trace

The live preview diagnostic showed:

- Worker build metadata was present and matched the PR branch
- Airtable was configured with table `Projects`
- Airtable was still returning HTTP 429
- D1 was bound and contained 5 active project records
- all 5 D1 records had valid Airtable record IDs beginning `rec`

The `/api/projects` response returned the five expected projects with `id`, `airtableId` and `recordId` all set to Airtable `rec...` values.

## Files inspected

- `public/js/projects-page.js`
- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/studies.js`
- `infra/cloudflare/src/service/participants.js`
- `infra/cloudflare/src/service/impact-internals.js`
- `infra/cloudflare/src/service/impact.js`
- `tests/projects-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-plan.md`
- `docs/agent-audit/reasoning/2026/05/14/projects-team-scoped-access-plan.json`
- `docs/agent-audit/reasoning/2026/05/17/projects-d1-cache-resilience.md`

## Findings

### Projects page team label

The API response already supplied team fields. The page was still showing `Unassigned team` because the client-side team normalisation previously suppressed the known team value.

The defect was therefore in the page controller, not in the `/api/projects` payload.

### Project linkage

The canonical project identifier is now the Airtable record ID.

Valid route and linkage examples:

- `recMtdmBbaFilF2Tm`
- `recpZe8mLEiASXfRd`
- `recgdpwEI5hFO7bUZ`
- `recIFoFmpDIGBP726`
- `recUUeazIqBMfsZL4`

Invalid route and linkage examples:

- `PID-*`
- local UUIDs
- team names
- project names
- user-facing labels

Studies already use a `project_airtable_id` request body field and write Airtable linked-record arrays. Participants link through studies, which is acceptable as long as the study is linked to the canonical project record ID.

Impact / Insights helpers were more ambiguous. They supported both text and linked field names, but the write path used a plain `Project ID` text value. That risks preserving the old PID-style model if callers send non-record identifiers.

## Decisions

### Decision 1 — keep Airtable record IDs canonical

Project route IDs and project linkage values must be Airtable record IDs beginning `rec`.

This keeps the browser route, D1 cache key and Airtable linked-record relationships aligned.

### Decision 2 — render the API team label

The Projects page should render the team label returned by the API. It should not suppress `Home Office Biometrics`, because that is a real team value in the current data.

Fallback order should support the API contract and schema drift:

1. `teamName`
2. `team_name`
3. `team`
4. `teamNames[0]`
5. `Org`
6. `org`
7. `Unassigned team`

### Decision 3 — Impact defaults to linked project field

Impact / Insights persistence should default to a linked Airtable `Project` field with `[projectId]`.

A text field mode remains available only for schemas that deliberately store the Airtable record ID in a plain text field.

## Changes made

### `public/js/projects-page.js`

Updated team-name normalisation so the known team value is no longer blanked.

Added `Org` and `org` to the team-name fallback chain.

Updated the card team label so `project.org` is used before `Unassigned team`.

### `infra/cloudflare/src/service/internals/airtable.js`

Updated the shared project resolver so a valid Airtable record ID is passed through immediately.

This prevents `rec...` project IDs from being pushed through legacy lookup fields such as local IDs or project-name based matching.

### `infra/cloudflare/src/service/impact-internals.js`

Added project ID validation for impact writes.

Changed the default write behaviour to use a linked Airtable project field.

Added explicit configuration support for a text-field mode where the Airtable table deliberately stores the record ID as text.

### `infra/cloudflare/src/service/impact.js`

Updated create-route error handling so validation errors from the impact persistence helper can return their intended status instead of being flattened into a generic 500.

### `tests/projects-page-route-state.test.js`

Updated route-state assertions so the test pins the project-card team-label contract and verifies that the previous hard-coded suppression does not return.

### `docs/agent-audit/reasoning/2026/05/18/trace.json`

Expanded the JSON trace from a placeholder into a structured operational audit record.

## Validation evidence

Before this trace expansion, commit `4e7123366c346b00a3d4c19782ef12daf772b142` was observed green across:

- CI
- Worker CI
- Validate ResearchOps
- Release Gate
- Format pull request
- QA — Broken links
- Accessibility audit
- qa-bdd

This trace-documentation update creates a newer PR head and therefore requires checks to run again.

## Issues and pivots

A previous trace file for 2026-05-18 was inadequate. It only stated that PR work continued and CI was green.

That did not meet the repository trace expectations in the master prompt or match the richer examples under `docs/agent-audit/reasoning/2026/05/`.

The corrective action is this full Markdown trace plus a matching expanded JSON trace.

## Residual risks

- The latest preview still needs live browser verification after deployment.
- `/pages/projects/` should show `Home Office Biometrics` on the five seeded project cards.
- Dashboard navigation should continue to use `/pages/project-dashboard/?id=rec...`.
- The real Airtable field shape for Impact / Insights still needs confirmation. Linked `Project` is now the default. Text mode must be configured deliberately if the schema requires it.
- Airtable remains rate-limited with HTTP 429, so D1 is still carrying the preview read path.

## Rollback notes

Rollback is to revert the commits that changed:

- `public/js/projects-page.js`
- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/impact-internals.js`
- `infra/cloudflare/src/service/impact.js`
- `tests/projects-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/18/trace.json`
- `docs/agent-audit/reasoning/2026/05/18/project-linkage-trace.md`

No Airtable schema migration was made.

No production D1 migration was made.

## Next validation target

- confirm CI on the new trace-documentation head
- open the current Pages preview
- confirm the project cards show the team label
- click a project card and verify the dashboard URL contains `?id=rec...`
- check `/api/_diag/projects-source` still reports D1 valid project count as 5 while Airtable is rate-limited
