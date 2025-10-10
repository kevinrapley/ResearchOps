/**
 * @file service.js
 * @module service
 * @summary Core API service (Airtable + GitHub CSV) for ResearchOps Worker.
 */

import { DEFAULTS } from "./core/constants.js";
import { BatchLogger } from "./core/logger.js";
import {
	fetchWithTimeout,
	toCsvLine,
	b64Decode,
	b64Encode,
	safeText,
	toMs,
	mdToAirtableRich,
	pickFirstField,
	airtableTryWrite
} from "./core/utils.js";
import {
	GUIDE_LINK_FIELD_CANDIDATES,
	GUIDE_FIELD_NAMES,
	PARTICIPANT_FIELDS,
	SESSION_FIELDS
} from "./core/fields.js";

/**
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS Comma-separated list of allowed origins for CORS.
 * @property {string} AUDIT "true" to enable audit logs; otherwise "false".
 * @property {string} AIRTABLE_BASE_ID Airtable base ID.
 * @property {string} AIRTABLE_TABLE_PROJECTS Table name for projects.
 * @property {string} AIRTABLE_TABLE_DETAILS  Table name for project details.
 * @property {string} AIRTABLE_TABLE_STUDIES  Table name for studies (e.g., "Project Studies").
 * @property {string} AIRTABLE_TABLE_GUIDES   Table name for discussion guides (e.g., "Discussion Guides").
 * @property {string} AIRTABLE_TABLE_PARTIALS Table name for partials (e.g., "Partials").
 * @property {string} AIRTABLE_TABLE_PARTICIPANTS Table name for participants (e.g., "Participants").
 * @property {string} AIRTABLE_TABLE_SESSIONS Table name for sessions (e.g., "Sessions").
 * @property {string} AIRTABLE_TABLE_COMMSLOG Table name for comms log (e.g., "Communications Log").
 * @property {string} AIRTABLE_API_KEY Airtable API token.
 * @property {string} GH_OWNER GitHub repository owner.
 * @property {string} GH_REPO GitHub repository name.
 * @property {string} GH_BRANCH GitHub branch (e.g., "main").
 * @property {string} GH_PATH_PROJECTS Path to projects CSV file.
 * @property {string} GH_PATH_DETAILS  Path to project-details CSV file.
 * @property {string} GH_PATH_STUDIES  Path to studies CSV file.
 * @property {string} GH_TOKEN GitHub access token.
 * @property {any}    ASSETS Cloudflare static assets binding.
 * @property {string} [MODEL] Workers AI model name.
 * @property {string} [AIRTABLE_TABLE_AI_LOG] Optional Airtable table for AI usage logs.
 * @property {any}    AI Cloudflare Workers AI binding (env.AI.run).
 */

/**
 * ResearchOps HTTP service (Airtable + GitHub CSV).
 * Encapsulates business logic for all API routes.
 * @class ResearchOpsService
 */
export class ResearchOpsService {
	/**
	 * Construct the service.
	 * @constructs ResearchOpsService
	 * @param {Env} env
	 * @param {{cfg?:Partial<typeof DEFAULTS>, logger?:BatchLogger}} [opts]
	 */
	constructor(env, opts = {}) {
		/** @public @readonly */
		this.env = env;
		/** @public @readonly */
		this.cfg = Object.freeze({ ...DEFAULTS, ...(opts.cfg || {}) });
		/** @private */
		this.log = opts.logger || new BatchLogger({ batchSize: this.cfg.LOG_BATCH_SIZE });
		/** @private */
		this.destroyed = false;
	}

	/** @returns {void} */
	reset() { this.log.reset(); }

	/** @returns {void} */
	destroy() {
		if (this.destroyed) return;
		this.log.destroy();
		this.destroyed = true;
	}

