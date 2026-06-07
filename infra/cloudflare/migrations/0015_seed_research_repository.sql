-- Seed curated research repository records for realistic product evaluation.
-- Date: 2026-06-07
-- Scope: non-PII, consent-confirmed, reviewed artefacts plus curator queue records.
-- These rows deliberately avoid participant names, contact details, consent records,
-- transcripts, recordings, raw notes, draft synthesis and recruitment data.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO rops_repository_artefacts (
	id,
	title,
	summary,
	artefact_type,
	status,
	confidence,
	evidence_maturity,
	service_area,
	user_group,
	method,
	risk_area,
	source_project_id,
	source_study_id,
	source_method,
	sample_summary,
	limitations,
	reuse_guidance,
	do_not_use_for,
	owner_user_id,
	reviewed_by_user_id,
	pii_cleared,
	consent_scope_confirmed,
	active,
	created_at,
	updated_at,
	published_at,
	review_due_at,
	payload_json
) VALUES
	(
		'staff-evidence-boundaries',
		'Staff need clearer evidence boundaries before reuse',
		'Delivery teams reuse findings more confidently when each artefact states the source context, confidence level and where the evidence should not be applied.',
		'Service pattern',
		'published',
		'high',
		'validated-learning',
		'casework',
		'frontline-staff',
		'interviews',
		'evidence-misuse',
		'proj-repository-foundations',
		'study-staff-reuse-boundaries',
		'Moderated staff interviews',
		'12 staff interviews across casework, triage and quality assurance roles; all evidence is summarised and non-identifying.',
		'Evidence is strongest for high-volume casework teams and less tested in specialist investigation services.',
		'Use when publishing or reusing findings across service areas. Include boundaries alongside recommendations and design decisions.',
		'Do not use as a substitute for fresh research where policy, eligibility or channel constraints differ materially.',
		'user_research_ops_lead',
		'user_senior_researcher',
		1,
		1,
		1,
		'2026-04-12T09:00:00Z',
		'2026-06-02T14:30:00Z',
		'2026-06-02T14:30:00Z',
		'2026-07-01',
		'{"linkedRecommendations":["rec-evidence-boundary-template","rec-review-before-cross-service-reuse"],"dateRange":"2026-03 to 2026-04","clearance":"summary-only"}'
	),
	(
		'check-answers-review-anxiety',
		'Check answers pages can increase review anxiety',
		'Users who are unsure about evidence requirements often re-read check answers pages several times unless the page makes next steps and correction options explicit.',
		'Finding',
		'published',
		'medium',
		'reviewed-evidence',
		'applications',
		'public-users',
		'usability-testing',
		'confidence-and-comprehension',
		'proj-apply-service-patterns',
		'study-check-answers-confidence',
		'Task-based usability testing',
		'8 usability sessions with mixed digital confidence; findings are aggregated by behaviour pattern only.',
		'The study focused on form-heavy journeys and did not include assisted digital support sessions.',
		'Use when designing final review steps, correction links and confirmation pages for application services.',
		'Do not generalise to simple notification-only journeys without further validation.',
		'user_researcher_applications',
		'user_research_ops_lead',
		1,
		1,
		1,
		'2026-03-20T10:15:00Z',
		'2026-05-28T11:00:00Z',
		'2026-05-28T11:00:00Z',
		'2026-06-24',
		'{"linkedRecommendations":["rec-check-answers-next-steps"],"dateRange":"2026-02 to 2026-03","clearance":"summary-only"}'
	),
	(
		'consent-state-workarounds',
		'Consent state workarounds create avoidable operational risk',
		'Teams create local tracking workarounds when consent scope, withdrawal state and reuse clearance are not visible in one governed place.',
		'Risk insight',
		'published',
		'high',
		'validated-learning',
		'research-operations',
		'researchers',
		'service-review',
		'governance-and-consent',
		'proj-consent-foundation',
		'study-consent-operations-review',
		'Operational service review',
		'Review of anonymised workflow steps and team practices across research planning and repository release.',
		'Findings describe process risk and do not evaluate a live participant-facing consent product.',
		'Use when prioritising consent-state visibility, repository release checks and withdrawal handling.',
		'Do not expose consent records or infer individual participant preferences from this artefact.',
		'user_research_ops_lead',
		'user_data_governance_lead',
		1,
		1,
		1,
		'2026-04-01T09:45:00Z',
		'2026-05-21T16:20:00Z',
		'2026-05-21T16:20:00Z',
		'2026-08-21',
		'{"linkedRecommendations":["rec-consent-state-before-release","rec-withdrawal-signal-in-repository"],"dateRange":"2026-03 to 2026-04","clearance":"process-summary"}'
	),
	(
		'lightweight-capture-before-tagging',
		'Lightweight capture is needed before detailed tagging',
		'Researchers are more likely to submit reusable evidence when they can save a concise candidate artefact before completing taxonomy, provenance and release checks.',
		'Opportunity',
		'published',
		'medium',
		'reviewed-evidence',
		'research-operations',
		'researchers',
		'journey-mapping',
		'workflow-friction',
		'proj-repository-foundations',
		'study-publish-workflow',
		'Researcher journey mapping',
		'Journey mapping with 9 researchers and research leads using aggregated workflow observations.',
		'The evidence does not yet cover very large programmes with dedicated research librarians.',
		'Use when designing publish-to-repository journeys and candidate capture forms.',
		'Do not use to remove required PII, consent or reviewer checks before publication.',
		'user_researcher_repository',
		'user_research_ops_lead',
		1,
		1,
		1,
		'2026-04-18T13:00:00Z',
		'2026-05-30T09:10:00Z',
		'2026-05-30T09:10:00Z',
		'2026-09-30',
		'{"linkedRecommendations":["rec-save-candidate-before-taxonomy"],"dateRange":"2026-04 to 2026-05","clearance":"summary-only"}'
	),
	(
		'assisted-digital-handoff-language',
		'Assisted digital handoffs need plain ownership language',
		'Users and support staff understand handoffs better when each step states who owns the next action and what evidence is needed.',
		'Content pattern',
		'published',
		'medium',
		'reviewed-evidence',
		'support',
		'assisted-digital-users',
		'content-testing',
		'handoff-risk',
		'proj-assisted-digital-support',
		'study-handoff-content',
		'Content testing',
		'10 content testing sessions using anonymised scenarios and non-identifying task prompts.',
		'Findings are strongest for telephone-supported journeys and need further validation for face-to-face channels.',
		'Use when writing support handoff, evidence request and escalation content.',
		'Do not use as a script for regulated advice or case-specific decision making.',
		'user_content_researcher',
		'user_senior_content_designer',
		1,
		1,
		1,
		'2026-02-18T11:00:00Z',
		'2026-05-16T10:00:00Z',
		'2026-05-16T10:00:00Z',
		'2026-07-16',
		'{"linkedRecommendations":["rec-name-next-action-owner"],"dateRange":"2026-01 to 2026-02","clearance":"summary-only"}'
	),
	(
		'evidence-upload-retry-patterns',
		'Evidence upload journeys need explicit retry states',
		'Users lose confidence when upload failures do not distinguish file problems, connection problems and service-side delays.',
		'Design pattern',
		'published',
		'high',
		'validated-learning',
		'applications',
		'public-users',
		'usability-testing',
		'transaction-failure',
		'proj-evidence-upload',
		'study-upload-retries',
		'Prototype usability testing',
		'14 usability sessions using synthetic files and simulated service responses.',
		'The tested prototype did not include third-party document providers.',
		'Use when designing upload failure messages, retry actions and confirmation states.',
		'Do not use to define security scanning policy or file retention rules.',
		'user_researcher_applications',
		'user_service_designer',
		1,
		1,
		1,
		'2026-03-05T09:30:00Z',
		'2026-05-12T15:40:00Z',
		'2026-05-12T15:40:00Z',
		'2026-08-12',
		'{"linkedRecommendations":["rec-show-retry-reason","rec-preserve-upload-progress"],"dateRange":"2026-02 to 2026-03","clearance":"summary-only"}'
	),
	(
		'caseworker-dashboard-scan-order',
		'Caseworker dashboards work better when urgency and ownership scan together',
		'Staff scan queues faster when urgency, owner and next action are grouped before secondary metadata.',
		'Service pattern',
		'published',
		'high',
		'validated-learning',
		'casework',
		'frontline-staff',
		'contextual-inquiry',
		'operational-prioritisation',
		'proj-casework-queue',
		'study-dashboard-scan-order',
		'Contextual inquiry',
		'Observation and playback with 11 staff members using anonymised queue examples.',
		'The insight applies to dashboard scan order, not to automated prioritisation logic.',
		'Use when designing queue tables, work allocation panels and case overview pages.',
		'Do not use to infer risk scoring rules or staff performance measures.',
		'user_service_designer',
		'user_research_ops_lead',
		1,
		1,
		1,
		'2026-01-22T14:00:00Z',
		'2026-04-29T12:45:00Z',
		'2026-04-29T12:45:00Z',
		'2026-06-20',
		'{"linkedRecommendations":["rec-group-urgency-owner-action"],"dateRange":"2026-01","clearance":"summary-only"}'
	),
	(
		'notification-timing-after-manual-review',
		'Manual review notifications should explain timing uncertainty',
		'People are less likely to contact support unnecessarily when notification content explains the review window and what will happen if more evidence is needed.',
		'Finding',
		'published',
		'medium',
		'reviewed-evidence',
		'notifications',
		'public-users',
		'survey-analysis',
		'expectation-management',
		'proj-notification-patterns',
		'study-manual-review-updates',
		'Survey analysis',
		'Aggregated survey responses from 186 users, with all free-text responses summarised into non-identifying themes.',
		'Survey participants were self-selecting and findings should be paired with service analytics where possible.',
		'Use when drafting status update emails, SMS content and account messages after manual review.',
		'Do not use to commit to operational service-level agreements without delivery evidence.',
		'user_content_researcher',
		'user_senior_researcher',
		1,
		1,
		1,
		'2026-02-26T08:30:00Z',
		'2026-05-09T10:25:00Z',
		'2026-05-09T10:25:00Z',
		'2026-09-09',
		'{"linkedRecommendations":["rec-explain-review-window"],"dateRange":"2026-02","clearance":"theme-summary"}'
	),
	(
		'eligibility-precheck-language',
		'Eligibility pre-checks need stronger uncertainty language',
		'Users can mistake a pre-check result for a final decision unless the page explains what has and has not been assessed.',
		'Content pattern',
		'published',
		'medium',
		'early-signal',
		'applications',
		'public-users',
		'content-testing',
		'eligibility-misinterpretation',
		'proj-eligibility-patterns',
		'study-precheck-language',
		'Content testing',
		'6 content testing sessions with synthetic eligibility examples.',
		'This is an early signal and should be tested again in a live service context.',
		'Use when writing eligibility pre-checks, result summaries and onward action content.',
		'Do not use as legal or policy wording for entitlement decisions.',
		'user_content_designer',
		'user_policy_research_lead',
		1,
		1,
		1,
		'2026-05-05T10:00:00Z',
		'2026-06-01T09:00:00Z',
		'2026-06-01T09:00:00Z',
		'2026-07-05',
		'{"linkedRecommendations":["rec-precheck-not-final-decision"],"dateRange":"2026-05","clearance":"summary-only"}'
	),
	(
		'researcher-review-queue-triage',
		'Repository review queues need visible triage reasons',
		'Curators review candidate artefacts faster when queue rows show why the item needs attention, not just its current status.',
		'Operational pattern',
		'published',
		'medium',
		'reviewed-evidence',
		'research-operations',
		'research-operations-team',
		'service-review',
		'curation-throughput',
		'proj-repository-foundations',
		'study-curator-workbench',
		'Operational service review',
		'Playback with ResearchOps reviewers using synthetic queue records and anonymised workflow summaries.',
		'The evidence is based on repository curation work and may not apply to unrelated moderation workflows.',
		'Use when designing candidate, stale and withdrawn artefact queues.',
		'Do not use to bypass reviewer judgement or publication clearance checks.',
		'user_research_ops_lead',
		'user_product_manager',
		1,
		1,
		1,
		'2026-04-25T15:15:00Z',
		'2026-06-03T13:10:00Z',
		'2026-06-03T13:10:00Z',
		'2026-10-03',
		'{"linkedRecommendations":["rec-show-triage-reason-in-queue"],"dateRange":"2026-04 to 2026-05","clearance":"workflow-summary"}'
	),
	(
		'candidate-assisted-digital-escalation',
		'Assisted digital escalation evidence pending review',
		'Candidate summary about assisted digital escalation points. It is not visible to ordinary repository users until review and clearance are complete.',
		'Candidate finding',
		'candidate',
		'low',
		'early-signal',
		'support',
		'assisted-digital-users',
		'interviews',
		'handoff-risk',
		'proj-assisted-digital-support',
		'study-escalation-points',
		'Moderated interviews',
		'Draft candidate summary based on aggregated themes only.',
		'Pending review.',
		'Use only after curation review.',
		'Do not publish before PII clearance and consent-scope confirmation.',
		'user_researcher_support',
		NULL,
		0,
		0,
		1,
		'2026-06-05T11:00:00Z',
		'2026-06-05T11:00:00Z',
		NULL,
		'2026-06-19',
		'{"queueReason":"Needs reviewer assignment and release checks."}'
	),
	(
		'candidate-taxonomy-gaps',
		'Repository taxonomy gaps pending curation',
		'Candidate operational evidence about missing taxonomy terms. It remains outside published search until reviewed.',
		'Candidate opportunity',
		'candidate',
		'low',
		'early-signal',
		'research-operations',
		'researchers',
		'service-review',
		'workflow-friction',
		'proj-repository-foundations',
		'study-taxonomy-feedback',
		'Operational service review',
		'Aggregated feedback from repository publishing walkthroughs.',
		'Pending curation and taxonomy review.',
		'Use only to triage repository taxonomy backlog.',
		'Do not expose as a published artefact before review.',
		'user_researcher_repository',
		NULL,
		0,
		0,
		1,
		'2026-06-06T09:20:00Z',
		'2026-06-06T09:20:00Z',
		NULL,
		'2026-06-21',
		'{"queueReason":"Needs taxonomy and publication boundary review."}'
	),
	(
		'withdrawn-outdated-channel-insight',
		'Outdated channel preference insight withdrawn',
		'This artefact is retained as a governed record but withdrawn from repository search because the service channel mix has changed.',
		'Finding',
		'withdrawn',
		'low',
		'superseded',
		'notifications',
		'public-users',
		'survey-analysis',
		'channel-change',
		'proj-notification-patterns',
		'study-legacy-channel-preference',
		'Survey analysis',
		'Legacy aggregated survey themes.',
		'Superseded by newer channel evidence.',
		'Use only for audit trail context.',
		'Do not use for current design decisions.',
		'user_content_researcher',
		'user_research_ops_lead',
		1,
		1,
		1,
		'2025-11-10T10:00:00Z',
		'2026-06-04T10:00:00Z',
		NULL,
		'2026-06-04',
		'{"withdrawalReason":"Superseded by newer research and channel data."}'
	);

