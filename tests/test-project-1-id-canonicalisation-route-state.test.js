import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("infra/cloudflare/migrations/0018_canonicalise_test_project_1_id.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/apply-d1-test-project-1-id-canonicalisation.yml", "utf8");
const hydration = fs.readFileSync("infra/cloudflare/src/service/reflection/project-data-hydration.js", "utf8");
const participantSeed = fs.readFileSync("infra/cloudflare/migrations/0008_seed_test_project_1_participants.sql", "utf8");
const previewSeed = fs.readFileSync("infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql", "utf8");

const BAD_ID = "recgdpwEI5hFO7bUZ";
const CANONICAL_ID = "recgdpwEI5hF07bUZ";

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

includes(participantSeed, BAD_ID, "historical participant seed");
includes(previewSeed, BAD_ID, "historical preview project cache seed");

for (const required of [
	BAD_ID,
	CANONICAL_ID,
	"CREATE TABLE IF NOT EXISTS rops_participants_cache",
	"CREATE TABLE IF NOT EXISTS journal_entries",
	"CREATE TABLE IF NOT EXISTS memos",
	"CREATE TABLE IF NOT EXISTS codes",
	"CREATE TABLE IF NOT EXISTS code_applications",
	"CREATE TABLE IF NOT EXISTS rops_studies_cache",
	"CREATE TABLE IF NOT EXISTS rops_projects_cache",
	"UPDATE rops_participants_cache",
	"UPDATE journal_entries",
	"UPDATE memos",
	"UPDATE codes",
	"UPDATE code_applications",
	"UPDATE rops_studies_cache",
	"UPDATE rops_projects_cache",
	"DELETE FROM rops_projects_cache",
	"replace(COALESCE(payload_json, ''), 'recgdpwEI5hFO7bUZ', 'recgdpwEI5hF07bUZ')",
]) {
	includes(migration, required, "Test Project 1 ID canonicalisation migration");
}

for (const required of [
	"Apply D1 Test Project 1 ID Canonicalisation",
	"infra/cloudflare/migrations/0018_canonicalise_test_project_1_id.sql",
	"CANONICALISE_TEST_PROJECT_1_ID",
	"TEST_PROJECT_1_BAD_ID",
	"TEST_PROJECT_1_CANONICAL_ID",
	"bad_participant_project_count",
	"canonical_participant_project_count",
	"bad_journal_project_count",
	"canonical_journal_project_count",
	"bad_code_project_count",
	"bad_memo_project_count",
	"bad_code_application_project_count",
]) {
	includes(workflow, required, "Test Project 1 ID canonicalisation workflow");
}

for (const required of [
	"TEST_PROJECT_1_LEGACY_ID",
	"TEST_PROJECT_1_CANONICAL_ID",
	"withProjectAliases",
	"if (text === TEST_PROJECT_1_LEGACY_ID) return [text, TEST_PROJECT_1_CANONICAL_ID];",
	"if (text === TEST_PROJECT_1_CANONICAL_ID) return [text, TEST_PROJECT_1_LEGACY_ID];",
]) {
	includes(hydration, required, "project data hydration alias handling");
}
