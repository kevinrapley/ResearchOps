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
 *   - Update study (partial): `PATCH /api/studies/:id`
 * - Guides:
 *   - List guides for a study: `GET /api/guides?study=<StudyAirtableId>`
 *   - Create guide: `POST /api/guides`
 *   - Read guide: `GET /api/guides/:id`
 *   - Update guide: `PATCH /api/guides/:id`
 *   - Publish guide: `POST /api/guides/:id/publish`
 * - Partials:
 *   - List partials: `GET /api/partials`
 *   - Read partial: `GET /api/partials/:id`
 *   - Create partial: `POST /api/partials`
 *   - Update partial: `PATCH /api/partials/:id`
 *   - Delete partial: `DELETE /api/partials/:id`
 * - Participants & Scheduling:
 *   - List participants by study: `GET /api/participants?study=<StudyAirtableId>`
 *   - Create participant: `POST /api/participants`
 *   - List sessions by study: `GET /api/sessions?study=<StudyAirtableId>`
 *   - Create session: `POST /api/sessions`
 *   - Update session: `PATCH /api/sessions/:id`
 *   - Download session invite (.ics): `GET /api/sessions/:id/ics`
 * - Communications:
 *   - Send templated comms (stub + Airtable log): `POST /api/comms/send`
 * - CSV streaming from GitHub:
 *   - `GET /api/projects.csv`, `GET /api/project-details.csv`
 * - AI assist:
 *   - Rule-guided rewrite for Description (Workers AI): `POST /api/ai-rewrite`
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
 * @property {string} [MODEL] Workers AI model name (e.g., "@cf/meta/llama-3.1-8b-instruct").
 * @property {string} [AIRTABLE_TABLE_AI_LOG] Optional Airtable table for counters-only AI logs (e.g., "AI_Usage").
 * @property {any}    AI Cloudflare Workers AI binding (env.AI.run).
 */

// AI rewrite endpoint (Workers AI)
import { aiRewrite } from './ai-rewrite.js';

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
			console.log("audit.batch", this._buf);
		} catch {
			for (const e of this._buf) {
				try { console.log("audit.entry", e); } catch {}
			}
		} finally {
			this._buf = [];
		}
	}

	/** @returns {void} */
	reset() { this._buf = []; }

	/** @returns {void} */
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
	let s = String(val);
	if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralize formula
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
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

/**
 * Base64 decode (UTF-8 safe).
 * @function b64Decode
 * @inner
 * @param {string} b64
 * @returns {string}
 */