INSERT OR IGNORE INTO rops_repository_artefacts (
	id,
	title,
	summary,
	artefact_type,
	status,
	confidence,
	evidence_maturity,
	service_area,
	user_group,
	method,
	risk_area,
	source_project_id,
	source_study_id,
	source_method,
	sample_summary,
	limitations,
	reuse_guidance,
	do_not_use_for,
	owner_user_id,
	reviewed_by_user_id,
	pii_cleared,
	consent_scope_confirmed,
	active,
	created_at,
	updated_at,
	published_at,
	review_due_at,
	payload_json
)
WITH
	service_dimension(service_area, service_label) AS (
		VALUES
			('applications', 'Application journeys'),
			('casework', 'Casework operations'),
			('support', 'Support channels'),
			('notifications', 'Notification services'),
			('research-operations', 'Research Operations')
	),
	group_dimension(user_group, user_group_label) AS (
		VALUES
			('public-users', 'public users'),
			('assisted-digital-users', 'assisted digital users'),
			('frontline-staff', 'frontline staff'),
			('researchers', 'researchers'),
			('research-operations-team', 'ResearchOps reviewers')
	),
	method_dimension(method, method_label, source_method) AS (
		VALUES
			('usability-testing', 'usability testing', 'Task-based usability testing'),
			('interviews', 'interviews', 'Moderated interviews'),
			('content-testing', 'content testing', 'Content testing'),
			('survey-analysis', 'survey analysis', 'Survey analysis'),
			('contextual-inquiry', 'contextual inquiry', 'Contextual inquiry'),
			('service-review', 'service review', 'Operational service review')
	),
	risk_dimension(risk_area, risk_label) AS (
		VALUES
			('confidence-and-comprehension', 'confidence and comprehension'),
			('workflow-friction', 'workflow friction'),
			('governance-and-consent', 'governance and consent'),
			('handoff-risk', 'handoff risk'),
			('transaction-failure', 'transaction failure'),
			('evidence-misuse', 'evidence misuse')
	),
	generated AS (
		SELECT
			row_number() OVER (ORDER BY service_area, user_group, method, risk_area) AS rn,
			service_area,
			service_label,
			user_group,
			user_group_label,
			method,
			method_label,
			source_method,
			risk_area,
			risk_label
		FROM service_dimension
		CROSS JOIN group_dimension
		CROSS JOIN method_dimension
		CROSS JOIN risk_dimension
		LIMIT 90
	)
