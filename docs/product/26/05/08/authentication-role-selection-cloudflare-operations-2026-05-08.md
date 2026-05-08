# Authentication role-selection Cloudflare operations

**Date:** 2026-05-08  
**Status:** operational implementation note  
**Related decision record:** [`authentication-role-selection-decisions-2026-05-08.md`](authentication-role-selection-decisions-2026-05-08.md)  
**Related migration:** [`../../../infra/cloudflare/migrations/0001_auth_foundation.sql`](../../../../infra/cloudflare/migrations/0001_auth_foundation.sql)  
**Related workflow:** [`../../../../.github/workflows/apply-d1-auth-foundation.yml`](../../../../.github/workflows/apply-d1-auth-foundation.yml)

## Purpose

This note records the Cloudflare operational setup for the real authentication role-selection foundation.

It covers the Worker, Cloudflare Access, D1, GitHub Actions and Wrangler path needed to turn the repository changes into live database tables and seed records.

## Implementation boundary

This work uses Cloudflare Access for identity, Workers for server-side enforcement and D1 for the ResearchOps access-control plane.

D1 is the canonical store for ResearchOps users, identities, teams, roles, permissions, assignments, route declarations and audit state.

Airtable remains the research data layer. It must not decide permissions.

Cloudflare Agents are not used to grant access, reveal participant data or make role-selection decisions. They may later support admin guidance, but access-control decisions must remain deterministic and auditable.

## Cloudflare Access runtime values

The Worker identity resolver expects Cloudflare Access to place a JWT in the `Cf-Access-Jwt-Assertion` request header.

The resolver validates:

- the Access JWT is present
- the token has three JWT segments
- the signing algorithm is `RS256`
- the token signature matches a trusted Cloudflare Access public key
- the token is not expired
- the token is not before its valid time
- the token audience matches the configured Access application audience
- the token includes a subject and email claim

The implementation uses these environment values:

| Value | Purpose |
|---|---|
| `CLOUDFLARE_ACCESS_AUD` | Preferred ResearchOps variable for the Access Application Audience tag. |
| `CF_ACCESS_AUD` | Supported fallback name for the Access Application Audience tag. |
| `CF_ACCESS_AUD_TAG` | Supported fallback name for the Access Application Audience tag. |
| `CLOUDFLARE_ACCESS_CERTS_URL` | Explicit URL for the Cloudflare Access signing keys. |
| `CF_ACCESS_CERTS_URL` | Supported fallback signing-key URL. |
| `CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Team domain used to build `https://<team-domain>/cdn-cgi/access/certs` when explicit cert URL is not provided. |

Use either an explicit certs URL or a team domain. Do not configure both with conflicting values.

## Required Worker binding

The Worker must have this D1 binding available:

| Binding | Database |
|---|---|
| `RESEARCHOPS_D1` | `researchops-d1` |

The current `infra/cloudflare/wrangler.toml` already binds `RESEARCHOPS_D1` to `researchops-d1`.

## Required GitHub secrets

The manual D1 workflow uses the same Cloudflare secret pattern as the Worker deployment workflow.

Required repository or environment secrets:

| Secret | Purpose |
|---|---|
| `CF_API_TOKEN` | Allows Wrangler to execute against Cloudflare. |
| `CF_ACCOUNT_ID` | Identifies the Cloudflare account. |

The token must have enough permission to execute D1 commands against `researchops-d1`.

## D1 migration file

The migration file is:

```text
infra/cloudflare/migrations/0001_auth_foundation.sql
```

It creates these control-plane tables:

- `auth_users`
- `auth_identities`
- `auth_teams`
- `auth_team_memberships`
- `auth_permissions`
- `auth_roles`
- `auth_role_permissions`
- `auth_role_assignments`
- `auth_permission_exceptions`
- `auth_events`
- `auth_audit_events`
- `auth_route_permissions`

It also seeds:

- 17 permission records
- 6 role records
- 15 role-permission mapping records
- 6 route-permission declaration records

