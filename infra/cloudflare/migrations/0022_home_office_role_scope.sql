-- Decouple Home Office research roles from team identity.
-- Date: 2026-06-23
-- Scope: add an organisation role-assignment scope, migrate active research roles
-- to the Home Office scope and revoke legacy team-scoped research-role mirrors.
-- Team Admin remains team-scoped because it administers a specific team.

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS auth_role_assignments_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organisation', 'team', 'project', 'study')),
  scope_id TEXT NOT NULL,
  assignment_status TEXT NOT NULL DEFAULT 'active' CHECK (assignment_status IN ('pending', 'active', 'rejected', 'expired', 'revoked')),
  requested_reason TEXT,
  approved_by_user_id TEXT REFERENCES auth_users(id),
  approved_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, role_id, scope_type, scope_id)
);

INSERT OR IGNORE INTO auth_role_assignments_new (
  id,
  user_id,
  role_id,
  scope_type,
  scope_id,
  assignment_status,
  requested_reason,
  approved_by_user_id,
  approved_at,
  expires_at,
  created_at,
  updated_at
)
SELECT
  id,
  user_id,
  role_id,
  scope_type,
  scope_id,
  assignment_status,
  requested_reason,
  approved_by_user_id,
  approved_at,
  expires_at,
  created_at,
  updated_at
FROM auth_role_assignments;

DROP TABLE auth_role_assignments;
ALTER TABLE auth_role_assignments_new RENAME TO auth_role_assignments;

CREATE INDEX IF NOT EXISTS idx_auth_assignments_user_scope ON auth_role_assignments(user_id, scope_type, scope_id);

CREATE TABLE IF NOT EXISTS auth_permission_exceptions_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES auth_permissions(code) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organisation', 'team', 'project', 'study')),
  scope_id TEXT NOT NULL,
  exception_status TEXT NOT NULL DEFAULT 'active' CHECK (exception_status IN ('active', 'expired', 'revoked')),
  reason TEXT NOT NULL,
  granted_by_user_id TEXT REFERENCES auth_users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO auth_permission_exceptions_new (
  id,
  user_id,
  permission_code,
  scope_type,
  scope_id,
  exception_status,
  reason,
  granted_by_user_id,
  expires_at,
  created_at
)
SELECT
  id,
  user_id,
  permission_code,
  scope_type,
  scope_id,
  exception_status,
  reason,
  granted_by_user_id,
  expires_at,
  created_at
FROM auth_permission_exceptions;

DROP TABLE auth_permission_exceptions;
ALTER TABLE auth_permission_exceptions_new RENAME TO auth_permission_exceptions;

PRAGMA foreign_keys = ON;

WITH home_office_roles(role_id) AS (
  VALUES
    ('role_observer'),
    ('role_researcher'),
    ('role_research_lead'),
    ('role_approver'),
    ('role_safeguarding_lead')
),
active_home_office_role_sources AS (
  SELECT
    ra.user_id,
    ra.role_id,
    MAX(ra.approved_by_user_id) AS approved_by_user_id,
    MAX(ra.approved_at) AS approved_at,
    CASE
      WHEN SUM(CASE WHEN ra.expires_at IS NULL THEN 1 ELSE 0 END) > 0 THEN NULL
      ELSE MAX(ra.expires_at)
    END AS expires_at
  FROM auth_role_assignments ra
  INNER JOIN home_office_roles r ON r.role_id = ra.role_id
  WHERE ra.assignment_status = 'active'
    AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  GROUP BY ra.user_id, ra.role_id
)
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
  'asn_home_office_' || replace(replace(replace(u.email, '@', '_'), '.', '_'), '-', '_') || '_' || r.role_key,
  src.user_id,
  src.role_id,
  'organisation',
  'home_office',
  'active',
  'Home Office role migrated from legacy team or project-scoped research role assignment.',
  src.approved_by_user_id,
  COALESCE(src.approved_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  src.expires_at
FROM active_home_office_role_sources src
INNER JOIN auth_users u ON u.id = src.user_id
INNER JOIN auth_roles r ON r.id = src.role_id
ON CONFLICT(user_id, role_id, scope_type, scope_id) DO UPDATE SET
  assignment_status = 'active',
  requested_reason = excluded.requested_reason,
  approved_by_user_id = excluded.approved_by_user_id,
  approved_at = excluded.approved_at,
  expires_at = CASE
    WHEN auth_role_assignments.expires_at IS NULL OR excluded.expires_at IS NULL THEN NULL
    ELSE MAX(auth_role_assignments.expires_at, excluded.expires_at)
  END,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

WITH home_office_roles(role_id) AS (
  VALUES
    ('role_observer'),
    ('role_researcher'),
    ('role_research_lead'),
    ('role_approver'),
    ('role_safeguarding_lead')
)
UPDATE auth_role_assignments
SET
  assignment_status = 'revoked',
  requested_reason = 'Revoked because research delivery roles are Home Office scoped; teams are membership contexts only.',
  expires_at = COALESCE(expires_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE scope_type = 'team'
  AND assignment_status = 'active'
  AND role_id IN (SELECT role_id FROM home_office_roles);

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
VALUES (
  'aud_home_office_role_scope_20260623',
  'auth.role_scope.home_office_migration',
  (SELECT id FROM auth_users WHERE lower(email) = lower('digikev.kevin.rapley@gmail.com') LIMIT 1),
  NULL,
  'auth_role_assignments',
  'home_office',
  'role.assign',
  'infra/cloudflare/migrations/0022_home_office_role_scope.sql',
  'home-office-role-scope',
  'succeeded',
  0,
  '{"scopeType":"organisation","scopeId":"home_office","teamScopedResearchRoles":"revoked","teamAdminScope":"team","reason":"teams_are_membership_contexts_not_research_role_identity"}'
)
ON CONFLICT(id) DO NOTHING;
