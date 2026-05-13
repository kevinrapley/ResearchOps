-- Preview-only first Team Admin seed
-- Date: 2026-05-13
-- Scope: seed the ResearchOps preview D1 database with Kevin's first Team Admin account.
-- This file must only be applied to preview D1 deployments.

PRAGMA foreign_keys = ON;

INSERT INTO auth_users (id, email, display_name, account_status)
VALUES (
  'usr_preview_first_team_admin_kevin_rapley',
  'digikev.kevin.rapley@gmail.com',
  'Kevin',
  'active'
)
ON CONFLICT(email) DO UPDATE SET
  display_name = 'Kevin',
  account_status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_teams (id, name, team_status)
VALUES (
  'team_researchops_core',
  'ResearchOps Core Team',
  'active'
)
ON CONFLICT(id) DO UPDATE SET
  name = 'ResearchOps Core Team',
  team_status = 'active',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_team_memberships (id, user_id, team_id, membership_status, removed_at)
SELECT
  'mbr_preview_first_team_admin_kevin_researchops_core',
  u.id,
  'team_researchops_core',
  'active',
  NULL
FROM auth_users u
WHERE lower(u.email) = lower('digikev.kevin.rapley@gmail.com')
ON CONFLICT(user_id, team_id) DO UPDATE SET
  membership_status = 'active',
  removed_at = NULL;

INSERT INTO auth_role_assignments (
  id,
  user_id,
  role_id,
  scope_type,
  scope_id,
  assignment_status,
  requested_reason,
  approved_by_user_id,
  approved_at,
  expires_at
)
SELECT
  'asn_preview_first_team_admin_kevin_team_admin',
  u.id,
  'role_team_admin',
  'team',
  'team_researchops_core',
  'active',
  'Preview bootstrap: first Team Admin account for ResearchOps preview D1.',
  u.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  NULL
FROM auth_users u
WHERE lower(u.email) = lower('digikev.kevin.rapley@gmail.com')
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
  assignment_status = 'active',
  requested_reason = 'Preview bootstrap: first Team Admin account for ResearchOps preview D1.',
  approved_by_user_id = excluded.approved_by_user_id,
  approved_at = excluded.approved_at,
  expires_at = NULL,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_role_assignments (
  id,
  user_id,
  role_id,
  scope_type,
  scope_id,
  assignment_status,
  requested_reason,
  approved_by_user_id,
  approved_at,
  expires_at
)
SELECT
  'asn_preview_first_team_admin_kevin_safeguarding_lead',
  u.id,
  'role_safeguarding_lead',
  'team',
  'team_researchops_core',
  'active',
  'Preview bootstrap: Safeguarding Lead access for first Team Admin account.',
  u.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  NULL
FROM auth_users u
WHERE lower(u.email) = lower('digikev.kevin.rapley@gmail.com')
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
  assignment_status = 'active',
  requested_reason = 'Preview bootstrap: Safeguarding Lead access for first Team Admin account.',
  approved_by_user_id = excluded.approved_by_user_id,
  approved_at = excluded.approved_at,
  expires_at = NULL,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO auth_audit_events (
  id,
  event_type,
  actor_user_id,
  team_id,
  target_type,
  target_id,
  permission_code,
  route_path,
  field_group,
  outcome,
  is_safeguarding,
  metadata_json
)
SELECT
  'aud_preview_first_team_admin_seed_kevin',
  'auth.preview_first_team_admin.seeded',
  u.id,
  'team_researchops_core',
  'auth_users',
  u.id,
  'role.assign',
  '.github/workflows/deploy-worker.yml',
  'preview-bootstrap',
  'succeeded',
  0,
  '{"email":"digikev.kevin.rapley@gmail.com","roles":["team_admin","safeguarding_lead"],"team":"ResearchOps Core Team"}'
FROM auth_users u
WHERE lower(u.email) = lower('digikev.kevin.rapley@gmail.com')
ON CONFLICT(id) DO NOTHING;
