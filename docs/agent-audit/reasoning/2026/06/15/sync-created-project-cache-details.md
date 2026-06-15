# Agent trace - Sync created project cache details

**Date:** 2026-06-15
**Trace type:** operational audit trace
**Branch:** `fix/sync-created-project-cache-details`
**Trace required:** yes, because the branch starts with `fix/`

## Task

Fix the create-project forward path so newly created projects are immediately
cached with user groups, stakeholders, objectives and lead researcher details.

## Operating Model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

## Implementation

Updated the project create route to sync the created project into D1 immediately
after Airtable and Project Details creation. The cached payload now includes the
mapped project fields plus lead researcher, lead researcher email and notes.

Updated D1 sync so single-record syncs do not mark the whole Airtable cache
inactive. Full list refreshes still replace the active Airtable set.

Handled Codex review comments by marking create-time single-project cache writes
as `airtable-partial`. Project list reads treat partial rows as an incomplete
cache and query Airtable instead of returning a partial list. Project-by-ID
reads still allow partial rows as a fallback.

Updated project-by-ID Airtable refresh to join Project Details before syncing to
D1, so lead researcher, email and notes are preserved in the cached payload.

## Files

Modified:

- `infra/cloudflare/src/service/project-record-routes.js`
- `tests/projects-route-contract.test.js`

Created:

- `docs/agent-audit/reasoning/2026/06/15/sync-created-project-cache-details.md`
- `docs/agent-audit/reasoning/2026/06/15/sync-created-project-cache-details.json`

## Validation

Passed:

- `node tests/projects-route-contract.test.js`
- `npx prettier -c infra/cloudflare/src/service/project-record-routes.js tests/projects-route-contract.test.js docs/agent-audit/reasoning/2026/06/15/sync-created-project-cache-details.md docs/agent-audit/reasoning/2026/06/15/sync-created-project-cache-details.json`
- `npm run trace:coverage`
- `git diff --check`

## Residual Risk

The test uses Worker route mocks rather than a live Airtable write. The
operational repair for the existing project was performed separately through a
temporary branch-only workflow.
