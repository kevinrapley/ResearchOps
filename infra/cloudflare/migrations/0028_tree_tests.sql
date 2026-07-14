-- Tree test study preparation and per-participant task results.

CREATE TABLE IF NOT EXISTS rops_tree_test_configs (
	study_id TEXT PRIMARY KEY,
	instructions TEXT,
	tree_json TEXT NOT NULL DEFAULT '[]',
	tasks_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rops_tree_test_results (
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

CREATE INDEX IF NOT EXISTS idx_rops_tree_test_results_study ON rops_tree_test_results (study_id, active, created_at);
CREATE INDEX IF NOT EXISTS idx_rops_tree_test_results_session ON rops_tree_test_results (session_id, active, created_at);
