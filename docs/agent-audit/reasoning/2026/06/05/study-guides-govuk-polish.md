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
- `public/components/guides/guide-editor.js`
- `public/components/guides/patterns.js`
- `public/components/guides/variable-manager.js`
- `public/js/guides-route-loader.js`
- `public/js/study-guides-context.js`
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
- Follow-up browser comments addressed: the missing-context table row now has a route-scoped GOV.UK table status cell with 20px vertical padding; required guide title/source validation now uses a GOV.UK error summary and inline field errors; the study-context failure now appears as a GOV.UK warning text while the caption keeps study context from the URL; pattern and variables panels now appear directly below the toolbar controls that reveal them; the pattern panel uses GOV.UK warning text, list/details/buttons and local starter View/Edit/Delete affordances; the variables panel uses GOV.UK buttons and labelled GOV.UK inputs after adding a variable.
- Latest browser comments addressed: unresolved partial checks now appear in the GOV.UK error summary and source textarea error state instead of a detached lint inset; the editor section top border has been removed; guide title input font inherits GOV.UK typography; the default preview metadata now renders as separate Study and Project rows with a study filename-style value; preview heading/body sizes are constrained for an editor preview; `Save draft` and `Draft a guide` are secondary actions; empty or unavailable guide lists show an informative inset fallback instead of an empty table; the transitive guide editor import is cache-busted so default source changes reach the browser.
- Starter discussion guide partials now hydrate from the local pattern registry before the `/api/partials` request completes or fails, so the default first-visit guide can render `intro_opening_v1`, `consent_standard_v2`, `task_observation_shell_v1`, `probe_error_recovery_v1`, `probe_trust_signals_v1`, `wrapup_debrief_v1` and `note_observer_grid_v1` without showing unknown-partial errors.
- Pattern deletion now requires typing the exact confirmation phrase `delete pattern` before the GOV.UK warning button is enabled; creating new patterns is hidden entirely while the pattern service is unavailable and local starter patterns are being shown.

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
- Browser follow-up check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT`: header caption shows `Study RECT3O7DT`, context failure is a GOV.UK warning text, `Insert tag` is no longer rendered, table status row has 20px vertical padding, pattern and variables panels appear 20px below the toolbar, pattern panel has GOV.UK warning text and no legacy `.btn` or `.link-like` controls, variables panel renders GOV.UK buttons and labelled GOV.UK inputs after `Add variable`.
- `node --test tests/study-guides-route-state.test.js tests/study-child-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npx prettier -c public/components/guides/guides-page.js public/components/guides/variable-manager.js public/components/guides/patterns.js public/js/guides-route-loader.js public/js/study-guides-context.js tests/study-guides-route-state.test.js tests/study-child-route-state.test.js src/styles/guides.scss`
- `npm test` (176 tests passed)
- `npm run trace:coverage`
- Browser latest review check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT`: missing-context guide list hides the table and shows an informative fallback; `Draft a guide` and `Save draft` are secondary buttons; editor top border is `0px`; title input font is `"GDS Transport", Arial, sans-serif`; default preview metadata includes `Study_2026-06-05`; preview H1 font size is `24px`; unknown partial checks appear in the GOV.UK error summary and mark the source textarea with `Resolve guide source issues`.
- `node --test tests/study-guides-route-state.test.js tests/study-child-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npx prettier -c public/components/guides/guides-page.js public/components/guides/guide-editor.js public/js/guides-route-loader.js tests/study-guides-route-state.test.js tests/study-child-route-state.test.js src/styles/guides.scss`
- `npm test` (176 tests passed)
- Latest browser comment pass at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT`: pattern category headings are capitalised and visually distinct from pattern item titles; `Create pattern` and `Close` appear at the top of the patterns panel; pattern `View`, `Edit` and `Delete` are GOV.UK secondary buttons and each opens the appropriate in-flow tray content; drawer secondary buttons are white on grey; variables `Add variable`, `Discard changes` and `Close` are white on grey; the variable key input inherits `"GDS Transport", Arial, sans-serif`; the variables header row has `20px` top padding.
- `node tests/study-guides-route-state.test.js`
- `node tests/study-child-route-state.test.js`
- Latest browser comment pass: pattern action trays now move into the pattern item that launched them; pattern item `Delete` uses GOV.UK warning button styling; the reusable pattern action is labelled `Add to guide`; displayed and inserted partial names use a single version suffix when the name already ends in `_vN`; default guide Study and Project metadata render on separate lines; the missing-context status uses the GOV.UK notification banner macro; the fallback page caption is `Study` and no longer exposes the Study record ID.
- `node tests/study-guides-route-state.test.js`
- `node tests/study-child-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npx prettier -c public/components/guides/guide-editor.js public/components/guides/guides-page.js public/js/study-guides-context.js tests/study-guides-route-state.test.js`
- `npm run trace:coverage`
- `node --test tests/study-guides-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/govuk-tables-summary-lists-application-route-state.test.js tests/govuk-frontend-integration-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- `npm test`
- Browser alignment check at `http://127.0.0.1:8891/pages/study/guides/?id=RECT3O7DT` with viewport `1212x672`: preview panel top and guide source textarea top both measured at `1181px`.
- `npx prettier --write src/styles/guides.scss public/components/guides/guides-page.js tests/study-guides-route-state.test.js`
- `sass --load-path=node_modules --no-source-map src/styles/guides.scss public/css/guides.css`
- `node scripts/styles/format-generated-css.mjs --write public/css/guides.css`
- `npm run build:govuk-pages`
- `npm run agent:model -- "Make starter discussion guide partials available on first page load"`
- `npm run build:govuk-pages`
- `node tests/study-guides-route-state.test.js && node tests/study-child-route-state.test.js`
- `npm run generated-css:check -- public/css/guides.css`
- Browser draft-path check at `http://127.0.0.1:8891/pages/study/guides/?pid=recgdpwEI5hF07bUZ&sid=RECT3O7DT`: choosing `Draft a guide` populated the source with all seven starter partial references, rendered local starter content in the preview and showed no unknown-partial messages.
- Browser pattern fallback check at `http://127.0.0.1:8891/pages/study/guides/?pid=recgdpwEI5hF07bUZ&sid=RECT3O7DT`: pattern service fallback message is visible, the `Create pattern` button is hidden, and there are zero visible `Create pattern` buttons.

## Validation notes

- The repository script `npm run build:generated-css -- public/css/guides.css` could not run in this local environment because `node_modules/.bin/sass` is absent. The available `sass` binary was used directly, then the repository formatter checked the generated CSS.
- Initial browser verification against `http://127.0.0.1:8793/pages/study/guides/?id=RECT3O7DT` failed because that port was no longer serving the app. After the user restarted preview on `8891`, the alignment issue was verified and fixed.
- During the follow-up, the local dependency install initially failed while network access was unavailable. After temporary network access was granted, `npm_config_cache=.npm-cache npm ci` completed and the temporary cache was removed from the worktree.

## Changed-file guard

- Pre-existing unrelated local changes were observed and excluded from staging: `.gitignore`, `package.json`, `scripts/agent-operating-model/validate-operating-model.mjs`, and `scripts/agent-operating-model/claude-collaboration.mjs`.
- The PR should contain only the guides route implementation, generated outputs, route-state tests, CSS target manifest and this trace.

## Residual risk

- No known residual implementation risk after validation. Existing dependency audit advisories remain outside this PR and are classified as non-blocking by the repository release-gate policy.
