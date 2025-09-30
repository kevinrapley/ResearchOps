/**
 * @file ai-rewrite.js
 * @module AiRewrite
 * @summary Cloudflare Worker AI endpoint for rule-guided Description rewrites.
 * @description
 * Exposes:
 * - `POST /api/ai-rewrite`:
 *   Input:  { text:string } (≥ 400 chars)
 *   Output: { summary:string, suggestions:Array<{category,tip,why,severity}>, rewrite:string, flags:{possible_personal_data:boolean} }
 *
 * Design:
 * - Uses Cloudflare Workers AI via `env.AI.run(model, ...)`.
 * - Enforces OFFICIAL-by-default handling, no third-party calls.
 * - Hard token/length clamps, PII sweep, and counters-only Airtable logging.
 *
 * @requires globalThis.fetch
 * @requires globalThis.Request
 * @requires globalThis.Response
 *
 * @typedef {Object} Env
 * @property {string} ALLOWED_ORIGINS Comma-separated list of allowed origins for CORS.
 * @property {string} AUDIT "true" to enable audit logs; otherwise "false".
 * @property {string} AIRTABLE_BASE_ID Airtable base ID.
 * @property {string} AIRTABLE_API_KEY Airtable API token.
 * @property {string} [AIRTABLE_TABLE_AI_LOG] Optional Airtable table for counters-only AI usage logs (e.g., "AI_Usage").
 * @property {string} [MODEL] Workers AI model name (e.g., "@cf/meta/llama-3.1-8b-instruct").
 * @property {any}    AI Cloudflare Workers AI binding.
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
 *   MAX_BODY_BYTES:number,
 *   MIN_TEXT_CHARS:number,
 *   MAX_INPUT_CHARS:number,
 *   MAX_SUGGESTIONS:number,
 *   MAX_SUGGESTION_LEN:number,
 *   MAX_REWRITE_CHARS:number,
 *   MODEL_FALLBACK:string
 * }>}
 * @default
 * @inner
 */
const DEFAULTS = Object.freeze({
	TIMEOUT_MS: 10_000,
	MAX_BODY_BYTES: 512 * 1024,
	MIN_TEXT_CHARS: 400,
	MAX_INPUT_CHARS: 5000,
	MAX_SUGGESTIONS: 8,
	MAX_SUGGESTION_LEN: 160,
	MAX_REWRITE_CHARS: 1800, // ~220 words
	MODEL_FALLBACK: "@cf/meta/llama-3.1-8b-instruct"
});

/* =========================
 * @section Helper functions
 * ========================= */

/**
 * Build CORS headers for the given origin based on ALLOWED_ORIGINS.
 * @function corsHeaders
 * @inner
 * @param {Env} env
 * @param {string} origin
 * @returns {Record<string,string>}
 */
