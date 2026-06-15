# Mural journal status stale board lookup

## Run metadata

- Date: 2026-06-15
- Branch: `feature/mural-journal-export-layout`
- Trace trigger: branch prefix `feature/` requires an auditable trace
- Task summary: fix the Journals page reporting `Unavailable: could not check Mural` after a new Mural board was created for Test Project 1.

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare`: `.agent-operating-model/bundles/cloudflare/`
- `mural-public-api`: `.agent-operating-model/bundles/mural-public-api/`

## Bundles skipped

- `openai-platform`: not in scope.
- `mcp-agent-tooling`: not in scope.
- `airtable-public-api`: Airtable storage was touched only through existing repository helper contracts; the narrower ResearchOps integration rules were sufficient for this bug fix.

## Precedence decisions

- GitHub Diamond governed branch, trace and validation discipline.
- ResearchOps Developer Control governed service boundaries and existing helper usage.
- Cloudflare governed the Pages/Worker runtime path.
- Mural Public API governed stale or inaccessible Mural board handling.
- GOV.UK Design System remained in scope because the Journals page already presents the resulting status state through GOV.UK UI copy.

## Files read

- `public/js/journal-mural-sync-compact.js`
- `public/js/journal-tabs.js`
- `infra/cloudflare/src/service/mural-journal-sync-layout.js`
- `infra/cloudflare/src/service/mural-journal-sync/context.js`
- `infra/cloudflare/src/service/internals/mural-board-registry.js`
- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/internals/researchops-d1.js`
- `tests/mural-airtable-board-registry.test.js`
- `tests/mural-journal-sync-layout-runtime.test.js`
- `tests/mural-journal-sync-route-state.test.js`
- `tests/journal-tabs-api-origin-route-state.test.js`

## Files modified

- `infra/cloudflare/src/service/internals/airtable.js`
- `infra/cloudflare/src/service/mural-journal-sync-layout.js`
- `infra/cloudflare/src/service/mural-journal-sync/context.js`
- `tests/mural-airtable-board-registry.test.js`
- `tests/mural-journal-sync-layout-runtime.test.js`
- `docs/agent-audit/reasoning/2026/06/15/mural-journal-status-stale-board.md`
- `docs/agent-audit/reasoning/2026/06/15/mural-journal-status-stale-board.json`

## Implementation summary

- Changed Mural board registry listing so Airtable is preferred when Airtable is configured, with D1 retained as fallback when Airtable is unavailable or empty.
- Added stale or inaccessible Mural board error mapping in both journal sync context implementations so 403, 404 and 410 widget reads return `mural_board_not_found`.
- Added regression coverage for Airtable-over-stale-D1 board lookup and for stale Mural widget reads on the journal status path.

## Validation

- `npm test -- tests/mural-airtable-board-registry.test.js`
- `npm test -- tests/mural-journal-sync-layout-runtime.test.js`
- `npm test -- tests/mural-journal-sync-route-state.test.js tests/journal-tabs-api-origin-route-state.test.js`
- `npm test -- tests/mural-journal-sync-safe-tags-runtime.test.js tests/mural-journal-sync-layout-runtime.test.js tests/mural-airtable-board-registry.test.js tests/mural-journal-sync-route-state.test.js tests/journal-tabs-api-origin-route-state.test.js`
- `npm run format:check`
- `npm run lint` passed with existing warnings and no errors.
- `npm test` passed: 220 tests.

## Residual risk

- If a deployed environment has neither a live Airtable row nor a current D1 row for the newly-created board, the Journals page will correctly ask for a board to be created or reconnected. The dashboard should then be used to create/register the board again.
