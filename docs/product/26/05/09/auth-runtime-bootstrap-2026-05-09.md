# Authentication runtime bootstrap

Date: 2026-05-09

## Purpose

The authentication foundation D1 schema is live. The runtime bootstrap slice makes it possible for a real Cloudflare Access-authenticated user to become the first active ResearchOps team admin.

This closes the gap between:

- D1 auth tables existing
- seeded roles and permissions existing
- `/api/me` resolving a real user with an active team and permissions

## Implemented behaviour

The Cloudflare Access resolver now links a first sign-in to an existing bootstrapped user by email when no provider identity exists yet.

Resolution order:

1. find user by Cloudflare Access provider subject
2. if no identity exists, find a bootstrapped user by email
3. link the Cloudflare Access identity to that existing user
4. if neither identity nor email exists, create a new pending user

This avoids duplicate-user failure when the first admin has already been seeded by email but has not yet signed in through Cloudflare Access.

## Manual bootstrap workflow

Workflow:

```text
.github/workflows/bootstrap-d1-auth-runtime.yml
```

Trigger:

```text
workflow_dispatch
```

Required confirmation inputs:

```text
confirm_database_name = researchops-d1
confirm_operation = BOOTSTRAP_AUTH_RUNTIME
```

Required runtime inputs:

```text
admin_email
admin_display_name
team_id
team_name
assign_safeguarding_lead
```

Default team values:

```text
team_id = team_researchops_core
team_name = ResearchOps Core Team
```

## Bootstrap records

The workflow creates or updates:

- one active `auth_teams` record
- one active `auth_users` record for the admin email
- one active `auth_team_memberships` record
- one active `team_admin` role assignment at team scope
- one `auth_audit_events` bootstrap event

If explicitly selected, it also creates or updates one active `safeguarding_lead` role assignment.

Safeguarding access is not assigned by default.

## SQL generation

The workflow delegates SQL generation to:

```text
scripts/auth-runtime-bootstrap.mjs
```

The script validates input shape and writes two generated files inside the runner workspace:

```text
auth-runtime-bootstrap.sql
auth-runtime-bootstrap-verify.sql
```

The generated SQL is not committed.

## Verification

The workflow runs the verification SQL against remote D1 after applying the bootstrap SQL.

It reports:

- admin email
- account status
- team ID
- team status
- membership status
- active assigned role keys

## Boundary

This slice does not create a public role-management UI.

This slice does not configure the Cloudflare Access application or Worker environment values.

This slice does not automatically assign safeguarding access.

## Required operational follow-up

Before runtime use, configure the Worker environment with the Cloudflare Access audience and cert/team-domain values consumed by the resolver.

Then run the bootstrap workflow and sign in through Cloudflare Access as the bootstrapped admin user.
