/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Project handlers with team-scoped visibility and Airtable-first reads.
 */

import { fetchWithTimeout, toMs, safeText } from "../core/utils.js";

/**
 * @typedef {import('./index.js').ServiceContext} ServiceContext
 */

/* ───────────────────────── CSV fallback helpers ───────────────────────── */

/**
 * Parse RFC 4180-style CSV text into an array of row objects keyed by header.
 *
 * Handles:
 * - quoted fields ("...,...") with embedded commas
 * - escaped quotes inside quoted fields ("" => ")
 * - multi-line cells (newlines inside quoted fields)
 * - leading UTF-8 BOM
 * - blank trailing lines
 *
 * The previous implementation split on every newline and then on every comma,
 * which exploded `data/projects.csv` rows with quoted JSON `Stakeholders` cells
 * into dozens of garbage "records". See docs/agent-audit/reasoning/2026/05/15/.
 *
 * @param {string} text Raw CSV text.
 * @returns {Array<Record<string, string>>}
 */
export function parseCsv(text) {
	const rows = parseCsvRecords(String(text || ""));
	if (!rows.length) return [];

	const headers = rows[0].map((header) => String(header || "").trim());
	if (!headers.length) return [];

	const out = [];
	for (let r = 1; r < rows.length; r += 1) {
		const cols = rows[r];
		// Skip completely empty trailing rows (a single empty cell, no content).
		if (cols.length === 1 && cols[0].trim() === "") continue;
		const obj = {};
		for (let i = 0; i < headers.length; i += 1) {
			const key = headers[i];
			if (!key) continue;
			const value = cols[i] ?? "";
			// Unquoted cells get their surrounding whitespace trimmed for
			// compatibility with the prior parser; quoted cell content is
			// returned verbatim by parseCsvRecords.
			obj[key] = value;
		}
		out.push(obj);
	}
	return out;
}

/**
 * Tokenise CSV text into an array of records (each record is an array of cell
 * values). RFC 4180-compliant for the subset we actually emit and consume.
 *
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsvRecords(text) {
	if (!text) return [];
	// Strip a leading UTF-8 BOM if present.
	const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	/** @type {Array<Array<string>>} */
	const records = [];
	/** @type {Array<string>} */
	let record = [];
	let field = "";
	let inQuoted = false;
	let started = false;

	for (let i = 0; i < src.length; i += 1) {
		const c = src[i];

		if (inQuoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					inQuoted = false;
				}
			} else {
				field += c;
			}
			started = true;
			continue;
		}

		if (c === '"') {
			inQuoted = true;
			started = true;
			continue;
		}

		if (c === ",") {
			record.push(field);
			field = "";
			started = true;
			continue;
		}

		if (c === "\n" || c === "\r") {
			// Skip the second character of a CRLF pair.
			if (c === "\r" && src[i + 1] === "\n") i += 1;
			if (started || field || record.length) {
				record.push(field);
				records.push(record);
				record = [];
				field = "";
				started = false;
			}
			continue;
		}

		field += c;
		started = true;
	}

	if (started || field || record.length) {
		record.push(field);
		records.push(record);
	}

	return records;
}

async function fetchProjectsCsvFromGitHub(env) {
	const owner = env.GH_OWNER;
	const repo = env.GH_REPO;
	const branch = env.GH_BRANCH || "main";
	const path = env.GH_PATH_PROJECTS || "data/projects.csv";

	const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
	const headers = {};
	if (env.GH_TOKEN) headers.Authorization = `Bearer ${env.GH_TOKEN}`;

	const res = await fetch(rawUrl, { headers });
	const body = await res.text().catch(() => "");
	if (!res.ok) {
		throw Object.assign(new Error("github_csv_fetch_failed"), {
			status: res.status,
			body: safeText(body),
		});
	}
	return parseCsv(body);
}

