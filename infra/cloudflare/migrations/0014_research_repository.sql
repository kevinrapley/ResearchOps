-- D1-backed user research repository publication layer.
-- Date: 2026-06-07
-- Scope: persist curated, non-PII, reusable research artefacts and repository access declarations.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rops_repository_artefacts (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	summary TEXT NOT NULL,
	artefact_type TEXT NOT NULL,
	status TEXT NOT NULL,
	confidence TEXT NOT NULL,
	evidence_maturity TEXT NOT NULL,
	service_area TEXT,
	user_group TEXT,
	method TEXT,
	risk_area TEXT,
	source_project_id TEXT,
	source_study_id TEXT,
	source_method TEXT,
	sample_summary TEXT,
	limitations TEXT,
	reuse_guidance TEXT,
	do_not_use_for TEXT,
	owner_user_id TEXT,
	reviewed_by_user_id TEXT,
	pii_cleared INTEGER NOT NULL DEFAULT 0,
	consent_scope_confirmed INTEGER NOT NULL DEFAULT 0,
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	published_at TEXT,
	review_due_at TEXT,
	payload_json TEXT,
	CHECK (status IN ('candidate', 'reviewed', 'published', 'stale', 'withdrawn')),
	CHECK (confidence IN ('high', 'medium', 'low')),
	CHECK (pii_cleared IN (0, 1)),
	CHECK (consent_scope_confirmed IN (0, 1)),
	CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS rops_repository_artefact_tags (
	artefact_id TEXT NOT NULL,
	tag_slug TEXT NOT NULL,
	tag_label TEXT NOT NULL,
	tag_type TEXT NOT NULL DEFAULT 'tag',
	PRIMARY KEY (artefact_id, tag_slug),
	FOREIGN KEY (artefact_id) REFERENCES rops_repository_artefacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rops_repository_audit (
	id TEXT PRIMARY KEY,
	artefact_id TEXT,
	action TEXT NOT NULL,
	actor_user_id TEXT,
	created_at TEXT NOT NULL,
	payload_json TEXT,
	FOREIGN KEY (artefact_id) REFERENCES rops_repository_artefacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_repository_artefacts_status
	ON rops_repository_artefacts (status, active, published_at);

CREATE INDEX IF NOT EXISTS idx_repository_artefacts_review
	ON rops_repository_artefacts (status, review_due_at);

CREATE INDEX IF NOT EXISTS idx_repository_artefacts_facets
	ON rops_repository_artefacts (method, evidence_maturity, service_area, user_group, risk_area);

CREATE INDEX IF NOT EXISTS idx_repository_tags_type
	ON rops_repository_artefact_tags (tag_type, tag_slug);

CREATE TRIGGER IF NOT EXISTS trg_repository_seed_user_group_taxonomy
AFTER INSERT ON rops_repository_artefacts
WHEN NEW.user_group = 'research-operations-team'
BEGIN
	UPDATE rops_repository_artefacts
	SET
		user_group = 'research-operations-staff',
		title = REPLACE(title, 'ResearchOps reviewers', 'research operations staff'),
		summary = REPLACE(summary, 'ResearchOps reviewers', 'research operations staff'),
		reuse_guidance = REPLACE(reuse_guidance, 'ResearchOps reviewers', 'research operations staff')
	WHERE id = NEW.id;
END;

UPDATE rops_repository_artefacts
SET
	user_group = 'research-operations-staff',
	title = REPLACE(title, 'ResearchOps reviewers', 'research operations staff'),
	summary = REPLACE(summary, 'ResearchOps reviewers', 'research operations staff'),
	reuse_guidance = REPLACE(reuse_guidance, 'ResearchOps reviewers', 'research operations staff')
WHERE user_group = 'research-operations-team';

CREATE TRIGGER IF NOT EXISTS trg_repository_seed_topic_taxonomy
AFTER INSERT ON rops_repository_artefact_tags
WHEN NEW.tag_type = 'topic' AND NEW.tag_slug LIKE 'seeded-topic-%' AND NEW.artefact_id LIKE 'seeded-published-%'
BEGIN
	UPDATE rops_repository_artefact_tags
	SET
		tag_slug = (
			SELECT artefact.risk_area
			FROM rops_repository_artefacts artefact
			WHERE artefact.id = NEW.artefact_id
		),
		tag_label = (
			SELECT CASE artefact.risk_area
				WHEN 'confidence-and-comprehension' THEN 'Confidence and comprehension'
				WHEN 'workflow-friction' THEN 'Workflow friction'
				WHEN 'governance-and-consent' THEN 'Governance and consent'
				WHEN 'handoff-risk' THEN 'Handoff risk'
				WHEN 'transaction-failure' THEN 'Transaction failure'
				WHEN 'evidence-misuse' THEN 'Evidence misuse'
				ELSE 'Repository evidence theme'
			END
			FROM rops_repository_artefacts artefact
			WHERE artefact.id = NEW.artefact_id
		)
	WHERE artefact_id = NEW.artefact_id AND tag_slug = NEW.tag_slug AND tag_type = NEW.tag_type;
END;

CREATE TRIGGER IF NOT EXISTS trg_repository_seed_recommendation_taxonomy
AFTER INSERT ON rops_repository_artefact_tags
WHEN NEW.tag_type = 'recommendation' AND NEW.tag_slug LIKE 'rec-seeded-%' AND NEW.artefact_id LIKE 'seeded-published-%'
BEGIN
	UPDATE rops_repository_artefact_tags
	SET
		tag_slug = (
			SELECT CASE artefact.risk_area
				WHEN 'confidence-and-comprehension' THEN 'rec-explain-confidence-and-next-steps'
				WHEN 'workflow-friction' THEN 'rec-reduce-avoidable-workflow-friction'
				WHEN 'governance-and-consent' THEN 'rec-confirm-consent-and-governance-boundaries'
				WHEN 'handoff-risk' THEN 'rec-clarify-handoff-owner-and-next-action'
				WHEN 'transaction-failure' THEN 'rec-make-recovery-routes-explicit'
				WHEN 'evidence-misuse' THEN 'rec-state-evidence-limits-before-reuse'
				ELSE 'rec-check-source-context-before-reuse'
			END
			FROM rops_repository_artefacts artefact
			WHERE artefact.id = NEW.artefact_id
		),
		tag_label = (
			SELECT CASE artefact.risk_area
				WHEN 'confidence-and-comprehension' THEN 'Explain confidence and next steps'
				WHEN 'workflow-friction' THEN 'Reduce avoidable workflow friction'
				WHEN 'governance-and-consent' THEN 'Confirm consent and governance boundaries'
				WHEN 'handoff-risk' THEN 'Clarify handoff owner and next action'
				WHEN 'transaction-failure' THEN 'Make recovery routes explicit'
				WHEN 'evidence-misuse' THEN 'State evidence limits before reuse'
				ELSE 'Check source context before reuse'
			END
			FROM rops_repository_artefacts artefact
			WHERE artefact.id = NEW.artefact_id
		)
	WHERE artefact_id = NEW.artefact_id AND tag_slug = NEW.tag_slug AND tag_type = NEW.tag_type;
END;

UPDATE rops_repository_artefact_tags
SET
	tag_slug = (
		SELECT artefact.risk_area
		FROM rops_repository_artefacts artefact
		WHERE artefact.id = rops_repository_artefact_tags.artefact_id
	),
	tag_label = (
		SELECT CASE artefact.risk_area
			WHEN 'confidence-and-comprehension' THEN 'Confidence and comprehension'
			WHEN 'workflow-friction' THEN 'Workflow friction'
			WHEN 'governance-and-consent' THEN 'Governance and consent'
			WHEN 'handoff-risk' THEN 'Handoff risk'
			WHEN 'transaction-failure' THEN 'Transaction failure'
			WHEN 'evidence-misuse' THEN 'Evidence misuse'
			ELSE 'Repository evidence theme'
		END
		FROM rops_repository_artefacts artefact
		WHERE artefact.id = rops_repository_artefact_tags.artefact_id
	)
WHERE tag_type = 'topic' AND tag_slug LIKE 'seeded-topic-%' AND artefact_id LIKE 'seeded-published-%';

UPDATE rops_repository_artefact_tags
SET
	tag_slug = (
		SELECT CASE artefact.risk_area
			WHEN 'confidence-and-comprehension' THEN 'rec-explain-confidence-and-next-steps'
			WHEN 'workflow-friction' THEN 'rec-reduce-avoidable-workflow-friction'
			WHEN 'governance-and-consent' THEN 'rec-confirm-consent-and-governance-boundaries'
			WHEN 'handoff-risk' THEN 'rec-clarify-handoff-owner-and-next-action'
			WHEN 'transaction-failure' THEN 'rec-make-recovery-routes-explicit'
			WHEN 'evidence-misuse' THEN 'rec-state-evidence-limits-before-reuse'
			ELSE 'rec-check-source-context-before-reuse'
		END
		FROM rops_repository_artefacts artefact
		WHERE artefact.id = rops_repository_artefact_tags.artefact_id
	),
	tag_label = (
		SELECT CASE artefact.risk_area
			WHEN 'confidence-and-comprehension' THEN 'Explain confidence and next steps'
			WHEN 'workflow-friction' THEN 'Reduce avoidable workflow friction'
			WHEN 'governance-and-consent' THEN 'Confirm consent and governance boundaries'
			WHEN 'handoff-risk' THEN 'Clarify handoff owner and next action'
			WHEN 'transaction-failure' THEN 'Make recovery routes explicit'
			WHEN 'evidence-misuse' THEN 'State evidence limits before reuse'
			ELSE 'Check source context before reuse'
		END
		FROM rops_repository_artefacts artefact
		WHERE artefact.id = rops_repository_artefact_tags.artefact_id
	)
WHERE tag_type = 'recommendation' AND tag_slug LIKE 'rec-seeded-%' AND artefact_id LIKE 'seeded-published-%';

INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved) VALUES
	('repository.view', 'View research repository', 'Can view published, non-PII research repository artefacts.', 1, 0),
	('repository.curate', 'Curate research repository', 'Can review candidate artefacts and manage repository publication queues.', 1, 0);

INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code) VALUES
	('role_researcher', 'repository.view'),
	('role_research_lead', 'repository.view'),
	('role_research_lead', 'repository.curate'),
	('role_team_admin', 'repository.view'),
	('role_team_admin', 'repository.curate');

INSERT OR IGNORE INTO auth_route_permissions (id, method, route_pattern, required_permissions_json, auth_required, implementation_status) VALUES
	('route_api_repository_get', 'GET', '/api/repository', '["repository.view"]', 1, 'implemented'),
	('route_api_repository_artefacts_get', 'GET', '/api/repository/artefacts', '["repository.view"]', 1, 'implemented'),
	('route_api_repository_artefact_get', 'GET', '/api/repository/artefacts/:id', '["repository.view"]', 1, 'implemented'),
	('route_api_repository_artefacts_post', 'POST', '/api/repository/artefacts', '["repository.curate"]', 1, 'implemented');
