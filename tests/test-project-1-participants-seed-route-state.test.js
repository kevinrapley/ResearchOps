import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/apply-d1-test-project-1-participants.yml', 'utf8');

for (const required of [
	'CREATE TABLE IF NOT EXISTS rops_participants_cache',
	'participant_airtable_id TEXT',
	'access_needs TEXT',
	'sensitive_contact_json TEXT',
	'participant.record.create',
	"'POST', '/api/participants'",
	'recgdpwEI5hFO7bUZ',
	'rect3biqr',
	'TP1 Participant 01',
	'TP1 Participant 10',
	'ON CONFLICT(id) DO UPDATE SET',
]) {
	assert.ok(migration.includes(required), `Expected participant seed migration to include: ${required}`);
}

const seededRecordIds = migration.match(/d1ptp_test_project_1_\d{2}/g) || [];
assert.equal(new Set(seededRecordIds).size, 10, 'Expected exactly 10 unique Test Project 1 participant IDs');

for (const required of [
	'Apply D1 Test Project 1 Participants Seed',
	'infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql',
	'APPLY_TEST_PROJECT_1_PARTICIPANTS',
	'CREATE TABLE IF NOT EXISTS rops_participants_cache',
	"pragma_table_info('rops_participants_cache')",
	'participant_airtable_id',
	'access_needs',
	'sensitive_contact_json',
	'SELECT COUNT(*) AS participant_count FROM rops_participants_cache',
	"route_pattern = '/api/participants'",
]) {
	assert.ok(workflow.includes(required), `Expected participant seed workflow to include: ${required}`);
}
