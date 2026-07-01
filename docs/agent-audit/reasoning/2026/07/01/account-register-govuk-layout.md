# Account Register GOV.UK Layout

## Run Metadata

- Date: 2026-07-01
- Branch: `fix/account-register-govuk-layout`
- Trace decision: required because branch prefix is `fix/`
- Task summary: fix the account registration page so `/pages/account/register/` is generated from the Nunjucks GOV.UK layout and uses the shared GOV.UK Design System assets and component styling like the other rendered service pages.

## Operating Model Files Loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected Bundles

- `github-diamond`: `.agent-operating-model/bundles/github/`
- `researchops-developer-control`: `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team`: `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system`: `.agent-operating-model/bundles/govuk-design-system/`

## Bundles Skipped

- `cloudflare`: no Worker runtime, binding, deployment or route-handler change.
- `openai-platform`: no OpenAI API or model integration change.
- `mcp-agent-tooling`: no MCP protocol or tool contract change.
- `airtable-public-api`: no Airtable API change.
- `mural-public-api`: no Mural API change.

## Precedence Decisions

- GitHub Diamond governed branch selection, trace requirement, PR readiness and evidence reporting.
- ResearchOps Developer Control governed generated GOV.UK page conventions, source/rendered HTML parity and route-state coverage.
- Multi-Functional Team governed public-sector service assurance, user-impact framing and validation discipline.
- GOV.UK Design System governed shared GOV.UK Frontend asset use, form spacing, field-width affordance, error summary behaviour and check-answers behaviour.

## Files Read

- `README.md`
- `RECENT_LEARNINGS.md`
- `.github/CODEOWNERS`
- `package.json`
- `src/govuk/templates/layouts/researchops.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/templates/pages/account.njk`
- `public/pages/account/register/index.html`
- `public/pages/account/index.html`
- `public/pages/account/sign-in/index.html`
- `public/js/auth-registration-page.js`
- `tests/auth-registration-requests-route-state.test.js`
- `tests/govuk-generated-html-test-source-route-state.test.js`
- `tests/govuk-design-system-baseline-route-state.test.js`

## Files Created Or Modified

- `src/govuk/templates/pages/account-register.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/account/register/index.html`
- `public/js/auth-registration-page.js`
- `tests/auth-registration-requests-route-state.test.js`
- `tests/govuk-generated-html-test-source-route-state.test.js`
- `docs/agent-audit/reasoning/2026/07/01/account-register-govuk-layout.md`
- `docs/agent-audit/reasoning/2026/07/01/account-register-govuk-layout.json`

## Implementation Summary

- Added `src/govuk/templates/pages/account-register.njk` so the register page has a Nunjucks source template.
- Registered the page in `scripts/govuk/render-govuk-pages.mjs` so `public/pages/account/register/index.html` is generated with the shared ResearchOps GOV.UK layout.
- Regenerated the committed HTML for `/pages/account/register/`.
- Removed the route-level registration stylesheet entirely so the page uses the global GOV.UK Frontend Sass output and GOV.UK spacing and width utility classes.
- Removed the remaining `account-registration-status` class from the registration script reset path.
- Added route-state assertions that the register page uses `/assets/govuk/govuk-frontend.css`, initialises GOV.UK Frontend, avoids the old page-level legacy GOV.UK stylesheet set, keeps two-thirds field affordance classes and has no registration-specific page CSS hook.
- Applied review feedback by adding the global GOV.UK spacing utility `govuk-!-margin-bottom-6` to the requested-role radios group, giving a 30px gap before the next question without reintroducing page-specific CSS.
- Addressed Codex review thread `PRRT_kwDOP3Td2M6NvEBk` on `public/css/auth-registration.css`: the comment was valid because removing the page CSS also removed the success-panel text/link colour override while `showSuccess()` still injected `govuk-body` and a normal `govuk-link` into the green confirmation panel. The fix changed the success markup to `govuk-panel__body` and `govuk-link govuk-link--inverse` instead of restoring page-specific CSS.
- Added a renderer contract assertion so the register page cannot silently drift out of the generated GOV.UK page source list.

## Validation

- `npm run build:govuk-pages` passed.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/auth-registration-requests-route-state.test.js tests/govuk-generated-html-test-source-route-state.test.js tests/govuk-design-system-baseline-route-state.test.js` passed.
- `npm run format:check` passed.
- `npm test -- --ci` was attempted, but Node rejected the unsupported `--ci` option.
- `npm test` passed: 271 tests passed.
- `npm run lint` passed with 0 errors and existing warnings.
- Browser verification passed at 1440 by 1100 and 390 by 900 for initial hidden states, no old register-page GOV.UK stylesheet set, empty-submit validation errors, the `Something else` conditional field, check-answers transition, and check-answer change-link focus.
- `npm run build` passed.
- `npm run build:govuk-pages` passed after applying the radios spacing feedback.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/auth-registration-requests-route-state.test.js` passed after applying the radios spacing feedback.
- Browser computed-style check at 1264 by 732 passed: the radios group has `govuk-!-margin-bottom-6`, computed `margin-bottom` is `30px`, the measured gap to the next question is `30px`, and there is no horizontal overflow.
- `npm run format:check` passed after the success-panel contrast fix.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/auth-registration-requests-route-state.test.js` passed after the success-panel contrast fix.
- Browser success-state check passed: confirmation panel background is `rgb(15, 122, 82)`, body and inverse link text are `rgb(255, 255, 255)`, no plain `govuk-body` or plain `govuk-link` remains inside the panel, and there is no horizontal overflow.
- `npm run lint` passed after the success-panel contrast fix with 0 errors and existing warnings.
- `node --test tests/deploy-asset-paths.test.js` passed after a transient full-suite deploy asset comparison failure.
- `npm test` passed on rerun after the success-panel contrast fix: 271 tests passed.

## Codex Review Comment Handling

- Thread: `PRRT_kwDOP3Td2M6NvEBk`
- Comment URL: `https://github.com/kevinrapley/ResearchOps/pull/451#discussion_r3509418998`
- Classification: valid.
- Acknowledgement: added a `+1` reaction to the original comment.
- Remedy: changed `showSuccess()` in `public/js/auth-registration-page.js` to use confirmation-panel-safe body and inverse link classes, and added route-state assertions in `tests/auth-registration-requests-route-state.test.js`.
- Reply: `https://github.com/kevinrapley/ResearchOps/pull/451#discussion_r3509444159`
- Status: resolved on GitHub after commit `37472182` was pushed.

## Validation Not Run

- Full Playwright end-to-end suite was not run; this was a static generated page/layout change covered by route-state tests, full Node tests, build, lint and targeted browser interaction checks.

## Issues And Residual Risks

- The documented command `npm test -- --ci` is not usable in this repository because Node's test runner rejects `--ci`; `npm test` was run instead.
- The live production URL will not change until this branch is merged and deployed.
