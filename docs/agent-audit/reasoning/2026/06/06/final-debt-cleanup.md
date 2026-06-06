# Final repository debt cleanup

## Task summary

Address the final technical debt items: standardise preview-dependent Worker branch filters, document the D1 migration ordering contract, and document the generated GOV.UK HTML deployment boundary.

## Run metadata

- Date: 2026-06-06
- Branch: chore/reduce-repository-debt
- Trace required: yes, because `chore/` branches require an auditable trace.

## Operating model loaded

- AGENTS.md
- .agent-operating-model/orchestration.xml
- .agent-operating-model/bundle-registry.json
- .agent-operating-model/task-signal-catalog.json
- .agent-operating-model/selection-rules.json
- .agent-operating-model/precedence-policy.md
- .agent-operating-model/trace-policy.md
- .agent-operating-model/github-mutation-policy.md

## Bundles applied

- .agent-operating-model/bundles/github/
- .agent-operating-model/bundles/researchops-developer-control/
- .agent-operating-model/bundles/multi-functional-team/
- .agent-operating-model/bundles/govuk-design-system/
- .agent-operating-model/bundles/cloudflare/

## Files read

- .github/workflows/deploy-worker.yml
- .github/workflows/deploy-passwordless-preview-worker.yml
- .github/workflows/worker-ci.yml
- infra/cloudflare/migrations/
- tests/auth-registration-requests-route-state.test.js
- tests/govuk-pages-render-workflow-state.test.js

## Files created or modified

- .github/workflows/deploy-worker.yml
- .github/workflows/worker-ci.yml
- docs/deployment/d1-migration-ordering.md
- docs/deployment/generated-html-policy.md
- tests/auth-registration-requests-route-state.test.js
- tests/d1-migration-ordering-route-state.test.js
- tests/govuk-pages-render-workflow-state.test.js
- docs/agent-audit/reasoning/2026/06/06/final-debt-cleanup.md
- docs/agent-audit/reasoning/2026/06/06/final-debt-cleanup.json

## Decisions

- Aligned the main Worker workflow branch filters with the passwordless preview Worker branch filters so approved work branches refresh preview-dependent Workers consistently.
- Added the passwordless preview Worker workflow to Worker CI path filters because it changes Worker deployment behaviour.
- Documented the D1 migration ordering contract instead of renumbering existing duplicate prefixes, because those migrations are already referenced and may have been applied.
- Documented the generated GOV.UK HTML deployment boundary: generated HTML remains committed while Pages publishes `public/`, then can move to a build artefact when deployment supports building before publish.

## Validation

- `node --test tests/auth-registration-requests-route-state.test.js tests/d1-migration-ordering-route-state.test.js tests/govuk-pages-render-workflow-state.test.js` passed.
- `npm run format:check` passed.
- `npm run lint` passed with existing ESLint warnings.
- `npm test` passed with 184 tests.
- `npm run trace:coverage` passed.
