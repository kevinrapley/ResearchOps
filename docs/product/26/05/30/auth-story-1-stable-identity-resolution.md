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
- a safe `/api/me` contract
- unauthenticated and failed-identity states that do not leak account existence
- auth event names and audit shape for sign-in, sign-out and identity-link resolution
- tests that prove identity resolution is deterministic and safe

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

### Signed-in `/api/me`

```json
{
	"ok": true,
	"user": {
		"id": "usr_...",
		"displayName": "Alex Smith",
		"email": "alex.smith@example.gov.uk",
		"accountStatus": "active"
	}
}
```

### Signed-out `/api/me`

```json
{
	"ok": false,
	"error": "not_signed_in",
	"message": "Sign in to continue."
}
```

## Acceptance criteria summary

- Signed-out users can reach a clear sign-in route.
- Trusted identity provider assertions resolve to stable internal users.
- First-time known users can be created or matched safely.
- `/api/me` returns the signed-in identity without secrets or provider tokens.
- Signed-out `/api/me` requests fail safely.
- Failed sign-in avoids account enumeration.
- Auth events are recorded separately from application audit events.
- Server-side identity validation is covered by tests.

## Implementation slice

The first implementation should be deliberately thin:

1. Add an identity-resolution service for provider identity assertions.
2. Add or update `/api/me` so it resolves through the service.
3. Add unit tests for deterministic identity-link resolution and safe unauthenticated responses.
4. Add route-state or contract tests for the public response shape.
5. Leave role, team and permission data out of this story except where a safe placeholder state is required.

## Risks

### Identity-provider drift

The alpha implementation may start with Cloudflare Access or test provider assertions. The internal identity model should not depend on a single provider-specific field beyond the provider-subject mapping.

### Over-claiming authorisation

Do not add permissions, roles or access decisions into `/api/me` in this story unless they are clearly marked as future placeholders. Returning roles too early risks confusing identity proof with authorisation.

### Account enumeration

Failed sign-in, missing identity and unauthenticated `/api/me` responses must not reveal whether an email exists.

## Validation expectation

Run:

```bash
npm run validate
npm run lint
npm test -- --ci
```

Manual checks depend on the identity route selected for alpha and should be added to this document when the implementation route is confirmed.
