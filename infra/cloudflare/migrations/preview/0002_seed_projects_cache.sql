-- Preview-only project and study cache seed.
--
-- This is not a CSV fallback and does not create synthetic PID identifiers.
-- It seeds the preview D1 read-through cache with known Airtable Projects
-- record IDs and their linked Project Studies rows so branch previews can keep
-- serving the project dashboard while Airtable is rate-limiting the API.

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

INSERT INTO rops_studies_cache (id, project_id, study_id, title, method, status, description, created_at, active, source, updated_at, payload_json)
VALUES
	(
		'rect3biqr',
		'recgdpwEI5hFO7bUZ',
		'rect3biqr',
		'We will conduct one-to-one interviews with frontline staff who regularly use the internal case management system',
		'User Interview',
		'Planned',
		'We will conduct one-to-one interviews with frontline staff who regularly use the internal case management system. The aim is to understand how they complete daily tasks and where they encounter friction or delays. Sessions will last around 45 minutes and will include both open questions and task-based prompts. Findings will help identify unmet needs, opportunities to simplify processes, and areas for training. Insights will feed into service design decisions and prioritisation for the next delivery phase.',
		'2025-09-28T20:37:00.000Z',
		1,
		'preview-seed',
		'2026-05-18T12:15:00.000Z',
		'{"id":"rect3biqr","airtableId":"rect3biqr","recordId":"rect3biqr","projectId":"recgdpwEI5hFO7bUZ","projectIds":["recgdpwEI5hFO7bUZ"],"studyId":"rect3biqr","title":"We will conduct one-to-one interviews with frontline staff who regularly use the internal case management system","method":"User Interview","status":"Planned","description":"We will conduct one-to-one interviews with frontline staff who regularly use the internal case management system. The aim is to understand how they complete daily tasks and where they encounter friction or delays. Sessions will last around 45 minutes and will include both open questions and task-based prompts. Findings will help identify unmet needs, opportunities to simplify processes, and areas for training. Insights will feed into service design decisions and prioritisation for the next delivery phase.","createdAt":"2025-09-28T20:37:00.000Z"}'
	),
	(
		'rect3o7dt',
		'recgdpwEI5hFO7bUZ',
		'rect3o7dt',
		'The diary study description',
		'Diary Study',
		'Planned',
		'The diary study description',
		'2025-10-05T17:01:00.000Z',
		1,
		'preview-seed',
		'2026-05-18T12:15:00.000Z',
		'{"id":"rect3o7dt","airtableId":"rect3o7dt","recordId":"rect3o7dt","projectId":"recgdpwEI5hFO7bUZ","projectIds":["recgdpwEI5hFO7bUZ"],"studyId":"rect3o7dt","title":"The diary study description","method":"Diary Study","status":"Planned","description":"The diary study description","createdAt":"2025-10-05T17:01:00.000Z"}'
	)
ON CONFLICT(id) DO UPDATE SET
	project_id = excluded.project_id,
	study_id = excluded.study_id,
	title = excluded.title,
	method = excluded.method,
	status = excluded.status,
	description = excluded.description,
	created_at = excluded.created_at,
	active = 1,
	source = excluded.source,
	updated_at = excluded.updated_at,
	payload_json = excluded.payload_json;
