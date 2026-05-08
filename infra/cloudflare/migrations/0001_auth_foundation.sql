-- Authentication and role-selection foundation
-- Date: 2026-05-08
-- Scope: D1 control-plane schema for real authentication, role assignment,
-- permissions, scoped access and audit. This migration does not create a mock
-- identity route or change Airtable schema.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  mfa_claim TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS auth_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  team_status TEXT NOT NULL DEFAULT 'active' CHECK (team_status IN ('active', 'suspended', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES auth_teams(id) ON DELETE CASCADE,
  membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('pending', 'active', 'removed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  removed_at TEXT,
  UNIQUE (user_id, team_id)
);

CREATE TABLE IF NOT EXISTS auth_permissions (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
  is_reserved INTEGER NOT NULL DEFAULT 0 CHECK (is_reserved IN (0, 1))
);

CREATE TABLE IF NOT EXISTS auth_roles (
  id TEXT PRIMARY KEY,
  role_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  is_sensitive INTEGER NOT NULL DEFAULT 0 CHECK (is_sensitive IN (0, 1)),
  approval_required INTEGER NOT NULL DEFAULT 0 CHECK (approval_required IN (0, 1)),
  default_expiry_days INTEGER
);

CREATE TABLE IF NOT EXISTS auth_role_permissions (
  role_id TEXT NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES auth_permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS auth_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('team', 'project', 'study')),
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

CREATE TABLE IF NOT EXISTS auth_permission_exceptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES auth_permissions(code) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('team', 'project', 'study')),
  scope_id TEXT NOT NULL,
  exception_status TEXT NOT NULL DEFAULT 'active' CHECK (exception_status IN ('active', 'expired', 'revoked')),
  reason TEXT NOT NULL,
  granted_by_user_id TEXT REFERENCES auth_users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id TEXT REFERENCES auth_users(id),
  target_user_id TEXT REFERENCES auth_users(id),
  team_id TEXT REFERENCES auth_teams(id),
  provider TEXT,
  route_path TEXT,
  request_id TEXT,
  ip_hash TEXT,
  user_agent_family TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id TEXT REFERENCES auth_users(id),
  team_id TEXT REFERENCES auth_teams(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  permission_code TEXT REFERENCES auth_permissions(code),
  route_path TEXT,
  request_id TEXT,
  field_group TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'pending', 'redacted')),
  is_safeguarding INTEGER NOT NULL DEFAULT 0 CHECK (is_safeguarding IN (0, 1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  redacted_by_user_id TEXT REFERENCES auth_users(id),
  redacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_route_permissions (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL,
  route_pattern TEXT NOT NULL,
  required_permissions_json TEXT NOT NULL DEFAULT '[]',
  auth_required INTEGER NOT NULL DEFAULT 1 CHECK (auth_required IN (0, 1)),
  implementation_status TEXT NOT NULL DEFAULT 'declared' CHECK (implementation_status IN ('declared', 'implemented', 'deferred')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (method, route_pattern)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_memberships_user ON auth_team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_assignments_user_scope ON auth_role_assignments(user_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_actor ON auth_events(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_actor ON auth_audit_events(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_target ON auth_audit_events(target_type, target_id, created_at);

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
  ('participant.pii.view', 'View participant personal data state', 'Can access participant records beyond the public or anonymous service shell.', 1, 0),
  ('participant.pii.reveal', 'Reveal participant personal data', 'Can intentionally reveal identifiable participant fields where context access permits it.', 1, 0),
  ('participant.pii.export', 'Export participant personal data', 'Reserved permission for future identifiable participant exports.', 1, 1),
  ('governed.create', 'Create governed research records', 'Can create governed evidence, findings or recommendations.', 0, 0),
  ('governed.edit', 'Edit governed research records', 'Can edit governed research records with authorship and audit capture.', 0, 0),
  ('governed.review', 'Review governed research records', 'Can review findings or governed records.', 1, 0),
  ('governed.approve', 'Approve governed research records', 'Can approve studies, findings or governed records where approval is required.', 1, 0),
  ('recommendation.own', 'Own accepted recommendations', 'Can be assigned as decision owner for accepted recommendations.', 1, 0),
  ('safeguarding.view', 'View safeguarding detail', 'Can view restricted safeguarding detail.', 1, 0),
  ('safeguarding.record', 'Record safeguarding observations', 'Can record safeguarding risks or observations.', 1, 0),
  ('safeguarding.resolve', 'Resolve safeguarding concerns', 'Can resolve or close safeguarding concerns.', 1, 0),
  ('safeguarding.audit.view', 'View safeguarding audit', 'Can view restricted safeguarding audit events.', 1, 0),
  ('safeguarding.export', 'Export safeguarding records', 'Reserved permission for future safeguarding export controls.', 1, 1),
  ('audit.view', 'View audit events', 'Can view general audit events.', 1, 0),
  ('audit.export', 'Export audit events', 'Reserved permission for future audit export controls.', 1, 1),
  ('team.manage', 'Manage team membership', 'Can manage team members and team settings.', 1, 0),
  ('role.assign', 'Assign roles', 'Can assign or approve role access where policy permits.', 1, 0);

INSERT OR IGNORE INTO auth_roles (id, role_key, label, description, is_sensitive, approval_required, default_expiry_days) VALUES
  ('role_observer', 'observer', 'Observer', 'Can observe low-risk research context without participant personal data reveal.', 0, 0, NULL),
  ('role_researcher', 'researcher', 'Researcher', 'Can create and edit governed research records.', 0, 0, NULL),
  ('role_research_lead', 'research_lead', 'Research Lead', 'Can create, edit and review governed research records.', 1, 1, 180),
  ('role_approver', 'approver', 'Approver', 'Can approve governed research records and own accepted recommendations.', 1, 1, 180),
  ('role_safeguarding_lead', 'safeguarding_lead', 'Safeguarding Lead', 'Can view, record, resolve and audit safeguarding concerns.', 1, 1, 180),
  ('role_team_admin', 'team_admin', 'Team Admin', 'Can manage team membership, roles and general audit oversight.', 1, 1, 180);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
  ('role_researcher', 'governed.create'),
  ('role_researcher', 'governed.edit'),
  ('role_research_lead', 'governed.create'),
  ('role_research_lead', 'governed.edit'),
  ('role_research_lead', 'governed.review'),
  ('role_approver', 'governed.review'),
  ('role_approver', 'governed.approve'),
  ('role_approver', 'recommendation.own'),
  ('role_safeguarding_lead', 'safeguarding.view'),
  ('role_safeguarding_lead', 'safeguarding.record'),
  ('role_safeguarding_lead', 'safeguarding.resolve'),
  ('role_safeguarding_lead', 'safeguarding.audit.view'),
  ('role_team_admin', 'team.manage'),
  ('role_team_admin', 'role.assign'),
  ('role_team_admin', 'audit.view');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
  ('route_api_me_get', 'GET', '/api/me', '[]', 1, 'implemented'),
  ('route_api_me_permissions_get', 'GET', '/api/me/permissions', '[]', 1, 'implemented'),
  ('route_api_role_assignments_post', 'POST', '/api/auth/role-assignments', '["role.assign"]', 1, 'deferred'),
  ('route_api_account_activity_get', 'GET', '/api/audit/account-activity', '[]', 1, 'deferred'),
  ('route_api_team_audit_get', 'GET', '/api/audit/team-events', '["audit.view"]', 1, 'deferred'),
  ('route_api_safeguarding_audit_get', 'GET', '/api/safeguarding/audit', '["safeguarding.audit.view"]', 1, 'deferred');
