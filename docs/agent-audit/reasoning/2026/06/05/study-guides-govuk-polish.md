# Study guides GOV.UK polish

## Run metadata

- Date: 2026-06-05
- Branch: `feature/study-guides-govuk-polish`
- Trace requirement: required because `feature/` branches require an auditable trace.
- Task: improve `/pages/study/guides/?id=` after PR #357 merged, using Nunjucks and GOV.UK Frontend patterns, then open a new PR.
- Follow-up task: handle the unresolved Codex review thread on PR #358 and fix failing checks.

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

## Follow-up files changed

- `public/components/guides/guides-page.js`
- `public/js/guides-route-loader.js`
- `src/govuk/templates/pages/study-guides.njk`
- `src/styles/guides.scss`
- `public/css/guides.css`
- `public/pages/study/guides/index.html`
- `tests/study-child-route-state.test.js`
- `tests/study-guides-route-state.test.js`
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

## Codex review handling

- Review thread inspected: `PRRT_kwDOP3Td2M6Hdbh9`.
- Original Codex review comment: `PRRC_kwDOP3Td2M7IkHrI`.
- Classification: legitimate.
- Issue: the variables drawer became an in-flow panel below the tall editor/preview area, and opening it did not reliably move the user to the panel or focus a useful control.
- Resolution: drawer containers are now programmatically focusable, opening a drawer scrolls it into view with a GOV.UK-compatible in-page flow, focus moves to the preferred drawer control when available, the variables drawer has its expected form container, and the guides controller boots even when the route loader reaches it after `DOMContentLoaded`.
- Review-thread procedure to complete after the fix is pushed: add a thumbs-up reaction to the original comment, reply directly to the comment with the fix and validation evidence, then resolve the thread.

## CI failure investigation

- `CI / Node 20` and `Validate ResearchOps` failed at lint because `src/styles/guides.scss` did not pass Prettier.
- `Worker CI` published the Prettier patch showing the same `src/styles/guides.scss` formatting issue.
- `Release Gate` failed because its blocking lint and format checks failed; npm audit advisories were reported as non-blocking by repository policy.
- Fix applied: formatted `src/styles/guides.scss` and kept the generated CSS rebuilt from the formatted source.

## Validation

- `sass --load-path=node_modules --no-source-map src/styles/guides.scss public/css/guides.css`
- `node scripts/styles/format-generated-css.mjs --write public/css/guides.css`
- `npm run build:govuk-pages`
- Browser interaction check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT`: clicking `Variables` revealed the drawer in the visible viewport and moved focus to `drawer-variables-close`.
- `node --test tests/study-child-route-state.test.js tests/study-guides-route-state.test.js`
- `npx eslint public/js/guides-route-loader.js public/components/guides/guides-page.js tests/study-guides-route-state.test.js` (passed with existing warnings only)
- `npx prettier -c public/js/guides-route-loader.js public/components/guides/guides-page.js tests/study-child-route-state.test.js tests/study-guides-route-state.test.js src/styles/guides.scss docs/agent-audit/reasoning/2026/06/05/study-guides-govuk-polish.md docs/agent-audit/reasoning/2026/06/05/study-guides-govuk-polish.json`
- `npm test` (176 tests passed)
- `npm run trace:coverage`
- `node --test tests/study-guides-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js tests/govuk-frontend-integration-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npm test`
- Browser alignment check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT` with viewport `1212x672`: preview panel top and guide source textarea top both measured at `1181px`.
- `npx prettier --write src/styles/guides.scss public/components/guides/guides-page.js tests/study-guides-route-state.test.js`
- `sass --load-path=node_modules --no-source-map src/styles/guides.scss public/css/guides.css`
- `node scripts/styles/format-generated-css.mjs --write public/css/guides.css`
- `npm run build:govuk-pages`

## Validation notes

- The repository script `npm run build:generated-css -- public/css/guides.css` could not run in this local environment because `node_modules/.bin/sass` is absent. The available `sass` binary was used directly, then the repository formatter checked the generated CSS.
- Initial browser verification against `http://127.0.0.1:8793/pages/study/guides/?id=RECT3O7DT` failed because that port was no longer serving the app. After the user restarted preview on `8891`, the alignment issue was verified and fixed.
- During the follow-up, the local dependency install initially failed while network access was unavailable. After temporary network access was granted, `npm_config_cache=.npm-cache npm ci` completed and the temporary cache was removed from the worktree.

## Changed-file guard

- Pre-existing unrelated local changes were observed and excluded from staging: `.gitignore`, `package.json`, `scripts/agent-operating-model/validate-operating-model.mjs`, and `scripts/agent-operating-model/claude-collaboration.mjs`.
- The PR should contain only the guides route implementation, generated outputs, route-state tests, CSS target manifest and this trace.

## Residual risk

- No known residual implementation risk after validation. Existing dependency audit advisories remain outside this PR and are classified as non-blocking by the repository release-gate policy.
