-- Canonicalise Test Project 1 project identifiers in D1.
-- Date: 2026-06-10
--
-- Bad legacy ID: recgdpwEI5hFO7bUZ
-- Canonical ID:  recgdpwEI5hF07bUZ
--
-- The mismatch is the letter O versus the number 0 after hF.

CREATE TABLE IF NOT EXISTS rops_participants_cache (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	study_id TEXT NOT NULL,
	participant_airtable_id TEXT,
	participant_ref TEXT NOT NULL,
	channel_pref TEXT,
	consent_status TEXT,
	status TEXT,
	access_needs TEXT,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1-seed',
	created_at TEXT,
	updated_at TEXT NOT NULL,
	sensitive_contact_json TEXT,
	payload_json TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
	record_id TEXT PRIMARY KEY,
	project TEXT,
	category TEXT,
	content TEXT,
	tags TEXT,
	createdat TEXT,
	local_project_id TEXT
);

CREATE TABLE IF NOT EXISTS memos (
	record_id TEXT,
	project TEXT,
	type TEXT,
	title TEXT,
	body TEXT,
	createdat TEXT,
	local_project_id TEXT,
	local_memo_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS codes (
	record_id TEXT,
	project TEXT,
	name TEXT,
	description TEXT,
	parentcode TEXT,
	colour TEXT,
	createdat TEXT,
	local_project_id TEXT,
	local_code_id TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS rops_studies_cache (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	study_id TEXT,
	title TEXT,
	method TEXT,
	status TEXT,
	description TEXT,
	created_at TEXT,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'airtable',
	updated_at TEXT NOT NULL,
	payload_json TEXT
);

CREATE TABLE IF NOT EXISTS rops_projects_cache (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	org TEXT,
	phase TEXT,
	status TEXT,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'airtable',
	updated_at TEXT NOT NULL,
	payload_json TEXT
);

UPDATE rops_participants_cache
SET project_id = 'recgdpwEI5hF07bUZ',
	payload_json = replace(COALESCE(payload_json, ''), 'recgdpwEI5hFO7bUZ', 'recgdpwEI5hF07bUZ')
WHERE project_id = 'recgdpwEI5hFO7bUZ'
	OR payload_json LIKE '%recgdpwEI5hFO7bUZ%';

UPDATE journal_entries
SET project = 'recgdpwEI5hF07bUZ'
WHERE project = 'recgdpwEI5hFO7bUZ';

UPDATE memos
SET project = 'recgdpwEI5hF07bUZ'
WHERE project = 'recgdpwEI5hFO7bUZ';

UPDATE codes
SET project = 'recgdpwEI5hF07bUZ'
WHERE project = 'recgdpwEI5hFO7bUZ';

UPDATE rops_studies_cache
SET project_id = 'recgdpwEI5hF07bUZ',
	payload_json = replace(COALESCE(payload_json, ''), 'recgdpwEI5hFO7bUZ', 'recgdpwEI5hF07bUZ')
WHERE project_id = 'recgdpwEI5hFO7bUZ'
	OR payload_json LIKE '%recgdpwEI5hFO7bUZ%';

UPDATE rops_projects_cache
SET id = 'recgdpwEI5hF07bUZ',
	payload_json = replace(COALESCE(payload_json, ''), 'recgdpwEI5hFO7bUZ', 'recgdpwEI5hF07bUZ')
WHERE id = 'recgdpwEI5hFO7bUZ'
	AND NOT EXISTS (
		SELECT 1 FROM rops_projects_cache WHERE id = 'recgdpwEI5hF07bUZ'
	);

UPDATE rops_projects_cache
SET payload_json = replace(COALESCE(payload_json, ''), 'recgdpwEI5hFO7bUZ', 'recgdpwEI5hF07bUZ')
WHERE payload_json LIKE '%recgdpwEI5hFO7bUZ%';

DELETE FROM rops_projects_cache
WHERE id = 'recgdpwEI5hFO7bUZ'
	AND EXISTS (
		SELECT 1 FROM rops_projects_cache WHERE id = 'recgdpwEI5hF07bUZ'
	);
