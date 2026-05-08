# Agent trace checkpoint 037: auth runtime bootstrap complete

Branch: `feature/auth-runtime-bootstrap`

## Status

The auth runtime bootstrap slice has been implemented and is ready for pull request review.

## Files changed

- `infra/cloudflare/src/core/auth/access.js`
- `.github/workflows/bootstrap-d1-auth-runtime.yml`
- `scripts/auth-runtime-bootstrap.mjs`
- `tests/auth-runtime-bootstrap-route-state.test.js`
- `scripts/validate.sh`
- `docs/product/26/05/08/auth-runtime-bootstrap-2026-05-08.md`

## Runtime resolver change

The Cloudflare Access resolver now supports this first-admin bootstrap sequence:

1. resolve an existing user by Cloudflare Access provider subject
2. if no identity exists, resolve an existing bootstrapped user by email
3. link the Cloudflare Access provider identity to the existing user
4. if neither identity nor email exists, create a new pending user and link the identity

This prevents the first sign-in from failing when the admin user has been seeded by email before their first Cloudflare Access login.

## Bootstrap workflow

A new manual workflow exists:

```text
.github/workflows/bootstrap-d1-auth-runtime.yml
```

It requires:

```text
confirm_database_name = researchops-d1
confirm_operation = BOOTSTRAP_AUTH_RUNTIME
```

It accepts:

```text
admin_email
admin_display_name
team_id
team_name
assign_safeguarding_lead
```

The workflow generates SQL in the runner using:

```text
scripts/auth-runtime-bootstrap.mjs
```

It then applies the generated SQL to remote D1 and verifies the user, team, membership and active role keys.

## Safeguarding role boundary

`team_admin` is assigned by default.

`safeguarding_lead` is only assigned when the manual workflow input explicitly sets:

```text
assign_safeguarding_lead = true
```

## Validation coverage

A new route-state test checks:

- Access identity email fallback linking exists
- bootstrap workflow is manual-only
- bootstrap workflow requires confirmation inputs
- workflow applies and verifies generated SQL files
- bootstrap generator covers users, teams, memberships, role assignments and audit event creation

The new test is wired into `scripts/validate.sh`.

## Boundary

This slice does not run the bootstrap workflow.

This slice does not configure Cloudflare Access dashboard values or Worker secrets.

This slice does not create a public role-management UI.

## Next operational step after merge

Run `Bootstrap D1 Auth Runtime` from GitHub Actions with the intended first-admin email and team values.