	/**
	 * Build CORS headers for the given origin.
	 * @param {string} origin
	 * @returns {Record<string,string>}
	 */
	corsHeaders(origin) {
		const allowed = (this.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
		const h = {
			"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Vary": "Origin"
		};
		if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
		return h;
	}

	/**
	 * JSON response helper.
	 * @param {unknown} body
	 * @param {number} [status=200]
	 * @param {HeadersInit} [headers]
	 * @returns {Response}
	 */
	json(body, status = 200, headers = {}) {
		const hdrs = Object.assign({ "Content-Type": "application/json" }, headers || {});
		return new Response(JSON.stringify(body), { status, headers: hdrs });
	}

	/**
	 * Health endpoint.
	 * @async
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async health(origin) {
		return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
	}

	/* ───────────────────────── Projects ───────────────────────── */

	/**
	 * List projects from Airtable (joins latest Project Details).
	 * - Uses Airtable `record.createdTime` for `createdAt`.
	 * - Sorted newest-first server-side to guarantee stable ordering.
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 */
	async listProjectsFromAirtable(origin, url) {
		const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
		const view = url.searchParams.get("view") || undefined;

		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
		const tDetails = encodeURIComponent(this.env.AIRTABLE_TABLE_DETAILS);

		// ---- 1) Projects
		let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
		if (view) atUrl += `&view=${encodeURIComponent(view)}`;

		const pRes = await fetchWithTimeout(atUrl, {
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			}
		}, this.cfg.TIMEOUT_MS);

		const pText = await pRes.text();
		if (!pRes.ok) {
			this.log.error("airtable.list.fail", { status: pRes.status, text: safeText(pText) });
			return this.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, this.corsHeaders(origin));
		}

