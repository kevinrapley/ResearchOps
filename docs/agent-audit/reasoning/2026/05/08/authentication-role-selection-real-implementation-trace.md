# Agent trace: authentication role-selection real implementation

> This is an auditable trace for repository-affecting work triggered by `[reasoning]`. It records what happened, what was changed, what was paused, and what must be corrected before continuing. It does not expose private chain-of-thought.

## Run metadata

- Trace ID: `atrace-20260508-authentication-role-selection-real-implementation`
- Date: 2026-05-08
- Repository: `kevinrapley/ResearchOps`
- Active branch: `feature/auth-foundation-real-d1-current-main`
- Base branch: `main`
- Base commit at branch creation: `8305adeed3b7e4047f132bc8c50347ce47e6205f`
- Trigger token detected: `[reasoning]`
- Trace layer: `operational`

## User task summary

The user asked to begin systematically building authentication role selection into the application using all captured documentation.

The user then corrected the course by stating that this must not be a mock implementation. A prior branch had recorded the correction and the work was restarted from current `main` on `feature/auth-foundation-real-d1-current-main`.

The user then raised a trace governance concern: trace records must be continuously updated as the build progresses, rather than reconstructed at the end.

The user then clarified that the work must not become trace-only or document-only. It must systematically build the real authentication role-selection capability, including D1 table creation and seeding where necessary.

## Operating-model sources loaded before repository-affecting work

The repository operating model had already been loaded during this workstream from the following files:

- `AGENTS.md`
- `.agent-operating-model/orchestration.xml`
- `.agent-operating-model/bundle-registry.json`
- `.agent-operating-model/task-signal-catalog.json`
- `.agent-operating-model/selection-rules.json`
- `.agent-operating-model/bootstrap-checklist.md`
- `.agent-operating-model/precedence-policy.md`
- `.agent-operating-model/trace-policy.md`
- `.agent-operating-model/trace-layers.md`
- `.agent-operating-model/behavioural-evals.json`
- `docs/devops/ResearchOps-Bundle-Setup.zip`

## Selected bundles

Selected bundles:

- `github-diamond`
- `researchops-developer`
- `gov-product-assistant-gold-standard`
- `govuk-design-system`
- `cloudflare-core-developer`
- `airtable-public-api-developer`

Selection rationale:

- `github-diamond` applies because the task creates branch changes and will lead to a PR.
- `researchops-developer` applies because the task changes the ResearchOps platform architecture.
- `gov-product-assistant-gold-standard` applies because the task affects governance, personal data, safeguarding and assurance.
- `govuk-design-system` applies because account, role and permission UI are in scope for the wider implementation.
- `cloudflare-core-developer` applies because Worker, D1 and Cloudflare Access are in scope.
- `airtable-public-api-developer` applies because the implementation must protect Airtable behind Worker authorisation.

## Skipped bundles

Skipped bundle:

- `mural-public-api-developer`

Skip rationale:

- No Mural OAuth, workspace, room, board, widget or sticky-note implementation is in scope for this authentication slice.

## Precedence decisions

- GitHub Diamond governs branch hygiene, atomic changes, validation evidence and PR discipline.
- ResearchOps Developer governs the platform architecture and service boundary.
- Gold Standard Gov Product Assistant governs personal data, safeguarding, governance and service assurance risk.
- GOV.UK Design System governs UI and accessibility when UI changes begin.
- Cloudflare Core Developer governs Worker, D1, Access JWT and binding behaviour.
- Airtable Public API governs the boundary that Airtable remains a data layer and not an authorisation engine.

## Branch hygiene

- The earlier branch `feature/auth-foundation-d1-rbac-current-main` diverged from `main` after new commits landed.
- A fresh branch, `feature/auth-foundation-real-d1-current-main`, was created from current `main` commit `8305adeed3b7e4047f132bc8c50347ce47e6205f`.
- No force update was used.

## Files changed so far on this branch

Current implementation files created or modified:

- `infra/cloudflare/migrations/0001_auth_foundation.sql`
- `infra/cloudflare/src/core/auth/access.js`
- `infra/cloudflare/src/core/auth/route-permissions.js`
- `infra/cloudflare/src/worker.js`
- `tests/auth-foundation-route-state.test.js`
- `tests/auth-route-permissions.test.js`
- `docs/agent-audit/reasoning/2026/05/08/authentication-role-selection-real-implementation-trace.md`

## Implementation checkpoint 1: D1 auth foundation migration

File created:

- `infra/cloudflare/migrations/0001_auth_foundation.sql`

Purpose:

- Create the D1 control-plane schema for real authentication and role selection.

Schema coverage:

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

Decision coverage:

- D1 is the canonical control plane.
- `scope_type` and `scope_id` are present from the first schema.
- First enforceable scope can be team while project and study scope are supported structurally.
- Sensitive permissions are represented separately.
- Reserved export permissions are represented without implementing export.
- General audit and safeguarding audit are separate permissions.

## Implementation checkpoint 2: Cloudflare Access identity resolver

File created:

- `infra/cloudflare/src/core/auth/access.js`

Purpose:

- Resolve a real authenticated identity from the `Cf-Access-Jwt-Assertion` header.
- Validate the Access JWT signature using Cloudflare Access certificates.
- Validate token expiry and audience.
- Map the validated provider identity to a D1 ResearchOps user.
- Return active team, roles and permissions from D1.

Non-goals:

- It does not create mock identity behaviour.
- It does not implement password authentication.
- It does not implement role-management UI.
- It does not change Airtable schema.

## Implementation checkpoint 3: Worker route wiring

File modified:

- `infra/cloudflare/src/worker.js`

Purpose:

- Route `GET /api/me` and `GET /api/me/permissions` through the real Cloudflare Access identity resolver.
- Add `X-ResearchOps-Team-Id` to allowed request headers so an authenticated user can select an active team context.

## Implementation checkpoint 4: Auth foundation route tests

File created:

- `tests/auth-foundation-route-state.test.js`

Purpose:

- Confirm the identity routes fail closed without `Cf-Access-Jwt-Assertion`.
- Confirm Worker route wiring sends `/api/me` and `/api/me/permissions` through `core/auth/access.js`.
- Confirm no mock identity mode exists in `core/auth/access.js`.
- Confirm the D1 migration contains the required control-plane tables, scoped role fields and reserved permissions.

Test coverage currently asserted:

- `GET /api/me` returns `401` without an Access JWT.
- `GET /api/me/permissions` returns `401` without an Access JWT.
- Worker source imports and routes to `handleMeRoute`.
- Auth resolver source contains no `RESEARCHOPS_AUTH_MODE`, `MOCK` or `mock` identity branch.
- Migration contains required auth control-plane tables.
- Migration contains `scope_type`, `scope_id`, `safeguarding.audit.view`, `audit.export` and `participant.pii.export`.

## Implementation checkpoint 5: route-permission middleware plan

Planned file before creation:

- `infra/cloudflare/src/core/auth/route-permissions.js`

Purpose:

- Add a small real authorisation helper that reads declared route permissions from D1.
- Fail closed when a protected route has no declaration.
- Deny access where the authenticated context lacks a required permission.
- Avoid exposing missing permission codes to ordinary users.

Boundary for this step:

- Do not wire the helper into every existing product route yet.
- Do not create mock users or mock roles.
- Do not change Airtable behaviour yet.
- Keep the slice small and testable.

## Implementation checkpoint 6: route-permission helper created

File created:

- `infra/cloudflare/src/core/auth/route-permissions.js`

Purpose:

- Read route declarations from `auth_route_permissions` in D1.
- Fail closed where no route permission declaration exists.
- Check an authenticated context for required permissions.
- Return ordinary permission-denied responses without exposing missing permission codes.
- Allow diagnostics to include details only when explicitly requested by the caller.

Current boundary:

- The helper is not yet wired into existing product routes.
- It does not create users or roles.
- It does not change Airtable behaviour.

## Implementation checkpoint 7: route-permission helper tests

File created:

- `tests/auth-route-permissions.test.js`

Purpose:

- Confirm declared route permissions can be resolved from a D1-style binding.
- Confirm protected routes fail closed when no route declaration exists.
- Confirm missing permissions are denied without exposing missing permission codes to ordinary users.
- Confirm diagnostics can include missing permission codes only when explicitly requested.
- Confirm a matching permission allows the route.

Test coverage currently asserted:

- route declarations resolve method, route pattern, required permissions and auth state
- missing route declarations produce `route_permission_missing`
- ordinary permission-denied responses do not contain `details`
- diagnostic permission-denied responses can include `missingPermissions`
- matching permission `audit.view` allows `/api/audit/team-events`

## Real D1 implementation requirement

The current SQL migration is a real D1 migration file, but creating the migration file in the repository is not the same as applying it to the live D1 database.

The build must include a safe path to apply the migration to the real `researchops-d1` database that is bound as `RESEARCHOPS_D1` in `infra/cloudflare/wrangler.toml`.

Required next implementation controls:

- Add or confirm a controlled Wrangler command path for applying `infra/cloudflare/migrations/0001_auth_foundation.sql` to the remote D1 database.
- Prefer a manual `workflow_dispatch` or explicitly documented maintainer command rather than an automatic push-time migration.
- Ensure the seed records in the migration create permissions, roles, role-permission mappings and route permission declarations.
- Do not claim live D1 tables have been created until Wrangler migration output or other direct Cloudflare evidence confirms it.

Tool boundary:

- The current available tool access is GitHub repository access.
- Direct Cloudflare execution has not been performed through this assistant turn.
- Therefore live D1 creation cannot be claimed yet.

## Trace governance correction

The user raised a valid governance concern that trace records were not being continuously updated as implementation proceeded.

Correction now applied:

- this trace checkpoint exists on the active implementation branch
- the test file was created only after the first trace checkpoint was recorded
- this trace was updated immediately after the test file was created
- the route-permission middleware plan was recorded before creating that file
- the trace was updated after route-permission helper creation
- the route-permission test creation was recorded immediately after the file was created
- the real D1 application requirement has now been recorded explicitly
- future implementation steps must update this trace before or alongside code changes
- future responses should report both implementation progress and trace updates

## Process issue recorded

`AGENTS.md` says commits should be incremental and atomic with a diff of no more than 300 lines.

Current issue:

- the Access identity resolver commit has more than 300 added lines
- this should be treated as a process deviation

Correction for future steps:

- split future changes into smaller files and smaller commits
- update this trace as each implementation step completes
- do not batch large design and code changes without a trace checkpoint

## Validation not yet claimed

No local lint, format, typecheck, test or build result is claimed at this checkpoint.

The test files have been created but not yet executed in this environment.

## Pending next steps

The next implementation slice should be small and trace-updated before or alongside changes.

Candidate next steps:

- add a controlled remote D1 migration application path
- document environment variables required for Cloudflare Access JWT validation
- consider splitting the Access resolver into smaller modules if PR review flags the earlier large commit

## Residual risks

- Cloudflare Access JWT validation depends on environment configuration for Access certificates and audience.
- The D1 migration has not yet been run in an environment.
- The route wiring has not yet been validated by test execution.
- The implementation is not yet protected by a route-permission middleware for wider product routes.
- No PR has been opened for this branch yet.
