# Agent trace checkpoint 010: route-permission wiring plan

> This checkpoint belongs to `[reasoning]` trace `atrace-20260508-authentication-role-selection-real-implementation`. It records the next implementation step before code changes are made. It does not expose private chain-of-thought.

## Branch

`feature/auth-foundation-real-d1-current-main`

## Next implementation step

Wire the route-permission helper into the first real authenticated endpoints:

- `GET /api/me`
- `GET /api/me/permissions`

## Rationale

The D1 migration seeds route declarations for both routes. The Worker already routes both endpoints through the Cloudflare Access identity resolver. The route-permission helper exists but is not yet used by product code.

The next small slice is to make these identity endpoints check their D1 route declaration before returning account, team, role or permission data.

## Intended changes

Expected code changes:

- update `infra/cloudflare/src/core/auth/access.js`
- import `assertRoutePermission` and `routePermissionErrorResponse`
- call `assertRoutePermission(request, env, context)` after authentication context has resolved
- return route-permission errors through `routePermissionErrorResponse`

Expected test changes:

- update `tests/auth-foundation-route-state.test.js`
- assert that the Access resolver imports the route-permission helper
- assert that it calls `assertRoutePermission`

## Boundary

This step does not wire route-permission checks into all existing product routes.

This step does not create users or role assignments.

This step does not apply the D1 migration to the live database.

## Cloudflare bundle implication

Workers remain the server-side policy enforcement point. D1 remains the relational control plane. Cloudflare Agents are not used to decide access.

## Live D1 status

The remote `researchops-d1` database has not yet been changed by this workstream. The manual D1 workflow exists, but it has not been run in this chat.
