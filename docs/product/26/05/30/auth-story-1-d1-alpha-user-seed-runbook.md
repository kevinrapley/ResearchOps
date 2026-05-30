# Story 1 — D1 alpha user seed runbook

**Date:** 2026-05-30  
**Epic:** ROPS-AUTH-P1-000 — Governed access, permissions and audit  
**Story:** Sign in as a known user and resolve internal identity  
**Branch:** `feature/auth-stable-internal-user-identity`  
**Status:** operational seed runbook

## Purpose

Use a second real email address to validate Story 1 against the real D1 control plane.

This runbook supports alpha evidence that a non-admin user can sign in through the ResearchOps passwordless journey and resolve to a stable internal ResearchOps identity without being granted team, role or sensitive permission state by default.

## Do not commit real personal data

Do not commit the real email address or display name into this repository.

Use placeholders in committed documentation and supply real values only when running the D1 seed command in the operational environment.

## Data boundary

This seed is for Story 1 only.

It should create or confirm:

- one `auth_users` record
- optionally one `auth_identities` record for `researchops_email`

It should not create:

- team membership
- role assignment
- permission exception
- safeguarding access
- audit-view access
- participant PII access

## Placeholder values

Replace these values locally before execution:

```text
<USER_ID>        Stable internal user ID, for example usr_alpha_researcher_001
<IDENTITY_ID>    Stable identity link ID, for example idn_alpha_researcher_001
<EMAIL>          Real alpha user email address, lower case
<DISPLAY_NAME>   Real alpha user display name
```

## Seed SQL

```sql
INSERT OR IGNORE INTO auth_users (
  id,
  email,
  display_name,
  account_status
)
VALUES (
  '<USER_ID>',
  '<EMAIL>',
  '<DISPLAY_NAME>',
  'active'
);

INSERT OR IGNORE INTO auth_identities (
  id,
  user_id,
  provider,
  provider_subject,
  email,
  email_verified,
  mfa_claim,
  last_seen_at
)
VALUES (
  '<IDENTITY_ID>',
  '<USER_ID>',
  'researchops_email',
  '<EMAIL>',
  '<EMAIL>',
  1,
  'email_code',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
```

## Wrangler execution pattern

Run from the repository root after replacing placeholders in a local copy of the SQL.

```bash
cd infra/cloudflare
npx wrangler d1 execute researchops-d1 --remote --file ../../tmp/auth-story-1-alpha-user-seed.sql
```

If using direct SQL instead of a file, avoid pasting real personal data into terminal history where that creates an operational risk.

## Smoke test steps

1. Go to the ResearchOps sign-in page.

```text
/pages/account/sign-in/
```

2. Enter the seeded email address.

3. Complete the 6 digit passwordless code step.

4. Call the identity-only route with credentials included.

```text
GET /api/me/identity
```

5. Confirm the response contains identity-only state.

Expected response shape:

```json
{
  "ok": true,
  "authenticated": true,
  "provider": "researchops_email",
  "user": {
    "id": "<USER_ID>",
    "displayName": "<DISPLAY_NAME>",
    "email": "<EMAIL>",
    "accountStatus": "active"
  }
}
```

6. Confirm the response does not contain:

```text
activeTeam
roles
permissions
memberTeams
teamMemberships
session
token
```

7. Call the broader account route.

```text
GET /api/me
```

8. Confirm the user resolves as a known internal user.

9. Confirm no team, role or sensitive permission has been granted unless explicitly added in a later story.

## Rollback SQL

Only use this rollback if the seeded user is no longer required and has not been used for later story validation.

```sql
DELETE FROM auth_identities
WHERE provider = 'researchops_email'
  AND provider_subject = '<EMAIL>';

DELETE FROM auth_users
WHERE id = '<USER_ID>'
  AND email = '<EMAIL>';
```

Do not delete the user if later stories have attached team membership, role requests, audit events or governed records to the same internal user ID. Suspend the account instead if preserving audit continuity is required.

## Evidence to capture

Capture the following in the PR or test note without exposing unnecessary personal data:

- seed command completed
- sign-in completed
- `/api/me/identity` returned 200
- identity response contained the expected internal user ID
- identity response excluded roles, permissions and team membership state
- `/api/me` showed no elevated access unless later seeded deliberately

## Product interpretation

Passing this smoke test means Story 1 has a real alpha user who can resolve to a stable internal ResearchOps identity through the current passwordless journey.

It does not mean team joining, role request, role approval, permission assignment, PII reveal, safeguarding visibility or audit viewer functionality is complete.