function corsHeaders(env, origin) {
	const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
	const h = {
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400",
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
function json(body, status = 200, headers = {}) {
	const hdrs = Object.assign({ "Content-Type": "application/json" }, headers || {});
	return new Response(JSON.stringify(body), { status, headers: hdrs });
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
 * Clamp a string to max length (safe for undefined).
 * @function clamp
 * @inner
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
function clamp(s, n) {
	return (s || "").slice(0, n);
}

/**
 * Safe JSON.parse returning {} on failure.
 * @function safeParseJSON
 * @inner
 * @param {string} s
 * @returns {any}
 */
function safeParseJSON(s) {
	try { return JSON.parse(s); } catch { return {}; }
}

/**
 * Detect potential PII patterns (email, NI, NHS).
 * @function detectPII
 * @inner
 * @param {string} text
 * @returns {boolean}
 */
function detectPII(text) {
	const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
	const NI = /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i;
	const NHS = /\b\d{3}\s?\d{3}\s?\d{4}\b/;
	return EMAIL.test(text) || NI.test(text) || NHS.test(text);
}

/**
 * Sanitize rewrite for obvious PII remnants and whitespace.
 * @function sanitizeRewrite
 * @inner
 * @param {string} s
 * @returns {string}
 */
function sanitizeRewrite(s) {
	let out = String(s || "");
	// PII redaction
	out = out.replace(/\S+@\S+/g, "[redacted]")
		.replace(/\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/gi, "[redacted]")
		.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, "[redacted]");
	// Normalise newlines and trim line endings
	out = out.replace(/\r\n?/g, "\n")
		.split("\n").map(l => l.trimEnd()).join("\n")
		.replace(/\n{3,}/g, "\n\n") // collapse 3+ blanks to 2
		.trim();
	return out;
}

/* =========================
 * @section Service
 * ========================= */

/**
 * AI rewrite service (rule-guided; Workers AI).
 * @class AiRewriteService
 * @public
 * @inner
 */
class AiRewriteService {
	/**
	 * Construct the service.
	 * @constructs AiRewriteService
	 * @param {Env} env
	 * @param {{cfg?:Partial<typeof DEFAULTS>}} [opts]
	 */
	constructor(env, opts = {}) {
		/** @public @readonly */
		this.env = env;
		/** @public @readonly */
		this.cfg = Object.freeze({ ...DEFAULTS, ...(opts.cfg || {}) });
	}

	/**
	 * Handle POST /api/ai-rewrite
	 * @async
	 * @function handle
	 * @param {Request} request
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 */
	async handle(request, origin) {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders(this.env, origin) });
		}
		if (request.method !== "POST") {
			return json({ error: "Method Not Allowed" }, 405, corsHeaders(this.env, origin));
		}

		// Enforce ALLOWED_ORIGINS
		const allowed = (this.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
		if (origin && !allowed.includes(origin)) {
			return json({ error: "Origin not allowed" }, 403, corsHeaders(this.env, origin));
		}

		// Body guardrails
		const buf = await request.arrayBuffer();
		if (buf.byteLength > this.cfg.MAX_BODY_BYTES) {
			return json({ error: "Payload too large" }, 413, corsHeaders(this.env, origin));
		}

		/** @type {{text?:unknown}} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: "Invalid JSON" }, 400, corsHeaders(this.env, origin)); }

		const text = typeof payload.text === "string" ? payload.text : "";
		if (text.trim().length < this.cfg.MIN_TEXT_CHARS) {
			return json({ error: "MIN_LENGTH_400" }, 400, corsHeaders(this.env, origin));
		}

		const hasPII = detectPII(text);
		const input = clamp(text, this.cfg.MAX_INPUT_CHARS);
		const model = this.env.MODEL || this.cfg.MODEL_FALLBACK;

		// Policy & rules (kept concise to preserve tokens)

		/** @const {string} */
		const SYSTEM_PROMPT = [
			"You assist UK Home Office user researchers.",
			"Rewrite a research project Description using GOV.UK style.",
			"Only use facts from the provided input; never invent new details.",
			"If PII appears in the input, do not repeat it; instead advise removal.",
			"Structure the rewrite into labelled sections only if the input supports them.",
			"Section format: Label on its own line with a colon, content on the next line(s),",
			"then one blank line before the next section. Do not include unused labels.",
			"Typical sections you may include: Problem, Scope, Users, Outcomes, Ethics, Method, Assumptions & Risks, Context, Stakeholders, Research Questions, Timeline, Recruitment, Data Handling, Success Criteria.",
			"Output must be strictly JSON. Do not include markdown, code fences, or explanatory prose.",
			"If any field would be empty, return an empty string for it — never omit required keys."
		].join(" ");

		/** @const {string} */
		const RULES_PROMPT = [
			"Rules you must apply:",
			"01) Problem framing: restate as a user need; add one line each for in-scope/out-of-scope if the input mentions them.",
			"02) Users & inclusion: name primary users and contexts; mention inclusion (accessibility, device, language) if present.",
			"03) Outcomes & measures: include SMART outcomes with a number and timeframe where available.",
			"04) Assumptions & risks: capture as hypotheses; note constraints or dependencies.",
			"05) Ethics: summarise consent, retention, DPIA/DPS; remove or flag PII.",
			"06) Method: fit to maturity (discovery vs alpha) if described.",
			"07) Context: include policy drivers, service phase, organisational context if described.",
			"08) Stakeholders: list key people or teams to involve if given.",
			"09) Research questions: capture explicit questions the project will address.",
			"10) Artefacts/Deliverables: outputs such as maps, prototypes, reports if stated.",
			"11) Timeline: milestones or expected timeframe if available.",
			"12) Recruitment: sample, accessibility needs, demographics if mentioned.",
			"13) Data handling: storage, retention, sharing rules if described.",
			"14) Success criteria: capture what 'good' looks like if stated.",
			"15) Style: expand acronyms; use plain English; short sentences.",
			"16) Clarity: remove duplication; structure content under clear headings.",
			"",
			"Include only sections where the input contains relevant content. Never invent details."
		].join("\n");

		/** @const {string} */
		const OUTPUT_SCHEMA_STR = JSON.stringify({
			summary: "string (<= 300 chars). Brief overview of what to improve.",
			suggestions: [{
				category: "string (e.g., 'Style', 'Users & inclusion', 'Outcomes & measures')",
				tip: "string (<= 160 chars). Concrete edit or addition.",
				why: "string (<= 160 chars). Rationale for the tip.",
				severity: "one of: 'high' | 'medium' | 'low'"
			}],
			rewrite: [
				"string (<= 1800 chars). Concise, PII-free rewrite using labelled sections WHEN SUPPORTED by the input.",
				"Format: each section starts with a capitalised label followed by a colon on its own line,",
				"then the content on the next line(s). Insert one blank line between sections.",
				"Only include sections if input/rules provide relevant content — do NOT invent facts.",
				"Typical labels you MAY use: Problem, Scope, Users, Outcomes, Ethics, Method, Assumptions & Risks,",
				"Context, Stakeholders, Research Questions, Timeline, Recruitment, Data Handling, Success Criteria.",
				"Style: plain English; expand acronyms; short sentences; no placeholders (e.g., 'TBD')."
			].join(" ")
		}, null, 2);

		/** @const {string} */
		const OUTPUT_EXAMPLE = JSON.stringify({
			summary: "Clarify scope and outcomes; surface research questions; avoid PII.",
			suggestions: [{
					category: "Scope",
					tip: "State what is in and out of scope.",
					why: "Prevents drift and sets clear boundaries.",
					severity: "high"
				},
				{
					category: "Research questions",
					tip: "List 2–4 questions the study must answer.",
					why: "Focuses method and analysis.",
					severity: "medium"
				},
				{
					category: "Outcomes & measures",
					tip: "Add a numeric target with a timeframe.",
					why: "Enables tracking of success.",
					severity: "high"
				},
				{
					category: "Style",
					tip: "Use short sentences and expand acronyms.",
					why: "Improves GOV.UK clarity.",
					severity: "low"
				}
			],
			rewrite: "Problem:\n" +
				"Applicants abandon the address step because instructions and error messages are unclear.\n" +
				"\n" +
				"Scope:\n" +
				"In scope: address capture and validation screens in the online flow. Out of scope: payment provider changes.\n" +
				"\n" +
				"Users:\n" +
				"First-time visa applicants on mobile, including people using screen readers and with low bandwidth.\n" +
				"\n" +
				"Research questions:\n" +
				"• Which parts of the address step cause confusion?\n" +
				"• What wording and ordering improve completion?\n" +
				"• What accessibility issues appear on mobile devices?\n" +
				"\n" +
				"Outcomes:\n" +
				"Identify the top 3 blockers and reduce abandonment by 15% within the next quarter.\n" +
				"\n" +
				"Method:\n" +
				"Discovery interviews (≈12) and remote task-based usability on a clickable prototype, followed by a synthesis workshop.\n" +
				"\n" +
				"Timeline:\n" +
				"Fieldwork in November; synthesis in early December."
		}, null, 2);

		/** @const {string} */
		const INSTRUCTIONS = [
			"Return JSON ONLY, matching this schema:",
			OUTPUT_SCHEMA_STR,
			"",
			"Constraints:",
			`- suggestions: max ${DEFAULTS.MAX_SUGGESTIONS} items; each tip/why <= ${DEFAULTS.MAX_SUGGESTION_LEN} chars; include a balanced mix across categories.`,
			`- rewrite: <= ${DEFAULTS.MAX_REWRITE_CHARS} chars; remove emails/NI/NHS numbers; no placeholders like 'lorem' or 'TBD'.`,
			"- Do not include markdown, code fences, or any text outside JSON.",
			"",
			"If unsure, still return valid JSON using best-effort values. Here is a minimal valid example:",
			OUTPUT_EXAMPLE,
			"",
			"INPUT (verbatim):"
		].join("\n");

		let modelOutput = "";
		try {
			const resp = await this.env.AI.run(model, {
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: `${RULES_PROMPT}\n\n${INSTRUCTIONS}\n${input}` }
				],
				temperature: 0.2,
				max_tokens: 900
			});

			modelOutput = typeof resp === "string" ? resp : (resp?.response || resp?.result || "");
		} catch (e) {
			// Optional audit (no raw content)
			if (this.env.AUDIT === "true") {
				console.warn("ai.run.fail", { err: String(e?.message || e) });
			}
			return json({ error: "AI_UNAVAILABLE", message: "The AI service is temporarily unavailable." },
				503,
				corsHeaders(this.env, origin)
			);
		}

		// Before safeParseJSON(modelOutput):
		const first = modelOutput.indexOf("{");
		const last = modelOutput.lastIndexOf("}");
		if (first !== -1 && last !== -1 && last > first) {
			modelOutput = modelOutput.slice(first, last + 1);
		}

		// Parse + clamp + sanitize
		const parsed = safeParseJSON(modelOutput);
		const suggestions = Array.isArray(parsed.suggestions) ?
			parsed.suggestions
			.slice(0, this.cfg.MAX_SUGGESTIONS)
			.map(s => ({
				category: typeof s?.category === "string" ? s.category : "General",
				tip: clamp(typeof s?.tip === "string" ? s.tip : "", this.cfg.MAX_SUGGESTION_LEN),
				why: clamp(typeof s?.why === "string" ? s.why : "", this.cfg.MAX_SUGGESTION_LEN),
				severity: ["high", "medium", "low"].includes(s?.severity) ? s.severity : "medium"
			}))
			.filter(s => s.tip.trim().length > 0) : [];

		let rewrite = sanitizeRewrite(clamp(typeof parsed.rewrite === "string" ? parsed.rewrite : "", this.cfg.MAX_REWRITE_CHARS));

		if (!rewrite) {
			// brief, safe fallback – keeps UI consistent without inventing content
			rewrite = "Problem: [clarify the user need and scope]. Users & inclusion: [name primary users and contexts; include accessibility]. Outcomes: [add measurable target and timeframe]. Ethics: [consent, retention, DPIA; no PII]. Method: [fit to maturity].";
		}

		// Final PII sweep on rewrite
		if (detectPII(rewrite)) {
			rewrite = sanitizeRewrite(rewrite);
		}

		const body = {
			summary: typeof parsed.summary === "string" ? clamp(parsed.summary, 300) : "Suggestions to strengthen your Description",
			suggestions,
			rewrite,
			flags: { possible_personal_data: hasPII }
		};

		// Counters-only log to Airtable (best-effort; no raw text)
		// Fields: ts (ISO), trigger, char_bucket, suggestion_count, pii_detected
		(async () => {
			try {
				if (this.env.AIRTABLE_BASE_ID && this.env.AIRTABLE_API_KEY && this.env.AIRTABLE_TABLE_AI_LOG) {
					await fetch(`https://api.airtable.com/v0/${this.env.AIRTABLE_BASE_ID}/${encodeURIComponent(this.env.AIRTABLE_TABLE_AI_LOG)}`, {
						method: "POST",
						headers: {
							"authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
							"content-type": "application/json"
						},
						body: JSON.stringify({
							records: [{
								fields: {
									ts: new Date().toISOString(),
									trigger: "ai",
									char_bucket: Math.max(0, Math.floor(input.length / 200) * 200),
									suggestion_count: suggestions.length,
									pii_detected: !!hasPII
								}
							}]
						})
					});
				}
			} catch (e) {
				if (this.env.AUDIT === "true") {
					console.warn("airtable.ai_log.fail", { err: String(e?.message || e) });
				}
			}
		})();

		if (this.env.AUDIT === "true") {
			console.log("ai.rewrite.ok", { len: input.length, sugg: suggestions.length, pii: hasPII, out: safeText(rewrite) });
		}

		return json(body, 200, corsHeaders(this.env, origin));
	}
}

