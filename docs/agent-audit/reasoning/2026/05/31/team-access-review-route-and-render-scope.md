# Agent trace — Team access review route and render scope fix

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `fix/team-access-review-route-and-render-scope`  
**Related work:** Story 4 — Team Admin reviews team access requests

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation expected, automated review-comment handling and residual risk.

It does not expose private chain-of-thought.

## Operating-model bootstrap

Loaded repository-local sources:

- `README.md`
- `AGENTS.md`
- `RECENT_LEARNINGS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`
- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

Selection rationale:

- GitHub and repository governance are in scope because this is PR review-comment work.
- ResearchOps platform development is in scope because the branch changes platform routes and repository workflow tests.
- Multi-functional government product assurance is always loaded for ResearchOps work.
- GOV.UK Design System is in scope because the workflow renders GOV.UK page templates and committed static page output.
- Cloudflare is in scope because the branch affects Worker route availability and Pages-rendered output behaviour.

## Task summary

Fix the broken Team Admin review route and stop the GOV.UK render workflow from committing every generated `index.html` file when only one Nunjucks page template changes.

Address the Codex review comment on PR #319 about generator-only render workflow changes being skipped.

## Problems observed

The Team Admin review page displayed this user-facing error:

`This route is not available because no permission rule has been declared.`

The error came from the review page controller calling:

`GET /api/team-access/requests/review`

The endpoint was implemented, but the runtime route permission table could still lack the corresponding declaration if the D1 route declaration migration had not been applied to the active environment.

A separate rendering problem was also observed. After hardening the workflow to detect newly generated pages, new PRs could cause all generated `public/**/index.html` files to be re-rendered and committed. This creates noisy PRs and hides the meaningful page-specific change.

Codex then identified a second render workflow edge case. Generator-only or dependency-only changes to files listed in the workflow `paths` trigger would run the workflow, but the new changed-page-template detector would find no changed `src/govuk/templates/pages/*.njk` files. It would then skip rendering and allow stale committed `public/` output to merge.

## Files inspected

- `.github/workflows/render-govuk-pages.yml`
- `scripts/govuk/render-govuk-pages.mjs`
- `infra/cloudflare/src/core/auth/team-access-requests.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/migrations/0006_auth_team_access_review.sql`
- `tests/auth-team-access-review-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`
- `public/pages/team/access-requests/index.html`

## Files changed

- `.github/workflows/render-govuk-pages.yml`
- `infra/cloudflare/src/core/auth/team-access-requests.js`
- `tests/auth-team-access-review-route-state.test.js`
- `tests/govuk-pages-render-workflow-state.test.js`
- `docs/agent-audit/reasoning/2026/05/31/team-access-review-route-and-render-scope.md`
- `docs/agent-audit/reasoning/2026/05/31/team-access-review-route-and-render-scope.json`

## Implementation summary

The review, approve and reject endpoints now perform their own authenticated route context check and continue to enforce the Story 4 Team Admin decision rules server-side.

This avoids the user-facing route-permission declaration failure for the Team Admin review flow, while preserving these controls:

- signed-in context is required
- Team Admin authority is checked using manageable teams
- self-approval is blocked
- only pending requests can be decided
- approval creates active team membership only
- approval does not create role assignments
- approval does not create permission exceptions
- rejection does not create membership

The GOV.UK render workflow now separates render inputs into two paths.

For page-template-only changes under:

`src/govuk/templates/pages/*.njk`

it maps the changed Nunjucks templates to their registered generated outputs in:

`scripts/govuk/render-govuk-pages.mjs`

It still runs the renderer, but it stages and commits only the generated output files corresponding to changed or newly-created Nunjucks page templates.

For global render inputs, including generator scripts, package files, the workflow file itself and non-page GOV.UK templates, it sets `render_all=true`. This keeps the previous safety behaviour for generator-only or dependency-only workflow runs, so generated public output is checked rather than skipped.

The render workflow state test now pins both behaviours:

- page-template-only changes remain scoped to mapped generated outputs
- global render inputs render and check all generated GOV.UK pages

## Automated review-comment disposition

Codex comment on `.github/workflows/render-govuk-pages.yml`, lines 66–70, was classified as legitimate.

Resolution:

- Added global render-input detection before the page-template-only mapping branch.
- Treated `scripts/govuk/render-govuk-pages.mjs`, `scripts/govuk/normalise-service-pages.mjs`, `package.json`, `package-lock.json`, `.github/workflows/render-govuk-pages.yml` and non-page `src/govuk/templates/**` changes as `render_all=true` cases.
- Added test coverage in `tests/govuk-pages-render-workflow-state.test.js` for the Codex edge case.

## Scope controls

This branch does not change:

- the Story 4 Nunjucks page source
- the generated `public/pages/team/access-requests/index.html`
- D1 schema
- D1 migrations
- approval business rules
- rejection business rules
- role assignment
- permission assignment
- account-page rendering

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

CI should also confirm:

- the Team Admin review page route-state contract still passes
- the Worker CI route-state and unit tests pass
- the GOV.UK render workflow does not stage unrelated generated pages when only one Nunjucks page template changes
- the GOV.UK render workflow still renders and checks all generated output when generator, dependency, workflow or non-page template inputs change

## Residual risk

Validation has not been run in this connector context.

The render workflow deliberately uses a page-template-to-output mapping parsed from `scripts/govuk/render-govuk-pages.mjs`. If future registrations use a materially different object shape, the mapping check may need to be updated.
