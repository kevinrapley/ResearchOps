# RES-9 source-linked repository candidate drafting

## Run metadata

- Date: 2026-06-30
- Branch: feature/res-9-source-linked-candidate-drafting
- Task: Add a Submit to repository path from reviewed synthesis or recommendation context into the existing repository candidate flow.

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
- .agent-operating-model/behavioural-evals.json
- .agent-operating-model/github-mutation-policy.md

## Bundles selected

- github-diamond: repository governance, branch, validation and PR discipline.
- researchops-developer-control: ResearchOps platform architecture and repository conventions.
- multi-functional-team: public-sector product, safety and human review defaults.
- govuk-design-system: frontend form/page changes.
- cloudflare: Worker service candidate creation path.

## Bundles skipped

- openai-platform: no model/API integration changed.
- mcp-agent-tooling: no MCP/tool contract changed.
- airtable-public-api: no Airtable API behaviour changed.
- mural-public-api: no Mural API behaviour changed.

## Precedence decisions

- GitHub Diamond governed branch, trace and validation expectations.
- ResearchOps Developer Control governed the existing candidate row flow and repository payload shape.
- GOV.UK bundle governed visible form additions and retained human-editable candidate fields.
- Cloudflare bundle applied to the Worker service data path; no deployment was performed.

## Files read

- public/js/repository-static/candidate.js
- public/js/synthesize-page.js
- src/govuk/templates/pages/repository-static.njk
- infra/cloudflare/src/service/repository.js
- tests/repository-front-page-route-state.test.js
- tests/synthesis-api-route-state.test.js

## Files modified

- public/js/synthesize-page.js
- public/js/repository-static/candidate.js
- src/govuk/templates/pages/repository-static.njk
- infra/cloudflare/src/service/repository.js
- tests/repository-front-page-route-state.test.js
- tests/synthesis-api-route-state.test.js

## Implementation summary

- Added a Submit to repository link to synthesis theme cards.
- The link opens the existing candidate form and pre-fills source project, source study, source synthesis ID, evidence type, evidence basis, confidence, evidence maturity, limitations, reuse guidance and do-not-use-for guidance.
- Added visible candidate form fields for confidence, evidence maturity and source synthesis or recommendation ID so humans can edit before submission.
- Extended candidate row creation so `payload_json` stores source provenance, candidate drafting fields and pending PII/consent gate status while keeping rows in `candidate` status only.

## Validation attempted

- `npm ci`: passed; installed dependencies. npm reported existing audit findings: 1 low, 2 moderate and 2 high.
- `npm run build:generated-css`: passed.
- `npm test -- tests/synthesis-api-route-state.test.js tests/repository-front-page-route-state.test.js`: first failed before dependencies/generated CSS were present, then passed after `npm ci` and generated CSS build.
- `npm run build:govuk-pages`: passed and rendered repository candidate pages.
- `npm run format:check`: passed.
- `npm run lint`: passed with existing warnings only.
- `npm run typecheck --if-present`: passed/no output.

## Validation not run

- Full `npm test -- --ci` was not run; focused route-state tests and lint/build checks were run for this first increment.
- Browser/E2E validation was not run in this environment.

## Residual risks

- The first increment covers synthesis theme context. A separate recommendation page path can reuse the same candidate-form prefill aliases but was not added because no current recommendation UI flow was identified in this increment.
- PII and consent gates intentionally remain pending unless a curator reviews and confirms them later.
