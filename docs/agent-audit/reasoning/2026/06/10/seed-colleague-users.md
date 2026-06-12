# Seed colleague users trace

- Date: 2026-06-10
- Repository: ResearchOps
- Branch: fix/seed-colleague-auth-users
- Pull request: 395

## Summary

Adds D1 migrations and a guarded apply workflow for colleague access records.

The first migration seeds active colleague accounts, requested roles and audit events without sending notification emails or creating sign-in codes.

The second migration responds to the Codex review: current project visibility and auth context are team-key based, so Test Project 1 users also need an active visible team context. The migration creates the Home Office Biometrics team, adds Test Project 1 users to that team and mirrors their active Test Project 1 project-scoped role assignments to that team so the current auth context can surface them.

## Files changed

- infra/cloudflare/migrations/0020_seed_colleague_auth_users.sql
- infra/cloudflare/migrations/0021_bridge_test_project_1_users_to_visible_team_scope.sql
- .github/workflows/apply-d1-colleague-auth-users.yml
- docs/deployment/d1-migration-ordering.md
- docs/agent-audit/reasoning/2026/06/10/seed-colleague-users.md
- docs/agent-audit/reasoning/2026/06/10/seed-colleague-users-data.json

## Validation

Pending CI.
