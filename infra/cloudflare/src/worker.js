/**
 * @file worker.js
 * @module ResearchOpsWorker
 * @summary Cloudflare Worker for ResearchOps platform (Airtable + GitHub CSV).
 * @description
 * Serves static assets and exposes API routes for:
 * - Health: `GET /api/health`
 * - List projects (Airtable, newest-first via `record.createdTime`): `GET /api/projects`
 * - Create project (Airtable primary + optional Details; best-effort GitHub CSV dual-write):
 *   `POST /api/projects`
 * - CSV streaming from GitHub: `GET /api/projects.csv`, `GET /api/project-details.csv`
 *
 * @exports default
 * @requires globalThis.fetch
 * @requires globalThis.Request
 * @requires globalThis.Response
 *
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS
 * @property {string} AUDIT
 * @property {string} AIRTABLE_BASE_ID
 * @property {string} AIRTABLE_TABLE_PROJECTS
 * @property {string} AIRTABLE_TABLE_DETAILS
 * @property {string} AIRTABLE_API_KEY
 * @property {string} GH_OWNER
 * @property {string} GH_REPO
 * @property {string} GH_BRANCH
 * @property {string} GH_PATH_PROJECTS
 * @property {string} GH_PATH_DETAILS
 * @property {string} GH_TOKEN
 * @property {any}    ASSETS
 */

/* =========================
 * @section Configuration
 * ========================= */
/**
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
 * @class
 * @classdesc Minimal batched console logger (prevents log spam).
 * @public
 */
