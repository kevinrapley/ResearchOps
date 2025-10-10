/**
 * @file studies.js
 * @module studies
 * @summary Study endpoints (Airtable + GitHub CSV) for the ResearchOps Worker.
 *
 * @description
 * This module encapsulates all Study-related handlers that were previously
 * methods on a monolithic service class. It exports a factory function
 * `createStudiesHandlers` which returns concrete, bound handlers for:
 *
 * - listStudies (GET /api/studies?project=<AirtableProjectId>)
 * - createStudy (POST /api/studies)
 * - updateStudy (PATCH /api/studies/:id)
 *
 * Handlers are dependency-injected with `env`, `cfg`, a `log` (BatchLogger),
 * and a couple of helpers (`json`, `corsHeaders`, `githubCsvAppend`) from the
 * hosting service. This keeps the code testable and side-effect free.
 */

import {
	fetchWithTimeout,
	mdToAirtableRich,
	safeText,
	toMs
} from "../core/utils.js";

/**
 * Create a Study linked to a Project (Airtable primary) and append to GitHub CSV (best-effort).
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createStudy(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {any} */
	let payload;
	try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const errs = [];
	if (!payload.project_airtable_id) errs.push("project_airtable_id");
	if (!payload.method) errs.push("method");
	if (!payload.description) errs.push("description");
	if (errs.length) return svc.json({ error: "Missing required fields: " + errs.join(", ") }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const tStudies = encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES);
	const atStudiesUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

	const fields = {
		Project: [payload.project_airtable_id],
		Method: payload.method,
		Description: mdToAirtableRich(payload.description || ""),
		Status: typeof payload.status === "string" ? payload.status : undefined,
		"Study ID": typeof payload.study_id === "string" ? payload.study_id : undefined
	};
	for (const k of Object.keys(fields)) {
		const v = fields[k];
		if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) delete fields[k];
	}

	const sRes = await fetchWithTimeout(atStudiesUrl, {
		method: "POST",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ fields }] })
	}, svc.cfg.TIMEOUT_MS);
	const sText = await sRes.text();
	if (!sRes.ok) {
		svc.log.error("airtable.study.create.fail", { status: sRes.status, text: safeText(sText) });
		return svc.json({ error: `Airtable ${sRes.status}`, detail: safeText(sText) }, sRes.status, svc.corsHeaders(origin));
	}

	let sJson;
	try { sJson = JSON.parse(sText); } catch { sJson = { records: [] }; }
	const studyId = sJson.records?.[0]?.id;
	if (!studyId) return svc.json({ error: "Airtable response missing study id" }, 502, svc.corsHeaders(origin));

	// Best-effort CSV mirror
	let csvOk = true,
		csvError = null;
	try {
		const nowIso = new Date().toISOString();
		await svc.githubCsvAppend({
			path: svc.env.GH_PATH_STUDIES,
			header: ["AirtableId", "ProjectAirtableId", "StudyId", "Method", "Status", "Description", "CreatedAt"],
			row: [
				studyId,
				payload.project_airtable_id,
				payload.study_id || "",
				payload.method || "",
				payload.status || "",
				payload.description || "",
				nowIso
			]
		});
	} catch (e) {
		csvOk = false;
		csvError = String(e?.message || e);
		svc.log.warn("github.csv.append.fail.study", { err: csvError });
	}

	if (svc.env.AUDIT === "true") svc.log.info("study.created", { studyId, csvOk });
	return svc.json({ ok: true, study_id: studyId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, svc.corsHeaders(origin));
}

/**
 * List studies linked to a given project from Airtable.
 * - Requires ?project=<AirtableRecordId of Project>
 * - Paginates across all records
 * - Tolerates link field named "Project" or "Projects"
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listStudies(svc, origin, url) {
	try {
		const projectId = url.searchParams.get("project");
		if (!projectId) {
			return svc.json({ ok: false, error: "Missing project query" }, 400, svc.corsHeaders(origin));
		}

		const base = svc.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES);
		const atBase = `https://api.airtable.com/v0/${base}/${tStudies}`;
		const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);

			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, svc.cfg.TIMEOUT_MS);
			const bodyText = await resp.text();

			if (!resp.ok) {
				svc.log.error("airtable.studies.list.fail", { status: resp.status, text: safeText(bodyText) });
				return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(bodyText) }, resp.status, svc.corsHeaders(origin));
			}

			let js;
			try { js = JSON.parse(bodyText); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		const LINK_FIELDS = ["Project", "Projects"];

		const studies = records
			.filter(r => {
				const f = r.fields || {};
				const linkArr = LINK_FIELDS.map(n => f[n]).find(v => Array.isArray(v));
				return Array.isArray(linkArr) && linkArr.includes(projectId);
			})
			.map(r => {
				const f = r.fields || {};
				return {
					id: r.id,
					studyId: f["Study ID"] || "",
					method: f.Method || "",
					status: f.Status || "",
					description: f.Description || "",
					createdAt: r.createdTime || ""
				};
			})
			.sort((a, b) => (toMs(b.createdAt) - toMs(a.createdAt)));

		return svc.json({ ok: true, studies }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("studies.unexpected", { err: String(err?.message || err) });
		return svc.json({ ok: false, error: "Unexpected error listing studies", detail: String(err?.message || err) }, 500, svc.corsHeaders(origin));
	}
}

/**
 * Update a Study (Airtable partial update).
 * Accepts: { description?, method?, status?, study_id? }
 * Writes to Airtable fields: Description, Method, Status, "Study ID".
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} studyId
 * @returns {Promise<Response>}
 */
export async function updateStudy(svc, request, origin, studyId) {
	if (!studyId) return svc.json({ error: "Missing study id" }, 400, svc.corsHeaders(origin));

	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {any} */
	let payload;
	try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const fields = {
		Description: typeof payload.description === "string" ? mdToAirtableRich(payload.description) : undefined,
		Method: typeof payload.method === "string" ? payload.method : undefined,
		Status: typeof payload.status === "string" ? payload.status : undefined,
		"Study ID": typeof payload.study_id === "string" ? payload.study_id : undefined
	};
	for (const k of Object.keys(fields)) {
		const v = fields[k];
		if (v === undefined || (typeof v === "string" && v.trim() === "")) delete fields[k];
	}

	if (Object.keys(fields).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const tStudies = encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDIES);
	const atUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

	const res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: {
			"Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ id: studyId, fields }] })
	}, svc.cfg.TIMEOUT_MS);

	const text = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.study.update.fail", { status: res.status, text: safeText(text) });
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, svc.corsHeaders(origin));
	}

	if (svc.env.AUDIT === "true") svc.log.info("study.updated", { studyId, fields });
	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}