import assert from "node:assert/strict";
import fs from "node:fs";

const serviceSource = fs.readFileSync("infra/cloudflare/src/service/projects.js", "utf8");
const airtableSource = fs.readFileSync("infra/cloudflare/src/service/projects/airtable.js", "utf8");
const authSource = fs.readFileSync("infra/cloudflare/src/service/projects/auth.js", "utf8");
const csvSource = fs.readFileSync("infra/cloudflare/src/service/projects/csv.js", "utf8");
const githubCsvSource = fs.readFileSync("infra/cloudflare/src/service/projects/github-csv.js", "utf8");
const normalisationSource = fs.readFileSync("infra/cloudflare/src/service/projects/normalisation.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(serviceSource, "export async function listProjectsFromAirtable", "Projects service route layer");
includes(serviceSource, "export async function createProjectInAirtable", "Projects service route layer");
includes(serviceSource, "export async function getProjectById", "Projects service route layer");
includes(serviceSource, "export async function updateProjectFraming", "Projects service route layer");
includes(serviceSource, 'export { parseCsv } from "./projects/csv.js";', "Projects service route layer");
includes(serviceSource, 'from "./projects/airtable.js";', "Projects service route layer");
includes(serviceSource, 'from "./projects/auth.js";', "Projects service route layer");
includes(serviceSource, 'from "./projects/github-csv.js";', "Projects service route layer");
includes(serviceSource, 'from "./projects/normalisation.js";', "Projects service route layer");

excludes(serviceSource, "function parseCsvRecords", "Projects service route layer");
excludes(serviceSource, "async function fetchProjectsCsvFromGitHub", "Projects service route layer");
excludes(serviceSource, "function normaliseKey", "Projects service route layer");
excludes(serviceSource, "function userCanSeeProject", "Projects service route layer");
excludes(serviceSource, "async function readAirtableJson", "Projects service route layer");
excludes(serviceSource, "function mapProject", "Projects service route layer");

includes(csvSource, "export function parseCsv", "Projects CSV parser");
includes(csvSource, "function parseCsvRecords", "Projects CSV parser");
includes(githubCsvSource, "export async function fetchProjectsCsvFromGitHub", "Projects GitHub CSV fallback");
includes(githubCsvSource, "export function coerceCsvRowToProject", "Projects GitHub CSV fallback");
includes(normalisationSource, "export function normaliseKey", "Projects normalisation helpers");
includes(normalisationSource, "export function mapProject", "Projects normalisation helpers");
includes(normalisationSource, "export function compareProjects", "Projects normalisation helpers");
includes(authSource, "export function userCanSeeProject", "Projects auth helpers");
includes(authSource, "export function canStartProject", "Projects auth helpers");
includes(authSource, "export function activeTeamForCreate", "Projects auth helpers");
includes(airtableSource, "export function requireEnv", "Projects Airtable helpers");
includes(airtableSource, "export async function readAirtableJson", "Projects Airtable helpers");
includes(airtableSource, "export async function findProjectRecord", "Projects Airtable helpers");
includes(airtableSource, "export function createProjectFields", "Projects Airtable helpers");