		/** @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
		let pData;
		try { pData = JSON.parse(pText); } catch { pData = { records: [] }; }

		let projects = (pData.records || []).map(r => {
			const f = r.fields || {};
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
		});

		// ---- 2) Project Details (pull lead researcher + email, latest)
		const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
		const dRes = await fetchWithTimeout(dUrl, {
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

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
			this.log.warn("airtable.details.join.fail", { status: dRes.status, detail: safeText(dt) });
		}

		projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
		return this.json({ ok: true, projects }, 200, this.corsHeaders(origin));
	}

	/**
	 * Append a row to a GitHub-hosted CSV file (create if missing).
	 * @param {{ path:string, header:string[], row:(string|number)[] }} args
	 * @returns {Promise<void>}
	 */
	async githubCsvAppend({ path, header, row }) {
		const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
		const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
		const headers = {
			"Authorization": `Bearer ${GH_TOKEN}`,
			"Accept": "application/vnd.github+json",
			"X-GitHub-Api-Version": DEFAULTS.GH_API_VERSION,
			"Content-Type": "application/json"
		};

		// Read current file
		let sha = undefined,
			content = "",
			exists = false;
		const getRes = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers }, this.cfg.TIMEOUT_MS);
		if (getRes.status === 200) {
			const js = await getRes.json();
			sha = js.sha;
			content = b64Decode(js.content);
			exists = true;
		} else if (getRes.status === 404) {
			content = header.join(",") + "\n";
		} else {
			const t = await getRes.text();
			throw new Error(`GitHub read ${getRes.status}: ${safeText(t)}`);
		}

		// Append row
		content += toCsvLine(row);

		const putBody = {
			message: exists ? `chore: append row to ${path}` : `chore: create ${path} with header`,
			content: b64Encode(content),
			branch: GH_BRANCH
		};
		if (sha) putBody.sha = sha;

		const putRes = await fetchWithTimeout(base, { method: "PUT", headers, body: JSON.stringify(putBody) }, this.cfg.TIMEOUT_MS);
		if (!putRes.ok) {
			const t = await putRes.text();
			throw new Error(`GitHub write ${putRes.status}: ${safeText(t)}`);
		}
	}

	/**
	 * Stream a CSV file from GitHub with proper headers.
	 * @param {string} origin
	 * @param {string} path
	 * @returns {Promise<Response>}
	 */
	async streamCsv(origin, path) {
		const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
		const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
		const headers = {
			"Authorization": `Bearer ${GH_TOKEN}`,
			"Accept": "application/vnd.github+json",
			"X-GitHub-Api-Version": this.cfg.GH_API_VERSION
		};

		try {
			const getRes = await fetchWithTimeout(
				`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers },
				this.cfg.TIMEOUT_MS
			);

			if (getRes.status === 404) {
				this.log.warn("csv.not_found", { path });
				return this.json({ error: "CSV file not found" }, 404, this.corsHeaders(origin));
			}

			if (!getRes.ok) {
				const text = await getRes.text();
				this.log.error("github.csv.read.fail", { status: getRes.status, text: safeText(text) });
				return this.json({ error: `GitHub ${getRes.status}`, detail: safeText(text) },
					getRes.status,
					this.corsHeaders(origin)
				);
			}

			const js = await getRes.json();
			const content = b64Decode(js.content);

			const csvHeaders = {
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="${path.split('/').pop() || 'data.csv'}"`,
				"Cache-Control": this.cfg.CSV_CACHE_CONTROL,
				...this.corsHeaders(origin)
			};

			return new Response(content, { status: 200, headers: csvHeaders });

		} catch (e) {
			this.log.error("csv.stream.error", { err: String(e?.message || e), path });
			return this.json({ error: "Failed to stream CSV", detail: String(e?.message || e) },
				500,
				this.corsHeaders(origin)
			);
		}
	}

	/* ───────────────────────── Studies ───────────────────────── */

	/**
	 * Create a Study linked to a Project (Airtable primary) and append to GitHub CSV (best-effort).
	 * @param {Request} request
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async createStudy(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const errs = [];
		if (!payload.project_airtable_id) errs.push("project_airtable_id");
		if (!payload.method) errs.push("method");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
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
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] })
		}, this.cfg.TIMEOUT_MS);
		const sText = await sRes.text();
		if (!sRes.ok) {
			this.log.error("airtable.study.create.fail", { status: sRes.status, text: safeText(sText) });
			return this.json({ error: `Airtable ${sRes.status}`, detail: safeText(sText) }, sRes.status, this.corsHeaders(origin));
		}

		let sJson;
		try { sJson = JSON.parse(sText); } catch { sJson = { records: [] }; }
		const studyId = sJson.records?.[0]?.id;
		if (!studyId) return this.json({ error: "Airtable response missing study id" }, 502, this.corsHeaders(origin));

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
			await this.githubCsvAppend({
				path: this.env.GH_PATH_STUDIES,
				header: ["AirtableId", "ProjectAirtableId", "StudyId", "Method", "Status", "Description", "CreatedAt"],
				row
			});
		} catch (e) {
			csvOk = false;
			csvError = String(e?.message || e);
			this.log.warn("github.csv.append.fail.study", { err: csvError });
		}

		if (this.env.AUDIT === "true") this.log.info("study.created", { studyId, csvOk });
		return this.json({ ok: true, study_id: studyId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, this.corsHeaders(origin));
	}

	/**
	 * List studies linked to a given project from Airtable.
	 * - Requires ?project=<AirtableRecordId of Project>
	 * - Paginates across all records
	 * - Tolerates link field named "Project" or "Projects"
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 */
	async listStudies(origin, url) {
		try {
			const projectId = url.searchParams.get("project");
			if (!projectId) {
				return this.json({ ok: false, error: "Missing project query" }, 400, this.corsHeaders(origin));
			}

			const base = this.env.AIRTABLE_BASE_ID;
			const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
			const atBase = `https://api.airtable.com/v0/${base}/${tStudies}`;
			const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

			const records = [];
			let offset;

			// Do NOT restrict fields[] — avoids UNKNOWN_FIELD_NAME on differing schemas
			do {
				const params = new URLSearchParams({ pageSize: "100" });
				if (offset) params.set("offset", offset);

				const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
				const bodyText = await resp.text();

				if (!resp.ok) {
					this.log.error("airtable.studies.list.fail", { status: resp.status, text: safeText(bodyText) });
					return this.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(bodyText) }, resp.status, this.corsHeaders(origin));
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

			return this.json({ ok: true, studies }, 200, this.corsHeaders(origin));
		} catch (err) {
			this.log.error("studies.unexpected", { err: String(err?.message || err) });
			return this.json({ ok: false, error: "Unexpected error listing studies", detail: String(err?.message || err) }, 500, this.corsHeaders(origin));
		}
	}

	/**
	 * Update a Study (Airtable partial update).
	 * Accepts: { description?, method?, status?, study_id? }
	 * Writes to Airtable fields: Description, Method, Status, "Study ID".
	 * @param {Request} request
	 * @param {string} origin
	 * @param {string} studyId
	 * @returns {Promise<Response>}
	 */
	async updateStudy(request, origin, studyId) {
		if (!studyId) {
			return this.json({ error: "Missing study id" }, 400, this.corsHeaders(origin));
		}

		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

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
			return this.json({ error: "No updatable fields provided" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
		const atUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

		const res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				records: [{ id: studyId, fields }]
			})
		}, this.cfg.TIMEOUT_MS);

		const text = await res.text();
		if (!res.ok) {
			this.log.error("airtable.study.update.fail", { status: res.status, text: safeText(text) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
		}

		if (this.env.AUDIT === "true") this.log.info("study.updated", { studyId, fields });
		return this.json({ ok: true }, 200, this.corsHeaders(origin));
	}

	/* ───────────────────────── Guides ───────────────────────── */

	/**
	 * List guides for a study.
	 * @route GET /api/guides?study=<StudyAirtableId>
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 */
	async listGuides(origin, url) {
		const studyId = url.searchParams.get("study");
		if (!studyId) {
			return this.json({ ok: false, error: "Missing study query" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(this.env.AIRTABLE_TABLE_GUIDES || "Discussion Guides");
		const atBase = `https://api.airtable.com/v0/${base}/${tGuides}`;
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
			const txt = await resp.text();

			if (!resp.ok) {
				this.log.error("airtable.guides.list.fail", { status: resp.status, text: safeText(txt) });
				return this.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, this.corsHeaders(origin));
			}

			let js;
			try { js = JSON.parse(txt); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		// Find which field holds the link array (first candidate that exists and is an array)
		const guides = [];
		for (const r of records) {
			const f = r.fields || {};
			const f = r.fields || {};
			const linkKey = pickFirstField(f, GUIDE_LINK_FIELD_CANDIDATES);
			const linkArr = linkKey ? f[linkKey] : undefined;
			if (Array.isArray(linkArr) && linkArr.includes(studyId)) {
				const titleKey = pickFirstField(f, GUIDE_FIELD_NAMES.title);
				const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status);
				const verKey = pickFirstField(f, GUIDE_FIELD_NAMES.version);
				const srcKey = pickFirstField(f, GUIDE_FIELD_NAMES.source);
				const varsKey = pickFirstField(f, GUIDE_FIELD_NAMES.variables);

				guides.push({
					id: r.id,
					title: titleKey ? f[titleKey] : "",
					status: statusKey ? f[statusKey] : "draft",
					version: verKey ? f[verKey] : 1,
					sourceMarkdown: srcKey ? (f[srcKey] || "") : "",
					variables: (() => { try { return JSON.parse(f[varsKey] || "{}"); } catch { return {}; } })(),
					createdAt: r.createdTime || ""
				});
			}
		}

		guides.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
		return this.json({ ok: true, guides }, 200, this.corsHeaders(origin));
	}
	const f = r.fields || {};
	const linkKey = pickFirstField(f, GUIDE_LINK_FIELD_CANDIDATES);
	const linkArr = linkKey ? f[linkKey] : undefined;
	if (Array.isArray(linkArr) && linkArr.includes(studyId)) {
		const titleKey = pickFirstField(f, GUIDE_FIELD_NAMES.title);
		const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status);
		const verKey = pickFirstField(f, GUIDE_FIELD_NAMES.version);
		const srcKey = pickFirstField(f, GUIDE_FIELD_NAMES.source);
		const varsKey = pickFirstField(f, GUIDE_FIELD_NAMES.variables);

		guides.push({
			id: r.id,
			title: titleKey ? f[titleKey] : "",
			status: statusKey ? f[statusKey] : "draft",
			version: verKey ? f[verKey] : 1,
			sourceMarkdown: srcKey ? (f[srcKey] || "") : "",
			variables: (() => { try { return JSON.parse(f[varsKey] || "{}"); } catch { return {}; } })(),
			createdAt: r.createdTime || ""
		});
	}
}

guides.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
return this.json({ ok: true, guides }, 200, this.corsHeaders(origin));
}

/* … The remaining endpoints (createGuide, updateGuide, publishGuide, readGuide, etc.)
     continue as-is from your existing worker.js … */

}