SELECT
	printf('seeded-published-%03d', rn),
	printf('%s evidence for %s: %s', service_label, user_group_label, risk_label),
	printf('Curated repository summary showing what %s evidence tells teams about %s in %s. The artefact is a synthesised, non-identifying summary for reuse planning.', method_label, risk_label, lower(service_label)),
	CASE rn % 5
		WHEN 0 THEN 'Finding'
		WHEN 1 THEN 'Service pattern'
		WHEN 2 THEN 'Content pattern'
		WHEN 3 THEN 'Design pattern'
		ELSE 'Risk insight'
	END,
	'published',
	CASE rn % 3
		WHEN 0 THEN 'high'
		WHEN 1 THEN 'medium'
		ELSE 'low'
	END,
	CASE rn % 4
		WHEN 0 THEN 'validated-learning'
		WHEN 1 THEN 'reviewed-evidence'
		WHEN 2 THEN 'early-signal'
		ELSE 'reviewed-evidence'
	END,
	service_area,
	user_group,
	method,
	risk_area,
	printf('proj-seeded-%s', service_area),
	printf('study-seeded-%03d', rn),
	source_method,
	printf('Aggregated summary from %d non-identifying research inputs. Evidence is recorded as themes, behaviours and service observations only.', 6 + (rn % 15)),
	printf('This seeded artefact supports product evaluation. Validate with current service evidence before making high-risk delivery or policy decisions.'),
	printf('Use when comparing %s, %s and %s evidence across repository categories.', service_label, user_group_label, risk_label),
	printf('Do not use to infer participant-level behaviour, make eligibility decisions, or replace service-specific research for materially different constraints.'),
	'user_seed_researcher',
	'user_seed_reviewer',
	1,
	1,
	1,
	datetime('2026-01-01T09:00:00Z', printf('+%d days', rn)),
	datetime('2026-04-01T09:00:00Z', printf('+%d days', rn)),
	datetime('2026-04-01T09:00:00Z', printf('+%d days', rn)),
	date('2026-06-01', printf('+%d days', rn % 120)),
	printf('{"linkedRecommendations":["rec-seeded-%03d"],"dateRange":"2026 seeded evaluation set","clearance":"summary-only","seeded":true}', rn)
