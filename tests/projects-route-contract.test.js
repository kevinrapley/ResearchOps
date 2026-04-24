import assert from "node:assert/strict";
import fs from "node:fs";
import worker from "../infra/cloudflare/src/worker.js";

const env = {
  AIRTABLE_BASE_ID: "appTest",
  AIRTABLE_API_KEY: "patTest",
  AIRTABLE_TABLE_PROJECTS: "Projects",
  AIRTABLE_TABLE_DETAILS: "Project Details",
  GH_OWNER: "kevinrapley",
  GH_REPO: "ResearchOps",
  GH_BRANCH: "main",
  GH_PATH_PROJECTS: "data/projects.csv",
  ALLOWED_ORIGINS: "https://researchops.pages.dev",
};

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function csvResponse(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
    },
  });
}

function createMockFetch(calls) {
  return async (resource) => {
    const url = String(resource);
    calls.push(url);

    if (url.includes("/Projects?")) {
      return jsonResponse({
        records: [
          {
            id: "recBeta",
            createdTime: "2025-01-01T10:00:00.000Z",
            fields: {
              Name: "Beta project",
              Description: "Beta description",
              Phase: "Discovery",
              Status: "Planning research",
              Objectives: "Beta objective",
              UserGroups: "Analyst",
              Stakeholders: "[]",
            },
          },
          {
            id: "recAlpha",
            createdTime: "2025-01-01T10:00:00.000Z",
            fields: {
              Name: "Alpha project",
              Description: "Alpha description",
              Phase: "Discovery",
              Status: "Planning research",
              Objectives: "Alpha objective",
              UserGroups: "Researcher",
              Stakeholders: "[]",
            },
          },
          {
            id: "recNewest",
            createdTime: "2025-02-01T10:00:00.000Z",
            fields: {
              Name: "Newest project",
              Description: "Newest description",
              Phase: "Alpha",
              Status: "Conducting research",
              Objectives: "Newest objective",
              UserGroups: "Citizen",
              Stakeholders: "[]",
            },
          },
        ],
      });
    }

    if (url.includes("/Project%20Details?")) {
      return jsonResponse({
        records: [
          {
            id: "detailAlpha",
            createdTime: "2025-01-02T10:00:00.000Z",
            fields: {
              Project: ["recAlpha"],
              "Lead Researcher": "Lead Alpha",
              "Lead Researcher Email": "lead.alpha@example.test",
              Notes: "Joined detail notes",
            },
          },
        ],
      });
    }

    if (url.includes("raw.githubusercontent.com")) {
      return csvResponse(
        "LocalId,Name,CreatedAt\nrecCsv,Csv project,2025-01-01T00:00:00.000Z\n",
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}

async function assertProjectsRouteUsesComposedService() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(calls);

  try {
    const response = await worker.fetch(
      new Request("https://worker.test/api/projects"),
      env,
      {},
    );
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(Array.isArray(payload.projects), true);
    assert.deepEqual(
      payload.projects.map((project) => project.id),
      ["recNewest", "recAlpha", "recBeta"],
    );

    const newest = payload.projects[0];
    assert.equal(newest.name, "Newest project");
    assert.equal(newest["rops:servicePhase"], "Alpha");
    assert.equal(newest["rops:projectStatus"], "Conducting research");
    assert.equal(newest.createdAt, "2025-02-01T10:00:00.000Z");
    assert.equal(Object.hasOwn(newest, "Name"), false);
    assert.equal(Object.hasOwn(newest, "Phase"), false);

    const alpha = payload.projects[1];
    assert.equal(alpha.lead_researcher, "Lead Alpha");
    assert.equal(alpha.lead_researcher_email, "lead.alpha@example.test");
    assert.equal(alpha.notes, "Joined detail notes");

    assert.equal(
      calls.some((url) => url.includes("/Projects?")),
      true,
    );
    assert.equal(
      calls.some((url) => url.includes("/Project%20Details?")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertProjectsCsvRouteStillWorks() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(calls);

  try {
    const response = await worker.fetch(
      new Request("https://worker.test/api/projects.csv"),
      env,
      {},
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/csv/);

    const body = await response.text();
    assert.match(body, /LocalId,Name,CreatedAt/);
    assert.equal(
      calls.some((url) => url.includes("raw.githubusercontent.com")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertLegacyProjectsDirectHandlerIsAbsent() {
  const router = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");
  assert.equal(router.includes("projectsJsonDirect"), false);
  assert.equal(router.includes("Matched /api/projects (direct)"), false);
}

await assertProjectsRouteUsesComposedService();
await assertProjectsCsvRouteStillWorks();
assertLegacyProjectsDirectHandlerIsAbsent();
