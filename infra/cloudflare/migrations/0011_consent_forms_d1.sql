-- D1-backed consent forms for study materials.
-- Date: 2026-06-05
-- Scope: allow consent form authoring to load and persist without Airtable.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rops_consent_forms (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	title TEXT NOT NULL,
	form_type TEXT NOT NULL,
	status TEXT NOT NULL,
	version INTEGER NOT NULL DEFAULT 1,
	source_markdown TEXT NOT NULL,
	variables_json TEXT NOT NULL DEFAULT '{}',
	consent_items_json TEXT NOT NULL DEFAULT '[]',
	plain_english_summary TEXT,
	accessibility_notes TEXT,
	review_notes TEXT,
	owner TEXT,
	published_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_study
	ON rops_consent_forms (study_id, active, updated_at);

CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_status
	ON rops_consent_forms (status, active);
