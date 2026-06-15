# Agent trace - Start page Nunjucks and Sass ownership

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/pages-start-nunjucks-sass`  
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** `/pages/start/` Nunjucks and Sass source ownership

## Task

Fix `/pages/start/` so the page is owned by the repository GOV.UK Nunjucks
renderer and generated Sass pipeline instead of being maintained only as
committed static HTML and CSS.

The unit of work also required choosing the most suitable 6 roles from the 10
configured sub-agent roles, confirming the work locally, pushing the branch to
GitHub and opening a ready-for-review pull request.

## Branch Trace Decision

The branch is `fix/pages-start-nunjucks-sass`. Repository policy allows `fix/`
as a work-branch prefix and requires an auditable trace for repository-affecting
work on `fix/` branches. This trace is required even though the prompt did not
include the legacy `[reasoning]` token.

## Operating Model

Loaded repository operating-model sources:

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
- `.agent-operating-model/bundles/`

Selected bundle stack:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

The first three bundles are always-load bundles. `govuk-design-system` applies
because this task changes GOV.UK page templates, form markup, generated HTML and
Sass. `cloudflare` applies because Cloudflare Pages currently publishes the
committed `public/` output.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP server, tool, resource, prompt or consent work was in scope.
- `airtable-public-api` - no Airtable API or data integration work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation,
  validation evidence and PR readiness.
- ResearchOps Developer Control governed repository conventions, generated page
  ownership and route-state test expectations.
- Multi-Functional Team governed public-sector service assurance and residual
  risk framing.
- GOV.UK Design System governed the shared frontend layout, form component
  markup, input width decisions and page affordance checks.
- Cloudflare context governed the decision to keep regenerated `public/` output
  in the change set while the deployment contract publishes committed files.

No bundle conflicts were identified.

## Sub-Agent Selection

Selected 6 roles from the configured 10:

- `TemplateDev` for Nunjucks source ownership and renderer registration.
- `StyleDev` for Sass source ownership and generated CSS target coverage.
- `TestDev` for route-state and generated-output contract coverage.
- `RenderGuard` for source-to-generated-output drift checks.
- `CheckGuard` for focused validation lane selection and blockers.
- `ReviewGuard` for changed-file plausibility, trace and PR readiness.

Skipped roles:

- `BranchGuard` - branch hygiene was checked directly and by ReviewGuard for this
  narrow unit.
- `RuntimeDev` - no Worker runtime, auth flow or browser controller logic was in scope.
- `TraceGuard` - trace obligations were handled directly and by ReviewGuard.
- `DocsDev` - no product-note or documentation content change was needed beyond
  the required trace artefacts.

## Implementation

Created `src/govuk/templates/pages/start.njk` as the Nunjucks source for
`/pages/start/`. The template extends `layouts/researchops.njk`, keeps the start
route stylesheet in the `head` block, preserves the four-step form flow and
keeps the existing start route JavaScript modules in the `scripts` block.

Registered the page in `scripts/govuk/render-govuk-pages.mjs` so it renders to
`public/pages/start/index.html`.

Created `src/styles/start.scss` as the Sass source for `public/css/start.css`
and registered it in `scripts/styles/generated-css-targets.mjs`.

Regenerated `public/css/start.css` and `public/pages/start/index.html`. The
generated page now uses the shared GOV.UK layout shell and full
`/assets/govuk/govuk-frontend.css` instead of legacy GOV.UK fragment styles.

Added `*.sublime-workspace` to `.gitignore` and `.prettierignore` so local
editor workspace files are excluded from commits and repository-wide format
checks. This addresses the pre-existing validation blocker reported by the
sub-agents without committing `ResearchOps.sublime-workspace`.

Updated focused route-state tests so they verify:

- `/pages/start/` is registered in the GOV.UK renderer.
- `src/govuk/templates/pages/start.njk` extends the shared layout.
- `src/styles/start.scss` is the source for `public/css/start.css`.
- Generated start page output preserves form IDs, step IDs, AI-assist hooks,
  default project phase/status copy and the check-answers summary list.
- The start route no longer depends on legacy GOV.UK fragment styles.

## Files

Read:

- operating-model files listed above
- selected bundle prompt specs and bodies
- selected GOV.UK, ResearchOps, GitHub and Cloudflare reference files
- `/Users/kevin.rapley/.codex/config.toml`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/start-overview.njk`
- `public/pages/start/index.html`
- `public/css/start.css`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- start, GOV.UK frontend, Sass migration and render workflow tests

Created:

- `src/govuk/templates/pages/start.njk`
- `src/styles/start.scss`
- `docs/agent-audit/reasoning/2026/06/15/pages-start-nunjucks-sass.md`
- `docs/agent-audit/reasoning/2026/06/15/pages-start-nunjucks-sass.json`

Modified:

- `.gitignore`
- `.prettierignore`
- `public/css/start.css`
- `public/pages/start/index.html`
- `scripts/govuk/render-govuk-pages.mjs`
- `scripts/styles/generated-css-targets.mjs`
- `tests/govuk-forms-application-route-state.test.js`
- `tests/govuk-frontend-integration-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`
- `tests/start-page-route-state.test.js`

Unrelated local files deliberately excluded from this unit:

- `infra/cloudflare/src/core/auth/passwordless.js`
- `ResearchOps.sublime-workspace`

## Validation

Passed:

- `npm run build:generated-css -- public/css/start.css`
- `npm run build:generated-css`
- `npm run build:govuk-pages`
- `npm run generated-css:check`
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/start-page-route-state.test.js tests/govuk-forms-application-route-state.test.js tests/start-project-step-1-defaults-route-state.test.js tests/govuk-pages-render-workflow-state.test.js tests/sass-migration-route-state.test.js tests/govuk-frontend-integration-route-state.test.js`
- `node -e` JSON parse check for `docs/agent-audit/reasoning/2026/06/15/pages-start-nunjucks-sass.json`
- `npm run trace:validate`
- `npm run trace:coverage`
- `git diff --check`
- `npm run format:check`
- `npm run lint`
- `npm run build`
- `npm test`
- `node --test tests/start-page-route-state.test.js tests/govuk-forms-application-route-state.test.js`
- `npm run validate`
- Browser smoke check at `http://127.0.0.1:4173/pages/start/`, which confirmed
  the page title, H1, project form, four steps, generated GOV.UK CSS, start CSS
  and absence of the legacy GOV.UK forms fragment stylesheet.

Earlier focused test run failed before test-contract updates because the start
page no longer loads legacy GOV.UK fragment styles after moving under the shared
Nunjucks layout. The affected tests were updated to assert the intended new
contract.

`npm run lint` passed with existing repository warnings. Its generated CSS build
step temporarily produced an out-of-scope `public/css/brands/home-office.css`
diff; that generator side-effect was removed from the worktree and is not part
of this unit.

The first `npm run validate` attempt failed because two direct route-state tests
asserted exact one-line generated attributes. Those assertions were updated to
check the same `id` and class contracts independently, then `npm run validate`
passed.

## Residual Risk

`public/pages/start/index.html` has a larger generated diff because the page
moved from hand-maintained static HTML to the shared Nunjucks renderer. Review
should focus on the new template, generated page registration, Sass target and
route-state assertions, while still checking the regenerated public output.

The worktree contains unrelated local edits to
`infra/cloudflare/src/core/auth/passwordless.js`; they must not be staged for
this PR.