function coerceCsvRowToProject(r = {}) {
	const airtableId = displayText(r.AirtableId || r.airtableId || r.RecordId || r.recordId || "");
	const id = publicProjectId(r, { id: airtableId });
	let stakeholders = [];
	try {
		stakeholders = r.Stakeholders ? JSON.parse(r.Stakeholders) : [];
	} catch {
		/* noop */
	}

	const teamNames = normaliseTeamNames(r);
	const teamIds = normaliseTeamIds(r);
	const teamName = teamNames[0] || "";

	return {
		id,
		pid: id,
		localId: id,
		LocalId: id,
		airtableId,
		recordId: airtableId,
		name: displayText(r.Name || r["Project Name"] || r.Title || ""),
		description: displayText(r.Description || r.Summary || ""),
		"rops:servicePhase": displayText(r.Phase || r["Service Phase"] || ""),
		"rops:projectStatus": displayText(r.Status || r["Project Status"] || ""),
		objectives: normaliseLines(r.Objectives || r["Research Objectives"] || ""),
		user_groups: normaliseUserGroups(r.UserGroups || r["User Groups"] || ""),
		stakeholders: normaliseStakeholders(stakeholders),
		createdAt: displayText(r.CreatedAt || r.createdTime || ""),
		team_ids: teamIds,
		teamIds,
		teamNames,
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || displayText(r.Org || r.org || ""),
	};
}

/* ───────────────────────── Shared helpers ───────────────────────── */

