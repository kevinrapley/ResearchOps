/**
 * @file worker.js
 * @module ResearchOpsWorker
 * @summary Cloudflare Worker for ResearchOps platform (Airtable + GitHub CSV).
 * @description
 * Serves static assets and exposes API routes for:
 * - Health:
 *   - `GET /api/health`
 * - Projects:
 *   - List projects (Airtable, newest-first via `record.createdTime`): `GET /api/projects`
 *   - Create project (Airtable primary + optional Details; best-effort GitHub CSV dual-write):
 *     `POST /api/projects`
 * - Studies:
 *   - Create study (Airtable primary; best-effort GitHub CSV dual-write): `POST /api/studies`
 *   - List studies for a project: `GET /api/studies?project=<AirtableId>`
 * - CSV streaming from GitHub:
 *   - `GET /api/projects.csv`, `GET /api/project-details.csv`
 *
 * @requires globalThis.fetch
 * @requires globalThis.Request
 * @requires globalThis.Response
 *
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS Comma-separated list of allowed origins for CORS.
 * @property {string} AUDIT "true" to enable audit logs; otherwise "false".
 * @property {string} AIRTABLE_BASE_ID Airtable base ID.
 * @property {string} AIRTABLE_TABLE_PROJECTS Table name for projects.
 * @property {string} AIRTABLE_TABLE_DETAILS  Table name for project details.
 * @property {string} AIRTABLE_TABLE_STUDIES  Table name for studies (e.g., "Project Studies").
 * @property {string} AIRTABLE_API_KEY Airtable API token.
 * @property {string} GH_OWNER GitHub repository owner.
 * @property {string} GH_REPO GitHub repository name.
 * @property {string} GH_BRANCH GitHub branch (e.g., "main").
 * @property {string} GH_PATH_PROJECTS Path to projects CSV file.
 * @property {string} GH_PATH_DETAILS  Path to project-details CSV file.
 * @property {string} GH_PATH_STUDIES  Path to studies CSV file.
 * @property {string} GH_TOKEN GitHub access token.
 * @property {any}    ASSETS Cloudflare static assets binding.
 */

/* =========================
 * @section Configuration
 * ========================= */

/**
 * Immutable configuration defaults.
 * @constant
 * @name DEFAULTS
 * @type {Readonly<{
 *   TIMEOUT_MS:number,
 *   CSV_CACHE_CONTROL:string,
 *   GH_API_VERSION:string,
 *   LOG_BATCH_SIZE:number,
 *   MAX_BODY_BYTES:number
 * }>} 
 * @default
 * @inner
 */
const DEFAULTS = Object.freeze({
	TIMEOUT_MS: 10_000,
	CSV_CACHE_CONTROL: "no-store",
	GH_API_VERSION: "2022-11-28",
	LOG_BATCH_SIZE: 20,
	MAX_BODY_BYTES: 512 * 1024 // 512KB
});

/* =========================
 * @section Batched logger
 * ========================= */

/**
 * Minimal batched console logger (prevents log spam).
 * @class BatchLogger
 * @public
 * @inner
 */
class BatchLogger {
	/**
	 * Construct a BatchLogger.
	 * @constructs BatchLogger
	 * @param {{batchSize?:number}} [opts]
	 */
	constructor(opts = {}) {
		/** @private */
		this._batchSize = opts.batchSize || DEFAULTS.LOG_BATCH_SIZE;
		/** @private */
		this._buf = [];
		/** @private */
		this._destroyed = false;
	}

	/**
	 * Buffer a log entry and flush when batch size is reached.
	 * @param {"info"|"warn"|"error"} level
	 * @param {string} msg
	 * @param {unknown} [meta]
	 * @returns {void}
	 */
	log(level, msg, meta) {
		if (this._destroyed) return;
		this._buf.push({ t: Date.now(), level, msg, meta });
		if (this._buf.length >= this._batchSize) this.flush();
	}

	/** @returns {void} */
	info(m, x) { this.log("info", m, x); }
	/** @returns {void} */
	warn(m, x) { this.log("warn", m, x); }
	/** @returns {void} */
	error(m, x) { this.log("error", m, x); }

	/**
	 * Flush the buffered entries to console.
	 * @returns {void}
	 */
	flush() {
		if (!this._buf.length) return;
		try {
			// Single grouped write where possible (reduces noise)
			console.log("audit.batch", this._buf);
		} catch {
			// Fallback for environments that might not support structured logs
			for (const e of this._buf) {
				try { console.log("audit.entry", e); } catch {}
			}
		} finally {
			this._buf = [];
		}
	}

