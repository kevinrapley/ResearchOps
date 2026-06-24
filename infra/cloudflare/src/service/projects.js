/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Project handlers with team-scoped visibility and Airtable-first reads.
 */


/**
 * @typedef {import('./index.js').ServiceContext} ServiceContext
 */

import { fetchWithTimeout, safeText } from "../core/utils.js";
import { airtableHeaders, createProjectFields, findProjectRecord, isUnknownFieldError, joinLatestProjectDetails, jsonHeaders, readAirtableJson, readProjectRecords, requireEnv } from "./projects/airtable.js";
import { canStartProject, userCanSeeProject } from "./projects/auth.js";
import { coerceCsvRowToProject, fetchProjectsCsvFromGitHub } from "./projects/github-csv.js";
import { compareProjects, isRenderableProject, mapProject, normaliseLines, normaliseStakeholders, normaliseUserGroups } from "./projects/normalisation.js";

export { parseCsv } from "./projects/csv.js";

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
	if (Object.hasOwn(payload, "description")) fields.Description = String(payload.description || "").trim();
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
