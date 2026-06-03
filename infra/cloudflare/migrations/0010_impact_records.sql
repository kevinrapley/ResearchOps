CREATE TABLE IF NOT EXISTS impact_records (
	record_id TEXT PRIMARY KEY,
	display_ref TEXT NOT NULL UNIQUE,
	project_id TEXT NOT NULL,
	study_id TEXT,
	decision_link TEXT,
	metric_name TEXT NOT NULL,
	metric_unit TEXT,
	metric_direction TEXT,
	baseline_value REAL,
	target_value REAL,
	actual_value REAL,
	measurement_window TEXT,
	impact_type TEXT,
	impact_scale TEXT,
	status TEXT,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_impact_records_project
	ON impact_records (project_id, deleted_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_impact_records_study
	ON impact_records (study_id, deleted_at, updated_at);
