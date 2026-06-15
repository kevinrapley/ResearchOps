# Agent trace — Mural preview API origin follow-up

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `feature/mural-journal-export-layout`  
**Trace required:** yes, because the branch starts with `feature/`  
**Related work:** Project dashboard Mural availability

## Task

Follow up on the deleted-board fix after Test Project 1 still showed a
linked Mural board in the branch preview.

## Operating model

Loaded repository operating-model sources:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `mural-public-api` at `.agent-operating-model/bundles/mural-public-api/`

Additional context read:

- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

## Evidence

The previous backend fix was committed and pushed, and the preview Worker
deployment for `feature/mural-journal-export-layout` completed
successfully. However, `public/components/mural-integration.js` still
hardcoded `https://rops-api.digikev-kevin-rapley.workers.dev` whenever
the host ended with `pages.dev`. That bypassed the Pages Function proxy
in `functions/api/[[path]].js`, which routes branch previews to
`https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev`.

The branch preview itself remains behind Cloudflare Access from this
session, so the live authenticated UI could not be inspected directly.

## Change

- Updated `public/components/mural-integration.js` to resolve API origin
  the same way as other dashboard/journal controllers:
  - explicit `data-api-origin` or `window.API_ORIGIN` still wins
  - `pages.dev` uses an empty origin so calls go to same-origin `/api/*`
  - non-Pages local/custom contexts use `location.origin`
- Updated Mural dashboard route-state tests to reject the production
  Worker hardcode and require the same-origin proxy behavior.

## Files

Modified:

- `public/components/mural-integration.js`
- `tests/mural-ui-route-state.test.js`
- `tests/project-dashboard-route-state.test.js`

Created:

- `docs/agent-audit/reasoning/2026/06/15/mural-preview-api-origin-followup.md`
- `docs/agent-audit/reasoning/2026/06/15/mural-preview-api-origin-followup.json`

## Validation

```bash
npm test -- tests/mural-ui-route-state.test.js tests/project-dashboard-route-state.test.js tests/pages-config-mural-return-route-state.test.js tests/mural-resolve-runtime.test.js
npm run format:check
npm run lint
npm test
```

Results:

- Focused tests passed: 5 tests, 0 failures.
- Format check passed.
- Lint passed with 0 errors and existing repository warnings.
- Full test suite passed: 219 tests, 0 failures.

Note: one full-suite run was started in parallel with `npm run lint`,
which rebuilds generated CSS, and produced a generated-CSS fixture
mismatch in `tests/deploy-asset-paths.test.js`. Re-running `npm test`
after the build step completed passed cleanly.

## Residual risk

The protected preview page could not be loaded without Cloudflare Access.
The fix is based on repository routing evidence and route-state tests:
same-origin `/api/*` is the path that reaches the deployed preview Worker.
