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

Content design: “Checking the required setup tasks before fieldwork can begin. Checking readiness tasks.” is weak as a visible default. The default state now says “3 setup tasks need attention” with direct action links.

Frontend and accessibility: readiness rows need a consistent text track so tags remain scannable and single-line on desktop. On reduced viewports the status tag moves above the title and description to avoid cramped rows.

Researcher use: the caption above the study title must identify the linked project, not stay as the generic “Project”.

Codex review: the project title resolver must preserve the fallback path when project lookup fails and returns `null`.

## Implementation

- Replaced the weak session gate fallback copy with the prototype-style blocker summary and links.
- Styled the session gate as a blue bordered panel using the GOV.UK blue value.
- Added a tolerant project title resolver for common project name field shapes.
- Guarded the project title resolver against `null` project lookup results so the page keeps rendering with the “Project” fallback when the project endpoint is unavailable.
- Let the GOV.UK half-column define the Study readiness row width, using the GOV.UK 15px gutter between the text track and single-line status tag.
- Removed the visible “Checking” readiness defaults from the rendered markup so a failed or warming API still shows a useful review state.
- Stacked readiness task tags above title and hint text on smaller viewports.
- Bumped the Study page script version so the project caption and gate fixes are not paired with stale cached JavaScript.
- Regenerated `public/pages/study/index.html`.

## Validation

Passed:

- Browser desktop rendering check at `http://127.0.0.1:8787/pages/study/`: session gate has a 5px GOV.UK blue border, shows “3 setup tasks need attention”, includes the three blocker links, and readiness tags stay on one line with a 15px text/status gutter.
- Browser reduced-width rendering check at 390px: readiness status tags appear above the title and hint text.
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
