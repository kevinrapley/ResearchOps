# Study guides GOV.UK polish

## Run metadata

- Date: 2026-06-05
- Branch: `feature/study-guides-govuk-polish`
- Trace requirement: required because `feature/` branches require an auditable trace.
- Task: improve `/pages/study/guides/?id=` after PR #357 merged, using Nunjucks and GOV.UK Frontend patterns, then open a new PR.

## Operating model loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/github-mutation-policy.md`

## Bundles selected

- `github-diamond`: repository safety, branch governance, PR discipline and changed-file verification.
- `researchops-developer-control`: ResearchOps route, generated asset and service-page conventions.
- `multi-functional-team`: multidisciplinary government product assurance and researcher workflow critique.
- `govuk-design-system`: GOV.UK component, content, form, table, breadcrumb and accessibility decisions.

## Bundles skipped

- `cloudflare`: no Worker runtime, D1 binding or deployment code changed.
- `openai-platform`: no OpenAI API or model integration changed.
- `mcp-agent-tooling`: no MCP contracts or tools changed.
- `airtable-public-api`: no Airtable API or schema work changed.
- `mural-public-api`: no Mural integration changed.

## Team critique summary

- Interaction design: replace the scattered header/editor layout with one clear route flow: context, list, editor, source, preview, checks and guidance.
- Content design: use action-focused labels such as “Create guide” and “Publish guide”; avoid ambiguous editor-only labels.
- Accessibility: keep the breadcrumb as the return context, remove the redundant back button, ensure form controls have labels and hints, and make the guide table match the dynamic data shape.
- ResearchOps: preserve existing JavaScript hooks for loading, editing, saving, publishing, patterns and variables.
- Frontend: move the route stylesheet into the generated Sass pipeline and keep route CSS scoped to supporting GOV.UK Frontend components.

## Files read

- `src/govuk/templates/pages/study-guides.njk`
- `public/css/guides.css`
- `public/pages/study/guides/index.html`
- `public/components/guides/guides-page.js`
- `public/js/study-guides-context.js`
- `public/js/guides-route-loader.js`
- `scripts/styles/generated-css-targets.mjs`
- `scripts/styles/build-generated-css.mjs`
- `scripts/styles/format-generated-css.mjs`
- `scripts/govuk/render-govuk-pages.mjs`
- `tests/study-guides-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-tables-summary-lists-application-route-state.test.js`

## Files changed

- `src/govuk/templates/pages/study-guides.njk`
- `src/styles/guides.scss`
- `public/css/guides.css`
- `public/pages/study/guides/index.html`
- `scripts/styles/generated-css-targets.mjs`
- `tests/study-guides-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `tests/govuk-forms-application-route-state.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `docs/agent-audit/reasoning/2026/06/05/study-guides-govuk-polish.md`
- `docs/agent-audit/reasoning/2026/06/05/study-guides-govuk-polish.json`

## Implementation summary

- Reworked the discussion guides Nunjucks template around GOV.UK breadcrumbs, button, input, textarea and details macros.
- Removed the redundant `Back to Study` action so the breadcrumb hierarchy carries navigation context.
- Changed the page action from `New guide` to `Create guide`.
- Expanded the guide table skeleton to match the six columns rendered by the existing guide controller.
- Rebuilt the editor as a GOV.UK form flow with a labelled title input, source textarea, grouped editor actions, preview panel, lint inset text and guidance details.
- Added `src/styles/guides.scss` and registered `public/css/guides.css` as a generated CSS target.
- Replaced the legacy guides CSS with generated, route-scoped CSS.
- Updated route-state tests to protect the new GOV.UK shape and generated stylesheet ownership.

## Validation

- `sass --load-path=node_modules --no-source-map src/styles/guides.scss public/css/guides.css`
- `node scripts/styles/format-generated-css.mjs --write public/css/guides.css`
- `npm run build:govuk-pages`
- `node --test tests/study-guides-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js tests/govuk-frontend-integration-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npm test`
- Browser alignment check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT` with viewport `1212x672`: preview panel top and guide source textarea top both measured at `1181px`.

## Validation notes

- The repository script `npm run build:generated-css -- public/css/guides.css` could not run in this local environment because `node_modules/.bin/sass` is absent. The available `sass` binary was used directly, then the repository formatter checked the generated CSS.
- Initial browser verification against `http://127.0.0.1:8793/pages/study/guides/?id=RECT3O7DT` failed because that port was no longer serving the app. After the user restarted preview on `8891`, the alignment issue was verified and fixed.

## Changed-file guard

- Pre-existing unrelated local changes were observed and excluded from staging: `.gitignore`, `package.json`, `scripts/agent-operating-model/validate-operating-model.mjs`, and `scripts/agent-operating-model/claude-collaboration.mjs`.
- The PR should contain only the guides route implementation, generated outputs, route-state tests, CSS target manifest and this trace.

## Residual risk

- Normal git push was blocked by local DNS resolution for `github.com`. The branch and amended commit are ready locally; push and PR creation remain pending until network resolution is available.
