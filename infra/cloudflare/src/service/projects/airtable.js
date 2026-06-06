import { fetchWithTimeout, toMs } from "../../core/utils.js";
import { activeTeamForCreate } from "./auth.js";
import { displayText, isAirtableRecordId, mapProject, normaliseLines, normaliseStakeholders, normaliseUserGroups } from "./normalisation.js";

export function requireEnv(ctx, keys) {
	const miss = keys.filter((key) => !ctx?.env?.[key]);
	if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
}

export function jsonHeaders(ctx, origin, extra = {}) {
	return {
		...ctx.corsHeaders(origin),
		"content-type": "application/json; charset=utf-8",
		...extra,
	};
}

export function airtableHeaders(ctx) {
	return {
		Authorization: `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
		Accept: "application/json",
	};
}

export async function readAirtableJson(ctx, url, options = {}) {
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

export async function readProjectRecords(ctx, limit = 100, view) {
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

export async function findProjectRecord(ctx, projectId) {
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

export async function joinLatestProjectDetails(ctx, projects = []) {
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

export function createProjectFields(payload = {}, authContext = {}, ctx = {}) {
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

export function isUnknownFieldError(error) {
	const text = `${error?.message || ""} ${error?.body || ""}`;
	return /unknown field|unknown_field|unknown_field_name|invalid field|field name/i.test(text);
}
