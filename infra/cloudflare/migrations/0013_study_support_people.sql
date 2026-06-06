-- D1-backed note takers and observers setup for study fieldwork support.
-- Date: 2026-06-06
-- Scope: persist whether sessions need additional support people and who they are.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rops_study_support_setup (
	study_id TEXT PRIMARY KEY,
	project_id TEXT,
	decision TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE TABLE IF NOT EXISTS rops_study_support_people (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	project_id TEXT,
	name TEXT NOT NULL,
	role TEXT NOT NULL,
	role_other TEXT,
	email TEXT,
	attendance_scope TEXT NOT NULL,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_study_support_people_study
	ON rops_study_support_people (study_id, active, updated_at);

CREATE INDEX IF NOT EXISTS idx_rops_study_support_people_role
	ON rops_study_support_people (role, active);

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
	('study.support.view', 'View study support setup', 'Can view note taker and observer setup for a study.', 1, 0),
	('study.support.manage', 'Manage study support setup', 'Can create, update or remove note taker and observer setup for a study.', 1, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
	('role_researcher', 'study.support.view'),
	('role_researcher', 'study.support.manage'),
	('role_research_lead', 'study.support.view'),
	('role_research_lead', 'study.support.manage'),
	('role_team_admin', 'study.support.view'),
	('role_team_admin', 'study.support.manage');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
	('route_api_study_support_get', 'GET', '/api/study-support', '["study.support.view"]', 1, 'implemented'),
	('route_api_study_support_setup_put', 'PUT', '/api/study-support/setup', '["study.support.manage"]', 1, 'implemented'),
	('route_api_study_support_people_post', 'POST', '/api/study-support/people', '["study.support.manage"]', 1, 'implemented'),
	('route_api_study_support_people_delete', 'DELETE', '/api/study-support/people/:id', '["study.support.manage"]', 1, 'implemented');