FROM generated;

INSERT OR IGNORE INTO rops_repository_artefacts (
	id,
	title,
	summary,
	artefact_type,
	status,
	confidence,
	evidence_maturity,
	service_area,
	user_group,
	method,
	risk_area,
	source_project_id,
	source_study_id,
	source_method,
	sample_summary,
	limitations,
	reuse_guidance,
	do_not_use_for,
	owner_user_id,
	reviewed_by_user_id,
	pii_cleared,
	consent_scope_confirmed,
	active,
	created_at,
	updated_at,
	published_at,
	review_due_at,
	payload_json
)
WITH RECURSIVE n(value) AS (
	SELECT 1
	UNION ALL
	SELECT value + 1 FROM n WHERE value < 18
)
SELECT
	printf('seeded-candidate-%03d', value),
	printf('Candidate repository artefact %03d pending review', value),
	'Candidate summary held for curation. It is not visible to ordinary repository users until review, PII clearance and consent-scope confirmation are complete.',
	'Candidate artefact',
	'candidate',
	'low',
	'early-signal',
	CASE value % 5
		WHEN 0 THEN 'applications'
		WHEN 1 THEN 'casework'
		WHEN 2 THEN 'support'
		WHEN 3 THEN 'notifications'
		ELSE 'research-operations'
	END,
	CASE value % 4
		WHEN 0 THEN 'public-users'
		WHEN 1 THEN 'frontline-staff'
		WHEN 2 THEN 'researchers'
		ELSE 'assisted-digital-users'
	END,
	CASE value % 3
		WHEN 0 THEN 'interviews'
		WHEN 1 THEN 'service-review'
		ELSE 'content-testing'
	END,
	CASE value % 3
		WHEN 0 THEN 'workflow-friction'
		WHEN 1 THEN 'handoff-risk'
		ELSE 'evidence-misuse'
	END,
	'proj-seeded-candidates',
	printf('study-seeded-candidate-%03d', value),
	'Candidate capture',
	'Draft candidate summary based on aggregated, non-identifying themes only.',
	'Pending curation.',
	'Use only after curation review.',
	'Do not publish before PII clearance and consent-scope confirmation.',
	'user_seed_researcher',
	NULL,
	0,
	0,
	1,
	datetime('2026-06-01T09:00:00Z', printf('+%d hours', value)),
	datetime('2026-06-01T09:00:00Z', printf('+%d hours', value)),
	NULL,
	date('2026-06-14', printf('+%d days', value)),
	printf('{"queueReason":"Seeded candidate %03d needs reviewer assignment and release checks."}', value)
