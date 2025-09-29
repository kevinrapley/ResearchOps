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
			"Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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
	 * @file public/js/richtext.js
	 * @summary Markdown → Airtable Rich Text adapter (browser).
	 * Airtable Rich Text accepts Markdown. This normalises Markdown consistently.
	 */

	/**
	 * Normalise Markdown for Airtable Rich Text fields.
	 * - Normalises line endings to "\n"
	 * - Trims outer whitespace
	 * - Collapses >2 blank lines to 2
	 * - Converts tabs to 2 spaces
	 * - Trims trailing spaces at line ends
	 * @param {string} markdown
	 * @param {{collapseBlank?:boolean, tabSize?:number}} [opts]
	 * @returns {string}
	 */
	export function mdToAirtableRich(markdown, opts = {}) {
		const tabSize = Math.max(1, opts.tabSize ?? 2);
		const collapseBlank = opts.collapseBlank ?? true;

		let md = String(markdown ?? "");

		// normalise line Endings
		md = md.replace(/\r\n?/g, "\n");
		// tabs → spaces
		md = md.replace(/\t/g, " ".repeat(tabSize));
		// trim trailing spaces (per line)
		md = md.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n");
		// collapse 3+ blank lines → 2
		if (collapseBlank) md = md.replace(/\n{3,}/g, "\n\n");
		// outer trim
		md = md.trim();

		return md;
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
	 * @inner join Project Details -> include lead fields
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

		// ---- 2) Project Details (pull lead researcher + email)
		// We fetch a single page (100) which is fine for this UI; expand if you have more.
		const dUrl = `https://api.airtable.com/v0/${base}/${tDetails}?pageSize=100&fields%5B%5D=Project&fields%5B%5D=Lead%20Researcher&fields%5B%5D=Lead%20Researcher%20Email&fields%5B%5D=Notes`;
		const dRes = await fetchWithTimeout(dUrl, {
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

		if (dRes.ok) {
			const dText = await dRes.text();
			/** @type {{records:Array<{id:string,createdTime?:string,fields:Record<string,any>}>}} */
			let dData;
			try { dData = JSON.parse(dText); } catch { dData = { records: [] }; }

			// Map first-seen (or latest-by-createdTime) detail per project id.
			const detailsByProject = new Map();
			for (const r of (dData.records || [])) {
				const f = r.fields || {};
				const linked = Array.isArray(f.Project) && f.Project[0];
				if (!linked) continue;
				const existing = detailsByProject.get(linked);
				// prefer the newest createdTime if multiple
				if (!existing || toMs(r.createdTime) > toMs(existing._createdAt)) {
					detailsByProject.set(linked, {
						lead_researcher: f["Lead Researcher"] || "",
						lead_researcher_email: f["Lead Researcher Email"] || "",
						notes: f.Notes || "",
						_createdAt: r.createdTime || ""
					});
				}
			}

			// Merge onto projects by Airtable id (record id)
			projects = projects.map(p => {
				const d = detailsByProject.get(p.id);
				return d ? { ...p, lead_researcher: d.lead_researcher, lead_researcher_email: d.lead_researcher_email, notes: d.notes } : p;
			});
		} else {
			// Non-blocking: if details fetch fails, just log and continue
			const dt = await dRes.text().catch(() => "");
			this.log.warn("airtable.details.join.fail", { status: dRes.status, detail: safeText(dt) });
		}

		// newest-first for UI
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
		// Size guard for body (prevents abuse)
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @inner Parse JSON payload safely */
		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		// Validate required fields
		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		/** @inner Build Airtable project fields; strip empties */
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

		/** @inner Prepare Airtable endpoints */
		const base = this.env.AIRTABLE_BASE_ID;
		const tProjects = encodeURIComponent(this.env.AIRTABLE_TABLE_PROJECTS);
		const tDetails = encodeURIComponent(this.env.AIRTABLE_TABLE_DETAILS);
		const atProjectsUrl = `https://api.airtable.com/v0/${base}/${tProjects}`;
		const atDetailsUrl = `https://api.airtable.com/v0/${base}/${tDetails}`;

		// 1) Create main project
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
		/** @inner Extract project Airtable id */
		let pJson;
		try { pJson = JSON.parse(pText); } catch { pJson = { records: [] }; }
		const projectId = pJson.records?.[0]?.id;
		if (!projectId) return this.json({ error: "Airtable response missing project id" }, 502, this.corsHeaders(origin));

		// 2) Optionally create "Project Details" row
		let detailId = null;
		const hasDetails = Boolean(payload.lead_researcher || payload.lead_researcher_email || payload.notes);
		if (hasDetails) {
			const detailsFields = {
				Project: [projectId],
				"Lead Researcher": payload.lead_researcher || "",
				"Lead Researcher Email": payload.lead_researcher_email || "",
				Notes: payload.notes || ""
			};
			// Strip empty strings
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
				// Best-effort rollback of the project record
				try { await fetchWithTimeout(`${atProjectsUrl}/${projectId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` } }, this.cfg.TIMEOUT_MS); } catch {}
				this.log.error("airtable.details.fail", { status: dRes.status, text: safeText(dText) });
				return this.json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, this.corsHeaders(origin));
			}
			try { detailId = JSON.parse(dText).records?.[0]?.id || null; } catch {}
		}

		// 3) Best-effort GitHub CSV append(s)
		let csvOk = true,
			csvError = null;
		try {
			const nowIso = new Date().toISOString();
			// projects.csv
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

			// project-details.csv (optional)
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
		// Size guard
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @inner Parse body JSON */
		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		// Required field checks
		const errs = [];
		if (!payload.project_airtable_id) errs.push("project_airtable_id");
		if (!payload.method) errs.push("method");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		/** @inner Airtable endpoint */
		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
		const atStudiesUrl = `https://api.airtable.com/v0/${base}/${tStudies}`;

		/** @inner Construct study fields; strip empties */
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

		// Create study
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

		/** @inner Extract new Airtable record id */
		let sJson;
		try { sJson = JSON.parse(sText); } catch { sJson = { records: [] }; }
		const studyId = sJson.records?.[0]?.id;
		if (!studyId) return this.json({ error: "Airtable response missing study id" }, 502, this.corsHeaders(origin));

		// Best-effort CSV write
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
	 *
	 * - Requires `?project=<AirtableId>` query param (the Airtable record id of the Project).
	 * - Paginates through Airtable results to avoid missing records.
	 * - Filters client-side to ensure exact link match.
	 *
	 * @async
	 * @function listStudies
	 * @memberof ResearchOpsService
	 * @inner
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 */
	async listStudies(origin, url) {
		// Validate required query param
		const projectId = url.searchParams.get("project");
		if (!projectId) {
			return this.json({ error: "Missing project query" }, 400, this.corsHeaders(origin));
		}

		/** @inner Endpoint + auth setup */
		const base = this.env.AIRTABLE_BASE_ID;
		const tStudies = encodeURIComponent(this.env.AIRTABLE_TABLE_STUDIES);
		const atBase = `https://api.airtable.com/v0/${base}/${tStudies}`;
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		/** @inner Collect across pages */
		const records = [];
		let offset;

		do {
			// Limit fields to minimize payload; add offset as needed
			const params = new URLSearchParams({ pageSize: "100" });
			["Project", "Method", "Status", "Description", "Study ID"].forEach(f => params.append("fields[]", f));
			if (offset) params.set("offset", offset);

			const res = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
			const text = await res.text();

			if (!res.ok) {
				this.log.error("airtable.studies.fail", { status: res.status, text: safeText(text) });
				return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
			}

			/** @inner Parse and accumulate */
			let js;
			try { js = JSON.parse(text); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		// Filter: ensure the linked Project array contains the requested id
		const filtered = records.filter(r => Array.isArray(r.fields?.Project) && r.fields.Project.includes(projectId));

		// Map to UI model
		const studies = filtered.map(r => {
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

		// Newest first
		studies.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

		return this.json({ ok: true, studies }, 200, this.corsHeaders(origin));
	}
	
	/**
	 * Update a Study (Airtable partial update).
	 * Accepts: { description?, method?, status?, study_id? }
	 * Writes to Airtable fields: Description, Method, Status, "Study ID".
	 */
	async updateStudy(request, origin, studyId) {
		if (!studyId) {
			return this.json({ error: "Missing study id" }, 400, this.corsHeaders(origin));
		}

		// guard: payload size
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		// parse JSON
		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		// map incoming props → Airtable fields (only allow whitelisted fields)
		const fields = {
			Description: typeof payload.description === "string" ? payload.description : undefined,
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

		// Airtable PATCH
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
	 * @param {{path:string, header:string[], row:string[]}} params
	 * @returns {Promise<void>}
	 * @throws {Error} If GitHub API read/write fails.
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

		/** @inner Read the current file */
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
			// Initialize with header
			content = header.join(",") + "\n";
		} else {
			const t = await getRes.text();
			throw new Error(`GitHub read ${getRes.status}: ${safeText(t)}`);
		}

		// Append the new row
		content += toCsvLine(row);

		/** @inner Write back to GitHub with commit message */
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
 * - Proxies static assets via `env.ASSETS` with SPA fallback.
 *
 * @async
 * @function fetch
 * @memberof default
 * @inner
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response>}
 */
export default {
	async fetch(request, env, ctx) {
		/** @inner Bootstrap per-request service instance */
		const service = new ResearchOpsService(env);
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "";

		try {
			// API routes
			if (url.pathname.startsWith("/api/")) {
				// CORS preflight
				if (request.method === "OPTIONS") {
					return new Response(null, { headers: service.corsHeaders(origin) });
				}

				// Enforce ALLOWED_ORIGINS for API calls
				const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
				if (origin && !allowed.includes(origin)) {
					return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
				}

				// Route map
				if (url.pathname === "/api/health") return service.health(origin);

				// Projects
				if (url.pathname === "/api/projects" && request.method === "GET") {
					return service.listProjectsFromAirtable(origin, url);
				}
				if (url.pathname === "/api/projects" && request.method === "POST") {
					return service.createProject(request, origin);
				}

				// Studies
				if (url.pathname === "/api/studies" && request.method === "GET") {
					return service.listStudies(origin, url);
				}
				if (url.pathname === "/api/studies" && request.method === "POST") {
					return service.createStudy(request, origin);
				}

				// CSV streaming
				if (url.pathname === "/api/projects.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_PROJECTS);
				}
				if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_DETAILS);
				}

				// 404 for unknown API paths
				return service.json({ error: "Not found" }, 404, service.corsHeaders(origin));
			}

			// Static assets with SPA fallback
			let resp = await env.ASSETS.fetch(request);
			if (resp.status === 404) {
				// Serve index.html for client-side routes
				const indexReq = new Request(new URL("/index.html", url), request);
				resp = await env.ASSETS.fetch(indexReq);
			}
			return resp;

		} catch (e) {
			// Defensive error handling to avoid leaking impl details
			service.log.error("unhandled.error", { err: String(e?.message || e) });
			return new Response(JSON.stringify({ error: "Internal error" }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
			});
		} finally {
			// Always flush/destroy logger buffers
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
