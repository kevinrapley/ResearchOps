# Story 1 — Stable internal user identity resolution

**Date:** 2026-05-30  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Sign in as a known user and resolve internal identity  
**Branch:** `feature/auth-stable-internal-user-identity`  
**Status:** alpha implementation plan

## Story

As a research team member, I need to sign in to ResearchOps and be resolved to a stable internal user identity, so that my work can be connected to my permissions and audit trail.

## Intent

This story establishes identity proof and internal user resolution only.

It deliberately does not decide what the user can do. Authorisation belongs to later stories in the epic.

## Alpha scope

The alpha slice should provide:

- a stable internal user ID resolved from a trusted provider identity
- a safe identity-only `/api/me/identity` contract
- unauthenticated and failed-identity states that do not leak account existence
- auth event names and audit shape for sign-in, sign-out and identity-link resolution
- route-state tests that protect the identity-only response boundary
- a D1 smoke test using a second alpha mailbox at execution time

## Out of scope

This story does not include:

- team joining
- team switching
- role request
- role approval
- permission matrix UI
- participant PII reveal
- safeguarding visibility
- governed approval
- decision ownership
- full audit viewer

## Service principles

1. Authentication and authorisation must stay separate.
2. The Worker must validate identity before returning protected user data.
3. D1 is the control-plane store for users, identity links and auth events.
4. Provider tokens and raw identity-provider claims must not be returned to the browser.
5. First-time users must not receive sensitive permissions by default.
6. User-facing language must use plain terms such as “Sign in” rather than technical labels such as “Authenticate”.
7. Alpha validation should use a D1-seeded user rather than an in-memory identity fixture.

## Data concepts

### Internal user

A ResearchOps user is identified by a stable internal ID.

Suggested fields:

- `id`
- `displayName`
- `email`
- `accountStatus`
- `createdAt`
- `updatedAt`

### Identity provider link

A provider identity link is stored separately from the internal user.

Suggested fields:

- `id`
- `userId`
- `provider`
- `providerSubject`
- `email`
- `emailVerified`
- `createdAt`
- `lastSeenAt`

### Auth event

Auth events are separate from later application audit events.

Suggested event names:

- `auth.sign_in.success`
- `auth.sign_in.failure`
- `auth.sign_out.success`
- `auth.identity_link.created`
- `auth.identity_link.resolved`

## API contract

### Signed-in `/api/me/identity`

```json
{
	"ok": true,
	"authenticated": true,
	"provider": "researchops_email",
	"user": {
		"id": "usr_...",
		"displayName": "...",
		"email": "...",
		"accountStatus": "active"
	}
}
```

The identity-only route must not return:

- `activeTeam`
- `roles`
- `permissions`
- `memberTeams`
- `teamMemberships`
- session tokens
- provider tokens

### Signed-out `/api/me/identity`

```json
{
	"ok": false,
	"error": "authentication_required",
	"message": "Sign in is required to use this part of ResearchOps."
}
```

## Acceptance criteria summary

- Signed-out users can reach a clear sign-in route.
- Trusted provider assertions resolve to stable internal users.
- First-time known users can be created or matched safely.
- `/api/me/identity` returns the signed-in identity without secrets or provider tokens.
- Signed-out `/api/me/identity` requests fail safely.
- Failed sign-in avoids account enumeration.
- Auth events are recorded separately from application audit events.
- Server-side identity validation is covered by tests.
- D1 validation uses a second alpha mailbox with no team, role or sensitive permissions seeded for Story 1.

## Implementation slice

The first implementation should be deliberately thin:

1. Add an identity-only `/api/me/identity` route.
2. Route it through the existing scoped access resolver.
3. Declare the route in `auth_route_permissions`.
4. Add route-state or contract tests for the public response shape.
5. Add a D1 alpha user seed runbook with placeholders.
6. Leave role, team and permission data out of this story except where existing broader `/api/me` behaviour already exposes it.

## D1 validation

Story 1 should be smoke-tested with a second alpha mailbox that can receive the ResearchOps sign-in code.

Use:

```text
docs/product/26/05/30/auth-story-1-d1-alpha-user-seed-runbook.md
```

The seeded user should be active and known to D1, but should not receive team membership, role assignment or sensitive permissions in this story.

The user should sign in through:

```text
/pages/account/sign-in/
```

Then validate:

```text
GET /api/me/identity
```

## Risks

### Identity-provider drift

The visible alpha sign-in route uses ResearchOps passwordless email-code authentication. The internal identity model should not depend on a single provider-specific field beyond the provider-subject mapping.

### Over-claiming authorisation

Do not add permissions, roles or access decisions into `/api/me/identity`. Returning roles too early risks confusing identity proof with authorisation.

### Account enumeration

Failed sign-in, missing identity and unauthenticated identity responses must not reveal whether an email exists.

### Repository history hygiene

Do not commit the second mailbox address or related identifying values. Use placeholders in committed documentation and provide the operational values only when running the seed.

## Validation expectation

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

Manual checks depend on the seeded mailbox and should be captured without exposing identifying values in repository files.