The migration uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE` so it can be retried safely where the previous execution partly completed or where records already exist.

## Manual workflow for applying the migration

The manual workflow is:

```text
.github/workflows/apply-d1-auth-foundation.yml
```

It must be run manually through GitHub Actions.

Required workflow inputs:

| Input | Required value |
|---|---|
| `confirm_database_name` | `researchops-d1` |
| `confirm_operation` | `APPLY_AUTH_FOUNDATION` |
| `run_post_apply_checks` | `true` unless there is a specific reason to skip checks |

The workflow applies the SQL file using Wrangler:

```bash
npx --yes wrangler@${WRANGLER_VERSION} d1 execute "${D1_DATABASE_NAME}" \
  --remote \
  --config "${WRANGLER_CONFIG}" \
  --file "${AUTH_FOUNDATION_MIGRATION}"
```

The `--remote` flag is required. Without it, Wrangler may operate against a local D1 database rather than the deployed database.

## Post-apply checks

The workflow checks that `auth_%` tables exist:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name LIKE 'auth_%'
ORDER BY name;
```

The workflow also checks seed counts:

```sql
SELECT 'permissions' AS record_type, COUNT(*) AS total FROM auth_permissions
UNION ALL
SELECT 'roles', COUNT(*) FROM auth_roles
UNION ALL
SELECT 'role_permissions', COUNT(*) FROM auth_role_permissions
UNION ALL
SELECT 'route_permissions', COUNT(*) FROM auth_route_permissions;
```

Expected minimum counts after this migration:

| Record type | Expected count |
|---|---:|
| `permissions` | 17 |
| `roles` | 6 |
| `role_permissions` | 15 |
| `route_permissions` | 6 |

## Evidence required before claiming live D1 creation

Do not claim that the live D1 tables exist until there is evidence from one of these routes:

- successful GitHub Actions run for `Apply D1 Authentication Foundation`
- successful direct Wrangler execution against `--remote`
- successful Cloudflare API evidence showing the tables and seed records exist

The agent audit trace must be updated with the evidence source.

## First live verification checks

After successful migration, verify the real database has the expected route declarations.

```sql
SELECT method, route_pattern, required_permissions_json, auth_required, implementation_status
FROM auth_route_permissions
ORDER BY method, route_pattern;
```

The first seeded route declarations are:

| Method | Route | Required permissions |
|---|---|---|
| `GET` | `/api/me` | `[]` |
| `GET` | `/api/me/permissions` | `[]` |
| `POST` | `/api/auth/role-assignments` | `role.assign` |
| `GET` | `/api/audit/account-activity` | `[]` |
| `GET` | `/api/audit/team-events` | `audit.view` |
| `GET` | `/api/safeguarding/audit` | `safeguarding.audit.view` |

## Rollout order

Use this sequence:

1. Merge the authentication foundation PR after review.
2. Run validation and deployment checks.
3. Confirm Cloudflare Access values are configured.
4. Run the manual D1 workflow with the required confirmations.
5. Capture the workflow result in the agent audit trace.
6. Verify table and seed counts.
7. Deploy or redeploy the Worker.
8. Test `/api/me` and `/api/me/permissions` through Cloudflare Access.
9. Continue with role-management UI and wider route-permission wiring.

## Failure and retry notes

If the D1 execution fails, do not assume partial success.

Check the workflow output and rerun the post-apply checks. The migration is designed to tolerate repeat execution because table creation and seed inserts are idempotent.

If a seed count is lower than expected, stop and inspect the D1 output before continuing with Worker rollout.

If the Access JWT fails validation, check:

- the Access application audience value
- the team domain or certs URL
- whether the Worker receives `Cf-Access-Jwt-Assertion`
- whether the Access application protects the Worker route
- whether the Access signing keys have rotated

## Current status

The repository now contains the migration and the manual workflow.

The live `researchops-d1` database has not been changed by this document.

Live table creation and seeding are confirmed only after a successful workflow run or equivalent direct Cloudflare execution evidence.

## Source check

Cloudflare Access documentation says Access sends the application token in the `Cf-Access-Jwt-Assertion` request header and recommends validating that header rather than relying on the cookie.

Cloudflare D1 Wrangler documentation says `d1 execute` can execute SQL from `--command` or `--file`, and the D1 getting-started guidance shows `--remote --file` for applying schema to a deployed D1 database.
