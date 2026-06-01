import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/apply-d1-test-project-1-participants.yml', 'utf8');

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(migration, 'CREATE TABLE IF NOT EXISTS rops_participants_cache', 'Test Project 1 participant seed migration');
includes(migration, 'sensitive_contact_json TEXT', 'Test Project 1 participant seed migration');
includes(migration, 'participant.record.create', 'Test Project 1 participant seed migration');
includes(migration, "'POST', '/api/participants', '[\"participant.record.create\"]'", 'Test Project 1 participant seed migration');
includes(migration, 'recgdpwEI5hFO7bUZ', 'Test Project 1 participant seed migration');
includes(migration, 'rect3biqr', 'Test Project 1 participant seed migration');
includes(migration, 'd1ptp_test_project_1_01', 'Test Project 1 participant seed migration');
includes(migration, 'd1ptp_test_project_1_10', 'Test Project 1 participant seed migration');
includes(migration, 'TP1 Participant 01', 'Test Project 1 participant seed migration');
includes(migration, 'TP1 Participant 10', 'Test Project 1 participant seed migration');
includes(migration, 'ON CONFLICT(id) DO UPDATE SET', 'Test Project 1 participant seed migration');
includes(migration, 'sensitive_contact_json = excluded.sensitive_contact_json', 'Test Project 1 participant seed migration');
includes(migration, 'pseudonymised', 'Test Project 1 participant seed migration');

excludes(migration, '@', 'Test Project 1 participant seed migration');
excludes(migration, 'example.', 'Test Project 1 participant seed migration');
excludes(migration, '07123', 'Test Project 1 participant seed migration');

const seededRecordIds = migration.match(/d1ptp_test_project_1_\d{2}/g) || [];
assert.equal(new Set(seededRecordIds).size, 10, 'Expected exactly 10 unique Test Project 1 participant IDs');

includes(workflow, 'Apply D1 Test Project 1 Participants Seed', 'Test Project 1 participant seed workflow');
includes(workflow, 'infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql', 'Test Project 1 participant seed workflow');
includes(workflow, 'APPLY_TEST_PROJECT_1_PARTICIPANTS', 'Test Project 1 participant seed workflow');
includes(workflow, "SELECT COUNT(*) AS participant_count FROM rops_participants_cache WHERE project_id = 'recgdpwEI5hFO7bUZ'", 'Test Project 1 participant seed workflow');
includes(workflow, "SELECT method, route_pattern, required_permissions_json FROM auth_route_permissions WHERE route_pattern = '/api/participants' ORDER BY method;", 'Test Project 1 participant seed workflow');
includes(workflow, "source = 'd1-seed'", 'Test Project 1 participant seed workflow');