/* =========================
 * @section Route adapter
 * ========================= */

/**
 * Named handler you can import from worker.js router.
 * @async
 * @function aiRewrite
 * @param {Request} request
 * @param {Env} env
 * @param {string} origin
 * @returns {Promise<Response>}
 *
 * @example
 * // worker.js
 * import { aiRewrite } from './ai-rewrite.js';
 * if (url.pathname === '/api/ai-rewrite') return aiRewrite(request, env, origin);
 */
export async function aiRewrite(request, env, origin) {
	const svc = new AiRewriteService(env);
	return svc.handle(request, origin);
}

/* =========================
 * @section Worker entrypoint (standalone test)
 * ========================= */

/**
 * Default export: Cloudflare Worker `fetch` handler (standalone mode).
 * In your main worker, prefer the named `aiRewrite` export.
 */
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin") || "";
		if (url.pathname === "/api/ai-rewrite") {
			return aiRewrite(request, env, origin);
		}
		// Soft 404 to make it clear this file is for the single route.
		return json({ error: "Not found" }, 404, corsHeaders(env, origin));
	}
};

/* =========================
 * @section Test utilities (named exports)
 * ========================= */

/**
 * Create a minimal mock Env for unit tests.
 * @function createMockEnv
 * @param {Partial<Env>} overrides
 * @returns {Env}
 */
export function createMockEnv(overrides = {}) {
	return /** @type {Env} */ ({
		ALLOWED_ORIGINS: "https://researchops.pages.dev, https://rops-api.example.workers.dev",
		AUDIT: "false",
		AIRTABLE_BASE_ID: "app_base",
		AIRTABLE_API_KEY: "key",
		AIRTABLE_TABLE_AI_LOG: "AI_Usage",
		MODEL: "@cf/meta/llama-3.1-8b-instruct",
		AI: { run: async () => JSON.stringify({ summary: "ok", suggestions: [], rewrite: "example" }) },
		...overrides
	});
}

/**
 * Build a JSON Request for tests.
 * @function makeJsonRequest
 * @example
 * const req = makeJsonRequest("/api/ai-rewrite", { text: "x".repeat(420) });
 */
export function makeJsonRequest(path, body, init = {}) {
	const reqInit = {
		method: "POST",
		headers: Object.assign({ "Content-Type": "application/json" }, init.headers || {}),
		body: JSON.stringify(body)
	};
	for (const k in init) {
		if (k !== "headers") reqInit[k] = init[k];
	}
	return new Request(`https://example.test${path}`, reqInit);
}
