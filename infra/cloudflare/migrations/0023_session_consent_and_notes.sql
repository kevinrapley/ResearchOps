CREATE TABLE IF NOT EXISTS rops_participant_consent_cache (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	participant_id TEXT NOT NULL,
	consent_form_id TEXT,
	consent_form_version INTEGER NOT NULL DEFAULT 1,
	responses_json TEXT NOT NULL DEFAULT '{}',
	status TEXT NOT NULL DEFAULT 'Not recorded',
	capture_method TEXT,
	withdrawn INTEGER NOT NULL DEFAULT 0,
	withdrawal_reason TEXT,
	recorded_by TEXT,
	recorded_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_participant_consent_study
	ON rops_participant_consent_cache (study_id, active, recorded_at);

CREATE INDEX IF NOT EXISTS idx_rops_participant_consent_participant
	ON rops_participant_consent_cache (participant_id, active);

CREATE TABLE IF NOT EXISTS rops_session_notes (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	participant_id TEXT,
	study_id TEXT,
	start_iso TEXT NOT NULL,
	end_iso TEXT,
	start_offset_ms INTEGER,
	end_offset_ms INTEGER,
	duration_ms INTEGER,
	framework TEXT,
	category TEXT,
	content_html TEXT NOT NULL,
	content_plain TEXT,
	author TEXT,
	temporal_coverage TEXT,
	consent_snapshot_json TEXT,
	synced_to_mural INTEGER NOT NULL DEFAULT 0,
	synced_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1,
	source TEXT NOT NULL DEFAULT 'd1',
	payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_rops_session_notes_session
	ON rops_session_notes (session_id, active, start_iso);

CREATE INDEX IF NOT EXISTS idx_rops_session_notes_study
	ON rops_session_notes (study_id, active, start_iso);

CREATE INDEX IF NOT EXISTS idx_rops_session_notes_participant
	ON rops_session_notes (participant_id, active, start_iso);
