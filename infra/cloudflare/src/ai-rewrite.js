/**
 * @file ai-rewrite.js
 * @module AiRewrite
 * @summary Cloudflare Worker AI endpoint for rule-guided rewrites (Description & Objectives).
 * @description
 * Exposes:
 * - `POST /api/ai-rewrite`
 *   Payload:
 *     { mode: "description"|"objectives", text: string }
 *     - description: ≥ 400 chars (Step 1)
 *     - objectives:  ≥ 200 chars (Step 2)
 *   Returns:
 *     {
 *       summary: string,
 *       suggestions: Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>,
 *       rewrite: string,
 *       flags: { possible_personal_data: boolean }
 *     }
 *
 * Design:
 * - Uses Cloudflare Workers AI via `env.AI.run(model, ...)`
 * - OFFICIAL-by-default (no third-party calls)
 * - Hard clamps for input/output length, strict JSON shaping
 * - PII sweep (email, NI, NHS) and counters-only Airtable logging
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
 * @property {any}    AI Cloudflare Workers AI binding (env.AI.run).
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
 *   MIN_OBJECTIVES_CHARS:number,
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
	MIN_TEXT_CHARS: 400, // Step 1: Description
	MIN_OBJECTIVES_CHARS: 200, // Step 2: Initial Objectives
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
 * Sanitize rewrite for PII and whitespace/newlines.
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
 * @section Shared prompts (exported for reuse)
 * ========================= */

/**
 * High-level base instruction shared by both Description and Objectives modes.
 * @constant
 * @name BASE_SYSTEM_PROMPT
 * @type {string}
 */
export const BASE_SYSTEM_PROMPT = [
	"You assist UK Home Office user researchers.",
	"Use GOV.UK style: plain English, short sentences, accessible to all.",
	"Only use facts from the provided input; never invent new details.",
	"If personal data appears, do not repeat it; instead advise removal.",
	"Output must be strictly JSON. Do not include markdown, code fences, or explanatory prose.",
	"If any field would be empty, return an empty string — never omit required keys."
].join(" ");

/**
 * Description-specific system prompt (Step 1).
 * @constant
 * @name DESC_SYSTEM_PROMPT
 * @type {string}
 */
export const DESC_SYSTEM_PROMPT = [
	BASE_SYSTEM_PROMPT,
	"Rewrite a research project Description.",
	"Structure the rewrite into labelled sections only if the input supports them.",
	"Section format: Label on its own line with a colon, content on the next line(s),",
	"then one blank line before the next section. Do not include unused labels.",
	"Typical sections you may include: Problem, Scope, Users, Outcomes, Ethics, Method, Assumptions & Risks, Context, Stakeholders, Research Questions, Timeline, Recruitment, Data Handling, Success Criteria."
].join(" ");

/**
 * Objectives-specific system prompt (Step 2).
 * @constant
 * @name OBJ_SYSTEM_PROMPT
 * @type {string}
 */
export const OBJ_SYSTEM_PROMPT = [
	BASE_SYSTEM_PROMPT,
	"Rewrite and refine 'Initial Objectives' for a new research project.",
	"Group into clear, numbered objectives where possible.",
	"Apply SMART where detail exists (specific, measurable, achievable, relevant, time-bound).",
	"Avoid adding brand-new aims; only clarify or tighten what is present."
].join(" ");

/* =========================
 * @section Mode rules
 * ========================= */

/**
 * Build the RULES prompt per mode.
 * @function rulesPromptForMode
 * @param {"description"|"objectives"} mode
 * @returns {string}
 */
