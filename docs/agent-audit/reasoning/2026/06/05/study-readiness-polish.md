# Study Readiness Polish Trace

Date: 2026-06-05  
Branch: `fix/study-readiness-polish`  
Trace requirement: required because the branch uses the `fix/` prefix.

## Task

Bring the merged Study page implementation back in line with the reviewed prototype quality.

## Operating Model

Selected bundles:

- `github-diamond`
- `researchops-developer-control`
- `govuk-design-system`
- `multi-functional-team`

## Team Critique

Interaction design: the session gate must look like a decisive blocking panel, not a passive inset note. The fallback content should immediately show the blocker summary so the page does not look stalled while data hydrates.

Content design: once readiness data has loaded, the session gate must replace checking copy with a specific blocker count and direct action links.

Frontend and accessibility: readiness rows need a consistent text track so tags remain scannable and single-line on desktop. On reduced viewports the status tag moves above the title and description to avoid cramped rows.

Researcher use: the caption above the study title must identify the linked project, not stay as the generic “Project”.

Codex review: the project title resolver must preserve the fallback path when project lookup fails and returns `null`.

Owner review: the Nunjucks template must not hard-code the prototype blocker summary. The server-rendered session gate should use the neutral “Checking study readiness” fallback, and the client script should populate the actual blocker count and links after readiness data is loaded.

Owner review: Study readiness task text needs a uniform width, and status tags need to stack above the item at wider constrained viewports with comfortable spacing and clear left or right alignment.

Browser comment: in the stacked readiness layout, the status tag must be flush left with the associated item title, for example “Ready” aligned with “Description”.

Browser comment: the Study page load failure must be shown as a GOV.UK Error summary rather than a Notification banner.

## Implementation

- Corrected the Nunjucks fallback back to “Checking study readiness”, “Checking the required setup tasks before fieldwork can begin.” and “Checking readiness tasks.”
- Kept the actionable blocker summary in `renderSessionGatePanel`, where it is computed from actual incomplete readiness tasks.
- Styled the session gate as a blue bordered panel using the GOV.UK blue value.
- Added a tolerant project title resolver for common project name field shapes.
- Guarded the project title resolver against `null` project lookup results so the page keeps rendering with the “Project” fallback when the project endpoint is unavailable.
- Let the GOV.UK half-column define the Study readiness row width, using the GOV.UK 15px gutter between the text track and single-line status tag.
- Set a uniform 170px status track for desktop readiness rows so `govuk-task-list__name-and-hint` has the same computed width on every item.
- Moved readiness status tags above item text from 900px down, flush left with a 10px gap before the associated title and hint.
- Removed inherited GOV.UK task-list status padding in the stacked Study readiness layout so tags share the same left edge as their associated title and hint.
- Replaced the Study page loading failure Notification banner with a GOV.UK Error summary while preserving the `study-error` and `study-error-message` hooks used by the client script.
- Removed the visible “Checking” readiness defaults from the rendered markup so a failed or warming API still shows a useful review state.
- Stacked readiness task tags above title and hint text on smaller viewports.
- Bumped the Study page script version so the project caption and gate fixes are not paired with stale cached JavaScript.
- Regenerated `public/pages/study/index.html`.

## Validation

Passed:

- Browser desktop rendering check at `http://127.0.0.1:8787/pages/study/`: session gate has a 5px GOV.UK blue border, shows “3 setup tasks need attention”, includes the three blocker links, and readiness tags stay on one line with a 15px text/status gutter.
- Browser reduced-width rendering check at 390px: readiness status tags appear above the title and hint text.
- Browser layout recheck at 1246px, 768px and 496px: readiness item text widths are uniform in each viewport; desktop uses a 310px text track plus 170px status track; 768px and 496px stack status tags above text, flush left, with a 10px gap.
- `node scripts/govuk/render-govuk-pages.mjs`
- `node --test tests/study-page-route-state.test.js`
- `node --test tests/study-page-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js`
- `node scripts/styles/format-generated-css.mjs --check`
- `node scripts/agent-trace/assert-trace-coverage.mjs`
- `node node_modules/prettier/bin/prettier.cjs --check public/pages/study/index.html public/js/study-page.js public/css/study-page.css tests/study-page-route-state.test.js docs/agent-audit/reasoning/2026/06/05/study-readiness-polish.md docs/agent-audit/reasoning/2026/06/05/study-readiness-polish.json`
- `git diff --check`
- `node --test`

## Codex Comment Disposition

- PR #354 thread `PRRT_kwDOP3Td2M6HXN0F` on `public/js/study-page.js` line 408 was legitimate.
- Fix: `projectTitle` now normalises `null` project values before reading project name fields.
- Regression evidence: `tests/study-page-route-state.test.js` asserts the null-safe guard and project-name field lookup.
- GitHub disposition: branch was pushed at commit `53e1658e`, a PR review response was posted with validation evidence, and the original review thread was resolved.
- Tooling limitation: the required thumbs-up reaction and direct inline reply could not be completed because the GitHub connector returned `403 Resource not accessible by integration` for review-comment reactions and exposed only the GraphQL review-comment node ID, while its direct reply endpoint requires a REST numeric comment ID.
