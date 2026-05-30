# Agent trace — Story 3 team access request

**Date:** 2026-05-30  
**Trace type:** operational audit trace  
**Branch:** `feature/team-access-request`  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Request access to a team

## Evidence boundary

This trace records repository evidence, selected operating-model bundles, implementation scope, files read, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Begin implementation of Story 3 using the narrowed team position:

```text
Story 3 should let users ask to enter a team.
It should not decide what they can do once they are inside.
```

## Operating model files loaded

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/github-mutation-policy.md`

## Selected bundles

Always-load bundles:

- `.agent-operating-model/bundles/github/`
- `.agent-operating-model/bundles/researchops-developer-control/`
- `.agent-operating-model/bundles/multi-functional-team/`

Conditional bundles:

- `.agent-operating-model/bundles/govuk-design-system/`
- `.agent-operating-model/bundles/cloudflare/`

## Bundle selection rationale

GitHub Diamond was selected because this is repository-affecting branch work.

ResearchOps Developer Control was selected because this changes the ResearchOps account journey and access-control surface.

Multi-Functional Team was selected because the work is part of the governed access epic.

GOV.UK Design System was selected because this changes GOV.UK page templates, form structure, error summary behaviour, notification banners and account-page content.

Cloudflare was selected because the implementation adds D1 schema and Worker API routes.

## Bundles skipped

- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

## Files inspected

- `src/govuk/templates/pages/account.njk`
- `public/pages/account/index.html`
- `public/js/auth-account-page.js`
- `scripts/govuk/render-govuk-pages.mjs`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/src/core/auth/registration-requests.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `tests/auth-account-dashboard-route-state.test.js`

## Files changed

- `docs/product/26/05/30/auth-story-3-team-access-request.md`
- `infra/cloudflare/migrations/0005_auth_team_access_requests.sql`
- `infra/cloudflare/src/core/auth/team-access-requests.js`
- `infra/cloudflare/src/worker.js`
- `scripts/govuk/render-govuk-pages.mjs`
- `src/govuk/templates/pages/account.njk`
- `src/govuk/templates/pages/account-team-access.njk`
- `public/pages/account/index.html`
- `public/pages/account/team-access/index.html`
- `public/js/auth-account-page.js`
- `public/js/auth-team-access-page.js`
- `tests/auth-account-dashboard-route-state.test.js`
- `tests/auth-team-access-request-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/30/auth-story-3-team-access-request.md`
- `docs/agent-audit/reasoning/2026/05/30/auth-story-3-team-access-request.json`

## Implementation summary

The branch adds a request-access flow:

- no-team account state now links to `Request access to a team`
- account page has a separate `Team access requests` section for pending requests
- pending requests are labelled `Awaiting approval`
- pending requests are not displayed as active memberships
- pending requests can be cancelled from the account page
- `/pages/account/team-access/` provides a GOV.UK form to submit a team access request
- `/api/team-access/requests` lists and creates requests
- `/api/team-access/requests/cancel` cancels pending requests
- `auth_team_access_requests` stores request state separately from `auth_team_memberships`
- audit events are recorded as `team.access.requested` and `team.access.cancelled`

## Scope controls

This branch does not add:

- approval queue
- approval or rejection decisions
- team creation
- team switching
- role request
- role assignment
- PII reveal
- notification delivery
- audit viewer

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

Manual checks:

- sign in as a user with no team
- confirm account page links to request access
- submit a valid request for a discoverable active team
- confirm request appears under `Team access requests`
- confirm request is labelled `Awaiting approval`
- confirm request does not appear as an active team membership
- cancel the request and confirm it no longer appears
- confirm team-scoped records remain inaccessible while pending

## Residual risk

Validation has not been run in this connector context.

The current implementation supports discoverable active team names or IDs. Invitation-code handling is not implemented in this first slice, beyond accepting an entered reference through the same form field.
