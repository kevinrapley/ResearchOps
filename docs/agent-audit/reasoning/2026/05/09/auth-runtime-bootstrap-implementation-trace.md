# Agent trace: auth runtime bootstrap implementation

> This is the implementation trace for the authentication role-selection runtime bootstrap slice started on 2026-05-09. It records the plan, implementation, boundaries and required follow-up in a single slice-level trace rather than continuing checkpoint numbering from the previous D1 migration slice.

## Metadata

- Date: 2026-05-09
- Branch: `feature/auth-runtime-bootstrap`
- Slice: `auth-runtime-bootstrap`
- Previous slice: live D1 authentication foundation migration
- Previous slice status: complete and merged through PR #216
- Current PR: #217

## Correction applied

The first version of this slice incorrectly created files under 2026-05-08 paths and continued checkpoint numbering from the previous authentication slice.

That was wrong because this is a new slice on 2026-05-09.

Corrected structure:

- product documentation now lives under `docs/product/26/05/09/`
- this slice has one consolidated markdown trace
- this slice has one accompanying JSON trace
- checkpoint files `036` and `037` under the 2026-05-08 trace directory are removed

## Purpose

The live D1 authentication foundation exists, but runtime use still needs a safe way to seed the first real team admin.

This slice implements that bridge.

It allows a maintainer to seed:

- an active `auth_users` record
- an active `auth_teams` record
- an active `auth_team_memberships` record
- an active `team_admin` role assignment at team scope
- an optional `safeguarding_lead` role assignment only when explicitly selected

## Design issue

The Cloudflare Access resolver originally resolved users by provider subject.

That is correct after first sign-in, but it creates a bootstrap gap. A manual bootstrap workflow can know the first admin email before sign-in, but it cannot know the Cloudflare Access provider subject until after sign-in.

The resolver therefore needs an email-linking path.

## Resolver behaviour implemented

The resolver now uses this sequence:

1. find a user by Cloudflare Access provider subject
2. if no identity exists, find an existing bootstrapped user by email
3. link the Cloudflare Access identity to that existing user
4. if neither identity nor email exists, create a new pending user and link the identity

This prevents duplicate-user failure when the first admin has already been seeded by email but has not yet signed in through Cloudflare Access.

## Manual bootstrap workflow implemented

New workflow:

```text
.github/workflows/bootstrap-d1-auth-runtime.yml
```

The workflow is manual-only:

```text
workflow_dispatch
```

Required confirmation inputs:

```text
confirm_database_name = researchops-d1
confirm_operation = BOOTSTRAP_AUTH_RUNTIME
```

Runtime inputs:

```text
admin_email
admin_display_name
team_id
team_name
assign_safeguarding_lead
```

The workflow generates SQL using:

```text
scripts/auth-runtime-bootstrap.mjs
```

It then applies generated SQL to remote D1 and runs generated verification SQL.

## SQL generator implemented

New script:

```text
scripts/auth-runtime-bootstrap.mjs
```

The script validates:

- admin email shape
- team ID shape
- display name length
- team name length

It writes generated SQL files inside the runner workspace:

```text
auth-runtime-bootstrap.sql
auth-runtime-bootstrap-verify.sql
```

The generated SQL files are not committed.

## Deterministic bootstrap ID review fix

A PR review comment identified that the original deterministic membership and assignment IDs were derived from `team_id` only.

That meant bootstrapping a different `admin_email` into the same team could reuse these primary keys:

```text
mem_bootstrap_${teamSuffix}
asn_bootstrap_team_admin_${teamSuffix}
```

The unique constraints on `(user_id, team_id)` and `(user_id, role_id, scope_type, scope_id)` would not handle a primary-key conflict on `id`, so D1 could abort instead of creating the replacement admin record.

The generator has been changed so membership and assignment IDs include both team and user material plus a deterministic digest:

```text
principalDigest = sha256(teamId:email).slice(0, 16)
principalSuffix = teamSuffix_userSuffix_principalDigest
membershipId = mem_bootstrap_${principalSuffix}
teamAdminAssignmentId = asn_bootstrap_team_admin_${principalSuffix}
safeguardingAssignmentId = asn_bootstrap_safeguarding_${principalSuffix}
```

The user ID also includes an email-derived digest:

```text
usr_bootstrap_${userSuffix}_${stableDigest(email)}
```

This keeps reruns for the same user and team idempotent while avoiding collisions when bootstrapping a different admin email into the same team.

Validation coverage was updated to assert that the generator uses `stableDigest`, `teamSuffix`, `userSuffix` and `principalSuffix` for deterministic IDs.

## Safeguarding boundary

`team_admin` is assigned by default.

`safeguarding_lead` is not assigned by default.

It is only assigned if the workflow input explicitly sets:

```text
assign_safeguarding_lead = true
```

## Validation implemented

New route-state test:

```text
tests/auth-runtime-bootstrap-route-state.test.js
```

Validation coverage checks:

- Access identity email fallback linking exists
- bootstrap workflow is manual-only
- confirmation inputs are required
- generated SQL files are applied and verified
- bootstrap generator covers users, teams, memberships, role assignments and audit event creation
- deterministic membership and assignment IDs include both team and user material

The test is wired into:

```text
scripts/validate.sh
```

## Product documentation

Product documentation now lives at:

```text
docs/product/26/05/09/auth-runtime-bootstrap-2026-05-09.md
```

## Files changed in this slice

- `infra/cloudflare/src/core/auth/access.js`
- `.github/workflows/bootstrap-d1-auth-runtime.yml`
- `scripts/auth-runtime-bootstrap.mjs`
- `tests/auth-runtime-bootstrap-route-state.test.js`
- `scripts/validate.sh`
- `docs/product/26/05/09/auth-runtime-bootstrap-2026-05-09.md`
- `docs/agent-audit/reasoning/2026/05/09/auth-runtime-bootstrap-implementation-trace.md`
- `docs/agent-audit/reasoning/2026/05/09/auth-runtime-bootstrap-implementation-trace.json`

## Boundary

This slice does not run the bootstrap workflow.

This slice does not configure Cloudflare Access dashboard values or Worker secrets.

This slice does not create a public role-management UI.

This slice does not widen route-permission coverage beyond the existing identity routes.

## Required operational follow-up after merge

After this PR is merged, run `Bootstrap D1 Auth Runtime` from GitHub Actions with the intended first-admin email and team values.

Then sign in through Cloudflare Access as the bootstrapped user and verify `/api/me` and `/api/me/permissions` return the expected active team, roles and permissions.
