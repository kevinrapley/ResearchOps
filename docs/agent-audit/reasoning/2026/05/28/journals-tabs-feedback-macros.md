# Journals tabs and feedback macros trace

## Run metadata

- Date: 2026-05-28
- Repository: `kevinrapley/ResearchOps`
- Branch: `fix/journals-tabs-feedback-macros-clean`
- Pull request: #293
- Trace requirement: required by `fix/` branch policy
- Trace layer: operational

## Task summary

Update the journals page to use GOV.UK Nunjucks macros for tabs and page feedback. Remove the Back to Project button from the journals page.

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/github-mutation-policy.md`

## Canonical bundle directories selected

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`

## Files read

- `src/govuk/templates/pages/projects-journals.njk`
- `public/pages/projects/journals/index.html`
- `public/js/project-context.js`
- `public/js/journal-tabs.js`
- `tests/journals-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`

## Files modified

- `src/govuk/templates/pages/projects-journals.njk`
- `public/pages/projects/journals/index.html`
- `public/js/project-context.js`
- `tests/journals-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/28/journals-tabs-feedback-macros.md`
- `docs/agent-audit/reasoning/2026/05/28/journals-tabs-feedback-macros.json`

## Files created

- `docs/agent-audit/reasoning/2026/05/28/journals-tabs-feedback-macros.md`
- `docs/agent-audit/reasoning/2026/05/28/journals-tabs-feedback-macros.json`

## Implementation decisions

- Replaced hand-authored tab markup in the Nunjucks template with the GOV.UK `govukTabs` macro.
- Removed the `Back to Project` button from the journals template and rendered page.
- Kept shared `project-context.js` parent-link helpers for other routes that still use `Back to Project`.
- Added macro-rendered feedback targets using `govukErrorSummary` for errors and `govukNotificationBanner` for non-error messages in the same page location after the lead paragraph.
- Added an `href` to the error-summary item so the rendered error summary contains the link used by the runtime feedback handler.
- Updated `project-context.js` so legacy runtime `#flash` messages are routed into the macro-rendered feedback targets.
- Committed the rendered static journals HTML so preview deployments and route-state tests match the Nunjucks source.
- Preserved the existing journal entries, codes, memos, analysis and coding panel behaviour while changing the shell and feedback presentation.

## Validation attempted

- Opened PR #293 from `fix/journals-tabs-feedback-macros-clean` to `main`.
- Let the Render GOV.UK pages workflow run.
- Investigated CI failure and added the missing error-summary macro `href`.
- Restored shared parent-link hydration after confirming it is still required by other routes.
- Updated the route-state tests to match the new tabs, feedback and removed journals back-link contracts.

## Validation results

On commit `a8a3c5e6def8809c57ffaaa85820b3db7f661e23`, these GitHub Actions passed:

- Render GOV.UK pages
- Format pull request
- CI
- qa-bdd
- Accessibility audit (pa11y-ci)
- QA — Broken links (Lychee)
- Validate ResearchOps
- Release Gate
- Worker CI

## Residual risks

- The main journals content remains structurally close to the existing implementation. This PR only migrates tabs, feedback presentation and the removed journals back-link.