FROM n;

INSERT OR IGNORE INTO rops_repository_artefacts (
	id,
	title,
	summary,
	artefact_type,
	status,
	confidence,
	evidence_maturity,
	service_area,
	user_group,
	method,
	risk_area,
	source_project_id,
	source_study_id,
	source_method,
	sample_summary,
	limitations,
	reuse_guidance,
	do_not_use_for,
	owner_user_id,
	reviewed_by_user_id,
	pii_cleared,
	consent_scope_confirmed,
	active,
	created_at,
	updated_at,
	published_at,
	review_due_at,
	payload_json
)
WITH RECURSIVE n(value) AS (
	SELECT 1
	UNION ALL
	SELECT value + 1 FROM n WHERE value < 9
)
SELECT
	printf('seeded-withdrawn-%03d', value),
	printf('Withdrawn repository artefact %03d retained for audit', value),
	'Withdrawn governed record retained for curator inspection. It is excluded from ordinary repository search because the evidence is superseded or no longer suitable for reuse.',
	'Withdrawn artefact',
	'withdrawn',
	'low',
	'superseded',
	CASE value % 5
		WHEN 0 THEN 'applications'
		WHEN 1 THEN 'casework'
		WHEN 2 THEN 'support'
		WHEN 3 THEN 'notifications'
		ELSE 'research-operations'
	END,
	'public-users',
	'survey-analysis',
	'channel-change',
	'proj-seeded-withdrawn',
	printf('study-seeded-withdrawn-%03d', value),
	'Legacy evidence review',
	'Legacy aggregated evidence summary.',
	'Superseded by newer service evidence.',
	'Use only for audit trail context.',
	'Do not use for current design, delivery or policy decisions.',
	'user_seed_researcher',
	'user_seed_reviewer',
	1,
	1,
	1,
	datetime('2025-09-01T09:00:00Z', printf('+%d days', value)),
	datetime('2026-05-01T09:00:00Z', printf('+%d days', value)),
	NULL,
	date('2026-05-01', printf('+%d days', value)),
	printf('{"withdrawalReason":"Seeded withdrawn artefact %03d is superseded by newer evidence."}', value)
