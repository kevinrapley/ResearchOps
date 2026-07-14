-- Local/preview Tree Test session fixture.
-- Run only against Wrangler's local D1 state. It creates fictional data for
-- manually exercising the Tree Test session route.

INSERT INTO rops_studies_cache (
	id, project_id, study_id, title, method, status, description, created_at,
	active, source, updated_at, payload_json
)
VALUES (
	'recTreeTest000001',
	'recgdpwEI5hFO7bUZ',
	'recTreeTest000001',
	'Passport and support navigation tree test',
	'Tree Test',
	'Planned',
	'Local fixture for testing the Tree Test participant session.',
	'2026-07-10T22:45:00.000Z',
	1,
	'local-tree-test-seed',
	'2026-07-10T22:45:00.000Z',
	'{"id":"recTreeTest000001","airtableId":"recTreeTest000001","recordId":"recTreeTest000001","projectId":"recgdpwEI5hFO7bUZ","projectIds":["recgdpwEI5hFO7bUZ"],"studyId":"recTreeTest000001","title":"Passport and support navigation tree test","method":"Tree Test","status":"Planned","description":"Local fixture for testing the Tree Test participant session.","createdAt":"2026-07-10T22:45:00.000Z"}'
)
ON CONFLICT(id) DO UPDATE SET
	project_id = excluded.project_id,
	study_id = excluded.study_id,
	title = excluded.title,
	method = excluded.method,
	status = excluded.status,
	description = excluded.description,
	active = 1,
	source = excluded.source,
	updated_at = excluded.updated_at,
	payload_json = excluded.payload_json;

INSERT INTO rops_participants_cache (
	id, project_id, study_id, participant_airtable_id, participant_ref, channel_pref,
	consent_status, status, access_needs, active, source, created_at, updated_at,
	sensitive_contact_json, payload_json
)
VALUES (
	'd1p_tree_test_01',
	'recgdpwEI5hFO7bUZ',
	'recTreeTest000001',
	NULL,
	'Tree Test Participant 01',
	'email',
	'recorded',
	'confirmed',
	'None recorded',
	1,
	'local-tree-test-seed',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z',
	NULL,
	'{"projectId":"recgdpwEI5hFO7bUZ","studyId":"recTreeTest000001","participantRef":"Tree Test Participant 01","accessNeeds":"None recorded","hasSensitiveDetails":false,"pseudonymised":true}'
)
ON CONFLICT(id) DO UPDATE SET
	project_id = excluded.project_id,
	study_id = excluded.study_id,
	participant_ref = excluded.participant_ref,
	channel_pref = excluded.channel_pref,
	consent_status = excluded.consent_status,
	status = excluded.status,
	access_needs = excluded.access_needs,
	active = 1,
	source = excluded.source,
	updated_at = excluded.updated_at,
	sensitive_contact_json = excluded.sensitive_contact_json,
	payload_json = excluded.payload_json;

INSERT INTO rops_consent_forms (
	id, study_id, title, form_type, status, version, source_markdown, variables_json,
	consent_items_json, plain_english_summary, accessibility_notes, review_notes, owner,
	published_at, created_at, updated_at, active, source, payload_json
)
VALUES (
	'd1cf_tree_test_01',
	'recTreeTest000001',
	'Tree Test participant consent',
	'Consent form',
	'Published',
	1,
	'# Tree Test participant consent',
	'{}',
	'[{"id":"participation","label":"I agree to take part in this research.","required":true},{"id":"voluntary","label":"I understand I can stop at any time.","required":true},{"id":"data-use","label":"I understand how my responses will be used.","required":true}]',
	'Fictional consent form for local Tree Test verification.',
	'',
	'',
	'Local ResearchOps fixture',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z',
	1,
	'local-tree-test-seed',
	'{"fixture":true,"sessionId":"d1sess_tree_test_01"}'
)
ON CONFLICT(id) DO UPDATE SET
	status = excluded.status,
	version = excluded.version,
	consent_items_json = excluded.consent_items_json,
	published_at = excluded.published_at,
	updated_at = excluded.updated_at,
	active = 1,
	source = excluded.source,
	payload_json = excluded.payload_json;

INSERT INTO rops_participant_consent_cache (
	id, study_id, participant_id, consent_form_id, consent_form_version, responses_json,
	status, capture_method, withdrawn, withdrawal_reason, recorded_by, recorded_at,
	created_at, updated_at, active, source, payload_json
)
VALUES (
	'd1pc_tree_test_01',
	'recTreeTest000001',
	'd1p_tree_test_01',
	'd1cf_tree_test_01',
	1,
	'{"participation":"agreed","voluntary":"agreed","data-use":"agreed"}',
	'Ready for session',
	'local fixture',
	0,
	NULL,
	'Local ResearchOps fixture',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z',
	1,
	'local-tree-test-seed',
	'{"fixture":true}'
)
ON CONFLICT(id) DO UPDATE SET
	consent_form_id = excluded.consent_form_id,
	consent_form_version = excluded.consent_form_version,
	responses_json = excluded.responses_json,
	status = excluded.status,
	capture_method = excluded.capture_method,
	withdrawn = 0,
	updated_at = excluded.updated_at,
	active = 1,
	source = excluded.source,
	payload_json = excluded.payload_json;

INSERT INTO rops_tree_test_configs (
	study_id, instructions, tree_json, tasks_json, created_at, updated_at
)
VALUES (
	'recTreeTest000001',
	'For each task, choose the place where you would expect to find the answer. You can move through the navigation before choosing a location.',
	'[{"id":"node_1_services","label":"Services","children":[{"id":"node_2_passports","label":"Passports, travel and documents","children":[{"id":"node_3_renew_passport","label":"Renew a passport","children":[]},{"id":"node_4_lost_passport","label":"Lost or stolen passport","children":[]}]},{"id":"node_5_benefits","label":"Benefits and support","children":[{"id":"node_6_apply_support","label":"Apply for financial support","children":[]}]}]}]',
	'[{"id":"task_1","prompt":"You need to renew a passport. Where would you expect to do that?","target_id":"node_3_renew_passport"},{"id":"task_2","prompt":"Your passport has been stolen. Where would you look for help?","target_id":"node_4_lost_passport"},{"id":"task_3","prompt":"You need to apply for financial support. Where would you look?","target_id":"node_6_apply_support"}]',
	'2026-07-10T22:45:00.000Z',
	'2026-07-10T22:45:00.000Z'
)
ON CONFLICT(study_id) DO UPDATE SET
	instructions = excluded.instructions,
	tree_json = excluded.tree_json,
	tasks_json = excluded.tasks_json,
	updated_at = excluded.updated_at;
