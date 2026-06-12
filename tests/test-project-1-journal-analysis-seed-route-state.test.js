import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("infra/cloudflare/migrations/0019_expand_test_project_1_journal_analysis_seed.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/apply-d1-test-project-1-journal-analysis.yml", "utf8");
const projectData = fs.readFileSync("data/projects.csv", "utf8");
const seedSource = fs.readFileSync("infra/cloudflare/src/service/internals/test-project-1-journal-seed.js", "utf8");
const seedSqlWriter = fs.readFileSync("scripts/d1/write-test-project-1-journal-analysis-sql.mjs", "utf8");

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
	"CREATE TABLE IF NOT EXISTS \"code_applications\"",
	"idx_journal_entries_test_project_1_local_project_id",
	"idx_memos_test_project_1_local_project_id",
	"idx_codes_test_project_1_local_project_id",
	"idx_code_applications_test_project_1_local_project_id",
	"idx_code_applications_test_project_1_entry",
	"idx_code_applications_test_project_1_code",
	"recgdpwEI5hF07bUZ",
	"d04ab32e-6756-408e-a649-6859dd0079f2",
	"Evidence readiness",
	"Operational rhythm",
	"Reflexive practice",
	"Inclusive engagement",
	"Decision confidence",
	"Tool-switching burden",
	"Researcher positionality",
	"Participant burden",
	"Analysis confidence",
	"Provenance gaps",
	"Confidence threshold",
	"Pause for consent",
	"Negative case",
	"Evidence readiness is the organising problem",
	"Separate operations tracking from synthesis",
	"Co-occurrence should prompt interpretation",
	"Use the code hierarchy as an analytic scaffold",
	"Evidence readiness and inclusive engagement overlap",
	"ON CONFLICT(record_id) DO UPDATE SET",
	"ON CONFLICT(local_code_id) DO UPDATE SET",
	"ON CONFLICT(local_memo_id) DO UPDATE SET",
	"ON CONFLICT(local_application_id) DO UPDATE SET",
]) {
	includes(migration, required, "journal analysis seed migration");
}

const journalIds = migration.match(/d1tp1_journal_\d{3}/g) || [];
assert.equal(new Set(journalIds).size, 36, "Expected exactly 36 unique Test Project 1 journal entry IDs");

const codeIds = migration.match(/d1tp1_code_[a-z_]+/g) || [];
assert.equal(new Set(codeIds).size, 40, "Expected exactly 40 unique Test Project 1 code IDs");

const memoIds = migration.match(/d1tp1_memo_\d{3}/g) || [];
assert.equal(new Set(memoIds).size, 12, "Expected exactly 12 unique Test Project 1 memo IDs");

const applicationIds = migration.match(/d1tp1_app_\d{3}/g) || [];
assert.equal(new Set(applicationIds).size, 180, "Expected exactly 180 unique Test Project 1 code application IDs");

for (const placeholder of ["dummy", "sample", "lorem ipsum"]) {
	assert.equal(
		migration.toLowerCase().includes(placeholder),
		false,
		`Seed migration should not contain placeholder wording: ${placeholder}`,
	);
}

for (const required of [
	"TEST_PROJECT_1_CODES",
	"TEST_PROJECT_1_MEMOS",
	"TEST_PROJECT_1_CODE_APPLICATIONS",
	"TEST_PROJECT_1_ENTRY_CODE_IDS",
]) {
	includes(seedSource, required, "journal analysis seed source");
}

for (const required of [
	"Generated Test Project 1 journal analysis seed",
	"TEST_PROJECT_1_JOURNAL_ENTRIES",
	"TEST_PROJECT_1_CODE_APPLICATIONS",
	"ON CONFLICT(local_application_id) DO UPDATE SET",
]) {
	includes(seedSqlWriter, required, "journal analysis seed SQL writer");
}

for (const required of [
	"Apply D1 Test Project 1 Journal Analysis Seed",
	"infra/cloudflare/migrations/0019_expand_test_project_1_journal_analysis_seed.sql",
	"scripts/d1/write-test-project-1-journal-analysis-sql.mjs",
	"Check generated seed SQL is current",
	"APPLY_TEST_PROJECT_1_JOURNAL_ANALYSIS",
	"TEST_PROJECT_1_RECORD_ID",
	"TEST_PROJECT_1_LOCAL_ID",
	"SELECT COUNT(*) AS journal_entry_count FROM journal_entries",
	"SELECT COUNT(*) AS code_count FROM codes",
	"SELECT COUNT(*) AS memo_count FROM memos",
	"SELECT COUNT(*) AS code_application_count FROM code_applications",
	"SELECT entry, COUNT(*) AS applied_code_count FROM code_applications",
	"cooccurring_pair_count",
]) {
	includes(workflow, required, "journal analysis seed workflow");
}