	/**
	 * Reset the buffer (test helper).
	 * @returns {void}
	 */
	reset() { this._buf = []; }

	/**
	 * Clean up and prevent further logging.
	 * @returns {void}
	 */
	destroy() {
		this.flush();
		this._destroyed = true;
	}
}

/* =========================
 * @section Helper functions
 * ========================= */

/**
 * Fetch with a hard timeout.
 * @async
 * @function fetchWithTimeout
 * @inner
 * @param {RequestInfo | URL} resource
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<Response>}
 * @throws {Error} If aborted due to timeout.
 */
async function fetchWithTimeout(resource, init, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort("timeout"), timeoutMs);
	try {
		const initSafe = Object.assign({}, init || {});
		initSafe.signal = controller.signal;
		return await fetch(resource, initSafe);
	} finally {
		clearTimeout(id);
	}
}

/**
 * CSV-escape a single value.
 * @function csvEscape
 * @inner
 * @param {unknown} val
 * @returns {string}
 */
function csvEscape(val) {
	if (val == null) return "";
	const s = String(val);
	const needsQuotes = /[",\r\n]/.test(s);
	const esc = s.replace(/"/g, '""');
	return needsQuotes ? `"${esc}"` : esc;
}

/**
 * Convert an array to a CSV line.
 * @function toCsvLine
 * @inner
 * @param {Array<unknown>} arr
 * @returns {string}
 */
function toCsvLine(arr) {
	return arr.map(csvEscape).join(",") + "\n";
}

/**
 * Base64 encode (UTF-8 safe).
 * @function b64Encode
 * @inner
 * @param {string} s
 * @returns {string}
 */
function b64Encode(s) {
	return btoa(unescape(encodeURIComponent(s)));
}

/**
 * Base64 decode (UTF-8 safe).
 * @function b64Decode
 * @inner
 * @param {string} b
 * @returns {string}
 */
function b64Decode(b) {
	const clean = (b || "").replace(/\n/g, "");
	return decodeURIComponent(escape(atob(clean)));
}

/**
 * Truncate long text for logs.
 * @function safeText
 * @inner
 * @param {string} t
 * @returns {string}
 */
function safeText(t) {
	return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t;
}

/**
 * Parse date string to epoch ms; invalid → 0.
 * @function toMs
 * @inner
 * @param {string} d
 * @returns {number}
 */
function toMs(d) {
	const n = Date.parse(d);
	return Number.isFinite(n) ? n : 0;
}

/* =========================
 * @section Core service
 * ========================= */

/**
 * ResearchOps HTTP service (Airtable + GitHub CSV).
 * Encapsulates business logic for all API routes.
 *
 * @class ResearchOpsService
 * @public
 * @inner
 */
class ResearchOpsService {
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

	/**
	 * Reset soft state (test helper).
	 * @returns {void}
	 * @inner
	 */
	reset() { this.log.reset(); }

	/**
	 * Cleanup resources (idempotent).
	 * @returns {void}
	 * @inner
	 */
	destroy() {
		if (this.destroyed) return;
		this.log.destroy();
		this.destroyed = true;
	}

	/**
	 * Build CORS headers for the given origin.
	 * @function corsHeaders
	 * @inner
	 * @param {string} origin
	 * @returns {Record<string,string>}
	 */
	corsHeaders(origin) {
		const allowed = (this.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
		const h = {
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
			"Vary": "Origin"
		};
		if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
		return h;
	}

	/**
	 * JSON response helper.
	 * @function json
	 * @inner
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
	 * @function health
	 * @inner
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async health(origin) {
		return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
	}

	/**
	 * List projects from Airtable.
	 *
	 * - Uses Airtable `record.createdTime` for `createdAt`.
	 * - Sorted newest-first server-side to guarantee stable ordering.
	 *
	 * @async
	 * @function listProjectsFromAirtable
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {string} origin
	 *   Request origin (for CORS).
	 * @param {URL} url
	 *   Parsed request URL; supports `?limit=` and `?view=`.
	 * @returns {Promise<Response>}
	 *   JSON `{ ok:true, projects:[...] }` or `{ error:string }`.
	 *
	 * @example
	 * // GET /api/projects?limit=100&view=Grid%20view
	 */
	async listProjectsFromAirtable(origin, url) {
		/** @inner Extract query parameters and apply sensible limits */
		const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
		const view = url.searchParams.get("view") || undefined;

		/** @inner Build Airtable API URL */
		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);

		let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
		if (view) atUrl += `&view=${encodeURIComponent(view)}`;

		/** @inner Fetch from Airtable with timeout protection */
		const res = await fetchWithTimeout(atUrl, {
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			}
		}, this.cfg.TIMEOUT_MS);

		const text = await res.text();
		if (!res.ok) {
			this.log.error("airtable.list.fail", { status: res.status, text: safeText(text) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
		}

		/**
		 * @inner Parse Airtable response safely
		 * @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}}
		 */
		let data;
		try { data = JSON.parse(text); } catch { data = { records: [] }; }

		/** @inner Transform Airtable records to our project format */
		let projects = (data.records || []).map(r => {
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

		/** @inner Sort newest-first by creation time for stable ordering */
		projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

		return this.json({ ok: true, projects }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a project in Airtable (+ optional details), then append to GitHub CSV (best-effort).
	 *
	 * Validation:
	 * - Requires `name` and `description`.
	 * - Optional: `phase`, `status`, `objectives[]`, `user_groups[]`, `stakeholders[]`, `id` (LocalId).
	 *
	 * Side effects:
	 * - Creates one Airtable record in Projects.
	 * - Optionally creates one Airtable record in Project Details if lead fields are present.
	 * - Appends one (or two) lines to GitHub CSV files (best-effort, non-blocking).
	 *
	 * @async
	 * @function createProject
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {Request} request
	 *   Incoming HTTP request with JSON body.
	 * @param {string} origin
	 *   Request origin (for CORS).
	 * @returns {Promise<Response>}
	 *   JSON `{ ok:true, project_id, detail_id, csv_ok, csv_error? }` or error JSON with status.
	 */
	async createProject(request, origin) {
		/** @inner Parse and validate request body size */
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/**
		 * @inner Parse JSON payload safely
		 * @type {any}
		 */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		/** @inner Validate required fields */
		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		/** @inner Build Airtable project fields, filtering out undefined/empty values */
		const projectFields = {
			Org: payload.org || "Home Office Biometrics",
			Name: payload.name,
			Description: payload.description,
			Phase: typeof payload.phase === "string" ? payload.phase : undefined,
			Status: typeof payload.status === "string" ? payload.status : undefined,
			Objectives: (payload.objectives || []).join("\n"),
			UserGroups: (payload.user_groups || []).join(", "),
			Stakeholders: JSON.stringify(payload.stakeholders || []),
			LocalId: payload.id || ""
		};
		for (const k of Object.keys(projectFields)) {
			const v = projectFields[k];
			if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) delete projectFields[k];
		}

		/** @inner Prepare Airtable API endpoints */
		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
		const tDetails = encodeURIComponent(this.env.AIRTABLE_TABLE_DETAILS);
		const atProjectsUrl = `https://api.airtable.com/v0/${base}/${tProjects}`;
		const atDetailsUrl = `https://api.airtable.com/v0/${base}/${tDetails}`;

		/** @inner 1) Create main project record in Airtable */
		const pRes = await fetchWithTimeout(atProjectsUrl, {
			method: "POST",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields: projectFields }] })
		}, this.cfg.TIMEOUT_MS);
		const pText = await pRes.text();
		if (!pRes.ok) {
			this.log.error("airtable.create.fail", { status: pRes.status, text: safeText(pText) });
			return this.json({ error: `Airtable ${pRes.status}`, detail: safeText(pText) }, pRes.status, this.corsHeaders(origin));
		}
		let pJson;
		try { pJson = JSON.parse(pText); } catch { pJson = { records: [] }; }
		const projectId = pJson.records?.[0]?.id;
		if (!projectId) return this.json({ error: "Airtable response missing project id" }, 502, this.corsHeaders(origin));

		/** @inner 2) Optional details record creation if any detail fields are present */
		let detailId = null;
		const hasDetails = Boolean(payload.lead_researcher || payload.lead_researcher_email || payload.notes);
		if (hasDetails) {
			const detailsFields = {
				Project: [projectId],
				"Lead Researcher": payload.lead_researcher || "",
				"Lead Researcher Email": payload.lead_researcher_email || "",
				Notes: payload.notes || ""
			};
			/** @inner Remove empty string fields */
			for (const k of Object.keys(detailsFields)) {
				const v = detailsFields[k];
				if (typeof v === "string" && v.trim() === "") delete detailsFields[k];
			}
			const dRes = await fetchWithTimeout(atDetailsUrl, {
				method: "POST",
				headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
				body: JSON.stringify({ records: [{ fields: detailsFields }] })
			}, this.cfg.TIMEOUT_MS);
			const dText = await dRes.text();
			if (!dRes.ok) {
				/** @inner Attempt rollback of newly-created project on details failure */
				try {
					await fetchWithTimeout(`${atProjectsUrl}/${projectId}`, {
						method: "DELETE",
						headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
					}, this.cfg.TIMEOUT_MS);
				} catch {}
				this.log.error("airtable.details.fail", { status: dRes.status, text: safeText(dText) });
				return this.json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, this.corsHeaders(origin));
			}
			try { detailId = JSON.parse(dText).records?.[0]?.id || null; } catch {}
		}

		/** @inner 3) Best-effort GitHub CSV append(s) - non-blocking failures */
		let csvOk = true,
			csvError = null;
		try {
			const nowIso = new Date().toISOString();
			/** @inner Append to projects CSV */
			const projectRow = [
				payload.id || "",
				payload.org || "Home Office Biometrics",
				payload.name || "",
				payload.description || "",
				payload.phase || "",
				payload.status || "",
				(payload.objectives || []).join(" | "),
				(payload.user_groups || []).join(" | "),
				JSON.stringify(payload.stakeholders || []),
				nowIso
			];
			await this.githubCsvAppend({
				path: this.env.GH_PATH_PROJECTS,
				header: ["LocalId", "Org", "Name", "Description", "Phase", "Status", "Objectives", "UserGroups", "Stakeholders", "CreatedAt"],
				row: projectRow
			});

			/** @inner Append to details CSV if we have details */
			if (hasDetails) {
				const detailsRow = [
					projectId,
					payload.id || "",
					payload.lead_researcher || "",
					payload.lead_researcher_email || "",
					payload.notes || "",
					nowIso
				];
				await this.githubCsvAppend({
					path: this.env.GH_PATH_DETAILS,
					header: ["AirtableId", "LocalProjectId", "LeadResearcher", "LeadResearcherEmail", "Notes", "CreatedAt"],
					row: detailsRow
				});
			}
		} catch (e) {
			csvOk = false;
			csvError = String(e?.message || e);
			this.log.warn("github.csv.append.fail", { err: csvError });
		}

		/** @inner Log successful creation if audit mode enabled */
		if (this.env.AUDIT === "true") this.log.info("project.created", { airtableId: projectId, hasDetails, csvOk });
		return this.json({ ok: true, project_id: projectId, detail_id: detailId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a Study linked to a Project (Airtable primary) and append to GitHub CSV (best-effort).
	 *
	 * Validation:
	 * - Requires: `project_airtable_id`, `method`, `description`.
	 * - Optional: `status`, `study_id` (stored in `"Study ID"`).
	 *
	 * @async
	 * @function createStudy
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {Request} request
	 *   Incoming HTTP request with JSON body.
	 * @param {string} origin
	 *   Request origin (for CORS).
	 * @returns {Promise<Response>}
	 *   JSON `{ ok:true, study_id, csv_ok, csv_error? }` or error JSON with status.
	 */
	async createStudy(request, origin) {
		/** @inner Parse and validate request body size */
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/**
		 * @inner Parse JSON payload safely
		 * @type {any}
		 */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		/** @inner Validate required fields */
		const errs = [];
		if (!payload.project_airtable_id) errs.push("project_airtable_id");
		if (!payload.method) errs.push("method");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		/** @inner Prepare Airtable API endpoint */
		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
		const atStudiesUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

		/** @inner Build study fields, filtering out undefined/empty values */
		const fields = {
			Project: [payload.project_airtable_id],
			Method: payload.method,
			Description: payload.description,
			Status: typeof payload.status === "string" ? payload.status : undefined,
			"Study ID": typeof payload.study_id === "string" ? payload.study_id : undefined
		};
		for (const k of Object.keys(fields)) {
			const v = fields[k];
			if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) delete fields[k];
		}

		/** @inner Create study record in Airtable */
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

		/** @inner Parse response and extract study ID */
		let sJson;
		try { sJson = JSON.parse(sText); } catch { sJson = { records: [] }; }
		const studyId = sJson.records?.[0]?.id;
		if (!studyId) return this.json({ error: "Airtable response missing study id" }, 502, this.corsHeaders(origin));

		/** @inner Best-effort GitHub CSV append - non-blocking failures */
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

		/** @inner Log successful creation if audit mode enabled */
		if (this.env.AUDIT === "true") this.log.info("study.created", { studyId, csvOk });
		return this.json({ ok: true, study_id: studyId, csv_ok: csvOk, csv_error: csvOk ? undefined : csvError }, 200, this.corsHeaders(origin));
	}

	/**
	 * List studies linked to a given project from Airtable.
	 *
	 * - Requires `?project=<AirtableId>` query param (the **Airtable record id** of the Project).
	 * - Returns matching Study records (linked via `Project` link field).
	 *
	 * @async
	 * @function listStudies
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {string} origin
	 *   Request origin (for CORS).
	 * @param {URL} url
	 *   Parsed request URL containing `?project=`.
	 * @returns {Promise<Response>}
	 *   JSON `{ ok:true, studies:[...] }` or error JSON with status.
	 *
	 * @example
	 * // GET /api/studies?project=recXXXXXXXX
	 */
	async listStudies(origin, url) {
		/** @inner Extract and validate project ID parameter */
		const projectId = url.searchParams.get("project");
		if (!projectId) {
			return this.json({ error: "Missing project query" }, 400, this.corsHeaders(origin));
		}

		/** @inner Prepare Airtable API endpoint and filter formula */
		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);

		/**
		 * @inner Match exact linked record id in a multi-link field
		 * Using FIND + ARRAYJOIN is pragmatic for a single param; if performance 
		 * becomes an issue, use an Airtable View filtered by the linked record.
		 */
		const formula = `FIND("${projectId}", ARRAYJOIN({Project}))`;
		const atUrl = `https://api.airtable.com/v0/${base}/${tStudies}?filterByFormula=${encodeURIComponent(formula)}`;

		/** @inner Fetch studies from Airtable */
		const res = await fetchWithTimeout(atUrl, {
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

		const text = await res.text();
		if (!res.ok) {
			this.log.error("airtable.studies.fail", { status: res.status, text: safeText(text) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
		}

		/** 
		 * @inner Parse response and transform to our study format
		 * @type {{records:Array<{id:string,createdTime:string,fields:Record<string,any>}>}} 
		 */
		let data;
		try { data = JSON.parse(text); } catch { data = { records: [] }; }

		const studies = (data.records || []).map(r => {
			const f = r.fields || {};
			return {
				id: r.id,
				studyId: f["Study ID"] || "",
				method: f.Method || "",
				status: f.Status || "",
				description: f.Description || "",
				createdAt: r.createdTime
			};
		});

		return this.json({ ok: true, studies }, 200, this.corsHeaders(origin));
	}

	/**
	 * Stream a CSV file from GitHub with proper headers.
	 *
	 * - Fetches the CSV file from GitHub repository.
	 * - Returns the content with appropriate CSV headers and CORS.
	 * - Handles file not found gracefully.
	 *
	 * @async
	 * @function streamCsv
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {string} origin
	 *   Request origin (for CORS).
	 * @param {string} path
	 *   Repository path to CSV file (e.g., `data/projects.csv`).
	 * @returns {Promise<Response>}
	 *   CSV content response or error JSON with status.
	 *
	 * @example
	 * // GET /api/projects.csv
	 * return service.streamCsv(origin, env.GH_PATH_PROJECTS);
	 */
	async streamCsv(origin, path) {
    /** @inner Extract GitHub config and build API URL with headers */
    const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
    const base = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(path)}`;
    const headers = {
        "Authorization": `Bearer ${GH_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": this.cfg.GH_API_VERSION
    };

    try {
        /** @inner Fetch the CSV file from GitHub with timeout protection */
        const getRes = await fetchWithTimeout(
            `${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers },
            this.cfg.TIMEOUT_MS
        );

        /** @inner Handle file not found gracefully */
        if (getRes.status === 404) {
            this.log.warn("csv.not_found", { path });
            return this.json({ error: "CSV file not found" }, 404, this.corsHeaders(origin));
        }

        /** @inner Handle other HTTP errors from GitHub API */
        if (!getRes.ok) {
            const text = await getRes.text();
            this.log.error("github.csv.read.fail", { status: getRes.status, text: safeText(text) });
            return this.json({ error: `GitHub ${getRes.status}`, detail: safeText(text) },
                getRes.status,
                this.corsHeaders(origin)
            );
        }

        /** @inner Parse successful response and decode base64 content */
        const js = await getRes.json();
        const content = b64Decode(js.content);

        /** @inner Build CSV response headers with proper content type and CORS */
        const csvHeaders = {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${path.split('/').pop() || 'data.csv'}"`,
            "Cache-Control": this.cfg.CSV_CACHE_CONTROL,
            ...this.corsHeaders(origin)
        };

        return new Response(content, { status: 200, headers: csvHeaders });

    } catch (e) {
        /** @inner Handle any unexpected exceptions during CSV streaming */
        this.log.error("csv.stream.error", { err: String(e?.message || e), path });
        return this.json({ error: "Failed to stream CSV", detail: String(e?.message || e) },
            500,
            this.corsHeaders(origin)
        );
    }
}

	/**
	 * Append a row to a GitHub-hosted CSV file (create if missing).
	 *
	 * - Reads the file via GitHub Contents API to obtain `sha` + existing content.
	 * - Appends a new CSV line, creating file with header if it does not exist.
	 * - Writes back with a commit message.
	 *
	 * @async
	 * @function githubCsvAppend
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {Object} params
	 * @param {string} params.path
	 *   Repository path to CSV file (e.g., `data/studies.csv`).
	 * @param {string[]} params.header
	 *   Array of header column names (used if file needs creating).
	 * @param {string[]} params.row
	 *   Array of values to append as a new row.
	 * @returns {Promise<void>}
	 * @throws {Error} If GitHub API read/write fails.
	 *
	 * @example
	 * await service.githubCsvAppend({
	 *   path: "data/studies.csv",
	 *   header: ["AirtableId","ProjectAirtableId","StudyId","Method","Status","Description","CreatedAt"],
	 *   row: ["rec123","rec999","","User Interview","Planned","Consent forms","2025-09-28T12:00:00Z"]
	 * });
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

		/** @inner Read current file (to get sha and existing content) */
		let sha = undefined,
			content = "",
			exists = false;
		const getRes = await fetchWithTimeout(`${base}?ref=${encodeURIComponent(GH_BRANCH)}`, { headers }, this.cfg.TIMEOUT_MS);
		if (getRes.status === 200) {
			/** @inner File exists - get current content and sha */
			const js = await getRes.json();
			sha = js.sha;
			content = b64Decode(js.content);
			exists = true;
		} else if (getRes.status === 404) {
			/** @inner File doesn't exist - start with header row */
			content = header.join(",") + "\n";
		} else {
			/** @inner Unexpected error reading file */
			const t = await getRes.text();
			throw new Error(`GitHub read ${getRes.status}: ${safeText(t)}`);
		}

		/** @inner Append new row to content */
		content += toCsvLine(row);

		/**
		 * @inner Prepare commit payload
		 * @type {any}
		 */
		const putBody = {
			message: exists ? `chore: append row to ${path}` : `chore: create ${path} with header`,
			content: b64Encode(content),
			branch: GH_BRANCH
		};
		if (sha) putBody.sha = sha; // Include sha for updates

		/** @inner Write updated content back to GitHub */
		const putRes = await fetchWithTimeout(base, { method: "PUT", headers, body: JSON.stringify(putBody) }, this.cfg.TIMEOUT_MS);
		if (!putRes.ok) {
			const t = await putRes.text();
			throw new Error(`GitHub write ${putRes.status}: ${safeText(t)}`);
		}
	}
}

/* =========================
 * @section Worker entrypoint
 * ========================= */

/**
 * Default export: Cloudflare Worker `fetch` handler.
 *
 * - Routes all `/api/*` requests to service methods.
 * - Supports CORS preflight via `OPTIONS`.
 * - Enforces allowed origins (`ALLOWED_ORIGINS`).
 * - Proxies static assets via `env.ASSETS`.
 *
 * @async
 * @function fetch
 * @memberof default
 * @inner
 * @param {Request} request
 *   Incoming Cloudflare Worker Request.
 * @param {Env} env
 *   Environment variables (bindings + secrets).
 * @param {ExecutionContext} ctx
 *   Cloudflare execution context.
 * @returns {Promise<Response>}
 *   Standard Fetch API Response.
 *
 * @throws {Error} On unexpected failure (returned as 500 JSON).
 */
export default {
	async fetch(request, env, ctx) {
		/** @inner Initialize service and extract request details */
		const service = new ResearchOpsService(env);
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "";

		try {
			/** @inner Handle API routes */
			if (url.pathname.startsWith("/api/")) {
				/** @inner Handle CORS preflight requests */
				if (request.method === "OPTIONS") {
					return new Response(null, { headers: service.corsHeaders(origin) });
				}

				/** @inner Enforce allowed origins for API requests */
				const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
				if (origin && !allowed.includes(origin)) {
					return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
				}

				// Route to appropriate service methods
				/** @inner Health endpoint */
				if (url.pathname === "/api/health") return service.health(origin);

				/** @inner Projects endpoints */
				if (url.pathname === "/api/projects" && request.method === "GET") {
					return service.listProjectsFromAirtable(origin, url);
				}
				if (url.pathname === "/api/projects" && request.method === "POST") {
					return service.createProject(request, origin);
				}

				/** @inner Studies endpoints */
				if (url.pathname === "/api/studies" && request.method === "GET") {
					return service.listStudies(origin, url);
				}
				if (url.pathname === "/api/studies" && request.method === "POST") {
					return service.createStudy(request, origin);
				}

				/** @inner CSV streaming endpoints */
				if (url.pathname === "/api/projects.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_PROJECTS);
				}
				if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_DETAILS);
				}

				/** @inner 404 for unmatched API routes */
				return service.json({ error: "Not found" }, 404, service.corsHeaders(origin));
			}

			/** @inner Handle static assets with SPA fallback */
			let resp = await env.ASSETS.fetch(request);
			if (resp.status === 404) {
				/** @inner SPA fallback - serve index.html for client-side routing */
				const indexReq = new Request(new URL("/index.html", url), request);
				resp = await env.ASSETS.fetch(indexReq);
			}
			return resp;
		} catch (e) {
			/** @inner Log and return structured error for any unhandled exceptions */
			service.log.error("unhandled.error", { err: String(e?.message || e) });
			return new Response(JSON.stringify({ error: "Internal error" }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
			});
		} finally {
			/** @inner Always cleanup service resources */
			service.destroy();
		}
	}
};

/* =========================
 * @section Test utilities (named exports)
 * ========================= */

/**
 * Create a minimal mock Env for unit tests.
 * @function createMockEnv
 * @inner
 * @param {Partial<Env>} overrides
 * @returns {Env}
 * @since 1.0.0
 */
export function createMockEnv(overrides = {}) {
	return /** @type {Env} */ ({
		ALLOWED_ORIGINS: "http://localhost:8080",
		AUDIT: "false",
		AIRTABLE_BASE_ID: "app_base",
		AIRTABLE_TABLE_PROJECTS: "Projects",
		AIRTABLE_TABLE_DETAILS: "Project Details",
		AIRTABLE_TABLE_STUDIES: "Project Studies",
		AIRTABLE_API_KEY: "key",
		GH_OWNER: "owner",
		GH_REPO: "repo",
		GH_BRANCH: "main",
		GH_PATH_PROJECTS: "data/projects.csv",
		GH_PATH_DETAILS: "data/project-details.csv",
		GH_PATH_STUDIES: "data/studies.csv",
		GH_TOKEN: "gh",
		ASSETS: { fetch: () => new Response("not-found", { status: 404 }) },
		...overrides
	});
}

/**
 * Build a JSON Request for tests.
 * @function makeJsonRequest
 * @inner
 * @param {string} path
 * @param {any} body
 * @param {RequestInit} [init]
 * @returns {Request}
 * @example
 * const req = makeJsonRequest("/api/projects", { name:"X", description:"Y" });
 */
export function makeJsonRequest(path, body, init = {}) {
	const reqInit = {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" },
			init.headers || {}
		),
		body: JSON.stringify(body)
	};

	/** @inner Preserve extra init options (mode, credentials, etc.) */
	for (const k in init) {
		if (k !== "headers") reqInit[k] = init[k];
	}

	return new Request(`https://example.test${path}`, reqInit);
}
