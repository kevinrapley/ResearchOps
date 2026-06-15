# Agent trace - Role assignments GOV.UK template migration

**Date:** 2026-06-15  
**Trace type:** operational audit trace  
**Branch:** `fix/role-assignments-govuk-template`  
**Trace required:** yes, because the branch starts with `fix/`  
**Related work:** `/pages/team/role-assignments/` GOV.UK frontend templating repair

## Task

Fix `/pages/team/role-assignments/` so it uses the full GOV.UK frontend
templating path expected by the repository. The page had visible styling issues
around the header, breadcrumbs and phase banner because it was a static HTML
page with mixed legacy GOV.UK CSS and shared layout assets.

The user clarified that the page needs to be generated from Nunjucks if it is
not already. The final implementation therefore makes the Nunjucks template and
renderer registration the source of truth, then regenerates the committed
`public/` HTML.

## Branch Trace Decision

The current branch is `fix/role-assignments-govuk-template`. Repository policy
allows `fix/` as a work-branch prefix and requires an auditable trace for
repository-affecting work on `fix/` branches. This trace is therefore required
even without the legacy `[reasoning]` token.

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
because this is a GOV.UK frontend page chrome, breadcrumbs and component markup
repair. `cloudflare` applies because `docs/deployment/generated-html-policy.md`
states Cloudflare Pages currently publishes committed `public/` HTML.

Skipped conditional bundles:

- `openai-platform` - no OpenAI API, model or eval implementation was in scope.
- `mcp-agent-tooling` - no MCP tool, resource, prompt or consent work was in scope.
- `airtable-public-api` - no Airtable API or data integration work was in scope.
- `mural-public-api` - no Mural API or collaboration integration work was in scope.

Precedence decisions:

- GitHub Diamond governed branch naming, trace coverage, surgical mutation and
  validation evidence.
- ResearchOps Developer Control governed repository conventions and the GOV.UK
  generated-page workflow.
- Multi-Functional Team governed public-sector assurance and residual-risk
  framing.
- GOV.UK Design System governed the shared frontend layout, breadcrumbs and
  component markup expectations.
- Cloudflare context governed the decision to commit regenerated `public/` HTML
  while the deployment contract publishes committed files.

No bundle conflicts were identified.

## Implementation

Created `src/govuk/templates/pages/role-assignments.njk` as the source template
for the role assignments page. It extends `layouts/researchops.njk`, keeps the
page-specific role-assignment stylesheet and script in Nunjucks blocks, and
moves only the page content into the content block.

Registered the template in `scripts/govuk/render-govuk-pages.mjs` so it renders
to `public/pages/team/role-assignments/index.html`.

Regenerated `public/pages/team/role-assignments/index.html` with the GOV.UK page
renderer. The generated page now uses the shared GOV.UK layout shell, including
`govuk-template`, `govuk-template__body`, `/assets/govuk/govuk-frontend.css`,
layout initialisation scripts, the shared header include, the main wrapper and
the shared footer include. Legacy page-local GOV.UK CSS layers and `/css/screen.css`
were removed from the generated output.

Updated `tests/auth-role-assignment-ui-route-state.test.js` so the route-state
guard verifies the Nunjucks renderer registration, shared GOV.UK layout shell,
absence of legacy CSS, and the role-assignment form controls without depending
on one-line generated HTML formatting.

After PR #399 opened, the Node 20, Node 22 and Worker CI unit-test jobs failed
on the role-assignment route-state test. The failing checks used the generated
GOV.UK page helper, which renders valid Nunjucks output with different
attribute and label line breaks than the committed generated HTML. The test
helpers were hardened to normalize copy checks and accept valid generated label
markup instead of assuming a single serialized shape.

After review of the deployed preview, the breadcrumb was updated to match the
requested hierarchy: `Home` links to `/`, `Your account` links to
`/pages/account/`, and `Team administration` remains the current page.

## Files

Read:

- `AGENTS.md`
- operating-model files listed above
- selected bundle prompt specs and bodies
- `docs/deployment/generated-html-policy.md`
- `src/govuk/templates/layouts/researchops.njk`
- `src/govuk/templates/pages/team-access-requests.njk`
- `scripts/govuk/render-govuk-pages.mjs`
- `public/pages/team/role-assignments/index.html`
- `tests/auth-role-assignment-ui-route-state.test.js`
- adjacent GOV.UK page and route-state tests

