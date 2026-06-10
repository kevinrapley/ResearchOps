-- Realistic Reflexive Journal, Codes and Memos seed for Test Project 1.
-- Date: 2026-06-09
-- Scope: D1 runtime content for the Reflexive Journal & Analysis page.
--
-- Project: Test Project 1
-- Project record ID: recgdpwEI5hF07bUZ
-- Local project ID: d04ab32e-6756-408e-a649-6859dd0079f2
--
-- Records are fictional but realistic for a Home Office Biometrics discovery project.
-- They avoid real participant names and do not include sensitive operational details.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "journal_entries" (
	"record_id" TEXT PRIMARY KEY,
	"project" TEXT,
	"category" TEXT,
	"content" TEXT,
	"tags" TEXT,
	"createdat" TEXT,
	"local_project_id" TEXT
);

CREATE TABLE IF NOT EXISTS "memos" (
	"record_id" TEXT,
	"project" TEXT,
	"type" TEXT,
	"title" TEXT,
	"body" TEXT,
	"createdat" TEXT,
	"local_project_id" TEXT,
	"local_memo_id" TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "codes" (
	"record_id" TEXT,
	"project" TEXT,
	"name" TEXT,
	"description" TEXT,
	"parentcode" TEXT,
	"colour" TEXT,
	"createdat" TEXT,
	"local_project_id" TEXT,
	"local_code_id" TEXT PRIMARY KEY
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_test_project_1_local_project_id ON journal_entries(local_project_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_test_project_1_project ON journal_entries(project);
CREATE INDEX IF NOT EXISTS idx_memos_test_project_1_local_project_id ON memos(local_project_id);
CREATE INDEX IF NOT EXISTS idx_memos_test_project_1_project ON memos(project);
CREATE INDEX IF NOT EXISTS idx_codes_test_project_1_local_project_id ON codes(local_project_id);
CREATE INDEX IF NOT EXISTS idx_codes_test_project_1_project ON codes(project);

INSERT INTO journal_entries (
	record_id,
	project,
	category,
	content,
	tags,
	createdat,
	local_project_id
)
VALUES
	(
		'd1tp1_journal_001',
		'recgdpwEI5hF07bUZ',
		'perceptions',
		'Initial stakeholder conversations suggest the service problem is not just missing information. Researchers, policy colleagues and operational staff each hold part of the picture, but the handover between those perspectives is fragile. The project should treat evidence management as a service design issue rather than as an admin task.',
		'["evidence-management","handover","service-design"]',
		'2026-06-03T09:15:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_002',
		'recgdpwEI5hF07bUZ',
		'procedures',
		'Set up a weekly triage routine for incoming research requests. Each request is checked for decision dependency, participant risk, available evidence, recruitment route and whether a lightweight ethics review is enough. This has already reduced ambiguity in planning conversations.',
		'["triage","research-ops","ethics"]',
		'2026-06-03T14:40:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_003',
		'recgdpwEI5hF07bUZ',
		'decisions',
		'Decided to separate participant recruitment tracking from research insight synthesis. The same project needs both, but mixing them creates confusion about what is operational progress and what is evidence. The journal should make that distinction visible.',
		'["decision","recruitment","synthesis"]',
		'2026-06-04T10:05:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_004',
		'recgdpwEI5hF07bUZ',
		'introspections',
		'I noticed a pull towards making the platform prove its value through speed. That is only partly right. The stronger value is that it slows the right things down: consent, risk, inclusion, evidence quality and decisions that should not be rushed.',
		'["reflection","pace","governance"]',
		'2026-06-04T16:20:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_005',
		'recgdpwEI5hF07bUZ',
		'perceptions',
		'The phrase research repository means different things to different people. Some hear archive, some hear library and some hear assurance trail. The platform needs to support all three without forcing users to learn the internal operating model first.',
		'["repository","language","assurance"]',
		'2026-06-05T11:35:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_006',
		'recgdpwEI5hF07bUZ',
		'procedures',
		'Added a simple evidence readiness check before any artefact is promoted. The check asks whether the source is traceable, the participant context is understood, the limitation is documented and the finding can support a decision.',
		'["evidence-readiness","promotion","quality"]',
		'2026-06-05T15:10:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_007',
		'recgdpwEI5hF07bUZ',
		'decisions',
		'Decided that codes should describe observed service behaviour, not user attributes. For example, re-checking evidence and switching context are better codes than uncertain user or low confidence user. This reduces the risk of pathologising participants.',
		'["coding","ethics","behaviour"]',
		'2026-06-06T09:50:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	),
	(
		'd1tp1_journal_008',
		'recgdpwEI5hF07bUZ',
		'introspections',
		'The most useful moments in this work are where uncertainty becomes explicit. The journal should not feel like a diary bolted onto the service. It should behave like a thinking space that helps the team remember why a decision was reasonable at the time.',
		'["uncertainty","decision-trace","team-memory"]',
		'2026-06-06T17:25:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2'
	)
ON CONFLICT(record_id) DO UPDATE SET
	project = excluded.project,
	category = excluded.category,
	content = excluded.content,
	tags = excluded.tags,
	createdat = excluded.createdat,
	local_project_id = excluded.local_project_id;

INSERT INTO codes (
	record_id,
	project,
	name,
	description,
	parentcode,
	colour,
	createdat,
	local_project_id,
	local_code_id
)
VALUES
	(
		'd1tp1_code_evidence_quality',
		'recgdpwEI5hF07bUZ',
		'Evidence quality',
		'Moments where confidence depends on the provenance, completeness or decision-readiness of research evidence.',
		'',
		'#1d70b8ff',
		'2026-06-03T10:00:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_evidence_quality'
	),
	(
		'd1tp1_code_traceable_source',
		'recgdpwEI5hF07bUZ',
		'Traceable source',
		'Evidence can be linked back to a study, method, participant context or artefact without exposing sensitive detail.',
		'd1tp1_code_evidence_quality',
		'#1d70b8ff',
		'2026-06-03T10:05:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_traceable_source'
	),
	(
		'd1tp1_code_uncertainty_visible',
		'recgdpwEI5hF07bUZ',
		'Uncertainty made visible',
		'The team records limitations, unknowns or confidence boundaries instead of presenting early findings as settled facts.',
		'd1tp1_code_evidence_quality',
		'#1d70b8ff',
		'2026-06-03T10:10:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_uncertainty_visible'
	),
	(
		'd1tp1_code_governance_friction',
		'recgdpwEI5hF07bUZ',
		'Governance friction',
		'Process, approval or assurance activity that slows research without clearly improving participant safety or evidence quality.',
		'',
		'#f47738ff',
		'2026-06-04T09:20:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_governance_friction'
	),
	(
		'd1tp1_code_ethics_routine',
		'recgdpwEI5hF07bUZ',
		'Ethics as routine',
		'Ethics checks appear as part of everyday planning rather than as a late approval gate.',
		'd1tp1_code_governance_friction',
		'#f47738ff',
		'2026-06-04T09:25:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_ethics_routine'
	),
	(
		'd1tp1_code_context_switching',
		'recgdpwEI5hF07bUZ',
		'Context switching',
		'Researchers or stakeholders move between tools, documents or mental models to understand the current state of a project.',
		'',
		'#00703cff',
		'2026-06-05T09:00:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_context_switching'
	),
	(
		'd1tp1_code_research_ops_load',
		'recgdpwEI5hF07bUZ',
		'Research operations load',
		'Operational work required to plan, recruit, govern, document and share research before analysis can happen.',
		'd1tp1_code_context_switching',
		'#00703cff',
		'2026-06-05T09:05:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_research_ops_load'
	),
	(
		'd1tp1_code_decision_trace',
		'recgdpwEI5hF07bUZ',
		'Decision trace',
		'A recorded link between evidence, uncertainty, trade-offs and a project or service decision.',
		'',
		'#4c2c92ff',
		'2026-06-06T11:15:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_decision_trace'
	),
	(
		'd1tp1_code_participant_safeguard',
		'recgdpwEI5hF07bUZ',
		'Participant safeguard',
		'A design or operational choice that reduces risk, pressure, exclusion or accidental disclosure for participants.',
		'',
		'#d4351cff',
		'2026-06-06T11:20:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_participant_safeguard'
	),
	(
		'd1tp1_code_plain_language',
		'recgdpwEI5hF07bUZ',
		'Plain language',
		'Instructions, recruitment material or evidence summaries are written in language that participants and stakeholders can act on.',
		'd1tp1_code_participant_safeguard',
		'#d4351cff',
		'2026-06-06T11:25:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_code_plain_language'
	)
ON CONFLICT(local_code_id) DO UPDATE SET
	record_id = excluded.record_id,
	project = excluded.project,
	name = excluded.name,
	description = excluded.description,
	parentcode = excluded.parentcode,
	colour = excluded.colour,
	createdat = excluded.createdat,
	local_project_id = excluded.local_project_id;

INSERT INTO memos (
	record_id,
	project,
	type,
	title,
	body,
	createdat,
	local_project_id,
	local_memo_id
)
VALUES
	(
		'd1tp1_memo_001',
		'recgdpwEI5hF07bUZ',
		'analytical',
		'Evidence quality is becoming the organising problem',
		'Across the early journal entries, the strongest pattern is not lack of research activity. It is difficulty knowing when evidence is traceable, current and strong enough to support a decision. This suggests the service should foreground evidence readiness, provenance and limitations rather than only listing artefacts.',
		'2026-06-04T12:30:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_memo_001'
	),
	(
		'd1tp1_memo_002',
		'recgdpwEI5hF07bUZ',
		'methodological',
		'Separate operations tracking from synthesis',
		'The project needs both operational visibility and qualitative analysis, but they should not be collapsed into one view. Recruitment status, consent progress and scheduling belong in operational tracking. Codes, memos and journal entries belong in the analysis space. The connection between them should be explicit but not visually merged.',
		'2026-06-05T10:45:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_memo_002'
	),
	(
		'd1tp1_memo_003',
		'recgdpwEI5hF07bUZ',
		'reflexive',
		'Speed is not the only value proposition',
		'There is a risk that ResearchOps is framed only as a way to move faster. The more accountable framing is that the platform helps teams slow down the right decisions and move faster through repeatable admin. This distinction should influence copy, onboarding and success measures.',
		'2026-06-06T13:05:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_memo_003'
	),
	(
		'd1tp1_memo_004',
		'recgdpwEI5hF07bUZ',
		'theoretical',
		'Repository as assurance trail',
		'The repository concept has three overlapping functions: archive, working library and assurance trail. Treating it only as an archive underplays its value. The design should help users understand how a finding travels from session note to theme to decision, including what uncertainty was carried forward.',
		'2026-06-06T16:40:00.000Z',
		'd04ab32e-6756-408e-a649-6859dd0079f2',
		'd1tp1_memo_004'
	)
ON CONFLICT(local_memo_id) DO UPDATE SET
	record_id = excluded.record_id,
	project = excluded.project,
	type = excluded.type,
	title = excluded.title,
	body = excluded.body,
	createdat = excluded.createdat,
	local_project_id = excluded.local_project_id;
