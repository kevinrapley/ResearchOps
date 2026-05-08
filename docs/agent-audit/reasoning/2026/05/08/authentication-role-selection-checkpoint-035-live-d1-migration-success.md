# Agent trace checkpoint 035: live D1 migration success

Branch: `feature/live-d1-auth-foundation-migration`

## Status

The manual live D1 migration workflow has now succeeded.

## Workflow evidence

Workflow job:

```text
Apply authentication foundation to remote D1
```

Branch checked out by workflow:

```text
feature/live-d1-auth-foundation-migration
```

Commit checked out by workflow:

```text
5ee5636cdd38cd984033cbb810a6fa61714a4a32
```

Target database:

```text
researchops-d1
```

Target database ID:

```text
48b35a2e-52e8-4bc0-a8cf-88a7a1536f04
```

Migration file:

```text
infra/cloudflare/migrations/0001_auth_foundation.sql
```

Wrangler version:

```text
4.34.0
```

## Migration result

The workflow executed the migration against the remote database.

Wrangler reported:

```text
Total queries executed: 23
Rows read: 30
Rows written: 148
success: true
```

The database changed successfully.

## Authentication tables verified

Post-apply checks confirmed these `auth_%` tables exist:

```text
auth_audit_events
auth_events
auth_identities
auth_permission_exceptions
auth_permissions
auth_role_assignments
auth_role_permissions
auth_roles
auth_route_permissions
auth_team_memberships
auth_teams
auth_users
```

## Seed counts verified

Post-apply seed checks returned:

```text
permissions: 17
roles: 6
role_permissions: 15
route_permissions: 6
```

## Live migration state

The live D1 authentication foundation migration is complete.

## Remaining notes

Wrangler still warns that `observability.persist` is an unexpected field in `infra/cloudflare/wrangler.toml`.

That warning did not block the migration.

Node.js 20 deprecation warnings were also reported for GitHub Actions compatibility handling. That warning did not block the migration.