class BatchLogger {
	/**
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
	 * @function
	 * @access public
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
	 * @function
	 * @returns {void}
	 */
	flush() {
		if (!this._buf.length) return;
		try { console.log("audit.batch", this._buf); } catch { for (const e of this._buf) { try { console.log("audit.entry", e); } catch {} } } finally { this._buf = []; }
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
 * @function
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
 * @function
 * @param {Array<unknown>} arr
 * @returns {string}
 */
function toCsvLine(arr) {
	return arr.map(csvEscape).join(",") + "\n";
}

/**
 * Base64 encode (UTF-8 safe).
 * @function
 * @param {string} s
 * @returns {string}
 */
function b64Encode(s) {
	return btoa(unescape(encodeURIComponent(s)));
}

/**
 * Base64 decode (UTF-8 safe).
 * @function
 * @param {string} b
 * @returns {string}
 */
function b64Decode(b) {
	const clean = (b || "").replace(/\n/g, "");
	return decodeURIComponent(escape(atob(clean)));
}

/**
 * Truncate long text for logs.
 * @function
 * @param {string} t
 * @returns {string}
 */
function safeText(t) {
	return t && t.length > 2048 ? t.slice(0, 2048) + "…" : t;
}

/**
 * Parse date string to epoch ms; invalid → 0.
 * @function
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
 * @class
 * @classdesc ResearchOps HTTP service (Airtable + GitHub CSV).
 * @public
 */
class ResearchOpsService {
	/**
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
	 */
	reset() { this.log.reset(); }

	/**
	 * Cleanup resources (idempotent).
	 * @returns {void}
	 */
	destroy() {
		if (this.destroyed) return;
		this.log.destroy();
		this.destroyed = true;
	}

	/**
	 * Build CORS headers for the given origin.
	 * @function
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
	 * @function
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
	 * @function
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async health(origin) {
		return this.json({ ok: true, time: new Date().toISOString() }, 200, this.corsHeaders(origin));
	}

	/**
	 * List projects from Airtable.
	 * - Uses Airtable `record.createdTime` (system timestamp) for `createdAt`.
	 * - Sorted newest-first server-side to guarantee order irrespective of view configuration.
	 *
	 * @async
	 * @function
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 * @throws {Error} On network or Airtable API failure.
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

		// Guarantee newest-first for the UI
		projects.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

		return this.json({ ok: true, projects }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a project in Airtable (+ optional details), then append to GitHub CSV (best-effort).
	 * @async
	 * @function
	 * @param {Request} request
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 * @throws {Error} On network or Airtable API failure.
	 */
	async createProject(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}
		/** @type {any} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const errs = [];
		if (!payload.name) errs.push("name");
		if (!payload.description) errs.push("description");
		if (errs.length) return this.json({ error: "Missing required fields: " + errs.join(", ") }, 400, this.corsHeaders(origin));

		// Airtable (system of record)
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
		const projectId = pJson.records?.[0]?.id;
		if (!projectId) return this.json({ error: "Airtable response missing project id" }, 502, this.corsHeaders(origin));

		// 2) Optional details
		let detailId = null;
		const hasDetails = Boolean(payload.lead_researcher || payload.lead_researcher_email || payload.notes);
		if (hasDetails) {
			const detailsFields = {
				Project: [projectId],
				"Lead Researcher": payload.lead_researcher || "",
				"Lead Researcher Email": payload.lead_researcher_email || "",
				Notes: payload.notes || ""
			};
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
				try { await fetchWithTimeout(`${atProjectsUrl}/${projectId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` } }, this.cfg.TIMEOUT_MS); } catch {}
				this.log.error("airtable.details.fail", { status: dRes.status, text: safeText(dText) });
				return this.json({ error: `Airtable details ${dRes.status}`, detail: safeText(dText) }, dRes.status, this.corsHeaders(origin));
			}
			try { detailId = JSON.parse(dText).records?.[0]?.id || null; } catch {}
		}

		// 3) GitHub CSV append (best-effort; never block success)
		let csvOk = true,
			csvError = null;
		try {
			const nowIso = new Date().toISOString();
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
	 * Proxy a CSV file from GitHub Raw content.
	 * @async
	 * @function
	 * @param {string} origin
	 * @param {string} path
	 * @returns {Promise<Response>}
	 */
	async streamCsv(origin, path) {
		const { GH_OWNER, GH_REPO, GH_BRANCH, GH_TOKEN } = this.env;
		const url = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${encodeURIComponent(GH_BRANCH)}/${path}`;
		const res = await fetchWithTimeout(url, {
			headers: GH_TOKEN ? { "Authorization": `Bearer ${GH_TOKEN}` } : {}
		}, this.cfg.TIMEOUT_MS);

		if (!res.ok) {
			const t = await res.text();
			this.log.error("github.csv.stream.fail", { status: res.status, detail: safeText(t) });
			return this.json({ error: `GitHub ${res.status}`, detail: safeText(t) }, res.status, this.corsHeaders(origin));
		}
		return new Response(res.body, {
			status: 200,
			headers: {
				...this.corsHeaders(origin),
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `inline; filename="${path.split("/").pop() || "data.csv"}"`,
				"Cache-Control": this.cfg.CSV_CACHE_CONTROL
			}
		});
	}

	/**
	 * Append a row to a CSV file in GitHub (create if missing).
	 * @async
	 * @function
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

		// Read current file (to get sha)
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
}

/* =========================
 * @section Worker entrypoint
 * ========================= */
/**
 * Default export: Cloudflare Worker `fetch` handler.
 * @exports default
 */
export default {
	/**
	 * Cloudflare Worker entrypoint.
	 * @async
	 * @function
	 * @param {Request} request
	 * @param {Env} env
	 * @param {ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 * @throws {Error} On unexpected failure (returned as 500 response).
	 */
	async fetch(request, env, ctx) {
		const service = new ResearchOpsService(env);
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "";

		try {
			if (url.pathname.startsWith("/api/")) {
				if (request.method === "OPTIONS") {
					return new Response(null, { headers: service.corsHeaders(origin) });
				}
				const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
				if (origin && !allowed.includes(origin)) {
					return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
				}

				if (url.pathname === "/api/health") return service.health(origin);
				if (url.pathname === "/api/projects" && request.method === "GET") {
					return service.listProjectsFromAirtable(origin, url);
				}
				if (url.pathname === "/api/projects" && request.method === "POST") {
					return service.createProject(request, origin);
				}
				if (url.pathname === "/api/projects.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_PROJECTS);
				}
				if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_DETAILS);
				}
				return service.json({ error: "Not found" }, 404, service.corsHeaders(origin));
			}

			// Static assets (SPA fallback)
			let resp = await env.ASSETS.fetch(request);
			if (resp.status === 404) {
				const indexReq = new Request(new URL("/index.html", url), request);
				resp = await env.ASSETS.fetch(indexReq);
			}
			return resp;
		} catch (e) {
			service.log.error("unhandled.error", { err: String(e?.message || e) });
			return new Response(JSON.stringify({ error: "Internal error" }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
			});
		} finally {
			service.destroy();
		}
	}
};

/* =========================
 * @section Test utilities (named exports)
 * ========================= */
/**
 * Create a minimal mock Env for unit tests.
 * @function
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
		AIRTABLE_API_KEY: "key",
		GH_OWNER: "owner",
		GH_REPO: "repo",
		GH_BRANCH: "main",
		GH_PATH_PROJECTS: "data/projects.csv",
		GH_PATH_DETAILS: "data/project-details.csv",
		GH_TOKEN: "gh",
		ASSETS: { fetch: () => new Response("not-found", { status: 404 }) },
		...overrides
	});
}

/**
 * Build a JSON Request for tests.
 * @function
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

	// Copy other keys (like mode, credentials, etc.)
	for (const k in init) {
		if (k !== "headers") reqInit[k] = init[k];
	}

	return new Request(`https://example.test${path}`, reqInit);
}
