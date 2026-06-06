# Study support auth error fix

## Run metadata

- Date: 2026-06-06
- Branch: `fix/study-support-auth-error`
- Base commit: `63d26db1`
- Task: Fix authenticated note takers and observers setup save showing `route_permission_missing` and raw system copy.

## Branch trace decision

The branch starts with `fix/`, so an auditable trace is required by `.agent-operating-model/trace-policy.md`.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

The GOV.UK and Cloudflare bundles were applied manually because the failing behaviour spans a user-facing GOV.UK error summary and a Cloudflare Worker/D1 route-permission check.

## Bundles skipped

- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: Airtable fallback behaviour was not changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural integration changed.

## Precedence decisions

- GitHub Diamond governed branch naming, trace requirement, and validation evidence.
- ResearchOps Developer Control governed the route/service boundary and small scoped implementation.
- GOV.UK Design System governed user-facing error-summary copy so internal machine codes are not shown to researchers.
- Cloudflare governed Worker/D1 runtime handling.

## Files read

- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/migrations/0013_study_support_people.sql`
- `public/js/note-takers-observers-page.js`
- `public/js/study-route-context.js`
- `tests/study-note-takers-observers-route-state.test.js`
- `tests/auth-route-permissions.test.js`
- `docs/product/26/06/06/study-note-takers-observers.md`

## Files modified

- `infra/cloudflare/src/worker.js`
- `public/js/note-takers-observers-page.js`
- `tests/study-note-takers-observers-route-state.test.js`
- `docs/product/26/06/06/study-note-takers-observers.md`
- `docs/agent-audit/reasoning/2026/06/06/study-support-auth-error.md`
- `docs/agent-audit/reasoning/2026/06/06/study-support-auth-error.json`

## Implementation summary

- Added runtime idempotent seeding for the study-support auth permissions, researcher role mappings, and route-permission declarations before the Worker resolves the authenticated context for `/api/study-support`.
- Kept the route permission check in place after seeding so the endpoint remains permission-gated.
- Added page-level friendly error mapping so internal API codes such as `route_permission_missing` are not surfaced in the GOV.UK error summary.
- Extended route-state tests to assert both the runtime auth declarations and the friendly error copy.
- Updated the product document to record the original team discussion decisions, prototype steering decisions, access expectations, permission resilience and plain-language error handling.

## Validation

- `node tests/study-note-takers-observers-route-state.test.js` passed.
- `node tests/auth-route-permissions.test.js` passed.
- `node tests/study-child-route-state.test.js` passed.
- `node tests/study-page-route-state.test.js` passed.
- `npm test -- tests/study-note-takers-observers-route-state.test.js tests/auth-route-permissions.test.js tests/study-child-route-state.test.js tests/study-page-route-state.test.js` passed.
- `npx prettier -c infra/cloudflare/src/worker.js public/js/note-takers-observers-page.js tests/study-note-takers-observers-route-state.test.js` passed.

## Residual risk

The fix seeds only this route's new auth declarations at runtime. Wider D1 migration drift for unrelated routes remains outside this change.
