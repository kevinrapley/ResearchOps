import assert from "node:assert/strict";
import { listJournalEntries } from "../infra/cloudflare/src/service/journals.js";

const rows = [
  {
    record_id: "recJournalA",
    project: "recgdpwEI5hF07bUZ",
    local_project_id: "local-project-1",
    category: "perceptions",
    content: "Entry linked by both project ids.",
    tags: '["alpha","beta"]',
    createdat: "2025-10-02T10:00:00.000Z",
  },
  {
    record_id: "recJournalB",
    project: "recOtherProject",
    local_project_id: "local-project-2",
    category: "procedures",
    content: "Entry for another project.",
    tags: "[]",
    createdat: "2025-10-01T10:00:00.000Z",
  },
];

function createMockD1() {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all() {
              const [localProjectId, projectRecordId] = params;
              return {
                results: rows.filter((row) => {
                  return row.local_project_id === localProjectId || row.project === projectRecordId;
                }),
              };
            },
          };
        },
      };
    },
  };
}

function createService() {
  return {
    env: {
      RESEARCHOPS_D1: createMockD1(),
    },
    json(payload, status = 200, headers = {}) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          ...headers,
        },
      });
    },
    corsHeaders() {
      return {};
    },
    log: {
      error() {},
    },
  };
}

async function readEntriesFor(projectId) {
  const url = new URL("https://worker.test/api/journal-entries");
  url.searchParams.set("project", projectId);

  const response = await listJournalEntries(createService(), "", url);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.source, "d1");
  return payload.entries;
}

const entriesByAirtableId = await readEntriesFor("recgdpwEI5hF07bUZ");
assert.equal(entriesByAirtableId.length, 1);
assert.equal(entriesByAirtableId[0].id, "recJournalA");
assert.equal(entriesByAirtableId[0].content, "Entry linked by both project ids.");
assert.deepEqual(entriesByAirtableId[0].tags, ["alpha", "beta"]);

const entriesByLocalId = await readEntriesFor("local-project-1");
assert.equal(entriesByLocalId.length, 1);
assert.equal(entriesByLocalId[0].id, "recJournalA");

const entriesForOtherProject = await readEntriesFor("recOtherProject");
assert.equal(entriesForOtherProject.length, 1);
assert.equal(entriesForOtherProject[0].id, "recJournalB");
