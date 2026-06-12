import {
	TEST_PROJECT_1_CANONICAL_ID,
	TEST_PROJECT_1_CODE_APPLICATIONS,
	TEST_PROJECT_1_CODES,
	TEST_PROJECT_1_JOURNAL_ENTRIES,
	TEST_PROJECT_1_LOCAL_ID,
	TEST_PROJECT_1_MEMOS,
} from "../../infra/cloudflare/src/service/internals/test-project-1-journal-seed.js";

function sql(value) {
	return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function values(rows) {
	return rows.map((row) => `(${row.map(sql).join(", ")})`).join(",\n");
}

const journalRows = TEST_PROJECT_1_JOURNAL_ENTRIES.map((entry) => [
	entry.id,
	entry.project,
	entry.category,
	entry.content,
	JSON.stringify(entry.tags || []),
	entry.createdAt,
	entry.localProjectId,
]);

const codeRows = TEST_PROJECT_1_CODES.map((code) => [
	code.id,
	TEST_PROJECT_1_CANONICAL_ID,
	code.name,
	code.description,
	code.parentId || "",
	code.colour,
	code.createdAt,
	TEST_PROJECT_1_LOCAL_ID,
	code.id,
]);

const memoRows = TEST_PROJECT_1_MEMOS.map((memo) => [
	memo.id,
	TEST_PROJECT_1_CANONICAL_ID,
	memo.memoType,
	memo.title,
	memo.content,
	memo.createdAt,
	TEST_PROJECT_1_LOCAL_ID,
	memo.id,
]);

const applicationRows = TEST_PROJECT_1_CODE_APPLICATIONS.map((application) => [
	application.id,
	application.project,
	application.entry,
	application.code,
	application.excerpt,
	application.createdAt,
	application.localProjectId,
	application.id,
]);

process.stdout.write(`-- Generated Test Project 1 journal analysis seed.
-- Source: infra/cloudflare/src/service/internals/test-project-1-journal-seed.js
-- Project record ID: ${TEST_PROJECT_1_CANONICAL_ID}
-- Local project ID: ${TEST_PROJECT_1_LOCAL_ID}

CREATE TABLE IF NOT EXISTS "journal_entries" ("record_id" TEXT PRIMARY KEY, "project" TEXT, "category" TEXT, "content" TEXT, "tags" TEXT, "createdat" TEXT, "local_project_id" TEXT);
CREATE TABLE IF NOT EXISTS "memos" ("record_id" TEXT, "project" TEXT, "type" TEXT, "title" TEXT, "body" TEXT, "createdat" TEXT, "local_project_id" TEXT, "local_memo_id" TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS "codes" ("record_id" TEXT, "project" TEXT, "name" TEXT, "description" TEXT, "parentcode" TEXT, "colour" TEXT, "createdat" TEXT, "local_project_id" TEXT, "local_code_id" TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS "code_applications" ("record_id" TEXT, "project" TEXT, "entry" TEXT, "code" TEXT, "excerpt" TEXT, "createdat" TEXT, "local_project_id" TEXT, "local_application_id" TEXT PRIMARY KEY);

CREATE INDEX IF NOT EXISTS idx_journal_entries_test_project_1_local_project_id ON journal_entries(local_project_id);
CREATE INDEX IF NOT EXISTS idx_memos_test_project_1_local_project_id ON memos(local_project_id);
CREATE INDEX IF NOT EXISTS idx_codes_test_project_1_local_project_id ON codes(local_project_id);
CREATE INDEX IF NOT EXISTS idx_code_applications_test_project_1_local_project_id ON code_applications(local_project_id);
CREATE INDEX IF NOT EXISTS idx_code_applications_test_project_1_entry ON code_applications(entry);
CREATE INDEX IF NOT EXISTS idx_code_applications_test_project_1_code ON code_applications(code);

INSERT INTO journal_entries (record_id, project, category, content, tags, createdat, local_project_id) VALUES
${values(journalRows)}
ON CONFLICT(record_id) DO UPDATE SET project = excluded.project, category = excluded.category, content = excluded.content, tags = excluded.tags, createdat = excluded.createdat, local_project_id = excluded.local_project_id;

INSERT INTO codes (record_id, project, name, description, parentcode, colour, createdat, local_project_id, local_code_id) VALUES
${values(codeRows)}
ON CONFLICT(local_code_id) DO UPDATE SET record_id = excluded.record_id, project = excluded.project, name = excluded.name, description = excluded.description, parentcode = excluded.parentcode, colour = excluded.colour, createdat = excluded.createdat, local_project_id = excluded.local_project_id;

INSERT INTO memos (record_id, project, type, title, body, createdat, local_project_id, local_memo_id) VALUES
${values(memoRows)}
ON CONFLICT(local_memo_id) DO UPDATE SET record_id = excluded.record_id, project = excluded.project, type = excluded.type, title = excluded.title, body = excluded.body, createdat = excluded.createdat, local_project_id = excluded.local_project_id;

INSERT INTO code_applications (record_id, project, entry, code, excerpt, createdat, local_project_id, local_application_id) VALUES
${values(applicationRows)}
ON CONFLICT(local_application_id) DO UPDATE SET record_id = excluded.record_id, project = excluded.project, entry = excluded.entry, code = excluded.code, excerpt = excluded.excerpt, createdat = excluded.createdat, local_project_id = excluded.local_project_id;
`);
