# Agent trace — Mural deleted-board availability

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `feature/mural-journal-export-layout`  
**Trace required:** yes, because the branch starts with `feature/`  
**Related work:** Project dashboard Mural availability

## Task

Fix the project dashboard for Test Project 1 so a deleted linked Mural
board is not reported as available or exposed as an open-board link.

## Operating model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Additional bundle context read because the visible defect is on a Pages
dashboard backed by integration data:

- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `airtable-public-api` at `.agent-operating-model/bundles/airtable-public-api/`

Skipped bundles from the model selection: `openai-platform`,
`mcp-agent-tooling`.

Precedence applied: GitHub repository governance first, then
ResearchOps implementation rules, government product assurance, UI and
runtime context, and Mural API behavior for the endpoint-specific fix.
No instruction conflicts were found.

## Evidence

The dashboard frontend calls `/api/mural/resolve` and already treats a
404 from that endpoint as “No board yet”. The backend endpoint previously
trusted saved Airtable/D1/KV board mappings, so an active saved row could
still produce `ok: true` after the underlying Mural board had been
deleted.

The preview URL was checked directly, but it redirects to Cloudflare
Access, so authenticated live inspection was not available from this
session.

## Change

- Updated `infra/cloudflare/src/service/internals/mural.js` so
  `muralResolve` validates a resolved saved Mural ID with Mural before
  returning it as available when a user token is present.
- If Mural returns 403, 404 or 410 for the saved board, the endpoint now
  returns a 404 body with `error: "stale_board_unavailable"`. The existing
  frontend 404 path then switches the dashboard back to “No board yet” /
  create-board state instead of linking to the deleted board.
- Added `tests/mural-resolve-runtime.test.js` covering:
  - saved board mapping plus Mural 404 returns 404
  - saved board mapping plus successful Mural read still returns the
    linked board

## Files

Modified:

- `infra/cloudflare/src/service/internals/mural.js`

Created:

- `tests/mural-resolve-runtime.test.js`
- `docs/agent-audit/reasoning/2026/06/15/mural-deleted-board-availability.md`
- `docs/agent-audit/reasoning/2026/06/15/mural-deleted-board-availability.json`

## Validation

```bash
npm test -- tests/mural-resolve-runtime.test.js tests/mural-airtable-board-registry.test.js tests/project-dashboard-route-state.test.js
npm test
npm run format:check
npm run lint
```

Results:

- Targeted tests passed: 9 tests, 0 failures.
- Full test suite passed: 219 tests, 0 failures.
- Format check passed.
- Lint passed with 0 errors and existing repository warnings.

## Residual risk

No authenticated live dashboard session was available because the preview
URL is behind Cloudflare Access. The behavior is covered by mocked Mural
API responses at the Worker endpoint boundary.
