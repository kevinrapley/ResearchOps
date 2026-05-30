# Agent trace addendum — Story 1 D1 validation

**Date:** 2026-05-30  
**Branch:** `feature/auth-stable-internal-user-identity`  
**Story:** Sign in as a known user and resolve internal identity

## Decision recorded

Story 1 alpha validation will use a second controlled test email address in the real ResearchOps D1 environment rather than an in-memory FakeD1 identity fixture.

The email address and display name are operational values. They must be provided only when running the D1 seed steps and must not be committed to repository files.

## Runbook

The operational runbook is:

```text
docs/product/26/05/30/auth-story-1-d1-alpha-user-seed-runbook.md
```

The seed is intended to create an active identity-only user for Story 1 validation.

It must not grant:

- team membership
- role assignment
- permission exception
- safeguarding access
- participant personal data access

## Validation target

After seed and sign-in, validate:

```text
GET /api/me/identity
```

Expected behaviour:

- the user resolves to one stable internal ResearchOps user ID
- the response contains identity-only user data
- the response does not contain active team, roles, permissions, team memberships, session tokens or provider tokens

## Residual risk

The seed and smoke test have not been run in this connector context.
