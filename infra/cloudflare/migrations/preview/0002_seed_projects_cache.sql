-- Preview-only project cache seed.
--
-- This is not a CSV fallback and does not create synthetic PID identifiers.
-- It seeds the preview D1 read-through cache with the known Airtable Projects
-- record IDs so branch previews can keep serving project cards while Airtable
-- is rate-limiting the API.

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

INSERT INTO rops_projects_cache (id, name, org, phase, status, active, source, updated_at)
VALUES
	('recMtdmBbaFilF2Tm', 'New Project', 'Home Office Biometrics', 'Discovery', 'Planning research', 1, 'preview-seed', '2026-05-17T23:30:00.000Z'),
	('recpZe8mLEiASXfRd', 'My Project', 'Home Office Biometrics', 'Discovery', 'Goal setting & problem defining', 1, 'preview-seed', '2026-05-17T23:30:00.000Z'),
	('recgdpwEI5hFO7bUZ', 'Test Project 1', 'Home Office Biometrics', 'Discovery', 'Goal setting & problem defining', 1, 'preview-seed', '2026-05-17T23:30:00.000Z'),
	('recIFoFmpDIGBP726', 'Testing with AI', 'Home Office Biometrics', 'Pre-Discovery', 'Goal setting & problem defining', 1, 'preview-seed', '2026-05-17T23:30:00.000Z'),
	('recUUeazIqBMfsZL4', 'Project Name', 'Home Office Biometrics', 'Pre-Discovery', 'Goal setting & problem defining', 1, 'preview-seed', '2026-05-17T23:30:00.000Z')
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	org = excluded.org,
	phase = excluded.phase,
	status = excluded.status,
	active = 1,
	updated_at = excluded.updated_at;
