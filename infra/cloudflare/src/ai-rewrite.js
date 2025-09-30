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
	return (s || "")
		.replace(/\S+@\S+/g, "[redacted]")
		.replace(/\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/gi, "[redacted]")
		.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, "[redacted]")
		.replace(/\s+/g, " ")
		.trim();
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
		const system = [
			"You assist UK Home Office user researchers.",
			"Rewrite the research project Description concisely in GOV.UK style.",
			"Do not invent facts; only use provided content.",
			"If PII appears in input, do not copy it; suggest removal.",
			"Keep rewrite <= 220 words; structure: Problem → Users & Inclusion → Outcomes & Measures → Ethics & Method."
		].join(" ");

		const rules = [
			"Reframe problem as user need; one-line in/out of scope.",
			"Name primary users + contexts; add inclusion (accessibility, device, language).",
			"Set SMART outcomes (number + timeframe).",
			"Assumptions as hypotheses; note risks/constraints.",
			"Privacy: consent, retention, DPIA/DPS; avoid PII.",
			"Method fit to maturity (discovery vs alpha).",
			"Style: expand acronyms; avoid jargon/hedging; short sentences.",
			"Clarity: three-part structure; remove duplication."
		].join(" ");

		const instr = `Return strict JSON with keys: summary, suggestions (array of {category, tip, why, severity}), rewrite.
Limit suggestions to ${this.cfg.MAX_SUGGESTIONS} items, each <= ${this.cfg.MAX_SUGGESTION_LEN} chars.
Rewrite must not contain emails, NI, or NHS numbers.`;

		let modelOutput = "";
		try {
			const resp = await this.env.AI.run(model, {
				messages: [
					{ role: "system", content: system },
					{ role: "user", content: `${rules}\n\n${instr}\n\nINPUT:\n${input}` }
				],
				temperature: 0.2,
				max_tokens: 800
			});

			modelOutput = typeof resp === "string" ? resp : (resp?.response || resp?.result || "");
		} catch (e) {
			// Optional audit (no raw content)
			if (this.env.AUDIT === "true") {
				console.warn("ai.run.fail", { err: String(e?.message || e) });
			}
			return json({ error: "AI_UNAVAILABLE" }, 503, corsHeaders(this.env, origin));
		}

		// Parse + clamp + sanitize
		const parsed = safeParseJSON(modelOutput);
		const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, this.cfg.MAX_SUGGESTIONS).map(s => ({
			category: typeof s?.category === "string" ? s.category : "General",
			tip: clamp(typeof s?.tip === "string" ? s.tip : "", this.cfg.MAX_SUGGESTION_LEN),
			why: clamp(typeof s?.why === "string" ? s.why : "", this.cfg.MAX_SUGGESTION_LEN),
			severity: ["high", "medium", "low"].includes(s?.severity) ? s.severity : "medium"
		})) : [];

		let rewrite = sanitizeRewrite(clamp(typeof parsed.rewrite === "string" ? parsed.rewrite : "", this.cfg.MAX_REWRITE_CHARS));

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
							fields: {
								ts: new Date().toISOString(),
								trigger: "ai",
								char_bucket: Math.floor(input.length / 200) * 200,
								suggestion_count: suggestions.length,
								pii_detected: !!hasPII
							}
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