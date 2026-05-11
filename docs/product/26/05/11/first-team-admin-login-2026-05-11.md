# First Team Admin sign-in route

**Date:** 2026-05-11  
**Status:** implementation note  
**Scope:** first Team Admin entry point for the ResearchOps authentication and role-assignment workstream

## Purpose

This change gives the first bootstrapped Team Admin a clear user-facing route into ResearchOps.

The existing authentication foundation already supports:

- Cloudflare Access identity validation through `/api/me`
- D1 user lookup and identity linking
- active team membership lookup
- role and permission lookup
- Team Admin permission checks through `role.assign`
- the Team Admin role-assignment UI at `/pages/team/role-assignments/`

The missing piece was a front-door page where the first Team Admin could sign in, check whether ResearchOps recognises the account and continue to the role-assignment task.

## User need

As the first Team Admin, I need to sign in to ResearchOps and confirm my team and role access so that I can begin assigning roles to other team members.

## Route added

```text
/pages/account/sign-in/
```

The page uses GOV.UK-style account language:

- “Sign in to ResearchOps”
- “Sign in with Cloudflare Access”
- “If you cannot sign in”

It does not introduce custom password authentication.

## Behaviour

The page script calls:

```text
/api/me
```

with credentials included.

It then distinguishes these states:

- not signed in through Cloudflare Access
- signed in but account is not active
- signed in but no active ResearchOps team is available
- signed in with a team but without `role.assign`
- signed in as a Team Admin with `role.assign`

When the user has `role.assign`, the page shows a continuation link to:

```text
/pages/team/role-assignments/
```

## Security boundary

This route does not authenticate the user itself.

Authentication remains Cloudflare Access.

Authorisation remains server-side through the Worker and D1 permissions.

The client-side page only presents the current account state and a route into the Team Admin UI.

## Explicit non-goals

This change does not:

- add passwords
- add a custom session store
- add open account creation
- add role request flows
- change D1 schema
- change Cloudflare Access configuration
- grant the first Team Admin role

The Team Admin account must still be created through the existing auth runtime bootstrap process.

## Validation

A route-state test now asserts that:

- the sign-in page exists
- the page uses Cloudflare Access language
- the page depends on `/api/me`
- the page links Team Admin users to `/pages/team/role-assignments/`
- the client script checks for `role.assign`
- the page does not introduce password fields or browser-side session storage
