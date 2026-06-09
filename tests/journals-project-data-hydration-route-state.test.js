import assert from "node:assert/strict";
import fs from "node:fs";

const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const hydrationSource = fs.readFileSync("infra/cloudflare/src/service/reflection/project-data-hydration.js", "utf8");
const routerSource = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
const d1SeedSource = fs.readFileSync("infra/cloudflare/migrations/researchops-d1/0001_seed.sql", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(routerSource, "service.listJournalEntries(origin, url)", "Worker router");
includes(routerSource, "service.listMemos(origin, url)", "Worker router");
includes(routerSource, "service.listCodes(origin, url)", "Worker router");

includes(serviceIndexSource, "ProjectDataHydration.listJournalEntries(this, origin, url)", "ResearchOps service index");
includes(serviceIndexSource, "ProjectDataHydration.listMemos(this, origin, url)", "ResearchOps service index");
includes(serviceIndexSource, "ProjectDataHydration.listCodes(this, origin, url)", "ResearchOps service index");
excludes(serviceIndexSource, "listJournalEntries = (origin, url) => Journals.listJournalEntries", "ResearchOps service index");
excludes(serviceIndexSource, "listMemos = (origin, url) => Memos.listMemos", "ResearchOps service index");
excludes(serviceIndexSource, "listCodes = (origin, url) => Codes.listCodes", "ResearchOps service index");

includes(hydrationSource, "url.searchParams.get(\"project\")", "project data hydration service");
includes(hydrationSource, "url.searchParams.get(\"project_local_id\")", "project data hydration service");
includes(hydrationSource, "url.searchParams.get(\"project_airtable_id\")", "project data hydration service");
includes(hydrationSource, "findProjectRecord(service, candidate)", "project data hydration service");
includes(hydrationSource, "FROM journal_entries", "project data hydration service");
includes(hydrationSource, "FROM memos", "project data hydration service");
includes(hydrationSource, "FROM codes", "project data hydration service");
includes(hydrationSource, "local_project_id IN", "project data hydration service");
includes(hydrationSource, "OR project IN", "project data hydration service");
includes(hydrationSource, "source: \"d1\"", "project data hydration service");
includes(hydrationSource, "source: codes.length ? \"airtable\" : \"empty\"", "project data hydration service");

includes(d1SeedSource, "CREATE TABLE IF NOT EXISTS \"journal_entries\"", "ResearchOps D1 seed");
includes(d1SeedSource, "CREATE TABLE IF NOT EXISTS \"memos\"", "ResearchOps D1 seed");
includes(d1SeedSource, "CREATE TABLE IF NOT EXISTS \"codes\"", "ResearchOps D1 seed");
includes(d1SeedSource, "local_project_id", "ResearchOps D1 seed");
