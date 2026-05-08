# Agent trace checkpoint 036: auth runtime bootstrap plan

Branch: `feature/auth-runtime-bootstrap`

## Trigger

The user asked to create a new branch, implement the next authentication role-selection work, and finalise with a PR.

## Slice

`auth-runtime-bootstrap`

## Purpose

Make the live D1 authentication foundation usable by a real Cloudflare Access-authenticated user.

The D1 schema and seed migration are already live. The remaining bootstrap gap is that a real user needs:

- an active `auth_users` record
- an active `auth_teams` record
- an active `auth_team_memberships` record
- an active `team_admin` role assignment at team scope
- optional explicit `safeguarding_lead` role assignment if confirmed

## Key design issue

The existing Access resolver finds users by Cloudflare Access provider subject.

A bootstrap workflow can only safely seed a user by email before first login. Therefore the resolver must support this sequence:

1. Cloudflare Access user signs in for the first time.
2. No `auth_identities` record exists yet for their provider subject.
3. A seeded `auth_users` row exists for the same email.
4. The resolver links the Cloudflare Access identity to that existing user instead of trying to create a duplicate user email.

## Planned implementation files

- `infra/cloudflare/src/core/auth/access.js`
- `.github/workflows/bootstrap-d1-auth-runtime.yml`
- `tests/auth-runtime-bootstrap-route-state.test.js`
- `scripts/validate.sh`
- `docs/product/26/05/08/auth-runtime-bootstrap-2026-05-08.md`

## Planned behaviour

### Access resolver

Add email fallback linking:

- find by provider subject first
- if no identity exists, find active or pending user by email
- link Cloudflare Access identity to that existing user
- only create a new pending user when neither identity nor email exists

### Manual bootstrap workflow

Create a `workflow_dispatch` workflow that:

- requires `confirm_database_name = researchops-d1`
- requires `confirm_operation = BOOTSTRAP_AUTH_RUNTIME`
- requires an `admin_email`
- accepts `admin_display_name`, `team_id`, `team_name`, `assign_safeguarding_lead`
- validates input shape before writing SQL
- generates SQL with Python escaping rather than raw shell interpolation
- applies the SQL to remote D1
- runs verification checks

## Boundary

This slice does not create a public role-management UI.

This slice does not automatically assign safeguarding access unless explicitly requested in the workflow input.

This slice does not configure Cloudflare Access application values in the Cloudflare dashboard.
