-- Realistic Reflexive Journal, Codes and Memos seed for Test Project 1.
-- Project record ID: recgdpwEI5hF07bUZ
-- Local project ID: d04ab32e-6756-408e-a649-6859dd0079f2

CREATE TABLE IF NOT EXISTS "journal_entries" ("record_id" TEXT PRIMARY KEY, "project" TEXT, "category" TEXT, "content" TEXT, "tags" TEXT, "createdat" TEXT, "local_project_id" TEXT);
CREATE TABLE IF NOT EXISTS "memos" ("record_id" TEXT, "project" TEXT, "type" TEXT, "title" TEXT, "body" TEXT, "createdat" TEXT, "local_project_id" TEXT, "local_memo_id" TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS "codes" ("record_id" TEXT, "project" TEXT, "name" TEXT, "description" TEXT, "parentcode" TEXT, "colour" TEXT, "createdat" TEXT, "local_project_id" TEXT, "local_code_id" TEXT PRIMARY KEY);

CREATE INDEX IF NOT EXISTS idx_journal_entries_test_project_1_local_project_id ON journal_entries(local_project_id);
CREATE INDEX IF NOT EXISTS idx_memos_test_project_1_local_project_id ON memos(local_project_id);
CREATE INDEX IF NOT EXISTS idx_codes_test_project_1_local_project_id ON codes(local_project_id);

INSERT INTO journal_entries (record_id, project, category, content, tags, createdat, local_project_id) VALUES
('d1tp1_journal_001', 'recgdpwEI5hF07bUZ', 'perceptions', 'The project team is learning that evidence management is part of the service problem. People need to know what was learned, why it matters and how confident the team is before they can act on the research.', '["evidence-management","confidence","service-design"]', '2026-06-03T09:15:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2'),
('d1tp1_journal_002', 'recgdpwEI5hF07bUZ', 'procedures', 'A weekly triage routine now checks incoming research requests for decision dependency, available evidence, recruitment route and project timing before the team commits to new work.', '["triage","research-ops","planning"]', '2026-06-03T14:40:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2'),
('d1tp1_journal_003', 'recgdpwEI5hF07bUZ', 'decisions', 'The team decided to keep operations tracking separate from qualitative synthesis. Operational status and analysis should be linked, but they should not be collapsed into one view.', '["decision","operations","synthesis"]', '2026-06-04T10:05:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2'),
('d1tp1_journal_004', 'recgdpwEI5hF07bUZ', 'introspections', 'The strongest value of the platform may be that it slows down the right decisions while making routine research administration easier to manage.', '["reflection","governance","decision-quality"]', '2026-06-04T16:20:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2')
ON CONFLICT(record_id) DO UPDATE SET project = excluded.project, category = excluded.category, content = excluded.content, tags = excluded.tags, createdat = excluded.createdat, local_project_id = excluded.local_project_id;

INSERT INTO codes (record_id, project, name, description, parentcode, colour, createdat, local_project_id, local_code_id) VALUES
('d1tp1_code_evidence_quality', 'recgdpwEI5hF07bUZ', 'Evidence quality', 'Confidence depends on provenance, completeness and decision-readiness.', '', '#1d70b8ff', '2026-06-03T10:00:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_code_evidence_quality'),
('d1tp1_code_uncertainty_visible', 'recgdpwEI5hF07bUZ', 'Uncertainty made visible', 'Limitations and confidence boundaries are recorded rather than hidden.', 'd1tp1_code_evidence_quality', '#1d70b8ff', '2026-06-03T10:10:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_code_uncertainty_visible'),
('d1tp1_code_context_switching', 'recgdpwEI5hF07bUZ', 'Context switching', 'Work moves between tools, documents or mental models to understand project state.', '', '#00703cff', '2026-06-05T09:00:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_code_context_switching'),
('d1tp1_code_decision_trace', 'recgdpwEI5hF07bUZ', 'Decision trace', 'Evidence, uncertainty and trade-offs are connected to a project decision.', '', '#4c2c92ff', '2026-06-06T11:15:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_code_decision_trace')
ON CONFLICT(local_code_id) DO UPDATE SET record_id = excluded.record_id, project = excluded.project, name = excluded.name, description = excluded.description, parentcode = excluded.parentcode, colour = excluded.colour, createdat = excluded.createdat, local_project_id = excluded.local_project_id;

INSERT INTO memos (record_id, project, type, title, body, createdat, local_project_id, local_memo_id) VALUES
('d1tp1_memo_001', 'recgdpwEI5hF07bUZ', 'analytical', 'Evidence quality is becoming the organising problem', 'The early journal entries suggest the main issue is knowing when evidence is traceable, current and strong enough to support a decision. The service should foreground evidence readiness, provenance and limitations.', '2026-06-04T12:30:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_memo_001'),
('d1tp1_memo_002', 'recgdpwEI5hF07bUZ', 'methodological', 'Separate operations tracking from synthesis', 'Recruitment status, scheduling and planning belong in operational tracking. Codes, memos and journal entries belong in the analysis space. The connection should be visible without merging the two activities.', '2026-06-05T10:45:00.000Z', 'd04ab32e-6756-408e-a649-6859dd0079f2', 'd1tp1_memo_002')
ON CONFLICT(local_memo_id) DO UPDATE SET record_id = excluded.record_id, project = excluded.project, type = excluded.type, title = excluded.title, body = excluded.body, createdat = excluded.createdat, local_project_id = excluded.local_project_id;
