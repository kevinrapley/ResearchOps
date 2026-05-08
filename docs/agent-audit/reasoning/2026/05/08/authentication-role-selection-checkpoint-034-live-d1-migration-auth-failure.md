# Agent trace checkpoint 034: live D1 migration authentication failure

Branch: `feature/live-d1-auth-foundation-migration`

## Trigger

The user ran the manual `Apply D1 Authentication Foundation` workflow and provided the workflow log.

## Workflow execution evidence

The workflow started successfully and used the expected branch:

```text
feature/live-d1-auth-foundation-migration
```

The workflow checked out commit:

```text
5ee5636cdd38cd984033cbb810a6fa61714a4a32
```

The confirmation inputs passed:

```text
confirm_database_name = researchops-d1
confirm_operation = APPLY_AUTH_FOUNDATION
```

The migration file was present:

```text
infra/cloudflare/migrations/0001_auth_foundation.sql
```

Wrangler version was:

```text
4.34.0
```

The remote D1 target was identified as:

```text
researchops-d1 (48b35a2e-52e8-4bc0-a8cf-88a7a1536f04)
```

This matches the D1 binding in `infra/cloudflare/wrangler.toml`.

## Failure

The migration failed at the remote D1 import call:

```text
A request to the Cloudflare API (/accounts/***/d1/database/48b35a2e-52e8-4bc0-a8cf-88a7a1536f04/import) failed.
Authentication error [code: 10000]
```

Wrangler also reported:

```text
It looks like you are authenticating Wrangler via a custom API token set in an environment variable.
Please ensure it has the correct permissions for this operation.
```

## Assessment

The workflow reached the correct database and failed before applying the SQL import.

This is not evidence that the D1 migration partially applied.

Wrangler reported that failed import execution should return the database to its original state.

The likely issue is the `CF_API_TOKEN` GitHub secret. The token is valid enough for Wrangler to identify the account context, but it is not authorised for the D1 import operation.

## Required correction outside repository code

Update the GitHub Actions secret used by the workflow:

```text
CF_API_TOKEN
```

The replacement Cloudflare API token should include D1 edit permission for the account that owns:

```text
researchops-d1
```

It should be scoped to the account containing database ID:

```text
48b35a2e-52e8-4bc0-a8cf-88a7a1536f04
```

The existing repository workflow also uses:

```text
CF_ACCOUNT_ID
```

That secret should continue to match the same account.

## Do not mark complete yet

The live D1 migration remains pending.

Do not mark the migration as complete until a rerun succeeds and post-apply checks show:

- `auth_%` table list
- seeded counts for `auth_permissions`
- seeded counts for `auth_roles`
- seeded counts for `auth_role_permissions`
- seeded counts for `auth_route_permissions`

## Secondary warning

Wrangler also warned:

```text
Unexpected fields found in observability field: "persist"
```

This did not cause the migration failure. It can be cleaned up separately, but it is not blocking the D1 authentication issue.