FROM n;

INSERT OR IGNORE INTO rops_repository_artefact_tags (artefact_id, tag_slug, tag_label, tag_type) VALUES
	('staff-evidence-boundaries', 'cross-service-reuse', 'Cross-service reuse', 'topic'),
	('staff-evidence-boundaries', 'decision-support', 'Decision support', 'topic'),
	('staff-evidence-boundaries', 'rec-evidence-boundary-template', 'Evidence boundary template', 'recommendation'),
	('check-answers-review-anxiety', 'check-answers', 'Check answers', 'topic'),
	('check-answers-review-anxiety', 'confidence', 'Confidence', 'topic'),
	('check-answers-review-anxiety', 'rec-check-answers-next-steps', 'Explain next steps on review pages', 'recommendation'),
	('consent-state-workarounds', 'consent-scope', 'Consent scope', 'topic'),
	('consent-state-workarounds', 'release-governance', 'Release governance', 'topic'),
	('consent-state-workarounds', 'rec-consent-state-before-release', 'Confirm consent state before repository release', 'recommendation'),
	('consent-state-workarounds', 'rec-withdrawal-signal-in-repository', 'Show withdrawal signal in repository governance', 'recommendation'),
	('lightweight-capture-before-tagging', 'publish-workflow', 'Publish workflow', 'topic'),
	('lightweight-capture-before-tagging', 'candidate-capture', 'Candidate capture', 'topic'),
	('lightweight-capture-before-tagging', 'rec-save-candidate-before-taxonomy', 'Save candidate before taxonomy completion', 'recommendation'),
	('assisted-digital-handoff-language', 'assisted-digital', 'Assisted digital', 'topic'),
	('assisted-digital-handoff-language', 'handoff-content', 'Handoff content', 'topic'),
	('assisted-digital-handoff-language', 'rec-name-next-action-owner', 'Name the next action owner', 'recommendation'),
	('evidence-upload-retry-patterns', 'uploads', 'Uploads', 'topic'),
	('evidence-upload-retry-patterns', 'error-states', 'Error states', 'topic'),
	('evidence-upload-retry-patterns', 'rec-show-retry-reason', 'Show retry reason', 'recommendation'),
	('evidence-upload-retry-patterns', 'rec-preserve-upload-progress', 'Preserve upload progress where possible', 'recommendation'),
	('caseworker-dashboard-scan-order', 'queue-design', 'Queue design', 'topic'),
	('caseworker-dashboard-scan-order', 'staff-efficiency', 'Staff efficiency', 'topic'),
	('caseworker-dashboard-scan-order', 'rec-group-urgency-owner-action', 'Group urgency owner and next action', 'recommendation'),
	('notification-timing-after-manual-review', 'notifications', 'Notifications', 'topic'),
	('notification-timing-after-manual-review', 'manual-review', 'Manual review', 'topic'),
	('notification-timing-after-manual-review', 'rec-explain-review-window', 'Explain the review window', 'recommendation'),
	('eligibility-precheck-language', 'eligibility', 'Eligibility', 'topic'),
	('eligibility-precheck-language', 'uncertainty-language', 'Uncertainty language', 'topic'),
	('eligibility-precheck-language', 'rec-precheck-not-final-decision', 'Say a pre-check is not a final decision', 'recommendation'),
	('researcher-review-queue-triage', 'curator-workbench', 'Curator workbench', 'topic'),
	('researcher-review-queue-triage', 'queue-triage', 'Queue triage', 'topic'),
	('researcher-review-queue-triage', 'rec-show-triage-reason-in-queue', 'Show triage reason in queue rows', 'recommendation'),
	('candidate-assisted-digital-escalation', 'assisted-digital', 'Assisted digital', 'topic'),
	('candidate-taxonomy-gaps', 'taxonomy', 'Taxonomy', 'topic'),
	('withdrawn-outdated-channel-insight', 'withdrawn-record', 'Withdrawn record', 'topic');

