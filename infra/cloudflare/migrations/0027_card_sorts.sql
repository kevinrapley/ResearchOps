-- Card sort study preparation and per-session results.
-- A study whose method is "Card Sort" stores one configuration row (the
-- prepared cards, sort type and any predefined groups) and one result row per
-- participant card sort session.

CREATE TABLE IF NOT EXISTS rops_card_sort_configs (
	study_id TEXT PRIMARY KEY,
	sort_type TEXT NOT NULL DEFAULT 'open',
	allow_new_cards INTEGER NOT NULL DEFAULT 0,
	shuffle_cards INTEGER NOT NULL DEFAULT 1,
	instructions TEXT,
	cards_json TEXT NOT NULL DEFAULT '[]',
	groups_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rops_card_sort_results (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	session_id TEXT NOT NULL,
	participant_id TEXT,
	status TEXT NOT NULL DEFAULT 'in_progress',
	result_json TEXT NOT NULL DEFAULT '{}',
	started_at TEXT,
	completed_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rops_card_sort_results_study ON rops_card_sort_results (study_id, active, created_at);
CREATE INDEX IF NOT EXISTS idx_rops_card_sort_results_session ON rops_card_sort_results (session_id, active, created_at);