function rulesPromptForMode(mode) {
	if (mode === "description") {
		return [
			"Rules (Description):",
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
	}
	
	if (mode === "objectives") {
		return [
			"Rules (Objectives):",
			"01) Split into 3–6 concise, numbered objectives when possible.",
			"02) Make each objective action-oriented (start with a verb).",
			"03) Apply SMART if the input allows: include measurable targets and timeframes.",
			"04) Include any constraints, dependencies, or risks if mentioned.",
			"05) Keep scope aligned to the service phase and project status if present in the input.",
			"06) Avoid PII; if present, advise removal in suggestions.",
			"07) Use GOV.UK style: plain English, short sentences, expanded acronyms.",
			"08) If there is ambiguity, keep the objective clear but do not invent details."
		].join("\n");
	}

	// Fallback if an unknown mode sneaks through
	return "No rules available for this mode.";
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

		/** @type {{text?:unknown, mode?:unknown}} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: "Invalid JSON" }, 400, corsHeaders(this.env, origin)); }

		const rawMode = typeof payload.mode === "string" ? payload.mode : "description";
		/** @type {"description"|"objectives"} */
		const mode = rawMode.toLowerCase() === "objectives" ? "objectives" : "description";

		const text = typeof payload.text === "string" ? payload.text : "";
		const minChars = mode === "objectives" ? this.cfg.MIN_OBJECTIVES_CHARS : this.cfg.MIN_TEXT_CHARS;
		if (text.trim().length < minChars) {
			return json({ error: `MIN_LENGTH_${minChars}` }, 400, corsHeaders(this.env, origin));
		}

		const hasPII = detectPII(text);
		const input = clamp(text, this.cfg.MAX_INPUT_CHARS);
		const model = this.env.MODEL || this.cfg.MODEL_FALLBACK;

		// Prompts
		const SYSTEM_PROMPT = mode === "objectives" ? OBJ_SYSTEM_PROMPT : DESC_SYSTEM_PROMPT;
		const RULES_PROMPT = rulesPromptForMode(mode);

		// Output schema/instructions remain the same for both modes
		/** @const {string} */
		const OUTPUT_SCHEMA_STR = JSON.stringify({
			summary: "string (<= 300 chars). Brief overview of what to improve.",
			suggestions: [{
				category: "string (e.g., 'Style', 'Users & inclusion', 'Outcomes & measures', 'Scope', 'Risks')",
				tip: "string (<= 160 chars). Concrete edit or addition.",
				why: "string (<= 160 chars). Rationale for the tip.",
				severity: "one of: 'high' | 'medium' | 'low'"
			}],
			rewrite: [
				"string (<= 1800 chars).",
				mode === "objectives" ?
				"A numbered list of refined objectives when supported by the input; keep each objective concise and measurable where possible." :
				"Concise, PII-free rewrite using labelled sections WHEN SUPPORTED by the input. Each section starts with a label on its own line (with a colon), then content on the next line(s), and one blank line between sections. Only include sections if supported by the input."
			].join(" ")
		}, null, 2);

		/** @const {string} */
		const OUTPUT_EXAMPLE = JSON.stringify(
			mode === "objectives" ? {
				summary: "Tighten objectives; add measurable targets and timeframes.",
				suggestions: [
					{ category: "Measurability", tip: "Add numeric targets to 2 objectives.", why: "Enables progress tracking.", severity: "high" },
					{ category: "Clarity", tip: "Start each objective with an action verb.", why: "Improves readability.", severity: "medium" }
				],
				rewrite: "1) Identify the top 3 blockers in the account proofing journey by end of Q2.\n2) Increase task completion for the ID check step by 15% within 3 months.\n3) Validate the revised error messages with at least 8 participants using screen readers.\n4) Produce a prioritised backlog of improvements agreed with policy and service design."
			} : {
				summary: "Clarify scope and outcomes; surface research questions; avoid PII.",
				suggestions: [
					{ category: "Scope", tip: "State what is in and out of scope.", why: "Prevents drift and sets clear boundaries.", severity: "high" },
					{ category: "Research questions", tip: "List 2–4 key questions.", why: "Focuses method and analysis.", severity: "medium" },
					{ category: "Outcomes & measures", tip: "Add a numeric target with a timeframe.", why: "Enables tracking of success.", severity: "high" }
				],
				rewrite: "Problem:\nApplicants abandon the address step because instructions and error messages are unclear.\n\nScope:\nIn scope: address capture and validation screens in the online flow. Out of scope: payment provider changes.\n\nUsers:\nFirst-time visa applicants on mobile, including people using screen readers and with low bandwidth.\n\nOutcomes:\nIdentify the top 3 blockers and reduce abandonment by 15% within the next quarter."
			}, null, 2
		);

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

		// ---- Model call
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
			if (this.env.AUDIT === "true") {
				console.warn("ai.run.fail", { err: String(e?.message || e) });
			}
			return json({ error: "AI_UNAVAILABLE", message: "The AI service is temporarily unavailable." },
				503,
				corsHeaders(this.env, origin)
			);
		}

		// Trim any accidental prose around JSON
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
				severity: ["high", "medium", "low"].includes(s?.severity) ? s?.severity : "medium"
			}))
			.filter(s => s.tip.trim().length > 0) : [];

		let rewrite = sanitizeRewrite(
			clamp(typeof parsed.rewrite === "string" ? parsed.rewrite : "", this.cfg.MAX_REWRITE_CHARS)
		);

		// Minimal safe fallback to keep UI consistent (do not invent details)
		if (!rewrite) {
			rewrite = mode === "objectives" ?
				"1) [Refine an objective with a measurable target and timeframe].\n2) [Clarify another objective; keep it action-oriented]." :
				"Problem: [clarify user need and scope].\n\nUsers: [name primary users and contexts, including accessibility].\n\nOutcomes: [add a measurable target and timeframe].";
		}

		// Final PII sweep on rewrite
		if (detectPII(rewrite)) {
			rewrite = sanitizeRewrite(rewrite);
		}

		const body = {
			summary: typeof parsed.summary === "string" ? clamp(parsed.summary, 300) : (
				mode === "objectives" ?
				"Suggestions to strengthen your Initial Objectives" :
				"Suggestions to strengthen your Description"
			),
			suggestions,
			rewrite,
			flags: { possible_personal_data: hasPII }
		};

		// Counters-only log to Airtable (best-effort; no raw text)
		// Fields: ts, trigger, char_bucket, suggestion_count, pii_detected
		(async () => {
			try {
				if (this.env.AIRTABLE_BASE_ID && this.env.AIRTABLE_API_KEY && this.env.AIRTABLE_TABLE_AI_LOG) {
					await fetch(
						`https://api.airtable.com/v0/${this.env.AIRTABLE_BASE_ID}/${encodeURIComponent(this.env.AIRTABLE_TABLE_AI_LOG)}`, {
							method: "POST",
							headers: {
								"authorization": `Bearer ${this.env.AIRTABLE_API_KEY}`,
								"content-type": "application/json"
							},
							body: JSON.stringify({
								records: [{
									fields: {
										ts: new Date().toISOString(),
										trigger: mode === "objectives" ? "ai:obj" : "ai:desc",
										char_bucket: Math.max(0, Math.floor(input.length / 200) * 200),
										suggestion_count: suggestions.length,
										pii_detected: !!hasPII
									}
								}]
							})
						}
					);
				}
			} catch (e) {
				if (this.env.AUDIT === "true") {
					console.warn("airtable.ai_log.fail", { err: String(e?.message || e) });
				}
			}
		})();

		if (this.env.AUDIT === "true") {
			console.log("ai.rewrite.ok", {
				mode,
				len: input.length,
				sugg: suggestions.length,
				pii: hasPII,
				out: safeText(rewrite)
			});
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
 * const req = makeJsonRequest("/api/ai-rewrite", { mode:"description", text: "x".repeat(420) });
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
