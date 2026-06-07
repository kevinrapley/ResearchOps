# Repository browse selected-state trace

## Task summary

Implement the team-reviewed selected-state model for ResearchOps repository browse pages, especially `/pages/repository/user-groups/`.

## Run metadata

- Date: 2026-06-07
- Branch: `feature/repository-browse-selected-state`
- Base: `fix/repository-seed-meaningful-tags`
- Trace required: yes, because `feature/` branches require an auditable trace.
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

## Files read

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/pages/repository-static.njk`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/repository.js`
- `src/styles/repository.scss`
- `tests/repository-front-page-route-state.test.js`
- `docs/product/26/06/07/research-repository-product-direction.md`
- `infra/cloudflare/migrations/0014_research_repository.sql`
- `infra/cloudflare/migrations/0015_seed_research_repository.sql`
- `infra/cloudflare/migrations/0016_update_repository_seed_tag_taxonomy.sql`

## Files changed

- `src/govuk/data/repository-page.mjs`
- `src/govuk/templates/pages/repository-static.njk`
- `public/js/repository-static-page.js`
- `infra/cloudflare/src/service/repository.js`
- `src/styles/repository.scss`
- `tests/repository-front-page-route-state.test.js`
- `docs/product/26/06/07/repository-browse-selected-state-implementation.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-browse-selected-state.md`
- `docs/agent-audit/reasoning/2026/06/07/repository-browse-selected-state.json`

## Decisions

- Treat repository browse pages as selected-state result pages, not generic API helper pages.
- Rename the user-group route to `Browse by user group`.
- Use `Published artefacts`, not `Published evidence`.
- Keep stable page structure in Nunjucks: selected-state summary, sort form, result count, results area and pagination container.
- Hydrate dynamic artefact rows, selected state, pagination and sort behaviour in `public/js/repository-static-page.js`.
- Extend `/api/repository` responses with `selected` and `pagination` metadata.
- Limit selected-state results to 10 per page by default.
- Add sort support for `reviewed_desc`, `confidence_desc` and `relevance`.
- Render artefact metadata as structured definition content instead of relying on a flat tag list.

## Validation attempted

- GitHub compare was used to inspect changed files.
- Repository-local commands were not run in this environment.

## Residual risks

- Local build and test commands still need to be run.
- This branch depends on `fix/repository-seed-meaningful-tags` for corrected seed taxonomy and sentence-case browse labels.
