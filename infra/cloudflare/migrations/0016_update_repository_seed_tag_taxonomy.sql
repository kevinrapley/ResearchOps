-- Remove generated seed tags and normalise seeded user-group copy.
-- Date: 2026-06-07
-- Scope: remove non-production topic and recommendation rows from seeded repository artefacts.

UPDATE rops_repository_artefacts
SET
	user_group = 'research-operations-staff',
	title = REPLACE(title, 'ResearchOps reviewers', 'research operations staff'),
	summary = REPLACE(summary, 'ResearchOps reviewers', 'research operations staff'),
	reuse_guidance = REPLACE(reuse_guidance, 'ResearchOps reviewers', 'research operations staff')
WHERE user_group = 'research-operations-team';

DELETE FROM rops_repository_artefact_tags
WHERE
	artefact_id IN (
		SELECT id
		FROM rops_repository_artefacts
		WHERE source_project_id LIKE 'proj-seeded-%'
	)
	AND tag_type = 'topic';

DELETE FROM rops_repository_artefact_tags
WHERE
	artefact_id IN (
		SELECT id
		FROM rops_repository_artefacts
		WHERE source_project_id LIKE 'proj-seeded-%'
	)
	AND tag_type = 'recommendation';

INSERT OR IGNORE INTO rops_repository_audit (id, artefact_id, action, actor_user_id, created_at, payload_json) VALUES
	('audit-repository-remove-seed-tags-20260607', NULL, 'remove_repository_seed_tags', 'system_migration', '2026-06-07T14:00:00Z', '{"migration":"0016_update_repository_seed_tag_taxonomy.sql","purpose":"Remove generated seed topic and recommendation rows and normalise seeded user-group copy."}');
