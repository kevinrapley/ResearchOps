# Agent trace: first Team Admin login route

Date: 2026-05-11

Branch: `feature/first-team-admin-login`

## Trigger

The user asked to pick up the authentication, account request and role-setting workstream, starting with the ability for the first Team Admin to log in to the ResearchOps platform.

## Request interpreted

The implementation should add a practical first-login route for the already bootstrapped Team Admin.

The required outcome was:

- keep Cloudflare Access as the authentication route
- do not introduce custom passwords or mock identity mode
- use `/api/me` as the ResearchOps account and permission check
- recognise a signed-in Team Admin through the `role.assign` permission
- give the Team Admin a continuation route into `/pages/team/role-assignments/`
- keep identity, team membership and role assignment separate
- add tests and product documentation

## Evidence checked

Repository files checked:

- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `scripts/auth-runtime-bootstrap.mjs`
- `public/pages/team/role-assignments/index.html`
- `public/js/auth-role-assignment-page.js`
- `tests/auth-foundation-route-state.test.js`
- `docs/product/26/05/08/authentication-role-selection-requirements-2026-05-08.md`

## Findings

The backend already had the necessary foundation:

- `/api/me` resolves Cloudflare Access identity
- existing seeded users are found by email and linked to the Access identity
- D1 stores active account state, team membership, roles and permissions
- `role_team_admin` maps to `team.manage`, `role.assign` and `audit.view`
- the runtime bootstrap script can seed the first Team Admin as an active user with team membership and role assignment
- the role-assignment UI already depends on `/api/me` and `role.assign`

The missing user-facing capability was a clear sign-in/status route that lets the first Team Admin enter the platform and continue to the existing Team Admin task.

## Implementation applied

Added:

```text
public/pages/account/sign-in/index.html
public/js/auth-sign-in-page.js
tests/auth-sign-in-route-state.test.js
docs/product/26/05/11/first-team-admin-login-2026-05-11.md
```

Updated:

```text
visual-walkthrough.operational-fixtures.mjs
```

The page provides a GOV.UK-style account front door. It checks `/api/me` and distinguishes unauthenticated, inactive-account, no-team, non-admin and Team Admin states.

The script shows the Team Admin continuation link only when the user has `role.assign`.

## Security boundary

The page does not authenticate the user itself.

Authentication remains Cloudflare Access.

Authorisation remains server-side in the Worker and D1 permission layer.

The page only presents the current account state and routes authorised users to the Team Admin UI.

## Validation encoded

`tests/auth-sign-in-route-state.test.js` asserts:

- the sign-in page exists and uses GOV.UK-style account language
- Cloudflare Access is the sign-in mechanism
- the page depends on `/api/me`
- the page links Team Admins to `/pages/team/role-assignments/`
- the client script checks for `role.assign`
- the page does not introduce password fields
- the script does not use `localStorage` or `sessionStorage`

## Current status at trace write

The branch had not yet been opened as a PR.

CI still needed to run after the latest commits.