function requireEnv(ctx, keys) {
	const miss = keys.filter((key) => !ctx?.env?.[key]);
	if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

function jsonHeaders(ctx, origin, extra = {}) {
	return {
		...ctx.corsHeaders(origin),
		"content-type": "application/json; charset=utf-8",
		...extra,
	};
}

function airtableHeaders(ctx) {
	return {
		Authorization: `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
		Accept: "application/json",
	};
}

function normaliseKey(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function unique(values = []) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = String(value || "").trim();
		const key = normaliseKey(text);
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
	}
	return out;
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim() !== "") return value;
	}
	return "";
}

function tryJson(value) {
	if (typeof value !== "string") return null;
	const text = value.trim();
	if (!text || !/^[{[]/.test(text)) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function looksLikeStructuredValue(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return (
		/^_?\s*[{[]/.test(text) ||
		/"{1,3}email"{1,3}\s*:/i.test(text) ||
		/"{1,3}role"{1,3}\s*:/i.test(text) ||
		/"{1,3}name"{1,3}\s*:/i.test(text) ||
		/^[}\]]+$/.test(text)
	);
}

function displayText(value) {
	if (Array.isArray(value) || (value && typeof value === "object")) return "";
	const text = String(value || "")
		.trim()
		.replace(/^_+(?=\s*[{[])/, "");
	if (!text || looksLikeStructuredValue(text)) return "";
	return text;
}

function labelFromObject(item = {}) {
	return firstPresent(
		item.name,
		item.Name,
		item.label,
		item.Label,
		item.title,
		item.Title,
		item.text,
		item.Text,
		item.value,
		item.Value,
	);
}

function labelFromContentObject(item = {}) {
	return firstPresent(item.label, item.Label, item.title, item.Title, item.text, item.Text, item.value, item.Value);
}

function looksLikeIdentityFragment(value) {
	const text = String(value || "").trim();
	if (!text) return false;
	return (
		/"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/"?role"?\s*:/i.test(text) ||
		/"{1,3}EMAIL"{1,3}\s*:/i.test(text) ||
		/"{1,3}email"{1,3}\s*:/i.test(text) ||
		/"{1,3}role"{1,3}\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text))
	);
}

function normaliseLines(value) {
	const parsed = tryJson(value);
	if (parsed) return normaliseLines(parsed);

	if (Array.isArray(value)) return unique(value.flatMap((item) => normaliseLines(item)));

	if (value && typeof value === "object") {
		const label = displayText(labelFromContentObject(value));
		return label ? [label] : [];
	}

	return unique(
		String(value || "")
			.split(/\r?\n|[|]/)
			.map((item) => displayText(item))
			.filter((item) => item && !looksLikeIdentityFragment(item)),
	);
}

function normaliseLabelList(value) {
	const parsed = tryJson(value);
	if (parsed) return normaliseLabelList(parsed);

	if (Array.isArray(value)) return unique(value.flatMap((item) => normaliseLabelList(item)));

	if (value && typeof value === "object") {
		const label = displayText(labelFromContentObject(value) || labelFromObject(value));
		return label && !looksLikeIdentityFragment(label) ? [label] : [];
	}

	return unique(
		String(value || "")
			.split(/\r?\n|[|,]/)
			.map((item) => displayText(item))
			.filter((item) => item && !looksLikeIdentityFragment(item)),
	);
}

function normaliseUserGroups(value) {
	return normaliseLabelList(value);
}

function normaliseStakeholders(value) {
	const parsed = tryJson(value);
	const list = parsed || value;

	if (!Array.isArray(list)) return [];

	return list
		.map((item) => ({
			name: displayText(item?.name || item?.Name || ""),
			role: displayText(item?.role || item?.Role || ""),
			email: String(item?.email || item?.Email || item?.EMAIL || "").trim(),
		}))
		.filter((item) => item.name || item.role || item.email);
}

function valuesFromFieldValue(value) {
	const parsed = tryJson(value);
	if (parsed) return valuesFromFieldValue(parsed);
	if (Array.isArray(value)) return value.flatMap(valuesFromFieldValue);
	if (value && typeof value === "object") {
		const id = displayText(firstPresent(value.id, value.ID));
		const label = displayText(labelFromObject(value));
		return [id, label].filter(Boolean);
	}
	const text = displayText(value);
	return text ? [text] : [];
}

function valuesFromFields(fields = {}, names = []) {
	return names.flatMap((name) => valuesFromFieldValue(fields[name]));
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function normaliseTeamIds(fields = {}) {
	return unique(
		valuesFromFields(fields, [
			"Team ID",
			"Team IDs",
			"TeamId",
			"TeamIds",
			"team_id",
			"team_ids",
			"Team",
			"Teams",
			"Project Team",
			"Project Teams",
			"Owning Team",
			"Owning Teams",
		]).filter((value) => normaliseKey(value).startsWith("team-") || isAirtableRecordId(value)),
	);
}

function normaliseTeamNames(fields = {}) {
	const explicitNames = valuesFromFields(fields, [
		"Team Name",
		"Team Names",
		"Team name",
		"Team names",
		"teamName",
		"teamNames",
		"team_name",
		"team_names",
		"Org",
		"org",
		"Organisation",
		"Organization",
		"Project Team Name",
		"Project Team Names",
		"Owning Team Name",
		"Owning Team Names",
	]);

	const linkedNames = valuesFromFields(fields, ["Team", "Teams", "Project Team", "Project Teams", "Owning Team", "Owning Teams"]).filter(
		(value) => !isAirtableRecordId(value) && !normaliseKey(value).startsWith("team-"),
	);

	return unique([...explicitNames, ...linkedNames]).filter((value) => !looksLikeIdentityFragment(value));
}

function publicProjectId(fields = {}, record = {}) {
	return displayText(
		firstPresent(
			fields.PID,
			fields.Pid,
			fields.pid,
			fields["Project ID"],
			fields.ProjectID,
			fields.projectId,
			fields.LocalId,
			fields.localId,
			record.localId,
			record.LocalId,
			record.id,
		),
	);
}

function isRenderableProject(project = {}) {
	return Boolean(project.id && project.name && !looksLikeStructuredValue(project.name));
}

function teamsForAuthContext(authContext = {}) {
	return [...(authContext.teamMemberships || []), ...(authContext.memberTeams || []), ...(authContext.teams || []), authContext.activeTeam].filter(
		Boolean,
	);
}

function isResearchOpsCoreTeam(team = {}) {
	const id = normaliseKey(team.id || team.teamId || team.team_id);
	const name = normaliseKey(team.name || team.teamName || team.team_name || team.label);
	return id === "team-researchops-core" || name === "researchops-core" || name === "researchops-core-team";
}

function isResearchOpsCoreMember(authContext = {}) {
	return Boolean(authContext.isResearchOpsCoreTeamAdmin) || teamsForAuthContext(authContext).some(isResearchOpsCoreTeam);
}

function authTeamKeys(authContext = {}) {
	return new Set(
		teamsForAuthContext(authContext)
			.flatMap((team) => [team.id, team.teamId, team.team_id, team.name, team.teamName, team.team_name, team.label].map(normaliseKey))
			.filter(Boolean),
	);
}

function projectTeamKeys(project = {}) {
	return new Set(
		[...(project.team_ids || []), ...(project.teamIds || []), ...(project.teamNames || []), project.teamName, project.team_name, project.team, project.org]
			.map(normaliseKey)
			.filter(Boolean),
	);
}

function userCanSeeProject(project = {}, authContext = {}) {
	if (isResearchOpsCoreMember(authContext)) return true;

	const projectKeys = projectTeamKeys(project);
	if (!projectKeys.size) return false;

	const userKeys = authTeamKeys(authContext);
	for (const projectKey of projectKeys) {
		if (userKeys.has(projectKey)) return true;
	}
	return false;
}

function permissionsForAuthContext(authContext = {}) {
	return new Set((authContext.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function canStartProject(authContext = {}) {
	if (isResearchOpsCoreMember(authContext)) return true;
	if (permissionsForAuthContext(authContext).has("governed.create")) return true;

	return (authContext.roles || []).some((role) => {
		const key = role.key || role.roleKey;
		return key === "researcher" || key === "user_researcher" || key === "research_lead";
	});
}

function activeTeamForCreate(authContext = {}) {
	if (authContext.activeTeam?.id || authContext.activeTeam?.name) return authContext.activeTeam;
	return authContext.teamMemberships?.[0] || authContext.memberTeams?.[0] || null;
}

function mapProject(r) {
	const f = r?.fields || {};
	const airtableId = displayText(r?.id || "");
	const id = publicProjectId(f, { id: airtableId });
	const teamNames = normaliseTeamNames(f);
	const teamIds = normaliseTeamIds(f);
	const teamName = teamNames[0] || "";

	return {
		id,
		pid: id,
		localId: id,
		LocalId: id,
		airtableId,
		recordId: airtableId,
		name: displayText(f.Name || f["Project Name"] || f.Title || ""),
		description: displayText(f.Description || f.Summary || ""),
		"rops:servicePhase": displayText(f.Phase || f["Service Phase"] || ""),
		"rops:projectStatus": displayText(f.Status || f["Project Status"] || ""),
		objectives: normaliseLines(f.Objectives || f["Research Objectives"] || ""),
		user_groups: normaliseUserGroups(f.UserGroups || f["User Groups"] || ""),
		stakeholders: normaliseStakeholders(f.Stakeholders || []),
		createdAt: displayText(r.createdTime || f.CreatedAt || f["Created At"] || ""),
		team_ids: teamIds,
		teamIds,
		teamNames,
		teamName,
		team_name: teamName,
		team: teamName,
		org: teamName || displayText(f.Org || f.org || ""),
	};
}

function compareProjects(a = {}, b = {}) {
	const dateOrder = toMs(b.createdAt) - toMs(a.createdAt);
	if (dateOrder !== 0) return dateOrder;

	const an = String(a.name || "").toLocaleLowerCase();
	const bn = String(b.name || "").toLocaleLowerCase();
	if (an && !bn) return -1;
	if (!an && bn) return 1;
	if (an < bn) return -1;
	if (an > bn) return 1;

	const ai = String(a.id || a.LocalId || a.airtableId || "");
	const bi = String(b.id || b.LocalId || b.airtableId || "");
	return ai.localeCompare(bi);
}

async function readAirtableJson(ctx, url, options = {}) {
	const res = await fetchWithTimeout(url, options, ctx.cfg.TIMEOUT_MS);
	const text = await res.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = {};
	}

	if (!res.ok) {
		throw Object.assign(new Error(data?.error?.message || data?.error?.type || `airtable_http_${res.status}`), {
			status: res.status,
			body: text,
		});
	}
	return data;
}

async function readProjectRecords(ctx, limit = 100, view) {
	requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	const base = ctx.env.AIRTABLE_BASE_ID;
	const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
	let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
	if (view) atUrl += `&view=${encodeURIComponent(view)}`;
	const pData = await readAirtableJson(ctx, atUrl, {
		headers: airtableHeaders(ctx),
		signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS),
	});
	return Array.isArray(pData.records) ? pData.records : [];
}

async function findProjectRecord(ctx, projectId) {
	const id = displayText(projectId);
	if (!id) {
		throw Object.assign(new Error("missing_project_id"), { status: 400 });
	}

	if (isAirtableRecordId(id)) {
		const base = ctx.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
		return readAirtableJson(ctx, `https://api.airtable.com/v0/${base}/${tProjects}/${encodeURIComponent(id)}`, {
			headers: airtableHeaders(ctx),
			signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS),
		});
	}

	const records = await readProjectRecords(ctx, 100);
	const found = records.find((record) => {
		const project = mapProject(record);
		return [project.id, project.pid, project.localId, project.LocalId, project.airtableId, project.recordId].filter(Boolean).includes(id);
	});

	if (!found) {
		throw Object.assign(new Error("project_not_found"), { status: 404 });
	}
	return found;
}

