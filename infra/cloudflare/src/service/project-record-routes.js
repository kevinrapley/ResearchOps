/**
 * @file src/service/project-record-routes.js
 * @module service/project-record-routes
 * @summary Airtable Projects read and create routes using Airtable record IDs as canonical project IDs.
 */

import { toMs } from "../core/utils.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const AIRTABLE_MAX_PAGE_SIZE = 100;
const MAX_AIRTABLE_PAGES = 20;
const MAX_JSON_BODY_BYTES = 1024 * 1024;

function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function requireEnv(env, keys) {
	const missing = keys.filter((key) => !env?.[key]);
	if (missing.length) throw Object.assign(new Error(`Missing env: ${missing.join(", ")}`), { status: 500, missing });
}

function missingEnv(env, keys) {
	return keys.filter((key) => !env?.[key]);
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

function activeTeamForCreate(authContext = {}) {
	if (authContext.activeTeam?.id || authContext.activeTeam?.name || authContext.activeTeam?.teamName) return authContext.activeTeam;
	return authContext.teamMemberships?.[0] || authContext.memberTeams?.[0] || authContext.teams?.[0] || null;
}

function hasProjectShape(record = {}) {
	const fields = record.fields || {};
	return Boolean(fields.Name || fields["Project Name"] || fields.Title) && Boolean(fields.Phase || fields["Service Phase"] || fields.Status || fields["Project Status"] || fields.Description || fields.Summary);
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

function mapD1Project(row = {}) {
	const id = displayText(row.id || row.airtableId || row.recordId || "");
	const teamName = displayText(row.team_name || row.teamName || row.org || "");
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
		teamNames: splitList(row.team_names || row.teamNames || teamName, /\r?\n|[|,]/),
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName,
	};
}

function isRenderable(project = {}) {
	return Boolean(isAirtableRecordId(project.id) && project.name);
}

function isUnknownFieldError(error) {
	const text = `${error?.message || ""} ${error?.body || ""}`;
	return /unknown field|unknown_field|unknown_field_name|invalid field|field name/i.test(text);
}

function buildProjectFields(payload = {}, authContext = {}, env = {}) {
	const team = activeTeamForCreate(authContext);
	const fields = {
		Name: displayText(payload.name || payload.Name || ""),
		Description: displayText(payload.description || payload.Description || ""),
		Phase: displayText(payload.phase || payload.Phase || "Discovery"),
		Status: displayText(payload.status || payload.Status || "Planning research"),
		Objectives: splitList(payload.objectives || payload.Objectives || "", /\r?\n|[|]/).join("\n"),
		UserGroups: splitList(payload.user_groups || payload.UserGroups || payload["User Groups"] || "", /\r?\n|[|,]/).join(", "),
		Stakeholders: JSON.stringify(parseStakeholders(payload.stakeholders || payload.Stakeholders || [])),
	};

	const teamName = displayText(team?.name || team?.teamName || team?.team_name || payload.teamName || payload.team_name || payload.org || "");
	const teamId = displayText(team?.id || team?.teamId || team?.team_id || payload.teamId || payload.team_id || "");
	const teamNameField = env.AIRTABLE_PROJECT_TEAM_NAME_FIELD || "Team Name";
	const teamIdField = env.AIRTABLE_PROJECT_TEAM_ID_FIELD || "Team ID";
	if (teamName) fields[teamNameField] = teamName;
	if (teamId) fields[teamIdField] = teamId;
	return fields;
}

function buildProjectDetailFields(payload = {}, projectRecordId) {
	const fields = {
		Project: [projectRecordId],
	};
	const leadResearcher = displayText(payload.lead_researcher || payload["Lead Researcher"] || "");
	const leadEmail = displayText(payload.lead_researcher_email || payload["Lead Researcher Email"] || "");
	const notes = displayText(payload.notes || payload.Notes || "");
	if (leadResearcher) fields["Lead Researcher"] = leadResearcher;
	if (leadEmail) fields["Lead Researcher Email"] = leadEmail;
	if (notes) fields.Notes = notes;
	return Object.keys(fields).length > 1 ? fields : null;
}

async function airtableJson(env, url, options = {}) {
	const headers = new Headers(options.headers || {});
	if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${env.AIRTABLE_API_KEY}`);
	if (!headers.has("Accept")) headers.set("Accept", "application/json");
	const response = await fetch(url, { ...options, headers });
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

async function airtableRecords(env, tableName, searchParams = new URLSearchParams()) {
	const table = encodeURIComponent(tableName);
	const records = [];
	let offset = "";
	let page = 0;

	do {
		const params = new URLSearchParams(searchParams);
		params.set("pageSize", String(AIRTABLE_MAX_PAGE_SIZE));
		if (offset) params.set("offset", offset);
		const data = await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}?${params.toString()}`);
		records.push(...(Array.isArray(data.records) ? data.records : []));
		offset = data.offset || "";
		page += 1;
	} while (offset && page < MAX_AIRTABLE_PAGES);

	return records;
}

