/**
 * @file src/service/project-record-routes.js
 * @module service/project-record-routes
 * @summary Airtable Projects read routes using Airtable record IDs as canonical project IDs.
 */

import { toMs } from "../core/utils.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function requireEnv(env, keys) {
	const missing = keys.filter((key) => !env?.[key]);
	if (missing.length) throw Object.assign(new Error(`Missing env: ${missing.join(", ")}`), { status: 500 });
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function normaliseKey(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function displayText(value) {
	if (Array.isArray(value)) return value.map(displayText).filter(Boolean).join(", ");
	if (value && typeof value === "object") return displayText(value.name || value.Name || value.label || value.Label || value.text || value.Text || "");
	const text = String(value || "").trim().replace(/^_+(?=\s*[{[])/, "");
	if (!text || /^_?\s*[{[]/.test(text) || /"{1,3}(email|role|name)"{1,3}\s*:/i.test(text) || /^[}\]]+$/.test(text)) return "";
	return text;
}

function unique(values = []) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = displayText(value);
		const key = normaliseKey(text);
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
	}
	return out;
}

function splitList(value, pattern) {
	if (Array.isArray(value)) return unique(value.flatMap((item) => splitList(item, pattern)));
	if (value && typeof value === "object") return unique([value]);
	return unique(String(value || "").split(pattern));
}

function parseStakeholders(value) {
	let list = value;
	if (typeof value === "string") {
		try {
			list = JSON.parse(value || "[]");
		} catch {
			list = [];
		}
	}
	if (!Array.isArray(list)) return [];
	return list
		.map((item) => ({
			name: displayText(item?.name || item?.Name || ""),
			role: displayText(item?.role || item?.Role || ""),
			email: String(item?.email || item?.Email || item?.EMAIL || "").trim(),
		}))
		.filter((item) => item.name || item.role || item.email);
}

function valuesFromFields(fields = {}, names = []) {
	return names.flatMap((name) => splitList(fields[name], /\r?\n|[|,]/));
}

function teamIds(fields = {}) {
	return unique(
		valuesFromFields(fields, ["Team ID", "Team IDs", "TeamId", "TeamIds", "team_id", "team_ids", "Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(
			(value) => normaliseKey(value).startsWith("team-") || isAirtableRecordId(value),
		),
	);
}

function teamNames(fields = {}) {
	const explicit = valuesFromFields(fields, ["Team Name", "Team Names", "Team name", "Team names", "teamName", "teamNames", "team_name", "team_names", "Org", "org", "Organisation", "Organization", "Project Team Name", "Project Team Names"]);
	const linked = valuesFromFields(fields, ["Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(
		(value) => !isAirtableRecordId(value) && !normaliseKey(value).startsWith("team-"),
	);
	return unique([...explicit, ...linked]);
}

function teamsForAuth(authContext = {}) {
	return [...(authContext.teamMemberships || []), ...(authContext.memberTeams || []), ...(authContext.teams || []), authContext.activeTeam].filter(Boolean);
}

function isCoreTeam(team = {}) {
	const id = normaliseKey(team.id || team.teamId || team.team_id);
	const name = normaliseKey(team.name || team.teamName || team.team_name || team.label);
	return id === "team-researchops-core" || name === "researchops-core" || name === "researchops-core-team";
}

function isCoreMember(authContext = {}) {
	return Boolean(authContext.isResearchOpsCoreTeamAdmin) || teamsForAuth(authContext).some(isCoreTeam);
}

function authTeamKeys(authContext = {}) {
	return new Set(
		teamsForAuth(authContext)
			.flatMap((team) => [team.id, team.teamId, team.team_id, team.name, team.teamName, team.team_name, team.label].map(normaliseKey))
			.filter(Boolean),
	);
}

function projectTeamKeys(project = {}) {
	return new Set([...(project.team_ids || []), ...(project.teamIds || []), ...(project.teamNames || []), project.teamName, project.team_name, project.team, project.org].map(normaliseKey).filter(Boolean));
}

function userCanSee(project, authContext = {}) {
	if (isCoreMember(authContext)) return true;
	const projectKeys = projectTeamKeys(project);
	if (!projectKeys.size) return false;
	const userKeys = authTeamKeys(authContext);
	for (const key of projectKeys) {
		if (userKeys.has(key)) return true;
	}
	return false;
}

function canStartProject(authContext = {}) {
	if (isCoreMember(authContext)) return true;
	if ((authContext.permissions || []).some((permission) => permission.code === "governed.create")) return true;
	return (authContext.roles || []).some((role) => ["researcher", "user_researcher", "research_lead"].includes(role.key || role.roleKey));
}

function mapProject(record = {}) {
	const fields = record.fields || {};
	const id = isAirtableRecordId(record.id) ? record.id : "";
	const names = teamNames(fields);
	const ids = teamIds(fields);
	const teamName = names[0] || "";
	return {
		id,
		airtableId: id,
		recordId: displayText(fields["Record ID"] || id) || id,
		name: displayText(fields.Name || fields["Project Name"] || fields.Title || ""),
		description: displayText(fields.Description || fields.Summary || ""),
		"rops:servicePhase": displayText(fields.Phase || fields["Service Phase"] || ""),
		"rops:projectStatus": displayText(fields.Status || fields["Project Status"] || ""),
		objectives: splitList(fields.Objectives || fields["Research Objectives"] || "", /\r?\n|[|]/),
		user_groups: splitList(fields.UserGroups || fields["User Groups"] || "", /\r?\n|[|,]/),
		stakeholders: parseStakeholders(fields.Stakeholders || []),
		createdAt: displayText(record.createdTime || fields.CreatedAt || fields["Created At"] || ""),
		team_ids: ids,
		teamIds: ids,
		teamNames: names,
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || displayText(fields.Org || fields.org || ""),
	};
}

function isRenderable(project = {}) {
	return Boolean(isAirtableRecordId(project.id) && project.name);
}

async function airtableJson(env, url) {
	const response = await fetch(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, Accept: "application/json" } });
	const text = await response.text();
	let data = {};
	try {
		data = JSON.parse(text);
	} catch {
		data = {};
	}
	if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.error?.type || `airtable_http_${response.status}`), { status: response.status });
	return data;
}

