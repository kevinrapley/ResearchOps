# Test Project 1 Journal Co-occurrence Seed Audit

## Run metadata

- Date: 2026-06-11
- Working tree: `/Users/kevin.rapley/Documents/Codex/2026-06-04/researchops-familiarise-yourself-with-the-repo/work/ResearchOps`
- Branch at start: `main`
- Branch at finish: `feature/test-project-1-journal-seed`
- Branch posture: `feature/*` requires an auditable trace

## Task summary

Seed D1 for Test Project 1 with realistic journal entries, codes, memos and code applications so a user researcher can exercise code co-occurrence. The seeded codebook must support first-order descriptive codes, second-order interpretive codes, and aggregate thematic codes.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`

## Bundle selection

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`

Skipped bundles:

- `openai-platform`
- `mcp-agent-tooling`
- `airtable-public-api`
- `mural-public-api`

Reasoning:

- GitHub, ResearchOps developer and multidisciplinary assurance bundles apply to repository changes and PR publication.
- Cloudflare applies because the work changes D1 migrations and Worker service logic.
- GOV.UK applies because the work adds user-facing code hierarchy controls to the journal/codebook UI.
- OpenAI, MCP, Airtable and Mural bundles were not required because this change does not use those APIs.

## Precedence decisions

- Repository branch and trace policy took precedence, so the work moved to a `feature/` branch and includes this trace.
- Cloudflare storage rules took precedence for D1 schema compatibility and idempotent migrations.
- GOV.UK form rules took precedence for the parent-code control, using a standard select with hint text instead of bespoke UI.
- Existing ResearchOps service patterns took precedence for fallback behaviour between seeded D1 data and Airtable-backed data.

## Files read

- `infra/cloudflare/migrations/0017_seed_test_project_1_journal_analysis.sql`
- `infra/cloudflare/migrations/0018_canonicalise_test_project_1_id.sql`
- `infra/cloudflare/src/service/internals/test-project-1-journal-seed.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `infra/cloudflare/src/service/reflection/codes.js`
- `public/js/journal-tabs.js`
- `tests/test-project-1-journal-analysis-seed-route-state.test.js`
- `tests/test-project-1-id-canonicalisation-route-state.test.js`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`

## Files created or modified

Created:

- `tests/analysis-d1-cooccurrence-runtime.test.js`
- `tests/codes-d1-only-runtime.test.js`
- `docs/agent-audit/reasoning/2026/06/11/test-project-1-journal-cooccurrence-seed.md`
- `docs/agent-audit/reasoning/2026/06/11/test-project-1-journal-cooccurrence-seed.json`

Modified:

- `.github/workflows/apply-d1-test-project-1-id-canonicalisation.yml`
- `.github/workflows/apply-d1-test-project-1-journal-analysis.yml`
- `infra/cloudflare/migrations/0017_seed_test_project_1_journal_analysis.sql`
- `infra/cloudflare/migrations/0018_canonicalise_test_project_1_id.sql`
- `infra/cloudflare/src/service/internals/test-project-1-journal-seed.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `infra/cloudflare/src/service/reflection/codes.js`
- `public/js/journal-tabs.js`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `tests/test-project-1-id-canonicalisation-route-state.test.js`
- `tests/test-project-1-journal-analysis-seed-route-state.test.js`

## Implementation decisions

- Seeded 12 realistic journal entries, 21 hierarchical codes, 5 memos and 48 code applications for Test Project 1.
- Added a `code_applications` D1 table so co-occurrence can be tested with explicit entry-to-code links.
- Kept the D1 seed idempotent using stable record IDs and conflict updates.
- Added D1-backed code and journal fetch paths to the analysis service so co-occurrence, retrieval and export can operate without Airtable configuration.
- Added D1-only code create/update support, including parent assignment and three-level hierarchy validation.
- Added a parent-code select to code creation and editing so researchers can create thematic, interpretive and descriptive codes.
- Updated Test Project 1 fallback data so local pages show the same realistic journal entries even before D1 contains the rows.

## Validation attempted

- `node --check infra/cloudflare/src/service/reflection/analysis.js` passed.
- `node --check infra/cloudflare/src/service/reflection/codes.js` passed.
- `node --check public/js/journal-tabs.js` passed.
- Targeted Prettier write ran on touched files.
- `git diff --check` passed.
- Focused journal-analysis tests passed: 11 tests.
- `npm run trace:coverage` passed.
- `npm run format:check` passed.
- `npm test` passed with 208 tests.
- `npm run lint` passed with repository-existing warning-level findings. Two warning-level findings introduced in `infra/cloudflare/src/service/reflection/codes.js` were cleaned up before commit.

## Validation not run

- Browser walkthrough not run yet.
- Full Cloudflare deployment workflow not run locally.

## Issues, pivots and residual risks

- The first retrieval test assertion expected only the matched code on a result. The implementation correctly returns all codes on matched journal entries, so the test was adjusted to assert the entry-level code set.
- No production D1 migration has been applied from this local run; deployment remains through the GitHub workflow.
- The D1-only code hierarchy path is covered by focused tests, but full browser interaction for creating nested codes remains unverified in this run.