async function createProjectDetails(env, payload = {}, projectRecordId) {
	if (!env.AIRTABLE_TABLE_DETAILS) return null;
	const fields = buildProjectDetailFields(payload, projectRecordId);
	if (!fields) return null;
	const table = encodeURIComponent(env.AIRTABLE_TABLE_DETAILS);
	const data = await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ fields }] }),
	});
	return data.records?.[0] || null;
}

async function joinDetails(env, projects = []) {
	if (!env.AIRTABLE_TABLE_DETAILS) return projects;
	try {
		const params = new URLSearchParams();
		for (const field of ["Project", "Lead Researcher", "Lead Researcher Email", "Notes"]) {
			params.append("fields[]", field);
		}
		const records = await airtableRecords(env, env.AIRTABLE_TABLE_DETAILS, params);
		const details = new Map();
		for (const record of records) {
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

async function syncActiveProjectsToD1(env, projects = []) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) return;
	const currentProjects = projects.filter((project) => isAirtableRecordId(project.id));
	if (!currentProjects.length) return;

	try {
		await db.prepare("CREATE TABLE IF NOT EXISTS rops_projects_cache (id TEXT PRIMARY KEY, name TEXT NOT NULL, org TEXT, phase TEXT, status TEXT, active INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'airtable', updated_at TEXT NOT NULL)").run();
		await db.prepare("UPDATE rops_projects_cache SET active = 0 WHERE source = 'airtable'").run();

		const updatedAt = new Date().toISOString();
		for (const project of currentProjects) {
			await db
				.prepare("INSERT INTO rops_projects_cache (id, name, org, phase, status, active, source, updated_at) VALUES (?, ?, ?, ?, ?, 1, 'airtable', ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, org = excluded.org, phase = excluded.phase, status = excluded.status, active = excluded.active, source = excluded.source, updated_at = excluded.updated_at")
				.bind(project.id, project.name || "", project.org || "", project["rops:servicePhase"] || "", project["rops:projectStatus"] || "", updatedAt)
				.run();
		}
	} catch {
		/* Cache sync must not block the authoritative Airtable response. */
	}
}

async function listD1ProjectRecords(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) throw Object.assign(new Error("RESEARCHOPS_D1 binding not available"), { source: "d1" });
	await db.prepare("CREATE TABLE IF NOT EXISTS rops_projects_cache (id TEXT PRIMARY KEY, name TEXT NOT NULL, org TEXT, phase TEXT, status TEXT, active INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'airtable', updated_at TEXT NOT NULL)").run();
	const response = await db.prepare("SELECT * FROM rops_projects_cache WHERE active = 1 ORDER BY updated_at DESC").all();
	return (response?.results || []).map(mapD1Project).filter(isRenderable);
}

