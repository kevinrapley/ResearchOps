-- D1-canonical participant model and Test Project 1 seed.
-- Date: 2026-05-31
-- Scope: D1 runtime participant source of truth for testing without Airtable API calls.
--
-- Project: Test Project 1
-- Project record ID: recgdpwEI5hFO7bUZ
-- Study seeded: rect3biqr
--
-- Seeded records use explicit non-real prototype contact details for reveal and hide testing.
-- participant_airtable_id is retained only as an optional adapter key for legacy Airtable-backed session scheduling.

PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_project_id ON rops_participants_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_study_id ON rops_participants_cache(study_id);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_airtable_id ON rops_participants_cache(participant_airtable_id);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_active ON rops_participants_cache(active);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_source ON rops_participants_cache(source);

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
	('participant.record.create', 'Create participant records', 'Can create D1-backed participant records for a project or study.', 0, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
	('role_researcher', 'participant.record.create'),
	('role_research_lead', 'participant.record.create'),
	('role_team_admin', 'participant.record.create');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
	('route_api_participants_post', 'POST', '/api/participants', '["participant.record.create"]', 1, 'implemented');

INSERT INTO rops_participants_cache (
	id,
	project_id,
	study_id,
	participant_airtable_id,
	participant_ref,
	channel_pref,
	consent_status,
	status,
	access_needs,
	active,
	source,
	created_at,
	updated_at,
	sensitive_contact_json,
	payload_json
)
VALUES
	('d1ptp_test_project_1_01', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 01', 'email', 'not_sent', 'invited', 'None recorded', 1, 'd1-seed', '2026-05-31T22:40:01.000Z', '2026-05-31T22:40:01.000Z', '{"first_name":"Prototype","family_name":"Participant 01","full_name":"Prototype Participant 01","email":"prototype.participant01@example.test","phone":"Prototype phone 01"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 01","accessNeeds":"None recorded","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_02', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 02', 'phone', 'not_sent', 'invited', 'Prefers afternoon sessions', 1, 'd1-seed', '2026-05-31T22:40:02.000Z', '2026-05-31T22:40:02.000Z', '{"first_name":"Prototype","family_name":"Participant 02","full_name":"Prototype Participant 02","email":"prototype.participant02@example.test","phone":"Prototype phone 02"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 02","accessNeeds":"Prefers afternoon sessions","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_03', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 03', 'email', 'sent', 'invited', 'Needs captions for remote sessions', 1, 'd1-seed', '2026-05-31T22:40:03.000Z', '2026-05-31T22:40:03.000Z', '{"first_name":"Prototype","family_name":"Participant 03","full_name":"Prototype Participant 03","email":"prototype.participant03@example.test","phone":"Prototype phone 03"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 03","accessNeeds":"Needs captions for remote sessions","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_04', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 04', 'phone', 'sent', 'invited', 'Needs shorter session blocks', 1, 'd1-seed', '2026-05-31T22:40:04.000Z', '2026-05-31T22:40:04.000Z', '{"first_name":"Prototype","family_name":"Participant 04","full_name":"Prototype Participant 04","email":"prototype.participant04@example.test","phone":"Prototype phone 04"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 04","accessNeeds":"Needs shorter session blocks","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_05', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 05', 'email', 'not_sent', 'screening', 'None recorded', 1, 'd1-seed', '2026-05-31T22:40:05.000Z', '2026-05-31T22:40:05.000Z', '{"first_name":"Prototype","family_name":"Participant 05","full_name":"Prototype Participant 05","email":"prototype.participant05@example.test","phone":"Prototype phone 05"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 05","accessNeeds":"None recorded","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_06', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 06', 'email', 'sent', 'screening', 'Uses screen magnification', 1, 'd1-seed', '2026-05-31T22:40:06.000Z', '2026-05-31T22:40:06.000Z', '{"first_name":"Prototype","family_name":"Participant 06","full_name":"Prototype Participant 06","email":"prototype.participant06@example.test","phone":"Prototype phone 06"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 06","accessNeeds":"Uses screen magnification","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_07', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 07', 'phone', 'not_sent', 'invited', 'Needs plain English instructions', 1, 'd1-seed', '2026-05-31T22:40:07.000Z', '2026-05-31T22:40:07.000Z', '{"first_name":"Prototype","family_name":"Participant 07","full_name":"Prototype Participant 07","email":"prototype.participant07@example.test","phone":"Prototype phone 07"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 07","accessNeeds":"Needs plain English instructions","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_08', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 08', 'email', 'sent', 'invited', 'None recorded', 1, 'd1-seed', '2026-05-31T22:40:08.000Z', '2026-05-31T22:40:08.000Z', '{"first_name":"Prototype","family_name":"Participant 08","full_name":"Prototype Participant 08","email":"prototype.participant08@example.test","phone":"Prototype phone 08"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 08","accessNeeds":"None recorded","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_09', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 09', 'phone', 'sent', 'screening', 'Avoids early morning sessions', 1, 'd1-seed', '2026-05-31T22:40:09.000Z', '2026-05-31T22:40:09.000Z', '{"first_name":"Prototype","family_name":"Participant 09","full_name":"Prototype Participant 09","email":"prototype.participant09@example.test","phone":"Prototype phone 09"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 09","accessNeeds":"Avoids early morning sessions","hasSensitiveDetails":true,"pseudonymised":true}'),
	('d1ptp_test_project_1_10', 'recgdpwEI5hFO7bUZ', 'rect3biqr', NULL, 'TP1 Participant 10', 'email', 'not_sent', 'invited', 'None recorded', 1, 'd1-seed', '2026-05-31T22:40:10.000Z', '2026-05-31T22:40:10.000Z', '{"first_name":"Prototype","family_name":"Participant 10","full_name":"Prototype Participant 10","email":"prototype.participant10@example.test","phone":"Prototype phone 10"}', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 10","accessNeeds":"None recorded","hasSensitiveDetails":true,"pseudonymised":true}')
ON CONFLICT(id) DO UPDATE SET
	project_id = excluded.project_id,
	study_id = excluded.study_id,
	participant_airtable_id = excluded.participant_airtable_id,
	participant_ref = excluded.participant_ref,
	channel_pref = excluded.channel_pref,
	consent_status = excluded.consent_status,
	status = excluded.status,
	access_needs = excluded.access_needs,
	active = 1,
	source = excluded.source,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at,
	sensitive_contact_json = excluded.sensitive_contact_json,
	payload_json = excluded.payload_json;
