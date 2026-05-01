import assert from "node:assert/strict";
import fs from "node:fs";

const workerSource = fs.readFileSync("infra/cloudflare/src/worker.js", "utf8");
const serviceIndexSource = fs.readFileSync("infra/cloudflare/src/service/index.js", "utf8");
const synthesisServiceSource = fs.readFileSync("infra/cloudflare/src/service/synthesis.js", "utf8");

function includes(source, text, label) {
  assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
  assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(workerSource, "async function handleSynthesis", "Worker");
includes(workerSource, "apiPath === \"/api/synthesis/evidence\"", "Worker");
includes(workerSource, "apiPath === \"/api/synthesis\"", "Worker");
includes(workerSource, "apiPath === \"/api/synthesis/clusters\"", "Worker");
includes(workerSource, "apiPath === \"/api/synthesis/themes\"", "Worker");
includes(workerSource, "service.listSynthesisEvidence", "Worker");
includes(workerSource, "service.listSynthesis(origin, url)", "Worker");
includes(workerSource, "service.createSynthesisCluster", "Worker");
includes(workerSource, "service.updateSynthesisCluster", "Worker");
includes(workerSource, "service.deleteSynthesisCluster", "Worker");
includes(workerSource, "service.createSynthesisTheme", "Worker");
includes(workerSource, "apiPath.startsWith(\"/api/synthesis/\")", "Worker");

includes(serviceIndexSource, "import * as Synthesis from \"./synthesis.js\"", "Service index");
includes(serviceIndexSource, "listSynthesisEvidence", "Service index");
includes(serviceIndexSource, "listSynthesis =", "Service index");
includes(serviceIndexSource, "createSynthesisCluster", "Service index");
includes(serviceIndexSource, "updateSynthesisCluster", "Service index");
includes(serviceIndexSource, "deleteSynthesisCluster", "Service index");
includes(serviceIndexSource, "createSynthesisTheme", "Service index");

includes(synthesisServiceSource, "export async function listSynthesisEvidence", "Synthesis service");
includes(synthesisServiceSource, "export async function listSynthesis", "Synthesis service");
includes(synthesisServiceSource, "export async function createSynthesisCluster", "Synthesis service");
includes(synthesisServiceSource, "export async function updateSynthesisCluster", "Synthesis service");
includes(synthesisServiceSource, "export async function deleteSynthesisCluster", "Synthesis service");
includes(synthesisServiceSource, "export async function createSynthesisTheme", "Synthesis service");
includes(synthesisServiceSource, "function synthesisKey", "Synthesis service");
includes(synthesisServiceSource, "SESSION_KV", "Synthesis service");
includes(synthesisServiceSource, "Missing sid query", "Synthesis service");
includes(synthesisServiceSource, "Cluster label is required", "Synthesis service");
includes(synthesisServiceSource, "Theme label is required", "Synthesis service");
includes(synthesisServiceSource, "A theme needs at least one source evidence item", "Synthesis service");
includes(synthesisServiceSource, "Evidence does not belong to this study", "Synthesis service");
includes(synthesisServiceSource, "projectId", "Synthesis service");
includes(synthesisServiceSource, "studyId", "Synthesis service");
includes(synthesisServiceSource, "evidenceIds", "Synthesis service");
excludes(synthesisServiceSource, "localStorage", "Synthesis service");
