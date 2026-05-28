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
- `public/js/caqdas-interface.js`
- `tests/journals-route-state.test.js`
- `tests/govuk-breadcrumb-back-link-route-state.test.js`

## Files modified

- `src/govuk/templates/pages/projects-journals.njk`
- `public/pages/projects/journals/index.html`
- `public/js/project-context.js`
- `public/js/caqdas-interface.js`
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
- Updated `project-context.js` so legacy runtime `#flash` messages are routed into the macro-rendered feedback targets.
- Updated `project-context.js` so presented error-summary messages are converted to plain text rather than displayed as links.
- Updated `public/js/caqdas-interface.js` so Analysis-tab failures use page-level feedback instead of rendering the messages inside the local Analysis sections.
- Committed the rendered static journals HTML so preview deployments and route-state tests match the Nunjucks source.
- Preserved the existing journal entries, codes, memos, analysis and coding panel behaviour while changing the shell and feedback presentation.

## Validation attempted

- Opened PR #293 from `fix/journals-tabs-feedback-macros-clean` to `main`.
- Let the Render GOV.UK pages workflow run.
- Investigated CI failure and added the missing error-summary macro `href`.
- Restored shared parent-link hydration after confirming it is still required by other routes.
- Updated the route-state tests to match the new tabs, feedback and removed journals back-link contracts.
- Responded to review feedback by ensuring error messages are presented without links and Analysis-tab failures appear in the page-level feedback position.

## Validation results

On commit `484b9ea009da264a25077867ced7462d6eb42ae6`, these GitHub Actions passed:

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

- The source template still includes the GOV.UK error-summary item structure expected by the macro. Runtime presentation strips the displayed error text out of the anchor so users are not presented with a link.
- The main journals content remains structurally close to the existing implementation. This PR only migrates tabs, feedback presentation and the removed journals back-link.
