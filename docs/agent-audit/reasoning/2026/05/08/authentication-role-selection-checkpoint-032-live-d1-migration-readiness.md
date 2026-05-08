# Agent trace checkpoint 032: live D1 migration readiness

Branch: `main`

## Status

The user asked to proceed with the live D1 migration.

The manual workflow exists on `main`:

- `.github/workflows/apply-d1-auth-foundation.yml`

The migration exists on `main`:

- `infra/cloudflare/migrations/0001_auth_foundation.sql`

## Workflow inputs required

Run the manual workflow with:

- `confirm_database_name`: `researchops-d1`
- `confirm_operation`: `APPLY_AUTH_FOUNDATION`
- `run_post_apply_checks`: `true`

## Tool boundary

The currently available GitHub connector tools can inspect repository files, commits, workflow logs, workflow jobs and workflow artifacts, but they do not expose a workflow-dispatch action.

Therefore the assistant cannot directly start the manual GitHub Actions workflow from this environment.

## Evidence required after execution

After the workflow is run, capture:

- workflow run status
- `auth_%` table list output
- seed count output for permissions, roles, role permissions and route permissions

Do not claim live D1 migration completion until the workflow succeeds and those checks are visible.
