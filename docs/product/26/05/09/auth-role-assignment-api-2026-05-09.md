# Authentication role assignment API

Date: 2026-05-09

## Purpose

The authentication runtime bootstrap has created a real first Team Admin in D1. This slice adds the first managed role-assignment capability so that role changes no longer depend only on manual bootstrap SQL.

The endpoint is:

```text
POST /api/auth/role-assignments
```

## Runtime behaviour

The Worker route resolves the authenticated Cloudflare Access user, checks the active team context and then checks route permissions against D1.

The route requires:

```text
role.assign
```

A caller without `role.assign` receives `403` without internal permission diagnostics.

## Request body

The endpoint accepts a JSON object.

Required target field:

```text
targetUserId
```

or:

```text
targetEmail
```

Required role field:

```text
roleKey
```

Required reason field:

```text
requestedReason
```

Optional expiry field:

```text
expiresAt
```

## Sensitive role confirmation

Sensitive roles require explicit confirmation.

For any sensitive role, the request must include:

```text
sensitiveRoleConfirmation = ASSIGN_SENSITIVE_ROLE
```

For `safeguarding_lead`, the request must also include:

```text
safeguardingConfirmation = ASSIGN_SAFEGUARDING_LEAD
```

This prevents accidental assignment of high-risk access during the early role-management phase.

## Scope

Assignments created by this endpoint are scoped to the caller's active team.

The target user must already be an active member of that team.

This endpoint does not create users or team memberships.

## Database writes

The endpoint creates or reactivates records in:

```text
auth_role_assignments
```

It records each successful assignment in:

```text
auth_audit_events
```

The audit event uses:

```text
event_type = auth.role_assignment.created
permission_code = role.assign
outcome = succeeded
```

Safeguarding lead assignment audit events are marked as safeguarding-related.

## D1 route status migration

A small migration marks the route declaration as implemented:

```text
infra/cloudflare/migrations/0002_auth_role_assignment_route.sql
```

A manual workflow applies that route-status migration to remote D1:

```text
.github/workflows/apply-d1-auth-role-assignment-route.yml
```

Required confirmation inputs:

```text
confirm_database_name = researchops-d1
confirm_operation = APPLY_AUTH_ROLE_ASSIGNMENT_ROUTE
```

## Boundary

This slice does not create a role-management UI.

This slice does not create users.

This slice does not create team memberships.

This slice does not support cross-team assignment.

This slice does not assign permission exceptions.

## Operational follow-up after merge

After merge, run the route-status workflow to update remote D1 from `deferred` to `implemented` for:

```text
POST /api/auth/role-assignments
```

Then test the endpoint as the seeded Team Admin with `role.assign`.
