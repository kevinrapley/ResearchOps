# Journals project data hydration trace

## Run metadata

- Date: 2026-06-09
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-project-data-hydration`
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Original task summary

Correct the Reflexive Journal and Analysis page so Test Project 1 can show existing project-bound Reflexive Journal entries, Codes and Memos from available ResearchOps data sources. The defect appeared as empty journal, code and memo tabs despite the project having records in Airtable and likely D1.

## Operating-model files loaded

- `AGENTS.md`
- `RECENT_LEARNINGS.md`
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
- `.agent-operating-model/bundles/github/prompt.spec.yaml`
- `.agent-operating-model/bundles/github/prompt.body.xml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml`
- `.agent-operating-model/bundles/researchops-developer-control/prompt.body.xml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml`
- `.agent-operating-model/bundles/multi-functional-team/prompt.body.xml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml`
- `.agent-operating-model/bundles/govuk-design-system/prompt.body.xml`
- `.agent-operating-model/bundles/cloudflare/prompt.spec.yaml`
- `.agent-operating-model/bundles/cloudflare/prompt.body.xml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.spec.yaml`
- `.agent-operating-model/bundles/airtable-public-api/prompt.body.xml`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`
- `.agent-operating-model/bundles/airtable-public-api/`

## Bundles selected

- `github-diamond`: branch, PR, mutation, trace and CI governance.
- `researchops-developer-control`: ResearchOps service boundary, route and data contract ownership.
- `multi-functional-team`: public-sector product assurance defaults.
- `govuk-design-system`: Journals page UI and component context.
- `cloudflare`: Worker service and D1-backed runtime behaviour.
- `airtable-public-api`: Airtable record-listing and linked-record fallback behaviour.

## Bundles skipped

- `openai-platform`: no OpenAI API or model behaviour changed.
- `mcp-agent-tooling`: no MCP protocol or agent-tooling contract changed.
- `mural-public-api`: no Mural API behaviour changed; Mural sync is adjacent but not part of this display defect.

## Precedence decisions

GitHub Diamond governed the branch, PR and trace behaviour. ResearchOps Developer Control governed service-layer placement and route-state test coverage. Cloudflare governed D1-first read behaviour. Airtable Public API governed linked-record fallback handling. GOV.UK Design System governed the visible journals page context but did not require markup changes.

## Files read

- `public/js/journal-tabs.js`
- `public/js/project-context.js`
- `infra/cloudflare/src/core/router.js`
- `infra/cloudflare/src/service/index.js`
- `infra/cloudflare/src/service/journals.js`
- `infra/cloudflare/src/service/memos.js`
- `infra/cloudflare/src/service/reflection/codes.js`
- `infra/cloudflare/src/service/projects.js`
- `infra/cloudflare/src/service/projects/airtable.js`
- `infra/cloudflare/src/service/projects/normalisation.js`
- `infra/cloudflare/src/service/project-list-d1-airtable.js`
- `infra/cloudflare/src/service/internals/researchops-d1.js`
- `infra/cloudflare/migrations/researchops-d1/0001_seed.sql`

## Files created or modified

- Created `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- Modified `infra/cloudflare/src/service/index.js`
- Created `tests/journals-project-data-hydration-route-state.test.js`
- Created `docs/agent-audit/reasoning/2026/06/09/journals-project-data-hydration.md`
- Created `docs/agent-audit/reasoning/2026/06/09/journals-project-data-hydration.json`

## Implementation summary

The existing journals page already requested `/api/journal-entries`, `/api/codes` and `/api/memos` with a project identifier. The defect was that those service handlers did not consistently tolerate both public/local project ids and Airtable record ids across all three data types.

The change adds a shared project data hydration service for read paths. It resolves candidate project identifiers from `project`, `project_id`, `project_local_id` and `project_airtable_id`. It reads D1 first where a `RESEARCHOPS_D1` binding exists and matches rows by either `local_project_id` or `project`. If D1 has no matching rows, it resolves Airtable record ids through the existing project lookup and filters Airtable-linked records by the resolved project record id.

`listJournalEntries`, `listMemos` and `listCodes` now delegate to the shared hydration service. Create, update and delete paths remain on their existing service modules.

## Test-contract impact sweep

Performed. Affected contract surfaces:

- `/api/journal-entries` read behaviour
- `/api/codes` read behaviour
- `/api/memos` read behaviour
- service index delegation
- D1 seed table assumptions for journal entries, memos and codes
- Airtable fallback filtering by linked project record id
- route-state tests for journal data hydration

Legacy or affected terms checked:

- `listJournalEntries`
- `listMemos`
- `listCodes`
- `ProjectDataHydration`
- `journal_entries`
- `memos`
- `codes`
- `local_project_id`
- `project_airtable_id`
- `project_local_id`
- `findProjectRecord`

## Mutation strategy

A new `fix/` branch was created from `main`. Existing service delegation was changed through the available GitHub contents wrapper. A new service module and focused route-state test were added. The branch diff was checked against `main`; the changed-file list is plausible for a service-layer hydration fix plus trace artefacts.

## Automated review comments

No pull request had been opened at the time this trace was created. Review-thread state must be checked after the PR opens. Later legitimate Codex or automated review comments must be classified, fixed or evidenced, acknowledged with a thumbs-up reaction, replied to with validation evidence and resolved only after the fix is complete.

## Validation attempted

No repository commands were run in this connector session. Required before ready for review:

- `node --test tests/journals-project-data-hydration-route-state.test.js`
- `npm run build`
- `npm run format:check`
- `npm run validate`
- `npm run trace:coverage`

## Residual risks

- The new read path has not been validated against the live preview Worker yet.
- The branch changes service delegation and should remain draft until CI and preview checks complete.
- Project-context hydration remains asynchronous on the client, but the service read path now resolves the project id variants the page can send.
