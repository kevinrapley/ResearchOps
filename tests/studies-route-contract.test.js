import assert from "node:assert/strict";
import fs from "node:fs";

const studiesSource = fs.readFileSync("infra/cloudflare/src/service/studies.js", "utf8");
const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const dashboardSource = fs.readFileSync("public/js/project-dashboard.js", "utf8");

assert.equal(studiesSource.includes("rops_studies_cache"), true);
assert.equal(studiesSource.includes("Project must be an Airtable record ID beginning rec"), true);
assert.equal(studiesSource.includes("CSV fallback is intentionally disabled"), true);
assert.equal(studiesSource.includes("x-rops-studies-source"), true);
assert.equal(studiesSource.includes("PROJECT_LINK_FIELDS"), true);
assert.equal(studiesSource.includes("retry-after"), true);

assert.equal(workerSource.includes("diagnoseProjectLinkedRecords"), true);
assert.equal(workerSource.includes("/api/_diag/project-linked-records"), true);
assert.equal(workerSource.includes("handleStudies(request, env, apiPath)"), true);
assert.equal(workerSource.includes("apiPath === \"/api/studies\" || apiPath.startsWith(\"/api/studies/\")"), true);

assert.equal(dashboardSource.includes("async function loadStudies(projectId)"), true);