Created:

- `src/govuk/templates/pages/role-assignments.njk`
- `docs/agent-audit/reasoning/2026/06/15/role-assignments-govuk-template.md`
- `docs/agent-audit/reasoning/2026/06/15/role-assignments-govuk-template.json`

Modified:

- `public/pages/team/role-assignments/index.html`
- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/templates/pages/role-assignments.njk`
- `tests/auth-role-assignment-ui-route-state.test.js`

Generated output:

- `public/pages/team/role-assignments/index.html` was regenerated from
  `src/govuk/templates/pages/role-assignments.njk`. It remains committed because
  Cloudflare Pages currently publishes committed `public/` files.

## Sub-Agent Coordination

- Maxwell monitored branch drift and confirmed the branch was based on current
  `origin/main`.
- Ptolemy ran validation checks and identified the template-formatting issue
  before PR readiness.
- Boyle inspected the renderer/output blast radius and confirmed only the
  intended role assignments public page changed under `public/`.
- Descartes checked trace requirements and identified generated HTML policy
  wording to record in this trace.
- Gauss checked PR readiness and confirmed the changed-file scope was plausible
  once the trace and new template were included.

## Validation

Attempted:

- `node scripts/govuk/render-govuk-pages.mjs` - passed and regenerated the role
  assignments page.
- `npm run build:govuk-pages` - passed and regenerated GOV.UK pages through the
  repository build script and post-build normalisation step.
- `node --test tests/auth-role-assignment-ui-route-state.test.js tests/auth-role-assignment-error-copy-route-state.test.js tests/visual-walkthrough-role-assignment-route-state.test.js tests/govuk-generated-html-test-source-route-state.test.js tests/govuk-frontend-service-pages-route-state.test.js tests/govuk-frontend-integration-route-state.test.js` - passed.
- `node --test tests/auth-role-assignment-ui-route-state.test.js tests/govuk-generated-html-test-source-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js` - passed after the breadcrumb hierarchy update.
- `npm test` - passed after the CI assertion hardening, 220 tests passed.
- `node -e` JSON parse check for `docs/agent-audit/reasoning/2026/06/15/role-assignments-govuk-template.json` - passed.
- `npm run trace:coverage` - passed.
- `git diff --check` - passed.
- `npx prettier -c scripts/govuk/render-govuk-pages.mjs tests/auth-role-assignment-ui-route-state.test.js docs/agent-audit/reasoning/2026/06/15/role-assignments-govuk-template.md docs/agent-audit/reasoning/2026/06/15/role-assignments-govuk-template.json` - passed.
- `node --test tests/govuk-pages-render-workflow-state.test.js tests/govuk-generated-html-test-source-route-state.test.js tests/govuk-frontend-service-pages-route-state.test.js` - passed in the validation sub-agent lane.
- `node --import ./tests/helpers/generated-govuk-page-source.mjs --test tests/auth-role-assignment-ui-route-state.test.js tests/auth-role-assignment-error-copy-route-state.test.js` - passed in the validation sub-agent lane.
- `node --test tests/govuk-page-chrome-navigation-route-state.test.js tests/govuk-breadcrumb-back-link-route-state.test.js` - passed in the validation sub-agent lane.
- `npm run generated-css:check` - passed in the validation sub-agent lane.

Not run:

- Full repository validation suite, because the change is a narrow GOV.UK page
  generation migration with focused renderer, generated-page and route-state
  coverage.
- Local browser visual verification, because this unit changes page chrome by
  switching to the shared GOV.UK template and was covered by generated HTML and
  route-state checks.
- `npm test -- --ci`, because the documented command forwards `--ci` to the
  Node test runner in the current script and fails with `node: bad option: --ci`.
  The repository's actual `npm test` command was run instead.

## Residual Risk

The generated HTML diff is large because the page moved from hand-maintained
static HTML to the shared GOV.UK renderer. Review should focus on the Nunjucks
template, renderer registration and route-state assertions, while still checking
the regenerated public HTML for deployment output.
