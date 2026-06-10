import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("infra/cloudflare/migrations/0017_seed_test_project_1_journal_analysis.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/apply-d1-test-project-1-journal-analysis.yml", "utf8");
const projectData = fs.readFileSync("data/projects.csv", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

for (const required of [
	"Test Project 1",
	"recgdpwEI5hF07bUZ",
	"d04ab32e-6756-408e-a649-6859dd0079f2",
]) {
	includes(projectData, required, "project CSV");
}

for (const required of [
	"CREATE TABLE IF NOT EXISTS \"journal_entries\"",
	"CREATE TABLE IF NOT EXISTS \"memos\"",
	"CREATE TABLE IF NOT EXISTS \"codes\"",
	"idx_journal_entries_test_project_1_local_project_id",
	"idx_memos_test_project_1_local_project_id",
	"idx_codes_test_project_1_local_project_id",
	"recgdpwEI5hF07bUZ",
	"d04ab32e-6756-408e-a649-6859dd0079f2",
	"Evidence quality",
	"Uncertainty made visible",
	"Context switching",
	"Decision trace",
	"Evidence quality is becoming the organising problem",
	"Separate operations tracking from synthesis",
	"ON CONFLICT(record_id) DO UPDATE SET",
	"ON CONFLICT(local_code_id) DO UPDATE SET",
	"ON CONFLICT(local_memo_id) DO UPDATE SET",
]) {
	includes(migration, required, "journal analysis seed migration");
}

const journalIds = migration.match(/d1tp1_journal_\d{3}/g) || [];
assert.equal(new Set(journalIds).size, 4, "Expected exactly 4 unique Test Project 1 journal entry IDs");

const codeIds = migration.match(/d1tp1_code_[a-z_]+/g) || [];
assert.equal(new Set(codeIds).size, 4, "Expected exactly 4 unique Test Project 1 code IDs");

const memoIds = migration.match(/d1tp1_memo_\d{3}/g) || [];
assert.equal(new Set(memoIds).size, 2, "Expected exactly 2 unique Test Project 1 memo IDs");

for (const required of [
	"Apply D1 Test Project 1 Journal Analysis Seed",
	"infra/cloudflare/migrations/0017_seed_test_project_1_journal_analysis.sql",
	"APPLY_TEST_PROJECT_1_JOURNAL_ANALYSIS",
	"TEST_PROJECT_1_RECORD_ID",
	"TEST_PROJECT_1_LOCAL_ID",
	"SELECT COUNT(*) AS journal_entry_count FROM journal_entries",
	"SELECT COUNT(*) AS code_count FROM codes",
	"SELECT COUNT(*) AS memo_count FROM memos",
]) {
	includes(workflow, required, "journal analysis seed workflow");
}