function b64Decode(b64) {
	const bin = atob(String(b64 || "").replace(/\s+/g, ""));
	const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
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

/**
 * Normalise Markdown for Airtable Rich Text fields (server-side).
 * - Normalises line endings to "\n"
 * - Trims outer whitespace
 * - Collapses >2 blank lines to 2
 * - Converts tabs to N spaces (default 2)
 * - Trims trailing spaces at line ends
 * @inner
 * @param {string} markdown
 * @param {{collapseBlank?:boolean, tabSize?:number}} [opts]
 * @returns {string}
 */
function mdToAirtableRich(markdown, opts = {}) {
	const tabSize = Math.max(1, opts.tabSize ?? 2);
	const collapseBlank = opts.collapseBlank ?? true;

	let md = String(markdown ?? "");
	md = md.replace(/\r\n?/g, "\n"); // normalise line endings
	md = md.replace(/\t/g, " ".repeat(tabSize)); // tabs → spaces
	md = md.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n"); // strip trailing ws per line
	if (collapseBlank) md = md.replace(/\n{3,}/g, "\n\n"); // collapse 3+ blank lines
	return md.trim();
}

/** Candidate names for the Guides↔Study link field */
const GUIDE_LINK_FIELD_CANDIDATES = [
	"Study ↔", "Study", "Project Study", "Study Link", "Study Record", "Studies"
];

/** Candidate names for other common fields in the Guides table */
const GUIDE_FIELD_NAMES = {
	title: ["Title", "Name"],
	status: ["Status"],
	version: ["Version", "Revision", "v"],
	source: ["Source Markdown", "Markdown", "Source"],
	variables: ["Variables (JSON)", "Variables", "Vars"]
};

/** Participants & Sessions Airtable field names */
const PARTICIPANT_FIELDS = {
	display_name: ["Display Name", "Name", "Participant"],
	email: ["Email"],
	phone: ["Phone"],
	timezone: ["Time Zone", "Timezone"],
	channel_pref: ["Channel Pref", "Channel Preference"],
	access_needs: ["Access Needs", "Accessibility"],
	recruitment_source: ["Recruitment Source", "Source"],
	consent_status: ["Consent Status"],
	consent_record_id: ["Consent Record Id", "Consent Record"],
	privacy_notice_url: ["Privacy Notice URL", "Privacy URL"],
	status: ["Status"],
	study_link: ["Study", "Studies", "Project Study"],
};

const SESSION_FIELDS = {
	study_link: ["Study", "Studies", "Project Study"],
	participant_link: ["Participant", "Participants"],
	starts_at: ["Starts At", "Start", "Start Time"],
	duration_min: ["Duration (min)", "Duration"],
	type: ["Type", "Session Type"],
	location_or_link: ["Location / Link", "Location", "Join Link"],
	backup_contact: ["Backup Contact"],
	researchers: ["Researchers"],
	status: ["Status"],
	incentive_type: ["Incentive Type"],
	incentive_amount: ["Incentive Amount"],
	incentive_status: ["Incentive Status"],
	safeguarding_flag: ["Safeguarding", "Safeguarding Flag"],
	notes: ["Notes"],
};

/** Pick the first present key from `obj` that matches any of the candidates. */
function pickFirstField(obj, candidates) {
	if (!obj || typeof obj !== "object") return null;
	for (const k of candidates)
		if (Object.prototype.hasOwnProperty.call(obj, k)) return k;
	return null;
}

/**
 * Attempt an Airtable write with a field name; on 422 UNKNOWN_FIELD_NAME, tell caller to try next.
 * Returns {ok:true, json} OR {ok:false, retry:true, detail} for UNKNOWN_FIELD_NAME; OR {ok:false, retry:false, detail}
 */
async function airtableTryWrite(url, token, method, fields, timeoutMs) {
	const res = await fetchWithTimeout(url, {
		method,
		headers: {
			"Authorization": `Bearer ${token}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ records: [{ fields }] })
	}, timeoutMs);

	const text = await res.text();
	if (res.ok) {
		try { return { ok: true, json: JSON.parse(text) }; } catch { return { ok: true, json: { records: [] } }; }
	}

	// Detect UNKNOWN_FIELD_NAME to allow retry with another candidate
	let retry = false;
	try {
		const js = JSON.parse(text);
		retry = js?.error?.type === "UNKNOWN_FIELD_NAME";
	} catch {}
	return { ok: false, retry, detail: safeText(text), status: res.status };
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
	 * @function corsHeaders
	 * @inner
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
	 * List projects from Airtable (joins latest Project Details).
	 * - Uses Airtable `record.createdTime` for `createdAt`.
	 * - Sorted newest-first server-side to guarantee stable ordering.
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
	 * Create a project in Airtable (+ optional details), then append to GitHub CSV (best-effort).
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

		// Create project
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

		// Optional details
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

		// GitHub CSV (best-effort)
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
	 * Create a Study linked to a Project (Airtable primary) and append to GitHub CSV (best-effort).
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
	 * - Returns detailed errors instead of generic ones
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
					// Return Airtable's payload to the caller for visibility
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

	/**
	 * Stream a CSV file from GitHub with proper headers.
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

	/**
	 * Append a row to a GitHub-hosted CSV file (create if missing).
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

	/* --------------------- Guides (Discussion Guides) -------------------- */

	/**
	 * List guides for a study.
	 * @route GET /api/guides?study=<StudyAirtableId>
	 * @returns { ok:boolean, guides:Array }
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

	/**
	 * Create a guide for a study. Tries multiple link-field names until one works.
	 * @route POST /api/guides
	 * Body: { study_airtable_id, title?, status?, version?, sourceMarkdown?, variables? }
	 */
	async createGuide(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @type {any} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		if (!p.study_airtable_id)
			return this.json({ error: "Missing field: study_airtable_id" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(this.env.AIRTABLE_TABLE_GUIDES);
		const atUrl = `https://api.airtable.com/v0/${base}/${tGuides}`;

		// Build non-link fields (remember which Status key we used)
		const fieldsTemplate = {};
		const setIf = (names, val) => {
			if (val === undefined || val === null) return null;
			const k = names[0];
			fieldsTemplate[k] = val;
			return k;
		};

		setIf(GUIDE_FIELD_NAMES.title, String(p.title || "Untitled guide"));
		const statusKey = setIf(GUIDE_FIELD_NAMES.status, String(p.status || "draft")); // <-- initial desired value
		setIf(GUIDE_FIELD_NAMES.version, Number.isFinite(p.version) ? p.version : 1);
		setIf(GUIDE_FIELD_NAMES.source, mdToAirtableRich(p.sourceMarkdown || ""));
		setIf(GUIDE_FIELD_NAMES.variables, typeof p.variables === "object" ? JSON.stringify(p.variables || {}) : String(p.variables || "{}"));

		// Try link field candidates; for each, retry if Status select rejects "draft"
		let lastDetail = "";
		for (const linkName of GUIDE_LINK_FIELD_CANDIDATES) {
			// attempt 1: as-is
			let fields = { ...fieldsTemplate, [linkName]: [p.study_airtable_id] };
			let attempt = await airtableTryWrite(atUrl, this.env.AIRTABLE_API_KEY, "POST", fields, this.cfg.TIMEOUT_MS);
			if (attempt.ok) {
				const id = attempt.json.records?.[0]?.id;
				if (!id) return this.json({ error: "Airtable response missing id" }, 502, this.corsHeaders(origin));
				if (this.env.AUDIT === "true") this.log.info("guide.created", { id, linkName, statusFallback: "none" });
				return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
			}
			lastDetail = attempt.detail || lastDetail;

			// If the problem is an invalid select option on Status, retry smartly
			const is422 = attempt.status === 422;
			const isSelectErr = /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
			if (is422 && isSelectErr && statusKey && typeof fields[statusKey] === "string") {
				// attempt 2: capitalise (draft -> Draft)
				const cap = fields[statusKey].charAt(0).toUpperCase() + fields[statusKey].slice(1);
				fields = { ...fields, [statusKey]: cap };
				attempt = await airtableTryWrite(atUrl, this.env.AIRTABLE_API_KEY, "POST", fields, this.cfg.TIMEOUT_MS);
				if (attempt.ok) {
					const id = attempt.json.records?.[0]?.id;
					if (!id) return this.json({ error: "Airtable response missing id" }, 502, this.corsHeaders(origin));
					if (this.env.AUDIT === "true") this.log.info("guide.created", { id, linkName, statusFallback: "capitalised" });
					return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
				}

				// attempt 3: drop Status (let Airtable default or leave empty)
				const {
					[statusKey]: _drop, ...withoutStatus
				} = fields;
				attempt = await airtableTryWrite(atUrl, this.env.AIRTABLE_API_KEY, "POST", withoutStatus, this.cfg.TIMEOUT_MS);
				if (attempt.ok) {
					const id = attempt.json.records?.[0]?.id;
					if (!id) return this.json({ error: "Airtable response missing id" }, 502, this.corsHeaders(origin));
					if (this.env.AUDIT === "true") this.log.info("guide.created", { id, linkName, statusFallback: "omitted" });
					return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
				}
				lastDetail = attempt.detail || lastDetail;
			}

			// If UNKNOWN_FIELD_NAME for the link field, the caller loop continues to next candidate.
			if (!attempt.retry) {
				this.log.error("airtable.guide.create.fail", { status: attempt.status, detail: attempt.detail });
				return this.json({ error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, this.corsHeaders(origin));
			}
		}

		// No link field matched
		this.log.error("airtable.guide.create.linkfield.none_matched", { detail: lastDetail });
		return this.json({
			error: "Airtable 422",
			detail: lastDetail || "No matching link field name found for the Guides↔Study relation. Add a link-to-record field to your Discussion Guides table that links to Project Studies. Try: " + GUIDE_LINK_FIELD_CANDIDATES.join(", ")
		}, 422, this.corsHeaders(origin));
	}

	/**
	 * Update a guide (partial).
	 * @route PATCH /api/guides/:id
	 */
	async updateGuide(request, origin, guideId) {
		if (!guideId) return this.json({ error: "Missing guide id" }, 400, this.corsHeaders(origin));

		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) {
			this.log.warn("request.too_large", { size: body.byteLength });
			return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		}

		/** @type {any} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		// Map incoming keys to preferred Airtable field names
		const f = {};
		const putIf = (names, val) => {
			if (val === undefined) return null;
			const key = names[0];
			f[key] = val;
			return key;
		};

		putIf(GUIDE_FIELD_NAMES.title, typeof p.title === "string" ? p.title : undefined);
		const statusKey = putIf(GUIDE_FIELD_NAMES.status, typeof p.status === "string" ? p.status : undefined);
		putIf(GUIDE_FIELD_NAMES.version, Number.isFinite(p.version) ? p.version : undefined);
		putIf(GUIDE_FIELD_NAMES.source, typeof p.sourceMarkdown === "string" ? mdToAirtableRich(p.sourceMarkdown) : undefined);
		putIf(GUIDE_FIELD_NAMES.variables, p.variables != null ? JSON.stringify(p.variables) : undefined);

		if (Object.keys(f).length === 0) {
			return this.json({ error: "No updatable fields provided" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(this.env.AIRTABLE_TABLE_GUIDES);
		const atUrl = `https://api.airtable.com/v0/${base}/${tGuides}`;

		// try once
		let res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ id: guideId, fields: f }] })
		}, this.cfg.TIMEOUT_MS);

		let text = await res.text();
		if (res.ok) return this.json({ ok: true }, 200, this.corsHeaders(origin));

		// If status is invalid select option, retry with capitalised or omit
		const isSelectErr = /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(text);
		if (res.status === 422 && isSelectErr && statusKey && typeof f[statusKey] === "string") {
			// 2nd attempt: capitalised
			const f2 = { ...f, [statusKey]: f[statusKey].charAt(0).toUpperCase() + f[statusKey].slice(1) };
			res = await fetchWithTimeout(atUrl, {
				method: "PATCH",
				headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
				body: JSON.stringify({ records: [{ id: guideId, fields: f2 }] })
			}, this.cfg.TIMEOUT_MS);
			text = await res.text();
			if (res.ok) return this.json({ ok: true, status_fallback: "capitalised" }, 200, this.corsHeaders(origin));

			// 3rd attempt: omit Status
			const {
				[statusKey]: _drop, ...f3
			} = f2;
			res = await fetchWithTimeout(atUrl, {
				method: "PATCH",
				headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
				body: JSON.stringify({ records: [{ id: guideId, fields: f3 }] })
			}, this.cfg.TIMEOUT_MS);
			text = await res.text();
			if (res.ok) return this.json({ ok: true, status_fallback: "omitted" }, 200, this.corsHeaders(origin));
		}

		this.log.error("airtable.guide.update.fail", { status: res.status, text: safeText(text) });
		return this.json({ error: `Airtable ${res.status}`, detail: safeText(text) }, res.status, this.corsHeaders(origin));
	}

	/**
	 * Publish a guide: set Status="published" and increment Version.
	 * Uses flexible field names defined in GUIDE_FIELD_NAMES.
	 * @returns {Response}
	 */
	async publishGuide(origin, guideId) {
		if (!guideId) return this.json({ error: "Missing guide id" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(this.env.AIRTABLE_TABLE_GUIDES);
		const atBase = `https://api.airtable.com/v0/${base}/${tGuides}`;
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		// Read current record (to find actual keys + version)
		const getUrl = `${atBase}?pageSize=1&filterByFormula=${encodeURIComponent(`RECORD_ID()="${guideId}"`)}`;
		const getRes = await fetchWithTimeout(getUrl, { headers }, this.cfg.TIMEOUT_MS);
		const getText = await getRes.text();
		if (!getRes.ok) {
			this.log.error("airtable.guide.read.fail", { status: getRes.status, text: safeText(getText) });
			return this.json({ error: `Airtable ${getRes.status}`, detail: safeText(getText) }, getRes.status, this.corsHeaders(origin));
		}
		/** @type {{records?: Array<{id:string,fields?:Record<string,any>}>}} */
		let js;
		try { js = JSON.parse(getText); } catch { js = { records: [] }; }
		const rec = js.records?.[0];
		const f = rec?.fields || {};

		const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status) || GUIDE_FIELD_NAMES.status[0];
		const versionKey = pickFirstField(f, GUIDE_FIELD_NAMES.version) || GUIDE_FIELD_NAMES.version[0];

		const cur = Number.isFinite(f[versionKey]) ? Number(f[versionKey]) : parseInt(f[versionKey], 10);
		const nextVer = Number.isFinite(cur) ? cur + 1 : 1;

		const tryPatch = async (statusValue, note) => {
			const fields = statusValue != null ? {
				[statusKey]: statusValue,
				[versionKey]: nextVer
			} : {
				[versionKey]: nextVer
			};
			const res = await fetchWithTimeout(atBase, {
				method: "PATCH",
				headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
				body: JSON.stringify({ records: [{ id: guideId, fields }] })
			}, this.cfg.TIMEOUT_MS);
			const txt = await res.text();
			return { ok: res.ok, status: res.status, txt: safeText(txt), note };
		};

		// 1) 'published'
		let r = await tryPatch("published", "lowercase");
		if (r.ok) return this.json({ ok: true, version: nextVer, status: "published" }, 200, this.corsHeaders(origin));

		// If select error, try 'Published'
		const selectErr = r.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(r.txt);
		if (selectErr) {
			r = await tryPatch("Published", "capitalised");
			if (r.ok) return this.json({ ok: true, version: nextVer, status: "Published", status_fallback: "capitalised" }, 200, this.corsHeaders(origin));

			// final fallback: bump version only
			r = await tryPatch(null, "omit-status");
			if (r.ok) return this.json({ ok: true, version: nextVer, status: f[statusKey] || undefined, status_fallback: "omitted" }, 200, this.corsHeaders(origin));
		}

		this.log.error("airtable.guide.publish.fail", { status: r.status, text: r.txt });
		return this.json({ error: `Airtable ${r.status}`, detail: r.txt }, r.status || 500, this.corsHeaders(origin));
	}

	/**
	 * Read a single guide by ID.
	 * @route GET /api/guides/:id
	 * @returns {Response}
	 */
	async readGuide(origin, guideId) {
		if (!guideId) return this.json({ error: "Missing guide id" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const tGuides = encodeURIComponent(this.env.AIRTABLE_TABLE_GUIDES);
		const atUrl = `https://api.airtable.com/v0/${base}/${tGuides}/${encodeURIComponent(guideId)}`;

		const res = await fetchWithTimeout(atUrl, { headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` } }, this.cfg.TIMEOUT_MS);
		const txt = await res.text();
		if (!res.ok) {
			this.log.error("airtable.guide.read.fail", { status: res.status, text: safeText(txt) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		let js;
		try { js = JSON.parse(txt); } catch { js = {}; }
		const f = js.fields || {};

		// reuse your field-candidate logic
		const titleKey = pickFirstField(f, GUIDE_FIELD_NAMES.title);
		const statusKey = pickFirstField(f, GUIDE_FIELD_NAMES.status);
		const verKey = pickFirstField(f, GUIDE_FIELD_NAMES.version);
		const srcKey = pickFirstField(f, GUIDE_FIELD_NAMES.source);
		const varsKey = pickFirstField(f, GUIDE_FIELD_NAMES.variables);

		const guide = {
			id: js.id,
			title: titleKey ? f[titleKey] : "",
			status: statusKey ? f[statusKey] : "draft",
			version: verKey ? f[verKey] : 1,
			sourceMarkdown: srcKey ? (f[srcKey] || "") : "",
			variables: (() => { try { return JSON.parse(f[varsKey] || "{}"); } catch { return {}; } })(),
			createdAt: js.createdTime || ""
		};

		return this.json({ ok: true, guide }, 200, this.corsHeaders(origin));
	}

	/* --------------------- Partials -------------------- */

	/**
	 * List all partials (for pattern drawer).
	 * @route GET /api/partials
	 * @returns {Response}
	 */
	async listPartials(origin) {
		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTIALS || "Partials");
		const url = `https://api.airtable.com/v0/${base}/${table}?sort%5B0%5D%5Bfield%5D=Category&sort%5B1%5D%5Bfield%5D=Name`;

		const res = await fetchWithTimeout(url, {
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

		if (!res.ok) {
			const txt = await res.text();
			this.log.error("airtable.partials.list.fail", { status: res.status, text: safeText(txt) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		const { records = [] } = await res.json();
		const partials = records.map(r => ({
			id: r.id,
			name: r.fields.Name || "",
			title: r.fields.Title || "",
			category: r.fields.Category || "Uncategorised",
			version: r.fields.Version || 1,
			status: r.fields.Status || "draft"
		}));

		return this.json({ ok: true, partials }, 200, this.corsHeaders(origin));
	}

	/**
	 * Read a single partial by ID.
	 * @route GET /api/partials/:id
	 * @returns {Response}
	 */
	async readPartial(origin, id) {
		console.log("Service.readPartial called with:", { origin, id });

		if (!id) {
			console.error("Service.readPartial: No ID provided");
			return this.json({ error: "Missing partial id" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTIALS || "Partials");
		const url = `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(id)}`;

		console.log("Service.readPartial: Fetching from Airtable:", url);

		const res = await fetchWithTimeout(url, {
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

		console.log("Service.readPartial: Airtable response status:", res.status);

		if (!res.ok) {
			const txt = await res.text();
			console.error("Service.readPartial: Airtable error:", txt);
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		const rec = await res.json();
		console.log("Service.readPartial: Got record:", rec.id);

		const partial = {
			id: rec.id,
			name: rec.fields.Name || "",
			title: rec.fields.Title || "",
			category: rec.fields.Category || "",
			version: rec.fields.Version || 1,
			source: rec.fields.Source || "",
			description: rec.fields.Description || "",
			status: rec.fields.Status || "draft"
		};

		return this.json({ ok: true, partial }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a new partial.
	 * @route POST /api/partials
	 * @returns {Response}
	 */
	async createPartial(request, origin) {
		const body = await request.arrayBuffer();
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
			return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin));
		}

		if (!p.name || !p.title || !p.source) {
			return this.json({ error: "Missing required fields: name, title, source" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTIALS || "Partials");
		const url = `https://api.airtable.com/v0/${base}/${table}`;

		const fields = {
			Name: p.name,
			Title: p.title,
			Category: p.category || "Uncategorised",
			Version: p.version || 1,
			Source: p.source,
			Description: p.description || "",
			Status: p.status || "draft"
		};

		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ records: [{ fields }] })
		}, this.cfg.TIMEOUT_MS);

		if (!res.ok) {
			const txt = await res.text();
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		const { records = [] } = await res.json();
		const id = records[0]?.id;
		return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
	}

	/**
	 * Update a partial (partial update).
	 * @route PATCH /api/partials/:id
	 * @returns {Response}
	 */
	async updatePartial(request, origin, id) {
		const body = await request.arrayBuffer();
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
			return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin));
		}

		const fields = {};
		if (p.title !== undefined) fields.Title = p.title;
		if (p.source !== undefined) fields.Source = p.source;
		if (p.description !== undefined) fields.Description = p.description;
		if (p.status !== undefined) fields.Status = p.status;
		if (p.category !== undefined) fields.Category = p.category;

		if (Object.keys(fields).length === 0) {
			return this.json({ error: "No fields to update" }, 400, this.corsHeaders(origin));
		}

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTIALS || "Partials");
		const url = `https://api.airtable.com/v0/${base}/${table}`;

		const res = await fetchWithTimeout(url, {
			method: "PATCH",
			headers: {
				"Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ records: [{ id, fields }] })
		}, this.cfg.TIMEOUT_MS);

		if (!res.ok) {
			const txt = await res.text();
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		return this.json({ ok: true }, 200, this.corsHeaders(origin));
	}

	/**
	 * Delete a partial.
	 * @route DELETE /api/partials/:id
	 * @returns {Response}
	 */
	async deletePartial(origin, id) {
		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTIALS || "Partials");
		const url = `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(id)}`;

		const res = await fetchWithTimeout(url, {
			method: "DELETE",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` }
		}, this.cfg.TIMEOUT_MS);

		if (!res.ok) {
			const txt = await res.text();
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}

		return this.json({ ok: true }, 200, this.corsHeaders(origin));
	}

	/**
	 * List participants for a study.
	 * @route GET /api/participants?study=:id
	 * @returns {Response}
	 */
	async listParticipants(origin, url) {
		const studyId = url.searchParams.get("study");
		if (!studyId) return this.json({ ok: false, error: "Missing study query" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
		const atBase = `https://api.airtable.com/v0/${base}/${table}`;
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
			const txt = await resp.text();
			if (!resp.ok) {
				this.log.error("airtable.participants.list.fail", { status: resp.status, text: safeText(txt) });
				return this.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, this.corsHeaders(origin));
			}
			let js;
			try { js = JSON.parse(txt); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		const participants = records
			.filter(r => {
				const f = r.fields || {};
				const linkKey = pickFirstField(f, PARTICIPANT_FIELDS.study_link);
				const linkArr = linkKey ? f[linkKey] : undefined;
				return Array.isArray(linkArr) && linkArr.includes(studyId);
			})
			.map(r => {
				const f = r.fields || {};
				const pick = (keys) => { const k = pickFirstField(f, keys); return k ? f[k] : undefined; };
				return {
					id: r.id,
					display_name: pick(PARTICIPANT_FIELDS.display_name) || "",
					email: pick(PARTICIPANT_FIELDS.email) || "",
					phone: pick(PARTICIPANT_FIELDS.phone) || "",
					timezone: pick(PARTICIPANT_FIELDS.timezone) || "",
					channel_pref: pick(PARTICIPANT_FIELDS.channel_pref) || "email",
					access_needs: pick(PARTICIPANT_FIELDS.access_needs) || "",
					recruitment_source: pick(PARTICIPANT_FIELDS.recruitment_source) || "",
					consent_status: pick(PARTICIPANT_FIELDS.consent_status) || "not_sent",
					consent_record_id: pick(PARTICIPANT_FIELDS.consent_record_id) || "",
					privacy_notice_url: pick(PARTICIPANT_FIELDS.privacy_notice_url) || "",
					status: pick(PARTICIPANT_FIELDS.status) || "invited",
					createdAt: r.createdTime || ""
				};
			})
			.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

		return this.json({ ok: true, participants }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a participant linked to a study.
	 * @route POST /api/participants
	 * @input  { study_airtable_id:string, display_name:string, email?:string, phone?:string, timezone?:string, channel_pref?:string, access_needs?:string, recruitment_source?:string, consent_status?:string, privacy_notice_url?:string, status?:string }
	 * @returns {Response}
	 */
	async createParticipant(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));

		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }
		if (!p.study_airtable_id || !p.display_name) return this.json({ error: "Missing fields: study_airtable_id, display_name" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
		const url = `https://api.airtable.com/v0/${base}/${table}`;

		const fields = {
			[PARTICIPANT_FIELDS.study_link[0]]: [p.study_airtable_id],
			[PARTICIPANT_FIELDS.display_name[0]]: p.display_name,
			[PARTICIPANT_FIELDS.email[0]]: p.email || undefined,
			[PARTICIPANT_FIELDS.phone[0]]: p.phone || undefined,
			[PARTICIPANT_FIELDS.timezone[0]]: p.timezone || undefined,
			[PARTICIPANT_FIELDS.channel_pref[0]]: p.channel_pref || "email",
			[PARTICIPANT_FIELDS.access_needs[0]]: p.access_needs || undefined,
			[PARTICIPANT_FIELDS.recruitment_source[0]]: p.recruitment_source || undefined,
			[PARTICIPANT_FIELDS.consent_status[0]]: p.consent_status || "not_sent",
			[PARTICIPANT_FIELDS.privacy_notice_url[0]]: p.privacy_notice_url || undefined,
			[PARTICIPANT_FIELDS.status[0]]: p.status || "invited",
		};
		for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] })
		}, this.cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			this.log.error("airtable.participant.create.fail", { status: res.status, text: safeText(txt) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		const id = js.records?.[0]?.id;
		return this.json({ ok: true, id }, 200, this.corsHeaders(origin));
	}

	/**
	 * List sessions for a study.
	 * @route GET /api/sessions?study=:id
	 */
	async listSessions(origin, url) {
		const studyId = url.searchParams.get("study");
		if (!studyId) return this.json({ ok: false, error: "Missing study query" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
		const atBase = `https://api.airtable.com/v0/${base}/${table}`;
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, this.cfg.TIMEOUT_MS);
			const txt = await resp.text();
			if (!resp.ok) {
				this.log.error("airtable.sessions.list.fail", { status: resp.status, text: safeText(txt) });
				return this.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, this.corsHeaders(origin));
			}
			let js;
			try { js = JSON.parse(txt); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);

		const sessions = records
			.filter(r => {
				const f = r.fields || {};
				const linkKey = pickFirstField(f, SESSION_FIELDS.study_link);
				const linkArr = linkKey ? f[linkKey] : undefined;
				return Array.isArray(linkArr) && linkArr.includes(studyId);
			})
			.map(r => {
				const f = r.fields || {};
				const pick = (keys) => { const k = pickFirstField(f, keys); return k ? f[k] : undefined; };
				return {
					id: r.id,
					participant_id: Array.isArray(pick(SESSION_FIELDS.participant_link)) ? pick(SESSION_FIELDS.participant_link)[0] : "",
					starts_at: pick(SESSION_FIELDS.starts_at) || "",
					duration_min: pick(SESSION_FIELDS.duration_min) || 60,
					type: pick(SESSION_FIELDS.type) || "remote",
					location_or_link: pick(SESSION_FIELDS.location_or_link) || "",
					backup_contact: pick(SESSION_FIELDS.backup_contact) || "",
					researchers: pick(SESSION_FIELDS.researchers) || "",
					status: pick(SESSION_FIELDS.status) || "scheduled",
					incentive_type: pick(SESSION_FIELDS.incentive_type) || "",
					incentive_amount: pick(SESSION_FIELDS.incentive_amount) || 0,
					incentive_status: pick(SESSION_FIELDS.incentive_status) || "",
					safeguarding_flag: Boolean(pick(SESSION_FIELDS.safeguarding_flag)),
					notes: pick(SESSION_FIELDS.notes) || "",
					createdAt: r.createdTime || ""
				};
			})
			.sort((a, b) => toMs(a.starts_at) - toMs(b.starts_at));

		return this.json({ ok: true, sessions }, 200, this.corsHeaders(origin));
	}

	/**
	 * Create a session (schedules participant).
	 * Sends confirmation email/SMS (server-side) and logs comms.
	 * @route POST /api/sessions
	 * @input { study_airtable_id, participant_airtable_id, starts_at, duration_min, type, location_or_link, backup_contact?, researchers?, notes? }
	 */
	async createSession(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const missing = [];
		if (!p.study_airtable_id) missing.push("study_airtable_id");
		if (!p.participant_airtable_id) missing.push("participant_airtable_id");
		if (!p.starts_at) missing.push("starts_at");
		if (!p.duration_min) missing.push("duration_min");
		if (!p.type) missing.push("type");
		if (!p.location_or_link) missing.push("location_or_link");
		if (missing.length) return this.json({ error: "Missing fields: " + missing.join(", ") }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
		const url = `https://api.airtable.com/v0/${base}/${table}`;

		const fields = {
			[SESSION_FIELDS.study_link[0]]: [p.study_airtable_id],
			[SESSION_FIELDS.participant_link[0]]: [p.participant_airtable_id],
			[SESSION_FIELDS.starts_at[0]]: p.starts_at,
			[SESSION_FIELDS.duration_min[0]]: p.duration_min,
			[SESSION_FIELDS.type[0]]: p.type,
			[SESSION_FIELDS.location_or_link[0]]: p.location_or_link,
			[SESSION_FIELDS.backup_contact[0]]: p.backup_contact || undefined,
			[SESSION_FIELDS.researchers[0]]: p.researchers || undefined,
			[SESSION_FIELDS.status[0]]: p.status || "scheduled",
			[SESSION_FIELDS.incentive_type[0]]: p.incentive_type || undefined,
			[SESSION_FIELDS.incentive_amount[0]]: p.incentive_amount || undefined,
			[SESSION_FIELDS.incentive_status[0]]: p.incentive_status || undefined,
			[SESSION_FIELDS.safeguarding_flag[0]]: p.safeguarding_flag ? true : undefined,
			[SESSION_FIELDS.notes[0]]: p.notes || undefined,
		};
		for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

		const res = await fetchWithTimeout(url, {
			method: "POST",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ fields }] })
		}, this.cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			this.log.error("airtable.session.create.fail", { status: res.status, text: safeText(txt) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		const sessionId = js.records?.[0]?.id;

		// Fire-and-forget: send confirmation & log (best effort)
		try {
			// If you have a notification provider, invoke it here.
			// For now, log skeleton:
			if (this.env.AUDIT === "true") this.log.info("session.created", { sessionId, participant: p.participant_airtable_id });
		} catch (e) {
			this.log.warn("comms.confirmation.fail", { err: String(e?.message || e) });
		}

		return this.json({ ok: true, id: sessionId }, 200, this.corsHeaders(origin));
	}

	/**
	 * Update a session (reschedule / cancel / notes, etc.).
	 * @route PATCH /api/sessions/:id
	 */
	async updateSession(request, origin, sessionId) {
		if (!sessionId) return this.json({ error: "Missing session id" }, 400, this.corsHeaders(origin));
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const fields = {
			[SESSION_FIELDS.starts_at[0]]: p.starts_at,
			[SESSION_FIELDS.duration_min[0]]: p.duration_min,
			[SESSION_FIELDS.type[0]]: p.type,
			[SESSION_FIELDS.location_or_link[0]]: p.location_or_link,
			[SESSION_FIELDS.backup_contact[0]]: p.backup_contact,
			[SESSION_FIELDS.researchers[0]]: p.researchers,
			[SESSION_FIELDS.status[0]]: p.status,
			[SESSION_FIELDS.incentive_type[0]]: p.incentive_type,
			[SESSION_FIELDS.incentive_amount[0]]: p.incentive_amount,
			[SESSION_FIELDS.incentive_status[0]]: p.incentive_status,
			[SESSION_FIELDS.safeguarding_flag[0]]: typeof p.safeguarding_flag === "boolean" ? p.safeguarding_flag : undefined,
			[SESSION_FIELDS.notes[0]]: p.notes,
		};
		for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

		if (Object.keys(fields).length === 0) return this.json({ error: "No updatable fields provided" }, 400, this.corsHeaders(origin));

		const base = this.env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(this.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
		const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

		const res = await fetchWithTimeout(atUrl, {
			method: "PATCH",
			headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
			body: JSON.stringify({ records: [{ id: sessionId, fields }] })
		}, this.cfg.TIMEOUT_MS);

		const txt = await res.text();
		if (!res.ok) {
			this.log.error("airtable.session.update.fail", { status: res.status, text: safeText(txt) });
			return this.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, this.corsHeaders(origin));
		}
		return this.json({ ok: true }, 200, this.corsHeaders(origin));
	}

	/**
	 * Generate a minimal ICS for a session.
	 * @route GET /api/sessions/:id/ics
	 */
	async sessionIcs(origin, sessionId) {
		if (!sessionId) return new Response("Missing id", { status: 400, headers: this.corsHeaders(origin) });

		// Read session + participant to build summary
		const base = this.env.AIRTABLE_BASE_ID;
		const sTable = encodeURIComponent(this.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
		const pTable = encodeURIComponent(this.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
		const headers = { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}` };

		const sRes = await fetchWithTimeout(`https://api.airtable.com/v0/${base}/${sTable}/${encodeURIComponent(sessionId)}`, { headers }, this.cfg.TIMEOUT_MS);
		if (!sRes.ok) return this.json({ error: `Airtable ${sRes.status}` }, sRes.status, this.corsHeaders(origin));
		const sRec = await sRes.json();
		const sf = sRec.fields || {};
		const v = (keys) => { const k = pickFirstField(sf, keys); return k ? sf[k] : undefined; };

		const startsAt = v(SESSION_FIELDS.starts_at);
		const duration = Number(v(SESSION_FIELDS.duration_min) || 60);
		const dtStart = new Date(startsAt);
		const dtEnd = new Date(dtStart.getTime() + duration * 60000);
		const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

		// Participant display name (optional)
		let displayName = "participant";
		const pIds = Array.isArray(v(SESSION_FIELDS.participant_link)) ? v(SESSION_FIELDS.participant_link) : [];
		if (pIds[0]) {
			const pRes = await fetchWithTimeout(`https://api.airtable.com/v0/${base}/${pTable}/${encodeURIComponent(pIds[0])}`, { headers }, this.cfg.TIMEOUT_MS);
			if (pRes.ok) {
				const pRec = await pRes.json();
				const pf = pRec.fields || {};
				const pk = pickFirstField(pf, PARTICIPANT_FIELDS.display_name);
				if (pk) displayName = pf[pk] || displayName;
			}
		}

		const location = v(SESSION_FIELDS.location_or_link) || "";
		const summary = `Research session with ${displayName}`;
		const desc = `Join/arrive: ${location}`;

		function foldIcs(s) {
			return s.replace(/(.{1,73})(?=.)/g, "$1\r\n ");
		}
		const ics = [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:-//HOB ResearchOps//Scheduler//EN",
			"BEGIN:VEVENT",
			`UID:${sessionId}@researchops`,
			`DTSTAMP:${fmt(new Date())}`,
			`DTSTART:${fmt(dtStart)}`,
			`DTEND:${fmt(dtEnd)}`,
			`SUMMARY:${summary}`,
			`DESCRIPTION:${desc}`,
			`LOCATION:${location}`,
			"END:VEVENT",
			"END:VCALENDAR"
		].map(foldIcs).join("\r\n") + "\r\n";

		return new Response(ics, {
			status: 200,
			headers: {
				"Content-Type": "text/calendar; charset=utf-8",
				"Content-Disposition": `attachment; filename="session-${sessionId}.ics"`,
				...this.corsHeaders(origin)
			}
		});
	}

	/**
	 * Send a communication (email/SMS) and log it.
	 * (Stub: integrate your provider here; logs to Airtable Comms Log.)
	 * @route POST /api/comms/send
	 */
	async sendComms(request, origin) {
		const body = await request.arrayBuffer();
		if (body.byteLength > this.cfg.MAX_BODY_BYTES) return this.json({ error: "Payload too large" }, 413, this.corsHeaders(origin));
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return this.json({ error: "Invalid JSON" }, 400, this.corsHeaders(origin)); }

		const missing = [];
		if (!p.participant_id) missing.push("participant_id");
		if (!p.template_id) missing.push("template_id");
		if (!p.channel) missing.push("channel");
		if (missing.length) return this.json({ error: "Missing fields: " + missing.join(", ") }, 400, this.corsHeaders(origin));

		// TODO: plug in email/SMS provider here and capture provider message_id
		const messageId = `msg_${Date.now()}`;

		// Log to Airtable Comms Log
		try {
			const base = this.env.AIRTABLE_BASE_ID;
			const table = encodeURIComponent(this.env.AIRTABLE_TABLE_COMMSLOG || "Communications Log");
			const url = `https://api.airtable.com/v0/${base}/${table}`;
			const fields = {
				"Participant": [p.participant_id],
				"Session": p.session_id ? [p.session_id] : undefined,
				"Template Id": p.template_id,
				"Channel": p.channel,
				"Sent At": new Date().toISOString(),
				"Status": "sent",
				"Metadata": JSON.stringify({ message_id: messageId, substitutions: p.substitutions || {} })
			};
			for (const k of Object.keys(fields))
				if (fields[k] === undefined) delete fields[k];
			await fetchWithTimeout(url, {
				method: "POST",
				headers: { "Authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
				body: JSON.stringify({ records: [{ fields }] })
			}, this.cfg.TIMEOUT_MS);
		} catch (e) {
			this.log.warn("comms.log.fail", { err: String(e?.message || e) });
		}

		return this.json({ ok: true, message_id: messageId }, 200, this.corsHeaders(origin));
	}
}

/* =========================
 * @section Worker entrypoint
 * ========================= */

/**
 * Default export: Cloudflare Worker `fetch` handler.
 */
export default {
	async fetch(request, env, ctx) {
		const service = new ResearchOpsService(env);
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "";

		try {
			// API routes
			if (url.pathname.startsWith("/api/")) {
				// CORS preflight
				if (request.method === "OPTIONS") {
					return new Response(null, {
						status: 204,
						headers: { ...service.corsHeaders(origin), "Access-Control-Max-Age": "600" }
					});
				}

				// Enforce ALLOWED_ORIGINS for API calls
				const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
				if (origin && !allowed.includes(origin)) {
					return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
				}

				// Route map
				/**
				 * Health check.
				 * @route GET /api/health
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:boolean, time:string }
				 */
				if (url.pathname === "/api/health") {
					return service.health(origin);
				}

				/* -------------------- Projects -------------------- */
				/**
				 * List projects (Airtable; newest-first by record.createdTime).
				 * @route GET /api/projects
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @query  { limit?:number, view?:string }
				 * @output { ok:true, projects:Array<{id:string,name:string,description:string,createdAt:string,...}> }
				 */
				if (url.pathname === "/api/projects" && request.method === "GET") {
					return service.listProjectsFromAirtable(origin, url);
				}

				/**
				 * Create project (Airtable primary + optional Details; best-effort GitHub CSV dual-write).
				 * @route POST /api/projects
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input  { org?:string, name:string, description:string, phase?:string, status?:string, objectives?:string[], user_groups?:string[], stakeholders?:any[], id?:string, lead_researcher?:string, lead_researcher_email?:string, notes?:string }
				 * @output { ok:true, project_id:string, detail_id?:string, csv_ok:boolean, csv_error?:string }
				 */
				if (url.pathname === "/api/projects" && request.method === "POST") {
					return service.createProject(request, origin);
				}

				/* --------------------- Studies -------------------- */
				/**
				 * List studies for a project (Airtable).
				 * @route GET /api/studies
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @query  { project:string } – Airtable record id of the Project
				 * @output { ok:true, studies:Array<{id:string,studyId:string,method:string,status:string,description:string,createdAt:string}> }
				 */
				if (url.pathname === "/api/studies" && request.method === "GET") {
					return service.listStudies(origin, url);
				}

				/**
				 * Create study (Airtable primary; best-effort GitHub CSV dual-write).
				 * @route POST /api/studies
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input  { project_airtable_id:string, method:string, description:string, status?:string, study_id?:string }
				 * @output { ok:true, study_id:string, csv_ok:boolean, csv_error?:string }
				 */
				if (url.pathname === "/api/studies" && request.method === "POST") {
					return service.createStudy(request, origin);
				}

				/**
				 * Update study (partial; Airtable PATCH).
				 * @route PATCH /api/studies/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @param  {string} id – Airtable record id of the Study
				 * @input  { description?:string, method?:string, status?:string, study_id?:string }
				 * @output { ok:true }
				 */
				if (url.pathname.startsWith("/api/studies/") && request.method === "PATCH") {
					const studyId = decodeURIComponent(url.pathname.slice("/api/studies/".length));
					return service.updateStudy(request, origin, studyId);
				}

				/* ---------------------- AI assist ----------------- */
				/**
				 * AI assist (rule-guided rewrite).
				 * @route POST /api/ai-rewrite
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input  { text:string } – Step 1 Description (≥400 chars)
				 * @output { summary:string, suggestions:Array<{category:string,tip:string,why:string,severity:"high"|"medium"|"low"}>, rewrite:string, flags:{possible_personal_data:boolean} }
				 */
				if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
					return aiRewrite(request, env, origin);
				}

				/* --------------------- CSV streaming -------------- */
				/**
				 * Stream Projects CSV from GitHub (best-effort).
				 * @route GET /api/projects.csv
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output text/csv
				 */
				if (url.pathname === "/api/projects.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_PROJECTS);
				}

				/**
				 * Stream Project Details CSV from GitHub (best-effort).
				 * @route GET /api/project-details.csv
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output text/csv
				 */
				if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
					return service.streamCsv(origin, env.GH_PATH_DETAILS);
				}

				/* --------------------- Guides -------------------- */
				/**
				 * List guides for a study.
				 * @route GET /api/guides?study=<StudyRecordId>
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true, guides:Array<...> }
				 */
				if (url.pathname === "/api/guides" && request.method === "GET") {
					return service.listGuides(origin, url);
				}

				/**
				 * Create guide.
				 * @route POST /api/guides
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input { study_airtable_id:string, title?:string, status?:string, version?:number, sourceMarkdown?:string, variables?:object }
				 * @output { ok:true, id:string }
				 */
				if (url.pathname === "/api/guides" && request.method === "POST") {
					return service.createGuide(request, origin);
				}

				/**
				 * Read guide.
				 * @route GET /api/guides/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true, guide:{...} }
				 */
				if (url.pathname.startsWith("/api/guides/") && request.method === "GET" && !url.pathname.endsWith("/publish")) {
					const guideId = decodeURIComponent(url.pathname.slice("/api/guides/".length));
					return service.readGuide(origin, guideId);
				}

				/**
				 * Update guide.
				 * @route PATCH /api/guides/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input { title?:string, status?:string, version?:number, sourceMarkdown?:string, variables?:object }
				 * @output { ok:true }
				 */
				if (url.pathname.startsWith("/api/guides/") && request.method === "PATCH") {
					const guideId = decodeURIComponent(url.pathname.slice("/api/guides/".length));
					return service.updateGuide(request, origin, guideId);
				}

				/**
				 * Publish a guide (status=published, version++).
				 * @route POST /api/guides/:id/publish
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true, version:number, status:"published" }
				 */
				if (
					request.method === "POST" &&
					/^\/api\/guides\/[^/]+\/publish\/?$/.test(url.pathname)
				) {
					const parts = url.pathname.split("/"); // ["", "api", "guides", ":id", "publish"]
					const guideId = decodeURIComponent(parts[3]);
					return service.publishGuide(origin, guideId);
				}

				/* --------------------- Partials -------------------- */
				/**
				 * List all partials (for pattern drawer).
				 * @route GET /api/partials
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true, partials:Array<{id, name, title, category, version, status}> }
				 */
				if (url.pathname === "/api/partials" && request.method === "GET") {
					return service.listPartials(origin);
				}

				/**
				 * Create partial.
				 * @route POST /api/partials
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input { name:string, title:string, category:string, source:string, description?:string }
				 * @output { ok:true, id:string }
				 */
				if (url.pathname === "/api/partials" && request.method === "POST") {
					return service.createPartial(request, origin);
				}

				/**
				 * Get single partial (for editing).
				 * @route GET /api/partials/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true, partial:{id, name, title, category, version, source, description, status} }
				 */
				if (url.pathname.startsWith("/api/partials/") && request.method === "GET") {
					const partialId = decodeURIComponent(url.pathname.slice("/api/partials/".length));
					return service.readPartial(origin, partialId);
				}

				/**
				 * Update partial.
				 * @route PATCH /api/partials/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @input { title?, source?, description?, status?, category? }
				 * @output { ok:true }
				 */
				if (url.pathname.startsWith("/api/partials/") && request.method === "PATCH") {
					const partialId = decodeURIComponent(url.pathname.slice("/api/partials/".length));
					return service.updatePartial(request, origin, partialId);
				}

				/**
				 * Delete partial.
				 * @route DELETE /api/partials/:id
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { ok:true }
				 */
				if (url.pathname.startsWith("/api/partials/") && request.method === "DELETE") {
					const partialId = decodeURIComponent(url.pathname.slice("/api/partials/".length));
					return service.deletePartial(origin, partialId);
				}

				/* --------------------- Participants -------------------- */
				if (url.pathname === "/api/participants" && request.method === "GET") {
					return service.listParticipants(origin, url);
				}
				if (url.pathname === "/api/participants" && request.method === "POST") {
					return service.createParticipant(request, origin);
				}

				/* ----------------------- Sessions ---------------------- */
				if (url.pathname === "/api/sessions" && request.method === "GET") {
					return service.listSessions(origin, url);
				}
				if (url.pathname === "/api/sessions" && request.method === "POST") {
					return service.createSession(request, origin);
				}
				if (url.pathname.startsWith("/api/sessions/") && request.method === "PATCH") {
					const sessionId = decodeURIComponent(url.pathname.slice("/api/sessions/".length));
					return service.updateSession(request, origin, sessionId);
				}
				if (url.pathname.startsWith("/api/sessions/") && request.method === "GET" && url.pathname.endsWith("/ics")) {
					const parts = url.pathname.split("/"); // ["", "api", "sessions", ":id", "ics"]
					const sessionId = decodeURIComponent(parts[3]);
					return service.sessionIcs(origin, sessionId);
				}

				/* ------------------------ Comms ------------------------ */
				if (url.pathname === "/api/comms/send" && request.method === "POST") {
					return service.sendComms(request, origin);
				}

				/**
				 * Unknown API path.
				 * @route * /api/**
				 * @access OFFICIAL-by-default; CORS enforced via ALLOWED_ORIGINS
				 * @output { error:"Not found" }
				 */
				return service.json({ error: "Not found" }, 404, service.corsHeaders(origin));
			}

			// Static assets with SPA fallback
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
 */
export function createMockEnv(overrides = {}) {
	return /** @type {Env} */ ({
		ALLOWED_ORIGINS: "https://researchops.pages.dev, https://rops-api.digikev-kevin-rapley.workers.dev",
		AUDIT: "false",
		AIRTABLE_BASE_ID: "app_base",
		AIRTABLE_TABLE_PROJECTS: "Projects",
		AIRTABLE_TABLE_DETAILS: "Project Details",
		AIRTABLE_TABLE_STUDIES: "Project Studies",
		AIRTABLE_TABLE_GUIDES: "Discussion Guides",
		AIRTABLE_TABLE_PARTIALS: "Partials",
		AIRTABLE_TABLE_PARTICIPANTS: "Participants",
		AIRTABLE_TABLE_SESSIONS: "Sessions",
		AIRTABLE_TABLE_COMMSLOG: "Communications Log",
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

	for (const k in init) {
		if (k !== "headers") reqInit[k] = init[k];
	}

	return new Request(`https://example.test${path}`, reqInit);
}
