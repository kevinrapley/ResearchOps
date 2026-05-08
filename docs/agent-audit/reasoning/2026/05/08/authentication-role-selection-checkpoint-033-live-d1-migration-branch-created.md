# Agent trace checkpoint 033: live D1 migration branch created

Branch: `feature/live-d1-auth-foundation-migration`

## Trigger

The user directed that D1 migration work must continue on a branch rather than by committing directly to `main`.

## Branch created

A new branch was created from `main` commit:

```text
5ee2a8f0c9caf248052c7152f5e0abb6ed01b2df
```

Branch name:

```text
feature/live-d1-auth-foundation-migration
```

## Purpose

Use this branch to track live D1 migration execution evidence, runbook notes, and any follow-up corrections needed for the authentication role-selection D1 foundation.

## Existing migration workflow

The live D1 migration workflow already exists on `main` and therefore exists on this branch:

```text
.github/workflows/apply-d1-auth-foundation.yml
```

Required workflow inputs:

```text
confirm_database_name = researchops-d1
confirm_operation = APPLY_AUTH_FOUNDATION
run_post_apply_checks = true
```

## Tool boundary

The current GitHub connector exposes repository and workflow inspection tools, but it does not expose a workflow-dispatch action.

Therefore this assistant cannot directly start the manual GitHub Actions workflow from the available tool surface.

## Evidence required after manual execution

After the workflow is run, capture:

- workflow run status
- table list for `auth_%`
- seed counts for `auth_permissions`, `auth_roles`, `auth_role_permissions` and `auth_route_permissions`

Do not mark the live D1 migration complete until those checks are visible and successful.
