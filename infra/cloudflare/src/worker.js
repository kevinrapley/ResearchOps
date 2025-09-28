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
		const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
		const view = url.searchParams.get("view") || undefined;

		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);

		let atUrl = `https://api.airtable.com/v0/${base}/${tProjects}?pageSize=${limit}`;
		if (view) atUrl += `&view=${encodeURIComponent(view)}`;

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

		/** @type {{records: Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
		let data;
		try { data = JSON.parse(text); } catch { data = { records: [] }; }

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
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}
		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); }
		catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

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

		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
		const tDetails = encodeURIComponent(this.env.AIRTABLE_TABLE_DETAILS);
		const atProjectsUrl = `https://api.airtable.com/v0/${base}/${tProjects}`;
		const atDetailsUrl = `https://api.airtable.com/v0/${base}/${tDetails}`;

		// 1) Create project
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
		const projectId =
