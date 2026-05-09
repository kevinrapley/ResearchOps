# Agent trace: auth role assignment API implementation

Date: 2026-05-09

Branch: `feature/auth-role-assignment-api`

Slice: `auth-role-assignment-api`

Previous slice: auth runtime bootstrap live evidence, merged through PR #218.

## Purpose

The first Team Admin has been bootstrapped in live D1. This slice adds the first managed role-assignment API so role access can move from manual bootstrap toward controlled application behaviour.

Endpoint implemented:

```text
POST /api/auth/role-assignments
```

## Runtime route behaviour

The Worker now wires `POST /api/auth/role-assignments` to:

```text
infra/cloudflare/src/core/auth/role-assignments.js
```

The handler:

1. resolves the authenticated Cloudflare Access user
2. resolves the active team context
3. checks the D1 route-permission declaration
4. requires the caller to hold `role.assign`
5. validates the request body
6. verifies the target user exists
7. verifies the target user is an active member of the caller's active team
8. creates or reactivates the role assignment at team scope
9. records an audit event

## Permission model

The route uses the existing D1 route declaration:

```text
method = POST
route_pattern = /api/auth/role-assignments
required_permissions_json = ["role.assign"]
```

A user without `role.assign` receives `403` from the route-permission layer without internal diagnostic details.

## Request requirements

The request must include either `targetUserId` or `targetEmail`.

It must also include:

```text
roleKey
requestedReason
```

`expiresAt` is optional and must be a valid ISO-8601 date-time when provided.

## Sensitive role guard

Sensitive roles require explicit confirmation:

```text
sensitiveRoleConfirmation = ASSIGN_SENSITIVE_ROLE
```

The `safeguarding_lead` role also requires:

```text
safeguardingConfirmation = ASSIGN_SAFEGUARDING_LEAD
```

This prevents accidental escalation to sensitive or safeguarding access.

## Scope boundary

Role assignments are scoped to the caller's active team.

The target user must already have an active membership in that team.

This endpoint does not create users, teams or memberships.

## Database writes

Successful assignment writes to:

```text
auth_role_assignments
```

The write is idempotent against the unique key:

```text
(user_id, role_id, scope_type, scope_id)
```

Successful assignment also writes to:

```text
auth_audit_events
```

Audit event values include:

```text
event_type = auth.role_assignment.created
permission_code = role.assign
outcome = succeeded
```

`is_safeguarding` is set when assigning `safeguarding_lead`.

## D1 route-status migration

A migration has been added:

```text
infra/cloudflare/migrations/0002_auth_role_assignment_route.sql
```

It marks the D1 route declaration as implemented.

A manual workflow has been added to apply this operational update after merge:

```text
.github/workflows/apply-d1-auth-role-assignment-route.yml
```

Required workflow inputs:

```text
confirm_database_name = researchops-d1
confirm_operation = APPLY_AUTH_ROLE_ASSIGNMENT_ROUTE
run_post_apply_checks = true
```

## Validation

A route-state test has been added:

```text
tests/auth-role-assignment-api-route-state.test.js
```

The test checks Worker route wiring, authentication and route-permission use, active-team scoping, target user and reason validation, sensitive and safeguarding confirmation requirements, assignment writes, audit writes and D1 route-status migration intent.

## Product documentation

Product documentation lives at:

```text
docs/product/26/05/09/auth-role-assignment-api-2026-05-09.md
```

## Files changed in this slice

- `infra/cloudflare/src/core/auth/role-assignments.js`
- `infra/cloudflare/src/worker.js`
- `infra/cloudflare/migrations/0002_auth_role_assignment_route.sql`
- `.github/workflows/apply-d1-auth-role-assignment-route.yml`
- `tests/auth-role-assignment-api-route-state.test.js`
- `scripts/validate.sh`
- `docs/product/26/05/09/auth-role-assignment-api-2026-05-09.md`
- `docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-api-implementation-trace.md`
- `docs/agent-audit/reasoning/2026/05/09/auth-role-assignment-api-implementation-trace.json`

## Boundary

This slice does not create a role-management UI.

This slice does not create users or team memberships.

This slice does not support cross-team role assignment.

This slice does not assign permission exceptions.

This slice does not run the route-status workflow.

## Required operational follow-up after merge

After merge, run `Apply D1 Auth Role Assignment Route` from GitHub Actions to mark the route declaration as implemented in live D1.

Then test `POST /api/auth/role-assignments` as the seeded Team Admin.