INSERT OR IGNORE INTO rops_repository_artefact_tags (artefact_id, tag_slug, tag_label, tag_type)
WITH RECURSIVE n(value) AS (
	SELECT 1
	UNION ALL
	SELECT value + 1 FROM n WHERE value < 90
)
SELECT printf('seeded-published-%03d', value), printf('seeded-topic-%02d', value % 12), printf('Seeded topic %02d', value % 12), 'topic'
FROM n
UNION ALL
SELECT printf('seeded-published-%03d', value), printf('rec-seeded-%03d', value), printf('Seeded recommendation %03d', value), 'recommendation'
FROM n;

INSERT OR IGNORE INTO rops_repository_artefact_tags (artefact_id, tag_slug, tag_label, tag_type)
WITH RECURSIVE n(value) AS (
	SELECT 1
	UNION ALL
	SELECT value + 1 FROM n WHERE value < 18
)
SELECT printf('seeded-candidate-%03d', value), 'candidate-review', 'Candidate review', 'topic'
FROM n;

INSERT OR IGNORE INTO rops_repository_artefact_tags (artefact_id, tag_slug, tag_label, tag_type)
WITH RECURSIVE n(value) AS (
	SELECT 1
	UNION ALL
	SELECT value + 1 FROM n WHERE value < 9
)
SELECT printf('seeded-withdrawn-%03d', value), 'withdrawn-record', 'Withdrawn record', 'topic'
FROM n;

