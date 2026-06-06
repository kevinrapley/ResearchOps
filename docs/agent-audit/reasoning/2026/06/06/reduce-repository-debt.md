# Reduce repository debt

## Task summary

Narrow repository ignore rules, explicitly exclude charts from Prettier and ESLint, and split the large study guides page component by responsibility.

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

## Bundles applied

- .agent-operating-model/bundles/github/
- .agent-operating-model/bundles/researchops-developer-control/
- .agent-operating-model/bundles/multi-functional-team/
- .agent-operating-model/bundles/govuk-design-system/
- .agent-operating-model/bundles/cloudflare/

## Bundles not selected

- .agent-operating-model/bundles/openai/
- .agent-operating-model/bundles/mcp-agent-tooling/
- .agent-operating-model/bundles/airtable-public-api/
- .agent-operating-model/bundles/mural-public-api/

## Files read

- AGENTS.md
- .agent-operating-model/orchestration.xml
- .agent-operating-model/bundle-registry.json
- .agent-operating-model/task-signal-catalog.json
- .agent-operating-model/selection-rules.json
- .agent-operating-model/precedence-policy.md
- .agent-operating-model/trace-policy.md
- .gitignore
- .prettierignore
- eslint.config.js
- public/components/guides/guides-page.js
- public/components/guides/guide-editor.js
- public/components/guides/patterns.js
- tests/study-guides-route-state.test.js

## Files created or modified

- .gitignore
- .prettierignore
- docs/product/26/05/07/researchops-design-critique-backlog-2026-05-07.md
- docs/product/26/05/07/researchops-design-critique-implementation-authority-2026-05-07.md
- docs/product/26/05/07/researchops-design-critique-product-change-register-2026-05-07.md
- docs/product/26/05/08/authentication-role-selection-cloudflare-operations-2026-05-08.md
- eslint.config.js
- lychee.toml
- public/components/guides/api.js
- public/components/guides/front-matter.js
- public/components/guides/guides-page.js
- public/components/guides/pattern-controller.js
- public/partials/project-tabs.html
- tests/govuk-pages-render-workflow-state.test.js
- tests/study-guides-route-state.test.js
- docs/agent-audit/reasoning/2026/06/06/reduce-repository-debt.md
- docs/agent-audit/reasoning/2026/06/06/reduce-repository-debt.json

## Decisions

- Replaced broad Git ignores for source-controlled areas with narrower build, cache, test-output, and runtime artefact ignores so docs, scripts, infra, and public artefacts are no longer hidden from Git by default.
- Kept Prettier scope explicit where previously hidden files became visible to Git, because many source-controlled generated/vendor-heavy areas are not currently Prettier-owned.
- Added `charts/**` to both Prettier and ESLint ignores.
- Split guides-page responsibilities into API access, front matter parsing, and pattern drawer/controller modules while keeping the existing page bootstrapping and editor orchestration in `guides-page.js`.
- Updated route-state assertions to cover the extracted modules without depending on formatter-specific single-line imports.
- Follow-up Lychee remediation corrected stale documentation links exposed by the narrower Git ignore rules, fixed the project notes tab route, and added narrow Lychee exclusions for placeholder-heavy Mural example transcripts and the Mustache HTML head partial.

## Validation attempted

- `node --check public/components/guides/guides-page.js && node --check public/components/guides/pattern-controller.js && node --check public/components/guides/api.js && node --check public/components/guides/front-matter.js` — passed.
- `node tests/study-guides-route-state.test.js` — passed.
- `npm run format:check` — passed after generated CSS output was regenerated and confirmed unchanged.
- `npm run build:generated-css && npx eslint .` — passed with existing warnings only.
- `npm run trace:coverage` — passed.
- `node tests/govuk-pages-render-workflow-state.test.js` — passed.
- `npm test` — passed, 178 tests.
- Follow-up after Lychee failure: `npm run format:check` — passed.
- Follow-up after Lychee failure: `npm test` — passed, 178 tests.

## Residual risk

- ESLint still reports existing repository warnings, mainly console usage and unused symbols outside this change. This task did not attempt a repository-wide lint cleanup.
