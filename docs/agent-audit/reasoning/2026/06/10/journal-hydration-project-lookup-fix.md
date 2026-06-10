# Journal hydration project lookup fix trace

## Run metadata

- Date: 2026-06-10
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-project-data-hydration`
- Pull request: #383
- Trace layer: operational
- Branch-prefix trace decision: `fix/` requires a promoted trace.

## Task summary

Correct a live Test Project 1 hydration failure where Reflexive Journal entries, Codes and Memos were not reaching the frontend. The failure was traced to the Worker Airtable fallback not recognising `Project lookup`, which is the linked-project field used in existing journal entry and code data exports.

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
- `govuk-design-system`
- `cloudflare`
- `airtable-public-api`

## Files read

- `public/js/project-context.js`
- `public/js/journal-tabs.js`
- `public/js/project-dashboard.js`
- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `infra/cloudflare/src/service/projects/airtable.js`
- `infra/cloudflare/src/service/project-list-d1-airtable.js`
- `data/journal-entries.csv`
- `data/codes.csv`
- `tests/journals-project-data-hydration-route-state.test.js`

## Files modified

- `infra/cloudflare/src/service/reflection/project-data-hydration.js`
- `tests/journals-project-data-hydration-route-state.test.js`

## Implementation summary

The frontend already calls `/api/journal-entries`, `/api/codes` and `/api/memos` with a project identifier. The Worker read path checked D1 first and then fell back to Airtable. The fallback filtered linked records by fields named `Project`, `Projects`, `Project ID` and `Project Ref`, but existing journal and code data use `Project lookup`. The fallback therefore returned empty lists even when Airtable had Test Project 1 records.

The linked-project resolver now recognises both `Project lookup` and `Project Lookup`. Route-state coverage now asserts that the resolver supports those fields and that the source CSVs use them.

## Validation status

CI polling required after commit `af83f9676e5e27a8b00e631a3867c60b95fcad4b`.
