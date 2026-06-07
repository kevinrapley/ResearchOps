-- Replace generated seed labels with production-like repository taxonomy labels.
-- Date: 2026-06-07
-- Scope: display-safe topic, recommendation and user-group labels for seeded published artefacts.

UPDATE rops_repository_artefacts
SET
	user_group = 'research-operations-staff',
	title = REPLACE(title, 'ResearchOps reviewers', 'research operations staff'),
	summary = REPLACE(summary, 'ResearchOps reviewers', 'research operations staff'),
	reuse_guidance = REPLACE(reuse_guidance, 'ResearchOps reviewers', 'research operations staff')
WHERE user_group = 'research-operations-team';

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
WHERE
	tag_type = 'topic'
	AND tag_slug LIKE 'seeded-topic-%'
	AND artefact_id LIKE 'seeded-published-%';

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
WHERE
	tag_type = 'recommendation'
	AND tag_slug LIKE 'rec-seeded-%'
	AND artefact_id LIKE 'seeded-published-%';

INSERT OR IGNORE INTO rops_repository_audit (id, artefact_id, action, actor_user_id, created_at, payload_json) VALUES
	('audit-repository-seed-tag-taxonomy-20260607', NULL, 'update_repository_seed_tag_taxonomy', 'system_migration', '2026-06-07T14:00:00Z', '{"migration":"0016_update_repository_seed_tag_taxonomy.sql","purpose":"Replace generated seed tag labels and user-group copy with production-like taxonomy."}');