async function joinLatestProjectDetails(ctx, projects = []) {
	try {
		const base = ctx.env.AIRTABLE_BASE_ID;
		const tDetails = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);
		const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
		const dData = await readAirtableJson(ctx, dUrl, {
			headers: airtableHeaders(ctx),
			signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS),
		});

		const detailsByProject = new Map();
		for (const r of dData.records || []) {
			const f = r.fields || {};
			const linked = Array.isArray(f.Project) && f.Project[0];
			if (!linked) continue;
			const existing = detailsByProject.get(linked);
			if (!existing || toMs(r.createdTime) > toMs(existing._createdAt)) {
				detailsByProject.set(linked, {
					lead_researcher: displayText(f["Lead Researcher"] || ""),
					lead_researcher_email: displayText(f["Lead Researcher Email"] || ""),
					notes: displayText(f.Notes || ""),
					_createdAt: r.createdTime || "",
				});
			}
		}

		return projects.map((project) => {
			const details = detailsByProject.get(project.airtableId || project.recordId || project.id);
			return details ? { ...project, ...details } : project;
		});
	} catch (error) {
		ctx.log.warn("airtable.details.join.fail", {
			status: error?.status || 0,
			detail: String(error?.message || error).slice(0, 160),
		});
		return projects;
	}
}

