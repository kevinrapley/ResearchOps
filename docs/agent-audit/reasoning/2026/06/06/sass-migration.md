# Sass migration

## Task summary

Create a focused Sass migration change: use `@use` where feasible, and deliberately suppress or replace GOV.UK deprecated colour names.

## Run metadata

- Date: 2026-06-06
- Branch: chore/reduce-repository-debt
- Trace required: yes, because `chore/` branches require an auditable trace.
- Branch decision: attempted to create `chore/sass-migration`, but Git ref creation was blocked by workspace metadata permissions. The user then instructed that this branch should be used for the work.

## Operating model loaded

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

## Bundles applied

- .agent-operating-model/bundles/github/
- .agent-operating-model/bundles/researchops-developer-control/
- .agent-operating-model/bundles/multi-functional-team/
- .agent-operating-model/bundles/govuk-design-system/

## Bundles not selected

- .agent-operating-model/bundles/cloudflare/
- .agent-operating-model/bundles/openai/
- .agent-operating-model/bundles/mcp-agent-tooling/
- .agent-operating-model/bundles/airtable-public-api/
- .agent-operating-model/bundles/mural-public-api/

## Files read

- package.json
- scripts/styles/build-generated-css.mjs
- scripts/styles/format-generated-css.mjs
- scripts/styles/generated-css-targets.mjs
- src/styles/govuk.scss
- src/styles/researchops-home.scss
- src/styles/*.scss
- node_modules/govuk-frontend/dist/govuk/index.scss
- node_modules/govuk-frontend/dist/govuk/_base.scss
- node_modules/govuk-frontend/dist/govuk/settings/_index.scss
- node_modules/govuk-frontend/dist/govuk/settings/_warnings.scss
- tests/govuk-frontend-integration-route-state.test.js

## Files created or modified

- package.json
- scripts/styles/build-generated-css.mjs
- src/styles/govuk.scss
- src/styles/researchops-home.scss
- tests/govuk-frontend-integration-route-state.test.js
- tests/sass-migration-route-state.test.js
- docs/agent-audit/reasoning/2026/06/06/sass-migration.md
- docs/agent-audit/reasoning/2026/06/06/sass-migration.json

## Decisions

- Migrated ResearchOps-authored Sass entry points from `@import` to `@use` where the current GOV.UK package supports equivalent output.
- Preserved generated CSS output equivalence for the GOV.UK bundle and ResearchOps home stylesheet.
- Replaced deprecated GOV.UK pre-brand colour names in authored Sass with their documented replacement calls: black tint 80, black tint 95, and black tint 25.
- Suppressed the Dart Sass `import` deprecation in Sass build commands because the remaining `@import` usage comes from GOV.UK Frontend v6 internals, not authored ResearchOps Sass.
- Added a route-state guard to prevent reintroducing authored `src/styles` Sass `@import` usage or deprecated GOV.UK colour names.

## Validation

- `node --test tests/sass-migration-route-state.test.js tests/govuk-frontend-integration-route-state.test.js` passed.
- `npm run build:generated-css` passed without Sass deprecation warning output.
- `npm run build:govuk` passed without Sass deprecation warning output.
- `npm test` passed with 183 tests.
- `npm run format:check` passed.
- `npm run lint` passed with existing ESLint warnings.

## Residual risks

- GOV.UK Frontend v6 still contains internal Sass `@import` usage. The build now suppresses that vendor deprecation warning, while the new test guards against authored `src/styles` regressions.
