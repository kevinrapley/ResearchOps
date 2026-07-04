CREATE TABLE IF NOT EXISTS rops_ethics_submission_documents (
	id TEXT PRIMARY KEY,
	study_id TEXT NOT NULL,
	project_id TEXT,
	submission_version INTEGER NOT NULL DEFAULT 1,
	submission_type TEXT,
	route TEXT,
	status TEXT,
	template_key TEXT NOT NULL,
	object_key TEXT NOT NULL,
	object_etag TEXT,
	content_type TEXT NOT NULL,
	byte_size INTEGER NOT NULL,
	sha256 TEXT NOT NULL,
	submission_json TEXT NOT NULL,
	risk_outcome_json TEXT NOT NULL DEFAULT '{}',
	sourcebook_clauses_json TEXT NOT NULL DEFAULT '[]',
	created_by TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rops_ethics_submission_documents_study
	ON rops_ethics_submission_documents (study_id, submission_version, created_at);

CREATE INDEX IF NOT EXISTS idx_rops_ethics_submission_documents_object
	ON rops_ethics_submission_documents (object_key);

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved)
VALUES
	('study.ethics.view', 'View study ethics records', 'Can view study ethics and research risk records and generated submission documents.', 1, 0),
	('study.ethics.manage', 'Manage study ethics records', 'Can record study ethics risk next steps and generate submission documents.', 1, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code)
VALUES
	('role_researcher', 'study.ethics.view'),
	('role_researcher', 'study.ethics.manage'),
	('role_research_lead', 'study.ethics.view'),
	('role_research_lead', 'study.ethics.manage'),
	('role_team_admin', 'study.ethics.view'),
	('role_team_admin', 'study.ethics.manage');

INSERT OR IGNORE INTO auth_route_permissions
	(id, method, route_pattern, required_permissions_json, auth_required, implementation_status)
VALUES
	('route_api_study_ethics_submission_documents_post', 'POST', '/api/study-ethics-risk/submissions', '["study.ethics.manage"]', 1, 'implemented'),
	('route_api_study_ethics_submission_document_get', 'GET', '/api/study-ethics-risk/submissions/:id', '["study.ethics.view"]', 1, 'implemented');