function createProjectFields(payload = {}, authContext = {}, ctx = {}) {
	const team = activeTeamForCreate(authContext);
	const fields = {
		Name: displayText(payload.name || payload.Name || ""),
		Description: displayText(payload.description || payload.Description || ""),
		Phase: displayText(payload.phase || payload.Phase || "Discovery"),
		Status: displayText(payload.status || payload.Status || "Planning research"),
		Objectives: normaliseLines(payload.objectives || payload.Objectives || "").join("\n"),
		UserGroups: normaliseUserGroups(payload.user_groups || payload.UserGroups || payload["User Groups"] || "").join(", "),
		Stakeholders: JSON.stringify(normaliseStakeholders(payload.stakeholders || payload.Stakeholders || [])),
	};

	const teamName = displayText(team?.name || team?.teamName || payload.teamName || payload.team_name || payload.org || "");
	const teamId = displayText(team?.id || team?.teamId || payload.teamId || payload.team_id || "");
	const teamNameField = ctx.env.AIRTABLE_PROJECT_TEAM_NAME_FIELD || "Team Name";
	const teamIdField = ctx.env.AIRTABLE_PROJECT_TEAM_ID_FIELD || "Team ID";

	if (teamName) fields[teamNameField] = teamName;
	if (teamId) fields[teamIdField] = teamId;

	return fields;
}

function isUnknownFieldError(error) {
	const text = `${error?.message || ""} ${error?.body || ""}`;
	return /unknown field|unknown_field|unknown_field_name|invalid field|field name/i.test(text);
}

