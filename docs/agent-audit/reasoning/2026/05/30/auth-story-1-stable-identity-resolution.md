# Agent trace — Stable internal user identity resolution

**Date:** 2026-05-30  
**Trace type:** operational audit trace  
**Branch:** `feature/auth-stable-internal-user-identity`  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Sign in as a known user and resolve internal identity

## Evidence boundary

This trace records repository evidence, selected operating-model bundles, implementation scope, files read, files changed, validation expected and residual risk.

It does not expose private chain-of-thought.

## Task summary

Begin implementation work for Story 1 by establishing a narrow, testable identity-only route and product plan for stable internal user identity resolution.

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

ResearchOps Developer Control was selected because this changes ResearchOps platform architecture and Worker routing.

Multi-Functional Team was selected because the work is part of a public-sector product control plane.

GOV.UK Design System was selected because Story 1 includes sign-in and account-language commitments, although this first implementation slice does not yet alter visible pages.

Cloudflare was selected because the implementation affects Cloudflare Worker routing, D1-backed auth state and protected API contracts.

## Bundles skipped

- `.agent-operating-model/bundles/openai/`
- `.agent-operating-model/bundles/mcp-agent-tooling/`
- `.agent-operating-model/bundles/airtable-public-api/`
- `.agent-operating-model/bundles/mural-public-api/`

## Files inspected

- `docs/product/26/05/08/authentication-role-selection-requirements-2026-05-08.md`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/src/core/auth/passwordless.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `tests/auth-foundation-route-state.test.js`
- `tests/auth-registration-requests-runtime.test.js`

## Files changed

- `docs/product/26/05/30/auth-story-1-stable-identity-resolution.md`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `infra/cloudflare/src/core/auth/access-scoped.js`
- `infra/cloudflare/src/worker.js`
- `tests/auth-foundation-route-state.test.js`
- `docs/agent-audit/reasoning/2026/05/30/auth-story-1-stable-identity-resolution.md`
- `docs/agent-audit/reasoning/2026/05/30/auth-story-1-stable-identity-resolution.json`

## Implementation summary

The branch starts Story 1 by adding an identity-only route:

```text
GET /api/me/identity
```

The route is intended to expose only the signed-in identity contract:

- `ok`
- `authenticated`
- `provider`
- `user.id`
- `user.displayName`
- `user.email`
- `user.accountStatus`

It deliberately keeps active team, roles, permissions and team memberships out of the primary response. Those remain part of `/api/me` and `/api/me/permissions` for later stories.

## Test coverage added

`tests/auth-foundation-route-state.test.js` now checks:

- `/api/me/identity` fails closed without an access token
- the Worker routes `/api/me/identity` through the scoped access resolver
- the scoped access handler contains the identity-only branch
- the identity-only branch does not include active team, roles, permissions or member team state
- the D1 route-permission seed declares `/api/me/identity`

## Validation expected

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

## Residual risk

Validation has not been run in this connector context.

The first slice has not yet added an end-to-end signed-in runtime test with a FakeD1 identity provider assertion. That should be the next implementation step if this branch continues before PR.
