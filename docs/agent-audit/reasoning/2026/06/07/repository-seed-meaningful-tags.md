# Repository seed tag taxonomy trace

## Task summary

Replace generated repository seed tags such as `Seeded topic 00` and `Seeded recommendation 072` with production-like, meaningful topic and recommendation examples.

## Run metadata

- Date: 2026-06-07
- Branch: `fix/repository-seed-meaningful-tags`
- Trace required: yes, because `fix/` branches require an auditable trace.
- Repository: `kevinrapley/ResearchOps`

## Operating model loaded

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`
- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundles skipped

- `.agent-operating-model/bundles/openai/`: no OpenAI API or model behaviour changed.
- `.agent-operating-model/bundles/mcp-agent-tooling/`: no MCP tooling changed.
- `.agent-operating-model/bundles/airtable-public-api/`: Airtable fallback behaviour was not changed.
- `.agent-operating-model/bundles/mural-public-api/`: no Mural behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch creation, trace requirement and changed-file verification.
- ResearchOps Developer Control governed repository route contracts, D1 migration posture and test-contract updates.
- Multi-Functional Team governed the product requirement that repository labels are meaningful, reusable and not implementation leakage.
- GOV.UK Design System remained relevant because seeded labels are exposed in GOV.UK tag components on repository result pages.
- Cloudflare governed D1 schema, preview D1 migration behaviour and idempotent deployment posture.

## Files read

- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0015_seed_research_repository.sql`
- `tests/repository-front-page-route-state.test.js`
- `.github/workflows/deploy-worker.yml`
- `.github/workflows/deploy-passwordless-preview-worker.yml`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/repository.js`

## Files changed

- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql`
- `tests/repository-front-page-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/07/repository-seed-meaningful-tags.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-seed-meaningful-tags.json`

## Decisions

- Add an explicit `0016` migration that replaces generated seed topic and recommendation labels with meaningful taxonomy labels.
- Also add idempotent guards to `0014_research_repository.sql`, because preview deployment currently applies `0014` and `0015` directly. The guard repairs existing preview rows and rewrites future `0015` inserts through triggers.
- Keep the original `0015` seed data structure intact because it generates the broader review dataset.
- Update route-state coverage to assert meaningful seed tag labels and the schema guard.

## Replacement taxonomy

Generated topic tags now resolve to labels such as:

- Confidence and comprehension
- Workflow friction
- Governance and consent
- Handoff risk
- Transaction failure
- Evidence misuse

Generated recommendation tags now resolve to labels such as:

- Explain confidence and next steps
- Reduce avoidable workflow friction
- Confirm consent and governance boundaries
- Clarify handoff owner and next action
- Make recovery routes explicit
- State evidence limits before reuse

## Validation attempted

- GitHub compare confirms the branch is ahead of `main` and the changed-file list is limited to D1 seed taxonomy, route-state tests and trace files.
- Repository-local commands were not run in this environment.

## Residual risks

- The D1 preview deployment must run to update the existing preview database.
- Full repository CI has not been run locally in this session.
