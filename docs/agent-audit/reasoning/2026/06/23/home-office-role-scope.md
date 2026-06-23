# Trace — Home Office role scope and team membership separation

- Date: 2026-06-23
- Branch: `fix/home-office-role-scope`
- Trace decision: required because this is repository-affecting work on a `fix/` branch.
- Task: separate ResearchOps research roles from team identity so roles are Home Office scoped while `team_daas`, `team_home_office_biometrics` and future teams remain membership contexts.

## Operating Model

Loaded:

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
- `.agent-operating-model/github-mutation-policy.md`

Selected bundles:

- `github-diamond` at `.agent-operating-model/bundles/github/`
- `researchops-developer-control` at `.agent-operating-model/bundles/researchops-developer-control/`
- `multi-functional-team` at `.agent-operating-model/bundles/multi-functional-team/`
- `govuk-design-system` at `.agent-operating-model/bundles/govuk-design-system/`
- `cloudflare` at `.agent-operating-model/bundles/cloudflare/`

Skipped conditional bundles:

- `openai-platform`, `mcp-agent-tooling`, `airtable-public-api`, `mural-public-api`: no relevant API or agent-tooling changes.

Precedence applied:

- GitHub Diamond governed branch and validation discipline.
- ResearchOps Developer Control governed auth/runtime boundaries.
- Multi-Functional Team governed user-facing clarity around teams and roles.
- GOV.UK Design System governed account-page content and component preservation.
- Cloudflare governed D1 migration and Worker runtime handling.

## Changes

- Added `0022_home_office_role_scope.sql` to support `organisation` role scope, migrate active research delivery roles to `organisation/home_office`, and revoke active non-Team-Admin team-scoped role rows.
- Addressed PR review feedback by excluding expired active rows from migration sources and preserving effective role expiries when consolidating to `organisation/home_office`.
- Updated the base auth schema to allow `organisation` scope for role assignments and permission exceptions.
- Updated Access and passwordless session resolution so active teams come from `auth_team_memberships`, while roles and permissions resolve from active role assignments independent of selected team.
- Updated participant contact reveal authorization so organisation-scoped Home Office roles with `participant.pii.reveal` are accepted by the reveal endpoint, matching `/api/me` permissions.
- Kept passwordless email delivery changes outside this branch so the PR remains focused on Home Office role and team scope.
- Kept `team_admin` team-scoped because it administers a specific team.
- Updated role assignment so assigning Researcher, Research Lead, Observer, Approver or Safeguarding Lead creates or restores team membership but writes the role assignment at Home Office scope.
- Updated the account page to show Home Office roles separately from team memberships.
- Updated route-state and contract tests for the new role/team separation.
- Updated D1 migration ordering documentation so the next main migration prefix is `0023`.

## Validation

- `node --check` passed for changed auth and account JavaScript files.
- `npm run build:govuk-pages` passed.
- Focused auth/account route-state and contract tests passed.
- Focused participant reveal route-state test passed.
- Full main SQLite migration chain through `0022_home_office_role_scope.sql` passed.
- `npm test` passed: 245 tests.
- `npm run lint` passed with existing repository warnings.
- `npm run trace:coverage` passed.
- `git diff --check` passed.

## Residual Risk

- The live Cloudflare D1 database was not mutated in this task. The new migration must be applied through the normal deployment/migration route before live data changes.
- Historical docs still contain earlier team-scoped role discussion as audit history; this trace records the current correction.
