/**
 * @file src/service/project-list-d1-airtable.js
 * @module service/project-list-d1-airtable
 * @summary CSV-free project listing for /api/projects using Airtable first, then D1 cache.
 */

import { toMs } from "../core/utils.js";

const AIRTABLE_PAGE_SIZE = 100;
const MAX_AIRTABLE_PAGES = 20;

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

function splitList(value, pattern) {
	if (Array.isArray(value)) return value.flatMap((item) => splitList(item, pattern));
	if (value && typeof value === "object") return [displayText(value)].filter(Boolean);
	return String(value || "")
		.split(pattern)
		.map((item) => displayText(item))
		.filter(Boolean);
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
	const explicit = valuesFromFields(fields, ["Team Name", "Team Names", "Team name", "Team names", "teamName", "teamNames", "team_name", "team_names", "Organisation", "Organization", "Project Team Name", "Project Team Names"]);
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
	return new Set([...(project.team_ids || []), ...(project.teamIds || []), ...(project.teamNames || []), project.teamName, project.team_name, project.team].map(normaliseKey).filter(Boolean));
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

function mapAirtableProject(record = {}) {
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
		org: displayText(fields.Org || fields.org || ""),
	};
}

function mapD1Project(row = {}) {
	const id = displayText(row.id || row.airtableId || row.recordId || "");
	return {
		id,
		airtableId: id,
		recordId: id,
		name: displayText(row.name || ""),
		description: displayText(row.description || ""),
		"rops:servicePhase": displayText(row.phase || row["rops:servicePhase"] || ""),
		"rops:projectStatus": displayText(row.status || row["rops:projectStatus"] || ""),
		objectives: [],
		user_groups: [],
		stakeholders: [],
		createdAt: displayText(row.created_at || row.createdAt || row.updated_at || ""),
		team_ids: splitList(row.team_ids || row.teamIds || "", /\r?\n|[|,]/),
		teamIds: splitList(row.team_ids || row.teamIds || "", /\r?\n|[|,]/),
		teamNames: splitList(row.team_names || row.teamNames || "", /\r?\n|[|,]/),
		teamName: displayText(row.team_name || row.teamName || ""),
		team_name: displayText(row.team_name || row.teamName || ""),
		team: displayText(row.team_name || row.teamName || ""),
		org: displayText(row.org || ""),
	};
}

function isRenderable(project = {}) {
	return Boolean(isAirtableRecordId(project.id) && project.name && project["rops:servicePhase"] && project["rops:projectStatus"]);
}

async function airtableJson(ctx, url) {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
			Accept: "application/json",
		},
	});
	const text = await response.text();
	let data = {};
	try {
		data = JSON.parse(text);
	} catch {
		data = {};
	}
	if (!response.ok) throw Object.assign(new Error(data?.error?.message || data?.error?.type || `airtable_http_${response.status}`), { status: response.status, body: text });
	return data;
}

async function airtableRecords(ctx, tableName, searchParams = new URLSearchParams()) {
	const table = encodeURIComponent(tableName);
	const records = [];
	let offset = "";
	let page = 0;

	do {
		const params = new URLSearchParams(searchParams);
		params.set("pageSize", String(AIRTABLE_PAGE_SIZE));
		if (offset) params.set("offset", offset);
		const data = await airtableJson(ctx, `https://api.airtable.com/v0/${ctx.env.AIRTABLE_BASE_ID}/${table}?${params.toString()}`);
		records.push(...(Array.isArray(data.records) ? data.records : []));
		offset = data.offset || "";
		page += 1;
	} while (offset && page < MAX_AIRTABLE_PAGES);

	return records;
}

async function listAirtableProjects(ctx, url) {
	const missing = ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"].filter((key) => !ctx.env?.[key]);
	if (missing.length) throw Object.assign(new Error(`Missing env: ${missing.join(", ")}`), { source: "airtable", missing });

	const view = url.searchParams.get("view") || "";
	const params = new URLSearchParams();
	if (view) params.set("view", view);
	const projects = (await airtableRecords(ctx, ctx.env.AIRTABLE_TABLE_PROJECTS, params)).map(mapAirtableProject).filter(isRenderable);
	return { source: "airtable", projects };
}

async function listD1Projects(ctx) {
	const db = ctx.env.RESEARCHOPS_D1;
	if (!db?.prepare) throw Object.assign(new Error("RESEARCHOPS_D1 binding not available"), { source: "d1" });
	const response = await db.prepare("SELECT * FROM rops_projects_cache WHERE active = 1 ORDER BY updated_at DESC").all();
	const projects = (response?.results || []).map(mapD1Project).filter(isRenderable);
	return { source: "d1", projects };
}

export async function listProjectsFromD1OrAirtable(ctx, origin, url, authContext = {}) {
	const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
	const errors = [];
	let payload = null;

	try {
		payload = await listAirtableProjects(ctx, url);
	} catch (error) {
		errors.push({ source: "airtable", message: String(error?.message || error), status: error?.status || 0, missing: error?.missing || [] });
	}

	if (!payload || !payload.projects.length) {
		try {
			const d1Payload = await listD1Projects(ctx);
			if (d1Payload.projects.length) payload = d1Payload;
		} catch (error) {
			errors.push({ source: "d1", message: String(error?.message || error) });
		}
	}

	if (!payload) {
		return ctx.json(
			{
				ok: false,
				error: "projects_unavailable",
				detail: "No Airtable or D1 project source is available for /api/projects. CSV fallback is intentionally disabled.",
				sources: errors,
			},
			503,
			{
				...ctx.corsHeaders(origin),
				"content-type": "application/json; charset=utf-8",
				"x-rops-source": "none",
			},
		);
	}

	let projects = payload.projects.filter((project) => userCanSee(project, authContext));
	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	projects = projects.slice(0, limit);

	return ctx.json(
		{
			ok: true,
			projects,
			canStartProject: canStartProject(authContext),
		},
		200,
		{
			...ctx.corsHeaders(origin),
			"content-type": "application/json; charset=utf-8",
			"x-rops-source": payload.source,
		},
	);
}
