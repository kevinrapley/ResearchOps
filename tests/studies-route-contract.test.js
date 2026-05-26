import assert from "node:assert/strict";
import fs from "node:fs";

const studiesSource = fs.readFileSync("infra/cloudflare/src/service/studies.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const dashboardSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");
const studyPageSource = fs.readFileSync("public/js/study-page.js", "utf8");
const previewSeedSource = fs.readFileSync("infra/cloudflare/migrations/preview/0002_seed_projects_cache.sql", "utf8");

assert.equal(studiesSource.includes("rops_studies_cache"), true);
assert.equal(studiesSource.includes("Project must be an Airtable record ID beginning rec"), true);
assert.equal(studiesSource.includes("function isStudyIdentifier"), true);
assert.equal(studiesSource.includes("function readStudy"), true);
assert.equal(studiesSource.includes("url.searchParams.get(\"study\") || url.searchParams.get(\"id\")"), true);
assert.equal(studiesSource.includes("CSV fallback is intentionally disabled"), true);
assert.equal(studiesSource.includes("x-rops-studies-source"), true);
assert.equal(studiesSource.includes("PROJECT_LINK_FIELDS"), true);
assert.equal(studiesSource.includes("retry-after"), true);

assert.equal(workerSource.includes("diagnoseProjectLinkedRecords"), true);
assert.equal(workerSource.includes("/api/_diag/project-linked-records"), true);
assert.equal(workerSource.includes("handleStudies(request, env, apiPath)"), true);
assert.equal(workerSource.includes("apiPath === \"/api/studies\" || apiPath.startsWith(\"/api/studies/\")"), true);

assert.equal(dashboardSource.includes("async function loadStudies(projectId)"), true);
assert.equal(dashboardSource.includes("/pages/study/?id="), true);
assert.equal(dashboardSource.includes("/pages/study/?pid="), false);
assert.equal(dashboardSource.includes("&sid="), false);
assert.equal(dashboardSource.includes("renderStudiesLoadError"), true);

assert.equal(studyPageSource.includes("resolveStudyContext"), true);
assert.equal(studyPageSource.includes("url.searchParams.set(\"id\", studyId)"), true);
assert.equal(studyPageSource.includes("The legacy project and study URL does not match the linked records."), true);
assert.equal(studyPageSource.includes("routeMode: \"legacy-resolved\""), true);
assert.equal(studyPageSource.includes("params.get(\"pid\")"), true);
assert.equal(studyPageSource.includes("params.get(\"sid\")"), true);

assert.equal(previewSeedSource.includes("CREATE TABLE IF NOT EXISTS rops_studies_cache"), true);
assert.equal(previewSeedSource.includes("recgdpwEI5hFO7bUZ"), true);
assert.equal(previewSeedSource.includes("rect3biqr"), true);
assert.equal(previewSeedSource.includes("rect3o7dt"), true);
assert.equal(previewSeedSource.includes("preview-seed"), true);
