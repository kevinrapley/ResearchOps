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