async function joinDetails(env, projects = []) {
	if (!env.AIRTABLE_TABLE_DETAILS) return projects;
	try {
		const table = encodeURIComponent(env.AIRTABLE_TABLE_DETAILS);
		const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
		const data = await airtableJson(env, url);
		const details = new Map();
		for (const record of data.records || []) {
			const fields = record.fields || {};
			const linked = Array.isArray(fields.Project) && fields.Project[0];
			if (!isAirtableRecordId(linked)) continue;
			const existing = details.get(linked);
			if (!existing || toMs(record.createdTime) > toMs(existing._createdAt)) {
				details.set(linked, {
					lead_researcher: displayText(fields["Lead Researcher"] || ""),
					lead_researcher_email: displayText(fields["Lead Researcher Email"] || ""),
					notes: displayText(fields.Notes || ""),
					_createdAt: record.createdTime || "",
				});
			}
		}
		return projects.map((project) => ({ ...project, ...(details.get(project.id) || {}) }));
	} catch {
		return projects;
	}
}

export async function listProjectRecords(request, env, authContext = {}) {
	requireEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	const url = new URL(request.url);
	const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
	const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
	const data = await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}?pageSize=${limit}`);
	let projects = (data.records || []).map(mapProject).filter(isRenderable);
	projects = await joinDetails(env, projects);
	projects = projects.filter((project) => userCanSee(project, authContext));
	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	return json({ ok: true, projects, canStartProject: canStartProject(authContext) }, 200, { "x-rops-source": "airtable" });
}

export async function getProjectRecord(_request, env, projectId, authContext = {}) {
	requireEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	if (!isAirtableRecordId(projectId)) return json({ ok: false, error: "Project not found" }, 404);
	const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
	const project = mapProject(await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}/${encodeURIComponent(projectId)}`));
	if (!isRenderable(project) || !userCanSee(project, authContext)) return json({ ok: false, error: "Project not found" }, 404);
	const joined = await joinDetails(env, [project]);
	return json(joined[0], 200, { "x-rops-source": "airtable" });
}
