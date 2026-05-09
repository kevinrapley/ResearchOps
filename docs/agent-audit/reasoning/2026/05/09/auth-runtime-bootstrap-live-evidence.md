# Agent trace: auth runtime bootstrap live evidence

This is a small evidence trace for the live authentication runtime bootstrap completed after PR #217 was merged.

## Metadata

- Date: 2026-05-09
- Branch: `trace/auth-runtime-bootstrap-evidence`
- Related PR: #217, `Bootstrap authentication runtime admin access`
- PR #217 merge commit: `cc2bc9c52523d0928a0f34a08ecbbef6d302fbc9`
- Runtime workflow: `Bootstrap D1 Auth Runtime`
- Target database: `researchops-d1`
- Target team: `team_researchops_core`

## Status

The first Team Admin was seeded through the `Bootstrap D1 Auth Runtime` workflow after PR #217 was merged into `main`.

Runtime verification output supplied by the repository owner shows one active user profile in `auth_users` and active permissions scoped to `team_researchops_core`.

## User evidence

The `auth_users` verification showed:

```text
account_status = active
created_at = 2026-05-09T00:40:07.629Z
updated_at = 2026-05-09T00:40:07.629Z
```

The user email is deliberately not recorded in this repository trace.

## Role and permission evidence

The runtime permission check showed:

```text
active_roles = 2
permissions = 7
permission_exceptions = 0
scope = team_researchops_core
```

Active roles:

```text
safeguarding_lead
team_admin
```

Permissions confirmed for `safeguarding_lead`:

```text
safeguarding.view
safeguarding.record
safeguarding.resolve
safeguarding.audit.view
```

Permissions confirmed for `team_admin`:

```text
team.manage
role.assign
audit.view
```

## Safeguarding role note

The live bootstrap evidence shows the first admin holds `safeguarding_lead` as well as `team_admin`.

This is valid only if the bootstrap workflow was intentionally run with safeguarding assignment enabled, or if an equivalent deliberate assignment was made.

If safeguarding access was not intended, a follow-up role-removal operation should remove the `safeguarding_lead` assignment from the first admin.

## Evidence boundary

This trace records user-supplied runtime verification evidence.

It does not include screenshots, raw email address, provider subject, or Cloudflare configuration values.

This trace does not prove that `/api/me` and `/api/me/permissions` were called through the deployed Worker. It records D1-side bootstrap state and permission/role verification evidence.

## Current authentication role-selection state

The platform now has:

- live D1 authentication foundation
- active first admin user
- active core team
- active first admin team membership
- active `team_admin` role
- active `safeguarding_lead` role where intentionally assigned
- runtime bootstrap workflow merged into `main`

## Next implementation slice

The next implementation slice should be:

```text
POST /api/auth/role-assignments
```

Purpose:

- allow an authenticated Team Admin with `role.assign` to assign roles to users in their active team
- record the role assignment in `auth_audit_events`
- require explicit safeguards before assigning sensitive roles such as `safeguarding_lead`

Recommended branch:

```text
feature/auth-role-assignment-api
```