/* ───────────────────────── List Projects ───────────────────────── */

export async function listProjectsFromAirtable(ctx, origin, url, authContext = {}) {
	const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
	const view = url.searchParams.get("view") || undefined;

	const attemptAirtable = async () => {
		requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);

		let projects = readProjectRecords(ctx, limit, view).then((records) => records.map(mapProject).filter(isRenderableProject));
		projects = await joinLatestProjectDetails(ctx, await projects);
		projects = projects.filter((project) => userCanSeeProject(project, authContext));
		projects.sort(compareProjects);

		return { projects, source: "airtable" };
	};

	let payload;
	try {
		payload = await attemptAirtable();
	} catch (airErr) {
		ctx.log.warn("airtable.list.failed_fallback_to_csv", {
			status: airErr?.status ?? 0,
			detail: String(airErr?.message || airErr).slice(0, 200),
		});

		try {
			const rows = await fetchProjectsCsvFromGitHub(ctx.env);
			let projects = rows.map(coerceCsvRowToProject).filter(isRenderableProject).filter((project) => userCanSeeProject(project, authContext));
			if (projects.length > limit) projects = projects.slice(0, limit);
			projects.sort(compareProjects);
			payload = { projects, source: "csv" };
		} catch (csvErr) {
			return ctx.json(
				{
					ok: false,
					error: "projects_unavailable",
					detail: "Airtable and CSV fallback both failed",
					upstream: {
						github_status: csvErr?.status ?? 0,
						github_detail: safeText(csvErr?.body || csvErr?.message || String(csvErr)).slice(0, 200),
					},
				},
				500,
				jsonHeaders(ctx, origin, { "x-rops-source": "none" }),
			);
		}
	}

	return ctx.json(
		{
			ok: true,
			projects: payload.projects,
			canStartProject: canStartProject(authContext),
		},
		200,
		jsonHeaders(ctx, origin, { "x-rops-source": payload.source }),
	);
}

/* ───────────────────────── Create Project ───────────────────────── */

export async function createProjectInAirtable(ctx, request, origin, authContext = {}) {
	if (!canStartProject(authContext)) {
		return ctx.json(
			{
				ok: false,
				error: "forbidden",
				detail: "You do not have permission to start a research project.",
			},
			403,
			jsonHeaders(ctx, origin),
		);
	}

	try {
		requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	} catch (e) {
		return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
	}

	const body = await request.arrayBuffer();
	if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) {
		return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
	}

	let payload;
	try {
		payload = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin));
	}

	const fields = createProjectFields(payload, authContext, ctx);
	if (!fields.Name) return ctx.json({ ok: false, error: "Project name is required" }, 400, jsonHeaders(ctx, origin));

	const base = ctx.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

	try {
		const data = await readAirtableJson(ctx, atUrl, {
			method: "POST",
			headers: {
				...airtableHeaders(ctx),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ records: [{ fields }] }),
		});

		return ctx.json(
			{
				ok: true,
				project: mapProject(data.records?.[0]),
			},
			201,
			jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }),
		);
	} catch (error) {
		if (isUnknownFieldError(error)) {
			return ctx.json(
				{
					ok: false,
					error: "project_team_fields_missing",
					detail: "Airtable rejected the configured project team fields.",
				},
				500,
				jsonHeaders(ctx, origin),
			);
		}

		ctx.log.error("airtable.project.create.fail", {
			status: error?.status || 500,
			detail: String(error?.message || error).slice(0, 160),
		});

		return ctx.json(
			{
				ok: false,
				error: `Airtable ${error?.status || 500}`,
				detail: safeText(error?.message || error),
			},
			error?.status || 500,
			jsonHeaders(ctx, origin),
		);
	}
}

/* ───────────────────────── Get Project by ID ───────────────────────── */

