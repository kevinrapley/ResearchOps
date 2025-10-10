/**
 * @file src/service/projects.js
 * @module service/projects
 * @summary Project-related handlers (Airtable).
 */

import { toMs, safeText } from "../core/utils.js";

/**
 * @typedef {import('./index.js').ServiceContext} ServiceContext
 */

/* ───────────────────────── Helpers ───────────────────────── */

/**
 * Normalize an Airtable Project record into our API shape.
 * @param {{id:string,createdTime?:string,fields?:Record<string,any>}} r
 */
function mapProject(r) {
	const f = r?.fields || {};
	return {
		id: r.id,
		name: f.Name || "",
		description: f.Description || "",
		"rops:servicePhase": f.Phase || "",
		"rops:projectStatus": f.Status || "",
		objectives: String(f.Objectives || "").split("\n").filter(Boolean),
		user_groups: String(f.UserGroups || "").split(",").map(s => s.trim()).filter(Boolean),
		stakeholders: (() => { try { return JSON.parse(f.Stakeholders || "[]"); } catch { return []; } })(),
		createdAt: r.createdTime || f.CreatedAt || ""
	};
}

/* ───────────────────────── List Projects ───────────────────────── */

/**
 * List projects from Airtable and join latest details.
 * @param {ServiceContext} ctx
 * @param {string} origin
 * @param {URL} url
 */
export async function listProjectsFromAirtable(ctx, origin, url) {
	const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
	const view = url.searchParams.get("view") || undefined;

	const base = ctx.env.AIRTABLE_BASE_ID;
	const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
	const tDetails = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);

	// ---- 1) Projects
	let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
	if (view) atUrl += `&view=${encodeURIComponent(view)}`;

	const pRes = await fetch(atUrl, {
		headers: {
			"Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		},
		signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
	});

	const pText = await pRes.text();
	if (!pRes.ok) {
		ctx.log.error("airtable.projects.list.fail", { status: pRes.status, text: safeText(pText) });
		return ctx.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, ctx.corsHeaders(origin));
	}

	/** @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
	let pData;
	try { pData = JSON.parse(pText); } catch { pData = { records: [] }; }

	let projects = (pData.records || []).map(mapProject);

	// ---- 2) Project Details (pull lead researcher + email, latest)
	const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
	const dRes = await fetch(dUrl, {
		headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}` },
		signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
	});

	if (dRes.ok) {
		const dText = await dRes.text();
		/** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
		let dData;
		try { dData = JSON.parse(dText); } catch { dData = { records: [] }; }

		const detailsByProject = new Map();
		for (const r of (dData.records || [])) {
			const f = r.fields || {};
			const linked = Array.isArray(f.Project) && f.Project[0];
			if (!linked) continue;
			const existing = detailsByProject.get(linked);
			if (!existing || toMs(r.createdTime) > toMs(existing._createdAt)) {
				detailsByProject.set(linked, {
					lead_researcher: f["Lead Researcher"] || "",
					lead_researcher_email: f["Lead Researcher Email"] || "",
					notes: f.Notes || "",
					_createdAt: r.createdTime || ""
				});
			}
		}

		projects = projects.map(p => {
			const d = detailsByProject.get(p.id);
			return d ? { ...p, lead_researcher: d.lead_researcher, lead_researcher_email: d.lead_researcher_email, notes: d.notes } : p;
		});
	} else {
		const dt = await dRes.text().catch(() => "");
		ctx.log.warn("airtable.details.join.fail", { status: dRes.status, detail: safeText(dt) });
	}

	projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
	return ctx.json({ ok: true, projects }, 200, ctx.corsHeaders(origin));
}

/* ───────────────────────── Get Project by ID ───────────────────────── */

/**
 * Fetch a single project by Airtable record ID and join latest details.
 * Route shape: GET /api/projects/:id
 * @param {ServiceContext} ctx
 * @param {string} origin
 * @param {string} projectId Airtable record ID (e.g., "recXXXXXXXXXXXXXX")
 */
export async function getProjectById(ctx, origin, projectId) {
	if (!projectId) {
		return ctx.json({ error: "Missing project id" }, 400, ctx.corsHeaders(origin));
	}

	const base = ctx.env.AIRTABLE_BASE_ID;
	const tProjects = encodeURIComponent(ctx.env.AIRTABLE_TABLE_PROJECTS);
	const tDetails = encodeURIComponent(ctx.env.AIRTABLE_TABLE_DETAILS);

	// Direct-record GET
	const pUrl = `https://api.airtable.com/v0/${base}/${tProjects}/${encodeURIComponent(projectId)}`;
	const pRes = await fetch(pUrl, {
		headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}` },
		signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
	});
	const pText = await pRes.text();

	if (pRes.status === 404) {
		return ctx.json({ error: "Project not found" }, 404, ctx.corsHeaders(origin));
	}
	if (!pRes.ok) {
		ctx.log.error("airtable.project.read.fail", { status: pRes.status, text: safeText(pText) });
		return ctx.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, ctx.corsHeaders(origin));
	}

	/** @type {{id:string,createdTime?:string,fields?:Record<string,any>}} */
	let rec;
	try { rec = JSON.parse(pText); } catch { rec = /** @type any */ ({}); }

	let project = mapProject(rec);

	// Join latest details for this one project
	const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&filterByFormula=${encodeURIComponent(`FIND("${projectId}", ARRAYJOIN(Project))`)}`;
	const dRes = await fetch(dUrl, {
		headers: { "Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}` },
		signal: AbortSignal.timeout(ctx.cfg.TIMEOUT_MS)
	});

	if (dRes.ok) {
		const dText = await dRes.text();
		/** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
		let dData;
		try { dData = JSON.parse(dText); } catch { dData = { records: [] }; }

		let latest = null;
		for (const r of (dData.records || [])) {
			if (!latest || toMs(r.createdTime) > toMs(latest.createdTime)) latest = r;
		}
		if (latest) {
			const f = latest.fields || {};
			project = {
				...project,
				lead_researcher: f["Lead Researcher"] || "",
				lead_researcher_email: f["Lead Researcher Email"] || "",
				notes: f.Notes || ""
			};
		}
	} else {
		const dt = await dRes.text().catch(() => "");
		ctx.log.warn("airtable.project.details.join.fail", { status: dRes.status, detail: safeText(dt) });
	}

	return ctx.json(project, 200, ctx.corsHeaders(origin));
}