INSERT OR IGNORE INTO rops_repository_audit (id, artefact_id, action, actor_user_id, created_at, payload_json) VALUES
	('audit-repository-seed-20260607', NULL, 'seed_repository_demo_data', 'system_migration', '2026-06-07T12:00:00Z', '{"migration":"0015_seed_research_repository.sql","publishedArtefacts":100,"candidateArtefacts":20,"withdrawnArtefacts":10}'),
	('audit-staff-evidence-boundaries-published', 'staff-evidence-boundaries', 'published', 'user_senior_researcher', '2026-06-02T14:30:00Z', '{"clearance":"pii_cleared_and_consent_scope_confirmed"}'),
	('audit-check-answers-review-anxiety-published', 'check-answers-review-anxiety', 'published', 'user_research_ops_lead', '2026-05-28T11:00:00Z', '{"clearance":"pii_cleared_and_consent_scope_confirmed"}'),
	('audit-consent-state-workarounds-published', 'consent-state-workarounds', 'published', 'user_data_governance_lead', '2026-05-21T16:20:00Z', '{"clearance":"process_summary_only"}'),
	('audit-lightweight-capture-before-tagging-published', 'lightweight-capture-before-tagging', 'published', 'user_research_ops_lead', '2026-05-30T09:10:00Z', '{"clearance":"pii_cleared_and_consent_scope_confirmed"}'),
	('audit-withdrawn-outdated-channel-insight', 'withdrawn-outdated-channel-insight', 'withdrawn', 'user_research_ops_lead', '2026-06-04T10:00:00Z', '{"reason":"Superseded by newer channel evidence."}');