export async function createProjectRecord(request, env, authContext = {}) {
	requireEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	if (!canStartProject(authContext)) return json({ ok: false, error: "forbidden", detail: "You do not have permission to start a research project." }, 403);

	const body = await request.arrayBuffer();
	if (body.byteLength > MAX_JSON_BODY_BYTES) return json({ ok: false, error: "Payload too large" }, 413);

	let payload = {};
	try {
		payload = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return json({ ok: false, error: "Invalid JSON" }, 400);
	}

	const fields = buildProjectFields(payload, authContext, env);
	if (!fields.Name) return json({ ok: false, error: "Project name is required" }, 400);

	try {
		const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
		const data = await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] }),
		});
		const record = data.records?.[0];
		if (!record?.id) return json({ ok: false, error: "Project create failed" }, 502);

		let detailRecord = null;
		let detailWarning = null;
		try {
			detailRecord = await createProjectDetails(env, payload, record.id);
		} catch (error) {
			detailWarning = isUnknownFieldError(error) ? "project_detail_fields_missing" : "project_detail_create_failed";
		}

		const project = mapProject(record);
		const detailFields = detailRecord?.fields || {};
		return json(
			{
				ok: true,
				project: {
					...project,
					lead_researcher: displayText(detailFields["Lead Researcher"] || payload.lead_researcher || payload["Lead Researcher"] || ""),
					lead_researcher_email: displayText(detailFields["Lead Researcher Email"] || payload.lead_researcher_email || payload["Lead Researcher Email"] || ""),
					notes: displayText(detailFields.Notes || payload.notes || payload.Notes || ""),
				},
				detailWarning,
			},
			201,
			{ "x-rops-source": "airtable" },
		);
	} catch (error) {
		if (isUnknownFieldError(error)) return json({ ok: false, error: "project_team_fields_missing", detail: "Airtable rejected the configured project team fields." }, 500);
		return json({ ok: false, error: `Airtable ${error?.status || 500}`, detail: displayText(error?.message || error) }, error?.status || 500);
	}
}

export async function listProjectRecords(request, env, authContext = {}) {
	const url = new URL(request.url);
	const displayLimit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
	const view = url.searchParams.get("view") || "";
	const params = new URLSearchParams();
	const errors = [];
	let source = "none";
	let projects = [];
	if (view) params.set("view", view);

	const airtableMissing = missingEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	if (airtableMissing.length) {
		errors.push({ source: "airtable", message: `Missing env: ${airtableMissing.join(", ")}`, missing: airtableMissing });
	} else {
		try {
			projects = (await airtableRecords(env, env.AIRTABLE_TABLE_PROJECTS, params))
				.filter(hasProjectShape)
				.map(mapProject)
				.filter(isRenderable);
			projects = await joinDetails(env, projects);
			await syncActiveProjectsToD1(env, projects);
			source = "airtable";
		} catch (error) {
			errors.push({ source: "airtable", message: String(error?.message || error), status: error?.status || 0 });
			projects = [];
		}
	}

	if (!projects.length) {
		try {
			projects = await listD1ProjectRecords(env);
			if (projects.length) source = "d1";
		} catch (error) {
			errors.push({ source: "d1", message: String(error?.message || error) });
		}
	}

	if (!projects.length) {
		return json(
			{
				ok: false,
				error: "projects_unavailable",
				detail: "No Airtable or D1 project source is available for /api/projects. CSV fallback is intentionally disabled.",
				sources: errors,
			},
			503,
			{ "x-rops-source": "none" },
		);
	}

	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	projects = projects.filter((project) => userCanSee(project, authContext)).slice(0, displayLimit);
	return json({ ok: true, projects, canStartProject: canStartProject(authContext) }, 200, { "x-rops-source": source });
}

export async function getProjectRecord(_request, env, projectId, authContext = {}) {
	requireEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	if (!isAirtableRecordId(projectId)) return json({ ok: false, error: "Project not found" }, 404);
	const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
	const projectRecord = await airtableJson(env, `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${table}/${encodeURIComponent(projectId)}`);
	if (!hasProjectShape(projectRecord)) return json({ ok: false, error: "Project not found" }, 404);
	const project = mapProject(projectRecord);
	if (!isRenderable(project) || !userCanSee(project, authContext)) return json({ ok: false, error: "Project not found" }, 404);
	const joined = await joinDetails(env, [project]);
	return json(joined[0], 200, { "x-rops-source": "airtable" });
}
