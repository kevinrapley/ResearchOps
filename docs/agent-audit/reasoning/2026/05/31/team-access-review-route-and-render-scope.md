# Agent trace — Team access review route and render scope fix

**Date:** 2026-05-31  
**Trace type:** operational audit trace  
**Branch:** `fix/team-access-review-route-and-render-scope`  
**Related work:** Story 4 — Team Admin reviews team access requests

## Evidence boundary

This trace records repository evidence, implementation scope, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Fix the broken Team Admin review route and stop the GOV.UK render workflow from committing every generated `index.html` file when only one Nunjucks page template changes.

## Problems observed

The Team Admin review page displayed this user-facing error:

`This route is not available because no permission rule has been declared.`

The error came from the review page controller calling:

`GET /api/team-access/requests/review`

The endpoint was implemented, but the runtime route permission table could still lack the corresponding declaration if the D1 route declaration migration had not been applied to the active environment.

A separate rendering problem was also observed. After hardening the workflow to detect newly generated pages, new PRs could cause all generated `public/**/index.html` files to be re-rendered and committed. This creates noisy PRs and hides the meaningful page-specific change.

## Files inspected

- `.github/workflows/render-govuk-pages.yml`
- `scripts/govuk/render-govuk-pages.mjs`
- `infra/cloudflare/src/core/auth/team-access-requests.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/migrations/0006_auth_team_access_review.sql`
- `tests/auth-team-access-review-route-state.test.js`
- `public/pages/team/access-requests/index.html`

## Files changed

- `.github/workflows/render-govuk-pages.yml`
- `infra/cloudflare/src/core/auth/team-access-requests.js`
- `tests/auth-team-access-review-route-state.test.js`
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

The GOV.UK render workflow now determines which page templates changed under:

`src/govuk/templates/pages/*.njk`

It maps those changed Nunjucks templates to their registered generated outputs in:

`scripts/govuk/render-govuk-pages.mjs`

It still runs the renderer, but it stages and commits only the generated output files corresponding to changed or newly-created Nunjucks page templates.

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

## Residual risk

Validation has not been run in this connector context.

The render workflow deliberately uses a page-template-to-output mapping parsed from `scripts/govuk/render-govuk-pages.mjs`. If future registrations use a materially different object shape, the mapping check may need to be updated.
