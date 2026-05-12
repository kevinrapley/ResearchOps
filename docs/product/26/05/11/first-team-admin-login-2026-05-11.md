# First Team Admin passwordless sign-in route

**Date:** 2026-05-11  
**Status:** implementation note, revised 2026-05-12  
**Scope:** first Team Admin entry point for the ResearchOps authentication and role-assignment workstream

## Purpose

This change gives the first Team Admin a clear user-facing route into ResearchOps without exposing the user to Cloudflare-branded authentication screens.

ResearchOps owns the visible sign-in journey.

Cloudflare remains the platform infrastructure for the Worker, D1 and deployment layer.

## Product decision

The sign-in route now follows a ResearchOps-owned passwordless email-code flow.

The user journey is:

1. The user enters their work email address in ResearchOps.
2. ResearchOps sends a 6 digit sign-in code.
3. The user enters the code in ResearchOps.
4. The Worker verifies the code.
5. The Worker creates a ResearchOps session.
6. `/api/me` checks the user, active team, roles and permissions from D1.
7. If the user has `role.assign`, ResearchOps shows the route to manage team roles.

The user should remain within the ResearchOps interface throughout the journey.

## User need

As the first Team Admin, I need to sign in using my work email address so that I can confirm my account, team and role access and begin assigning roles to other team members.

## Routes

User-facing route:

```text
/pages/account/sign-in/
```

Worker routes:

```text
POST /api/auth/email/start
POST /api/auth/email/verify
POST /api/auth/logout
GET  /api/me
```

## Behaviour

The sign-in page contains two steps.

First, the user enters their email address.

Second, the user enters the 6 digit code sent to that email address.

After code verification, the page calls:

```text
/api/me
```

with credentials included.

It then distinguishes these states:

- signed out
- signed in but account is not active
- signed in but no active ResearchOps team is available
- signed in with a team but without `role.assign`
- signed in as a Team Admin with `role.assign`

When the user has `role.assign`, the page shows a continuation link to:

```text
/pages/team/role-assignments/
```

## D1 control plane

The passwordless journey uses D1 as the identity and authority layer.

The new passwordless support adds:

```text
auth_login_challenges
auth_sessions
```

The existing auth foundation continues to hold:

```text
auth_users
auth_identities
auth_teams
auth_team_memberships
auth_roles
auth_permissions
auth_role_permissions
auth_role_assignments
auth_events
auth_audit_events
auth_route_permissions
```

## Session model

After a successful code check, the Worker sets an HTTP-only ResearchOps session cookie.

The session is resolved by the Worker and mapped back to the D1 user, identity, team, role and permission model.

Existing Cloudflare Access JWT support can remain as a backend-compatible fallback, but it is no longer the visible sign-in journey for this route.

## Email delivery

The Worker can send sign-in codes through a configured email delivery route.

Supported configuration points are:

```text
RESEARCHOPS_EMAIL_WEBHOOK_URL
RESEARCHOPS_EMAIL_WEBHOOK_TOKEN
RESEND_API_KEY
RESEARCHOPS_EMAIL_FROM
RESEARCHOPS_AUTH_SECRET
```

The auth secret is required so codes and sessions can be stored as hashes rather than plaintext values.

## Security boundary

This route does not add custom password authentication.

ResearchOps sends a time-limited code and stores only hashed code/session values.

Authorisation remains server-side through the Worker and D1 permissions.

Client-side visibility only improves the interface. It is not the security boundary.

The Worker must still authorise protected API requests before Airtable reads or writes.

## Explicit non-goals

This change does not:

- add passwords
- expose Cloudflare-branded sign-in pages to the user
- grant the first Team Admin role
- add open role self-assignment
- replace D1 as the permission authority
- make Airtable an authorisation system
- add full account request and approval journeys
- add production-grade rate limiting or abuse controls

## Validation

The route-state test asserts that:

- the sign-in page exists
- the page collects an email address in ResearchOps
- the page collects a 6 digit code in ResearchOps
- the page does not expose Cloudflare sign-in language
- the page depends on `/api/auth/email/start`
- the page depends on `/api/auth/email/verify`
- the page depends on `/api/me` after verification
- the page links Team Admin users to `/pages/team/role-assignments/`
- the client script checks for `role.assign`
- the page does not introduce password fields or browser-side session storage
