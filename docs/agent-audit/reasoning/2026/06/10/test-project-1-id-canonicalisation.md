# Test Project 1 ID canonicalisation trace

## Run metadata

- Date: 2026-06-10
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/canonicalise-test-project-id`
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Task summary

Correct the Test Project 1 project ID mismatch where historical D1-backed links and seed rows use `recgdpwEI5hFO7bUZ` with the letter `O`, while the canonical Airtable record ID is `recgdpwEI5hF07bUZ` with the number `0`.

## Operating-model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond`
- `researchops-developer-control`
- `multi-functional-team`
- `cloudflare`
- `airtable-public-api`

## Files read

- `infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql`
- `infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql`
- `infra/cloudflare/migrations/researchops-d1/0001_seed.sql`
- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `tests/test-project-1-participants-seed-route-state.test.js`
- `docs/deployment/d1-migration-ordering.md`

## Files created or modified

- Created `infra/cloudflare/migrations/0018_canonicalise_test_project_1_id.sql`
- Modified `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- Modified `docs/deployment/d1-migration-ordering.md`
- Created `.github/workflows/apply-d1-test-project-1-id-canonicalisation.yml`
- Created `tests/test-project-1-id-canonicalisation-route-state.test.js`
- Created `docs/agent-audit/reasoning/2026/06/10/test-project-1-id-canonicalisation.md`
- Created `docs/agent-audit/reasoning/2026/06/10/test-project-1-id-canonicalisation.json`

## Implementation summary

A new D1 migration canonicalises the legacy `recgdpwEI5hFO7bUZ` identifier to `recgdpwEI5hF07bUZ` across the live D1 tables that can store Test Project 1 references: participant cache, journal entries, memos, codes, studies cache and project cache. JSON payload fields are also repaired using string replacement.

The journal hydration read path now treats the legacy and canonical IDs as aliases. This means existing links using `recgdpwEI5hFO7bUZ` continue to return journal entries, codes and memos even after D1 rows are normalised to `recgdpwEI5hF07bUZ`.

A guarded workflow applies the canonicalisation migration to the remote `researchops-d1` database and checks for remaining bad project references in the main affected tables.

## Validation status

CI polling required after PR creation.
