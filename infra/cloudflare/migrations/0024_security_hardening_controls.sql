CREATE TABLE IF NOT EXISTS auth_rate_limits (
	rate_key TEXT PRIMARY KEY,
	window_start TEXT NOT NULL,
	count INTEGER NOT NULL,
	expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expires_at
	ON auth_rate_limits (expires_at);

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
	('study.view', 'View studies', 'Can view study records and associated research planning data.', 1, 0),
	('study.manage', 'Manage studies', 'Can create or update study records.', 1, 0),
	('synthesis.view', 'View synthesis', 'Can view research evidence, clusters and themes.', 1, 0),
	('synthesis.manage', 'Manage synthesis', 'Can create, update or delete research synthesis records.', 1, 0),
	('consent.form.view', 'View consent forms', 'Can view consent form templates and versions.', 1, 0),
	('consent.form.manage', 'Manage consent forms', 'Can create, update or publish consent forms.', 1, 0),
	('participant.consent.view', 'View participant consent', 'Can view participant consent status for a study.', 1, 0),
	('participant.consent.manage', 'Manage participant consent', 'Can record or update participant consent.', 1, 0),
	('project.diagnostics.view', 'View project diagnostics', 'Can view project source diagnostics for operational assurance.', 1, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
	('role_researcher', 'study.view'),
	('role_researcher', 'study.manage'),
	('role_researcher', 'synthesis.view'),
	('role_researcher', 'synthesis.manage'),
	('role_researcher', 'consent.form.view'),
	('role_researcher', 'consent.form.manage'),
	('role_researcher', 'participant.consent.view'),
	('role_researcher', 'participant.consent.manage'),
	('role_research_lead', 'study.view'),
	('role_research_lead', 'study.manage'),
	('role_research_lead', 'synthesis.view'),
	('role_research_lead', 'synthesis.manage'),
	('role_research_lead', 'consent.form.view'),
	('role_research_lead', 'consent.form.manage'),
	('role_research_lead', 'participant.consent.view'),
	('role_research_lead', 'participant.consent.manage'),
	('role_research_lead', 'project.diagnostics.view'),
	('role_team_admin', 'study.view'),
	('role_team_admin', 'study.manage'),
	('role_team_admin', 'synthesis.view'),
	('role_team_admin', 'synthesis.manage'),
	('role_team_admin', 'consent.form.view'),
	('role_team_admin', 'consent.form.manage'),
	('role_team_admin', 'participant.consent.view'),
	('role_team_admin', 'participant.consent.manage'),
	('role_team_admin', 'project.diagnostics.view');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
	('route_api_diag_projects_source_get', 'GET', '/api/_diag/projects-source', '["project.diagnostics.view"]', 1, 'implemented'),
	('route_api_diag_project_linked_records_get', 'GET', '/api/_diag/project-linked-records', '["project.diagnostics.view"]', 1, 'implemented'),
	('route_api_studies_get', 'GET', '/api/studies', '["study.view"]', 1, 'implemented'),
	('route_api_studies_post', 'POST', '/api/studies', '["study.manage"]', 1, 'implemented'),
	('route_api_studies_patch', 'PATCH', '/api/studies/:id', '["study.manage"]', 1, 'implemented'),
	('route_api_synthesis_get', 'GET', '/api/synthesis', '["synthesis.view"]', 1, 'implemented'),
	('route_api_synthesis_evidence_get', 'GET', '/api/synthesis/evidence', '["synthesis.view"]', 1, 'implemented'),
	('route_api_synthesis_clusters_post', 'POST', '/api/synthesis/clusters', '["synthesis.manage"]', 1, 'implemented'),
	('route_api_synthesis_themes_post', 'POST', '/api/synthesis/themes', '["synthesis.manage"]', 1, 'implemented'),
	('route_api_synthesis_clusters_patch', 'PATCH', '/api/synthesis/clusters/:id', '["synthesis.manage"]', 1, 'implemented'),
	('route_api_synthesis_clusters_delete', 'DELETE', '/api/synthesis/clusters/:id', '["synthesis.manage"]', 1, 'implemented'),
	('route_api_consent_forms_get', 'GET', '/api/consent-forms', '["consent.form.view"]', 1, 'implemented'),
	('route_api_consent_forms_post', 'POST', '/api/consent-forms', '["consent.form.manage"]', 1, 'implemented'),
	('route_api_consent_forms_id_get', 'GET', '/api/consent-forms/:id', '["consent.form.view"]', 1, 'implemented'),
	('route_api_consent_forms_id_patch', 'PATCH', '/api/consent-forms/:id', '["consent.form.manage"]', 1, 'implemented'),
	('route_api_consent_forms_publish_post', 'POST', '/api/consent-forms/:id/publish', '["consent.form.manage"]', 1, 'implemented'),
	('route_api_participant_consent_get', 'GET', '/api/participant-consent', '["participant.consent.view"]', 1, 'implemented'),
	('route_api_participant_consent_post', 'POST', '/api/participant-consent', '["participant.consent.manage"]', 1, 'implemented'),
	('route_api_participant_consent_patch', 'PATCH', '/api/participant-consent/:id', '["participant.consent.manage"]', 1, 'implemented');