export async function getProjectById(ctx, origin, projectId, authContext = {}) {
	if (!projectId) {
		return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
	}

	try {
		requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_TABLE_DETAILS", "AIRTABLE_API_KEY"]);
	} catch (e) {
		return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
	}

	try {
		const rec = await findProjectRecord(ctx, projectId);
		let project = mapProject(rec);
		if (!isRenderableProject(project) || !userCanSeeProject(project, authContext)) {
			return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
		}

		project = (await joinLatestProjectDetails(ctx, [project]))[0];

		return ctx.json(project, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
	} catch (error) {
		const status = error?.status === 404 ? 404 : error?.status || 500;
		if (status !== 404) {
			ctx.log.error("airtable.project.read.fail", {
				status,
				detail: String(error?.message || error).slice(0, 160),
			});
		}
		return ctx.json(
			{
				ok: false,
				error: status === 404 ? "Project not found" : `Airtable ${status}`,
				detail: status === 404 ? undefined : safeText(error?.message || error),
			},
			status,
			jsonHeaders(ctx, origin),
		);
	}
}

/* ───────────────────────── Update Project Framing ───────────────────────── */

export async function updateProjectFraming(ctx, request, origin, projectId, authContext = {}) {
	if (!projectId) {
		return ctx.json({ ok: false, error: "Missing project id" }, 400, jsonHeaders(ctx, origin));
	}

	try {
		requireEnv(ctx, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	} catch (e) {
		return ctx.json({ ok: false, error: String(e?.message || e) }, 500, jsonHeaders(ctx, origin));
	}

	let record;
	let existingProject;
	try {
		record = await findProjectRecord(ctx, projectId);
		existingProject = mapProject(record);
	} catch (error) {
		const status = error?.status === 404 ? 404 : error?.status || 500;
		return ctx.json(
			{
				ok: false,
				error: status === 404 ? "Project not found" : `Airtable ${status}`,
			},
			status,
			jsonHeaders(ctx, origin),
		);
	}

	if (!isRenderableProject(existingProject) || !userCanSeeProject(existingProject, authContext)) {
		return ctx.json({ ok: false, error: "Project not found" }, 404, jsonHeaders(ctx, origin));
	}

	const body = await request.arrayBuffer();
	if (body.byteLength > ctx.cfg.MAX_BODY_BYTES) {
		return ctx.json({ ok: false, error: "Payload too large" }, 413, jsonHeaders(ctx, origin));
	}

	let payload;
	try {
		payload = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return ctx.json({ ok: false, error: "Invalid JSON" }, 400, jsonHeaders(ctx, origin));
	}

	const fields = {};
	if (Object.hasOwn(payload, "objectives")) fields.Objectives = normaliseLines(payload.objectives).join("\n");
	if (Object.hasOwn(payload, "user_groups")) fields.UserGroups = normaliseUserGroups(payload.user_groups).join(", ");
	if (Object.hasOwn(payload, "stakeholders")) fields.Stakeholders = JSON.stringify(normaliseStakeholders(payload.stakeholders));

	if (Object.keys(fields).length === 0) {
		return ctx.json({ ok: false, error: "No updatable project framing fields provided" }, 400, jsonHeaders(ctx, origin));
	}

	const base = ctx.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;
	const recordId = record.id;

	const res = await fetchWithTimeout(
		atUrl,
		{
			method: "PATCH",
			headers: {
				...airtableHeaders(ctx),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ records: [{ id: recordId, fields }] }),
		},
		ctx.cfg.TIMEOUT_MS,
	);

	const text = await res.text();
	if (!res.ok) {
		ctx.log.error("airtable.project.update.fail", {
			status: res.status,
			detail: safeText(text).slice(0, 160),
		});
		return ctx.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, jsonHeaders(ctx, origin));
	}

	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = { records: [] };
	}
	const project = mapProject(data.records?.[0] || { id: recordId, fields: { ...(record.fields || {}), ...fields } });

	if (ctx.env.AUDIT === "true") ctx.log.info("project.framing.updated", { projectId: project.id, airtableId: recordId, fields: Object.keys(fields) });
	return ctx.json({ ok: true, project }, 200, jsonHeaders(ctx, origin, { "x-rops-source": "airtable" }));
}
