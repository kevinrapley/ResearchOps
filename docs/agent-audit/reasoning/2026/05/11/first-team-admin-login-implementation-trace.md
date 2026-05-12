# Agent trace: first Team Admin passwordless sign-in route

Date: 2026-05-11

Branch: `fix/team-admin-sign-in-journey`

## Trigger

The user rejected the initial sign-in page and route because it exposed implementation mechanics, relied on a visible Cloudflare Access handoff and did not let the user sign in within the ResearchOps interface.

The user clarified the product requirement:

- the user enters their email address in ResearchOps
- the user receives a one-time code by email
- the user enters the code in ResearchOps
- the user is not exposed to Cloudflare pages or routes
- D1 remains the identity, team, role, permission and audit control plane
- the Worker remains the authorisation boundary
- Airtable is accessed only after Worker authorisation

## Request interpreted

The implementation should replace the Cloudflare Access handoff stance with a ResearchOps-owned passwordless email-code flow.

The required outcome was:

- remove visible Cloudflare sign-in language from the account page
- collect email address in the ResearchOps UI
- collect the one-time code in the ResearchOps UI
- add Worker endpoints to start and verify email-code challenges
- store challenge and session state in D1
- create an HTTP-only ResearchOps session cookie after successful code verification
- resolve `/api/me` from the ResearchOps session before falling back to Cloudflare Access
- continue to use D1 roles and permissions for `role.assign`
- show the Team Admin continuation route only after `/api/me` confirms permission

## Evidence checked

Repository files checked:

- `docs/product/26/05/08/authentication-role-selection-requirements-2026-05-08.md`
- `docs/product/26/05/09/auth-runtime-bootstrap-2026-05-09.md`
- `docs/product/26/05/09/auth-role-assignment-api-2026-05-09.md`
- `docs/product/26/05/09/auth-role-assignment-ui-2026-05-09.md`
- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `infra/cloudflare/migrations/0002_auth_role_assignment_route.sql`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/role-assignments.js`
- `infra/cloudflare/src/worker.js`
- `public/pages/account/sign-in/index.html`
- `public/js/auth-sign-in-page.js`
- `tests/auth-sign-in-route-state.test.js`

## Findings

The product requirements record three relevant methods:

- Cloudflare Access plus D1 RBAC
- passwordless email magic link or code plus D1 RBAC
- hybrid Access or OIDC plus passwordless collaborator support

The initial PR #240 implemented only a sign-in/status page and assumed Cloudflare Access as the visible authentication route. That did not meet the clarified user requirement.

The correct product stance for this follow-up is passwordless email-code authentication owned by ResearchOps.

The existing auth foundation already had:

- `auth_users`
- `auth_identities`
- `auth_teams`
- `auth_team_memberships`
- `auth_roles`
- `auth_permissions`
- `auth_role_permissions`
- `auth_role_assignments`
- `auth_events`
- `auth_audit_events`
- `auth_route_permissions`

The missing control-plane pieces were:

- one-time login challenges
- ResearchOps session records
- passwordless start and verify endpoints
- UI forms for email and code entry

## Implementation applied

Added:

```text
infra/cloudflare/migrations/0003_auth_passwordless_sessions.sql
infra/cloudflare/src/core/auth/passwordless.js
```

Updated:

```text
infra/cloudflare/src/core/auth/access.js
infra/cloudflare/src/worker.js
public/pages/account/sign-in/index.html
public/js/auth-sign-in-page.js
tests/auth-sign-in-route-state.test.js
scripts/validate.sh
docs/product/26/05/11/first-team-admin-login-2026-05-11.md
```

Removed:

```text
infra/cloudflare/src/core/auth/login.js
infra/cloudflare/src/core/auth/context.js
```

## Implemented flow

The implemented ResearchOps passwordless flow is:

```text
POST /api/auth/email/start
POST /api/auth/email/verify
POST /api/auth/logout
GET  /api/me
```

The UI journey is:

1. User enters an email address in ResearchOps.
2. Worker creates a challenge in D1.
3. Worker sends a 6 digit code through configured email delivery.
4. User enters the code in ResearchOps.
5. Worker verifies the code.
6. Worker creates a ResearchOps session.
7. Worker sets an HTTP-only session cookie.
8. `/api/me` resolves the session into user, team, role and permission context.
9. The page shows “Manage team roles” only if `role.assign` is present.

## Security boundary

The page does not enforce authorisation.

The page only collects email and code and displays account state.

The Worker validates the code, creates the session and resolves identity through D1.

The Worker remains responsible for permission checks before protected operations.

D1 remains the canonical store for users, identities, teams, roles, permissions, challenges, sessions and audit events.

The implementation does not add passwords.

The implementation does not expose Cloudflare-branded sign-in pages to the user.

## Validation encoded

`tests/auth-sign-in-route-state.test.js` asserts:

- the sign-in page collects email in ResearchOps
- the sign-in page collects a 6 digit code in ResearchOps
- the page does not expose Cloudflare sign-in language
- the page uses `/api/auth/email/start`
- the page uses `/api/auth/email/verify`
- the page uses `/api/me` after verification
- the Worker routes passwordless endpoints
- the passwordless server module uses D1 challenge and session tables
- the canonical auth resolver prefers ResearchOps sessions before Cloudflare Access fallback
- the Team Admin continuation route remains `/pages/team/role-assignments/`

## Current status at trace write

The corrective branch had not yet been opened as a PR.

CI still needed to run after the latest commits.
