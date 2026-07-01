# RES-10 impact-to-repository linkage

## Run metadata

- Date: 2026-07-01
- Branch: feature/res-10-impact-to-repository-linkage
- Task: Add optional impact source metadata to repository candidate payloads and published artefact detail summaries.

## Branch-prefix trace decision

- Branch prefix `feature/` requires an auditable trace.
- Trace contains operational evidence only and does not include private chain-of-thought.

## Operating-model files loaded

- AGENTS.md
- .agent-operating-model/orchestration.xml
- .agent-operating-model/bundle-registry.json
- .agent-operating-model/task-signal-catalog.json
- .agent-operating-model/selection-rules.json
- .agent-operating-model/bootstrap-checklist.md
- .agent-operating-model/precedence-policy.md
- .agent-operating-model/trace-policy.md
- .agent-operating-model/trace-layers.md
- .agent-operating-model/github-mutation-policy.md

## Bundles selected

- github-diamond: repository governance, branch, validation and trace discipline.
- researchops-developer-control: ResearchOps repository payload and publication workflow conventions.
- multi-functional-team: public-sector product, privacy, human review and harm defaults.
- govuk-design-system: candidate form additions and visible warning copy.
- cloudflare: Worker/D1 repository service data path.

## Bundles skipped

- openai-platform: no model/API integration changed.
- mcp-agent-tooling: no MCP/tool contract changed.
- airtable-public-api: no Airtable API behaviour changed.
- mural-public-api: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch and validation expectations.
- ResearchOps Developer Control governed candidate payload shape and artefact detail output.
- Multi-functional Team and GOV.UK rules supported the decision to store summary context rather than exposing sensitive decision links.
- Cloudflare bundle applied to Worker service behaviour; no deployment was performed.

## Files read

- 100-hephaestus-cron-ideas/2026/06/20/17-14-35_hephaestus-cron-ideas-critical-product-direction.md
- AGENTS.md and operating-model files listed above
- .agent-operating-model/bundles/github/prompt.spec.yaml
- .agent-operating-model/bundles/github/prompt.body.xml
- .agent-operating-model/bundles/researchops-developer-control/prompt.spec.yaml
- .agent-operating-model/bundles/researchops-developer-control/prompt.body.xml
- .agent-operating-model/bundles/multi-functional-team/prompt.spec.yaml
- .agent-operating-model/bundles/multi-functional-team/prompt.body.xml
- .agent-operating-model/bundles/govuk-design-system/prompt.spec.yaml
- .agent-operating-model/bundles/govuk-design-system/prompt.body.xml
- .agent-operating-model/bundles/cloudflare/prompt.spec.yaml
- .agent-operating-model/bundles/cloudflare/prompt.body.xml
- infra/cloudflare/src/service/repository.js
- public/js/repository-static/candidate.js
- public/js/repository-artefact-page.js
- src/govuk/templates/pages/repository-static.njk
- tests/repository-front-page-route-state.test.js
- tests/repository-review-workbench-runtime.test.js
- public/components/impact-tracker.js
- infra/cloudflare/src/service/impact.js

## Files modified

- infra/cloudflare/src/service/repository.js
- public/js/repository-static/candidate.js
- public/js/repository-artefact-page.js
- src/govuk/templates/pages/repository-static.njk
- tests/repository-front-page-route-state.test.js
- tests/repository-impact-linkage-runtime.test.js

## Implementation summary

- Added optional impact source fields to the repository candidate form: impact record reference, impact context summary, decision context summary and outcome context summary.
- Added candidate prefill aliases for impact source metadata so upstream impact or decision workflows can pre-populate the form without bypassing human review.
- Extended candidate creation so `payload_json` stores `impactSource` as summarised metadata and does not copy submitted `decisionLink` values into repository payloads.
- Extended published artefact detail output to include `impactSource` when full detail is requested, then rendered impact, decision and outcome context rows on the artefact detail page.
- Added regression coverage for candidate impact metadata storage, sensitive decision-link exclusion and artefact detail impact summaries.

## Validation attempted

- `node --test tests/repository-impact-linkage-runtime.test.js tests/repository-front-page-route-state.test.js`: first failed because the new test omitted `node:test`; fixed by importing `test`, then passed.
- `npm test -- tests/repository-impact-linkage-runtime.test.js tests/repository-front-page-route-state.test.js`: passed, 3/3 tests.
- `npm run build:govuk-pages`: passed and rendered repository pages.
- `npx eslint infra/cloudflare/src/service/repository.js public/js/repository-static/candidate.js public/js/repository-artefact-page.js tests/repository-impact-linkage-runtime.test.js tests/repository-front-page-route-state.test.js`: passed with existing warnings only for unused functions in repository scripts.

## Validation not run

- Full `npm test` suite was not run; focused route-state/runtime tests plus page rendering and targeted lint were run for this first increment.
- Browser/E2E validation was not run in this environment.

## Residual risks

- The new metadata is optional and summary-only. A later increment could add an explicit upstream link from the impact record table into the candidate form.
- Published detail only shows impact summaries when metadata exists in `payload_json`; existing artefacts without this metadata continue to display `Not recorded` rows.
