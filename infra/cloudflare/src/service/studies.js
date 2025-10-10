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
	safeText,
	mdToAirtableRich,
	toMs
} from "../core/utils.js";

/**
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS
 * @property {string} AIRTABLE_BASE_ID
 * @property {string} AIRTABLE_TABLE_STUDIES
 * @property {string} AIRTABLE_API_KEY
 * @property {string} GH_PATH_STUDIES
 */

/**
 * @typedef {Object} Cfg
 * @property {number} TIMEOUT_MS
 */

/**
 * @typedef {import("../core/logger.js").BatchLogger} BatchLogger
 */

/**
 * @typedef {Object} StudiesDeps
 * @property {Env} env Environment bindings (secrets, table names, etc.).
 * @property {Cfg} cfg Immutable configuration (timeouts, etc.).
 * @property {BatchLogger} log Batched logger instance.
 * @property {(body:any,status?:number,headers?:HeadersInit)=>Response} json JSON response helper.
 * @property {(origin:string)=>Record<string,string>} corsHeaders CORS header helper.
 * @property {(args:{ path:string, header:string[], row:(string|number)[] })=>Promise<void>} githubCsvAppend CSV append helper.
 */

/**
 * Factory returning bound Study handlers.
 * @param {StudiesDeps} deps
 */
export function createStudiesHandlers(deps) {
	const { env, cfg, log, json, corsHeaders, githubCsvAppend } = deps;

	/**
	 * List studies linked to a given project from Airtable.
	 * - Requires `?project=<AirtableRecordId of Project>`
	 * - Paginates across all records
	 * - Tolerates link field named "Project" or "Projects"
	 *
	 * @async
	 * @function listStudies
	 * @param {string} origin Request Origin header (for CORS).
	 * @param {URL} url Parsed request URL (with search params).
	 * @returns {Promise<Response>}
	 */
	async function listStudies(origin, url) {
		try {
			const projectId = url.searchParams.get("project");
			if (!projectId) {
				return json({ ok: false, error: "Missing project query" }, 400, corsHeaders(origin));
			}

			const base = env.AIRTABLE_BASE_ID;
			const tStudies = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);
			const atBase = `https://api.airtable.com/v0/${base}/${tStudies}`;
			const headers = { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` };

			const records = [];
			let offset;

			// Do NOT restrict fields[] — avoids UNKNOWN_FIELD_NAME on differing schemas
			do {
				const params = new URLSearchParams({ pageSize: "100" });
				if (offset) params.set("offset", offset);

				const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, cfg.TIMEOUT_MS);
				const bodyText = await resp.text();

				if (!resp.ok) {
					log.error("airtable.studies.list.fail", { status: resp.status, text: safeText(bodyText) });
					return json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(bodyText) }, resp.status, corsHeaders(origin));
				}

				/** @type {{records?: Array<{id:string, createdTime?:string, fields?: Record<string, any>}>, offset?: string}} */
				let js;
				try { js = JSON.parse(bodyText); } catch { js = { records: [] }; }

				records.push(...(js.records || []));
				offset = js.offset;
			} while (offset);

			// Work with common link field names
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
				.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

			return json({ ok: true, studies }, 200, corsHeaders(origin));
		} catch (err) {
			log.error("studies.unexpected", { err: String(err?.message || err) });
			return json({ ok: false, error: "Unexpected error listing studies", detail: String(err?.message || err) }, 500, corsHeaders(origin));
		}
	}

	/**
	 * Create a Study linked to a Project (Airtable primary) and append to GitHub CSV (best-effort).
	 *
	 * @async
	 * @function createStudy
	 * @param {Request} request Incoming request (expects JSON body).
	 * @param {string} origin Request Origin header (for CORS).
	 * @returns {Promise<Response>}
	 */
	async function createStudy(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > cfg.MAX_BODY_BYTES) {
			log.warn("request.too_large", { size: body.byteLength });
			return json({ error: "Payload too large" }, 413, corsHeaders(origin));
		}

		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin));
		}

		const errs = [];
		if (!payload.project_airtable_id) errs.push("project_airtable_id");
		if (!payload.method) errs.push("method");
		if (!payload.description) errs.push("description");
		if (errs.length) return json({ error: "Missing required fields: " + errs.join(", ") }, 400, corsHeaders(origin));

		const base = env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);
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
			headers: { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] })
		}, cfg.TIMEOUT_MS);

		const sText = await sRes.text();
		if (!sRes.ok) {
			log.error("airtable.study.create.fail", { status: sRes.status, text: safeText(sText) });
			return json({ error: `Airtable ${sRes.status}`, detail: safeText(sText) }, sRes.status, corsHeaders(origin));
		}

		let sJson;
		try { sJson = JSON.parse(sText); } catch { sJson = { records: [] }; }
		const studyId = sJson.records?.[0]?.id;
		if (!studyId) return json({ error: "Airtable response missing study id" }, 502, corsHeaders(origin));

		// Best-effort CSV
		let csvOk = true,
			csvError = null;
		try {
			const nowIso = new Date().toISOString();
			const row = [
				studyId,
				payload.project_airtable_id,
				payload.study_id || "",
				payload.method || "",
				payload.status || "",
				payload.description || "",
				nowIso
			];
			await githubCsvAppend({
				path: env.GH_PATH_STUDIES,
				header: ["AirtableId", "ProjectAirtableId", "StudyId", "Method", "Status", "Description", "CreatedAt"],
				row
			});
		} catch (e) {
			csvOk = false;
			csvError = String(e?.message || e);
			log.warn("github.csv.append.fail.study", { err: csvError });
		}

		if (env.AUDIT === "true") log.info("study.created", { studyId, csvOk });
		return json({ ok: true, study_id: studyId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, corsHeaders(origin));
	}

	/**
	 * Update a Study (Airtable partial update).
	 * Accepts: { description?, method?, status?, study_id? }
	 * Writes to Airtable fields: Description, Method, Status, "Study ID".
	 *
	 * @async
	 * @function updateStudy
	 * @param {Request} request Incoming request (expects JSON body).
	 * @param {string} origin Request Origin header (for CORS).
	 * @param {string} studyId Airtable record id of the Study to update.
	 * @returns {Promise<Response>}
	 */
	async function updateStudy(request, origin, studyId) {
		if (!studyId) {
			return json({ error: "Missing study id" }, 400, corsHeaders(origin));
		}

		const body = await request.arrayBuffer();
		if (body.byteLength > cfg.MAX_BODY_BYTES) {
			log.warn("request.too_large", { size: body.byteLength });
			return json({ error: "Payload too large" }, 413, corsHeaders(origin));
		}

		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin));
		}

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
			return json({ error: "No updatable fields provided" }, 400, corsHeaders(origin));
		}

		const base = env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);
		const atUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

		const res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: {
				"Authorization": `Bearer ${env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				records: [{ id: studyId, fields }]
			})
		}, cfg.TIMEOUT_MS);

		const text = await res.text();
		if (!res.ok) {
			log.error("airtable.study.update.fail", { status: res.status, text: safeText(text) });
			return json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, corsHeaders(origin));
		}

		if (env.AUDIT === "true") log.info("study.updated", { studyId, fields });
		return json({ ok: true }, 200, corsHeaders(origin));
	}

	return {
		listStudies,
		createStudy,
		updateStudy
	};
}