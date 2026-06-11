# Test Project 1 Journal Seed Expansion Audit

## Run metadata

- Date: 2026-06-12
- Working tree: `/Users/kevin.rapley/Documents/Codex/2026-06-04/researchops-familiarise-yourself-with-the-repo/work/ResearchOps`
- Branch: `feature/test-project-1-journal-seed`
- Branch posture: `feature/*` requires an auditable trace
- PR: `https://github.com/kevinrapley/ResearchOps/pull/392`

## Task summary

Address feedback that the Test Project 1 seed was too small, code co-occurrence returned no results, and the codebook UI did not clearly show whether a code was first-order, second-order or thematic.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`

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

- Cloudflare applies because the work changes D1 seed application and Worker runtime fallback behaviour.
- GOV.UK applies because the work changes codebook UI communication using GOV.UK details, summary list and tag patterns.

## Precedence decisions

- GitHub branch and trace policy required keeping work on the existing `feature/` branch and adding this trace.
- Cloudflare storage rules required idempotent D1 SQL and prepared-runtime fallback behaviour that does not rely on re-running an already-applied migration.
- GOV.UK component rules led to using tags for code type, summary-list rows for code metadata and a details component for concise hierarchy guidance.
- ResearchOps repository conventions led to centralising the seed in one service-internals module and generating the D1 SQL from that source.

## Files read

- `infra/cloudflare/migrations/0017_seed_test_project_1_journal_analysis.sql`
- `.github/workflows/apply-d1-test-project-1-journal-analysis.yml`
- `infra/cloudflare/src/service/internals/test-project-1-journal-seed.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `public/js/journal-tabs.js`
- `tests/test-project-1-journal-analysis-seed-route-state.test.js`
- `tests/analysis-d1-cooccurrence-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/d1-migration-ordering-route-state.test.js`
- `docs/deployment/d1-migration-ordering.md`

## Files created or modified

Created:

- `infra/cloudflare/migrations/0019_expand_test_project_1_journal_analysis_seed.sql`
- `scripts/d1/write-test-project-1-journal-analysis-sql.mjs`
- `docs/agent-audit/reasoning/2026/06/12/test-project-1-journal-seed-expansion.md`
- `docs/agent-audit/reasoning/2026/06/12/test-project-1-journal-seed-expansion.json`

Modified:

- `.github/workflows/apply-d1-test-project-1-journal-analysis.yml`
- `docs/deployment/d1-migration-ordering.md`
- `infra/cloudflare/src/service/internals/test-project-1-journal-seed.js`
- `infra/cloudflare/src/service/reflection/analysis.js`
- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `public/js/journal-tabs.js`
- `tests/analysis-d1-cooccurrence-runtime.test.js`
- `tests/journal-entry-d1-seed-fallback-runtime.test.js`
- `tests/journal-secondary-actions-route-state.test.js`
- `tests/test-project-1-journal-analysis-seed-route-state.test.js`

## Implementation decisions

- Expanded the canonical Test Project 1 dataset to 36 journal entries, 40 hierarchical codes, 12 memos and 180 code applications.
- Added a generated forward migration, `0019_expand_test_project_1_journal_analysis_seed.sql`, so deployed D1 can be updated even if earlier seed SQL was already applied or missed.
- Updated the D1 apply workflow to apply the expansion migration and verify the generated SQL is in sync with the canonical dataset source.
- Added runtime fallbacks so Test Project 1 preview uses the expanded seed when D1 is empty or still contains the older partial seed.
- Added codebook code-type labelling using GOV.UK tags: thematic code, second-order code and first-order code.
- Added a GOV.UK details component explaining the code hierarchy, plus summary-list metadata rows for code type and path.
- Restricted parent-code options to valid thematic or second-order parent codes.

## Validation attempted

- Syntax checks passed for changed JavaScript modules and the SQL writer.
- Generated SQL matched the checked-in expansion migration with `cmp`.
- SQLite applied the expansion migration locally.
- Local SQLite counts: 36 journal entries, 40 codes, 12 memos, 180 code applications and 200 co-occurring code pairs.
- Focused journal-analysis tests passed: 12 tests.
- `npm run format:check` passed.
- `npm test` passed with 209 tests.
- `npm run lint` passed with existing repository warning-level findings only.

## Validation not run

- Browser walkthrough was not run in this continuation.
- Remote D1 workflow was not manually dispatched from this local run.

## Issues, pivots and residual risks

- The previous PR changed an existing seed file, but an already-applied D1 seed path may not refresh a deployed database. This continuation adds a forward expansion migration and preview fallback to avoid an empty co-occurrence experience.
- The codebook UI now communicates code hierarchy clearly, but manual browser confirmation of spacing and live interaction remains unverified locally.
