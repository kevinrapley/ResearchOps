-- Seed pseudonymised D1 participants for Test Project 1.
-- Date: 2026-05-31
-- Scope: D1-only seed for local/preview participant list support.
--
-- Project: Test Project 1
-- Project record ID: recgdpwEI5hFO7bUZ
-- Study seeded: rect3biqr
--
-- This seed deliberately contains no contact details.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rops_participants_cache (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	study_id TEXT NOT NULL,
	participant_ref TEXT NOT NULL,
	channel_pref TEXT,
	consent_status TEXT,
	status TEXT,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1-seed',
	created_at TEXT,
	updated_at TEXT NOT NULL,
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_project_id ON rops_participants_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_study_id ON rops_participants_cache(study_id);
CREATE INDEX IF NOT EXISTS idx_rops_participants_cache_active ON rops_participants_cache(active);

INSERT INTO rops_participants_cache (
	id,
	project_id,
	study_id,
	participant_ref,
	channel_pref,
	consent_status,
	status,
	active,
	source,
	created_at,
	updated_at,
	payload_json
)
VALUES
	('d1ptp_test_project_1_01', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 01', 'email', 'not_sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:01.000Z', '2026-05-31T22:40:01.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 01","pseudonymised":true}'),
	('d1ptp_test_project_1_02', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 02', 'phone', 'not_sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:02.000Z', '2026-05-31T22:40:02.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 02","pseudonymised":true}'),
	('d1ptp_test_project_1_03', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 03', 'email', 'sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:03.000Z', '2026-05-31T22:40:03.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 03","pseudonymised":true}'),
	('d1ptp_test_project_1_04', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 04', 'phone', 'sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:04.000Z', '2026-05-31T22:40:04.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 04","pseudonymised":true}'),
	('d1ptp_test_project_1_05', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 05', 'email', 'not_sent', 'screening', 1, 'd1-seed', '2026-05-31T22:40:05.000Z', '2026-05-31T22:40:05.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 05","pseudonymised":true}'),
	('d1ptp_test_project_1_06', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 06', 'email', 'sent', 'screening', 1, 'd1-seed', '2026-05-31T22:40:06.000Z', '2026-05-31T22:40:06.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 06","pseudonymised":true}'),
	('d1ptp_test_project_1_07', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 07', 'phone', 'not_sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:07.000Z', '2026-05-31T22:40:07.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 07","pseudonymised":true}'),
	('d1ptp_test_project_1_08', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 08', 'email', 'sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:08.000Z', '2026-05-31T22:40:08.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 08","pseudonymised":true}'),
	('d1ptp_test_project_1_09', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 09', 'phone', 'sent', 'screening', 1, 'd1-seed', '2026-05-31T22:40:09.000Z', '2026-05-31T22:40:09.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 09","pseudonymised":true}'),
	('d1ptp_test_project_1_10', 'recgdpwEI5hFO7bUZ', 'rect3biqr', 'TP1 Participant 10', 'email', 'not_sent', 'invited', 1, 'd1-seed', '2026-05-31T22:40:10.000Z', '2026-05-31T22:40:10.000Z', '{"projectId":"recgdpwEI5hFO7bUZ","studyId":"rect3biqr","participantRef":"TP1 Participant 10","pseudonymised":true}')
ON CONFLICT(id) DO UPDATE SET
	project_id = excluded.project_id,
	study_id = excluded.study_id,
	participant_ref = excluded.participant_ref,
	channel_pref = excluded.channel_pref,
	consent_status = excluded.consent_status,
	status = excluded.status,
	active = 1,
	source = excluded.source,
	created_at = excluded.created_at,
	updated_at = excluded.updated_at,
	payload_json = excluded.payload_json;
