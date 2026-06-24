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
 *     - objectives:  ≥ 60 chars (Step 2)
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
 * - Hard clamps for input length and suggestion fields, strict JSON shaping
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

import { DEFAULTS } from "./ai-rewrite/config.js";
import { buildFallbackResponse } from "./ai-rewrite/fallback.js";
import { auditForBias, neutraliseInventedMethods, neutraliseInventedQuantifiers } from "./ai-rewrite/guardrails.js";
import { corsHeaders, isAllowedOrigin, json } from "./ai-rewrite/http.js";
import { DESC_SYSTEM_PROMPT, OBJ_SYSTEM_PROMPT, rulesPromptForMode, SUGGESTION_LIBRARY } from "./ai-rewrite/prompts.js";
import { clamp, detectPII, safeParseJSON, safeText, sanitizeRewrite } from "./ai-rewrite/text.js";

export { BASE_SYSTEM_PROMPT, DESC_SYSTEM_PROMPT, OBJ_SYSTEM_PROMPT } from "./ai-rewrite/prompts.js";
export { createMockEnv, makeJsonRequest } from "./ai-rewrite/testing.js";

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
		if (!isAllowedOrigin(this.env, origin)) {
			return json({ error: "Origin not allowed" }, 403, corsHeaders(this.env, origin));
		}

		// Identify mode from query (?mode=description|objectives)
		const url = new URL(request.url);
		const qMode = (url.searchParams.get("mode") || "description").toLowerCase();
		/** @type {"description"|"objectives"} */
		const mode = (qMode === "objectives") ? "objectives" : "description";

		// Body guardrails
		const buf = await request.arrayBuffer();
		if (buf.byteLength > this.cfg.MAX_BODY_BYTES) {
			return json({ error: "Payload too large" }, 413, corsHeaders(this.env, origin));
		}

		/** @type {{text?:unknown}} */
		let payload;
		try { payload = JSON.parse(new TextDecoder().decode(buf)); } catch { return json({ error: "Invalid JSON" }, 400, corsHeaders(this.env, origin)); }

		const text = typeof payload.text === "string" ? payload.text : "";

		// Mode-specific minimum length
		const minChars = (mode === "objectives") ? this.cfg.MIN_OBJ_TEXT_CHARS : this.cfg.MIN_TEXT_CHARS;
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
				"string.",
				mode === "objectives" ?
				"Markdown numbered list of refined objectives when supported by the input; keep each objective concise and measurable where possible." :
				"Concise, PII-free markdown rewrite using level 2 headings and short paragraphs or bullet lists. Use sections such as Research focus, Scope, Users and context, Research questions, Method and inclusion, Deliverables, Outcomes, Data handling and Success criteria. Do not use markdown tables."
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
				rewrite: "1. Identify the top 3 blockers in the account proofing journey by end of Q2.\n2. Increase task completion for the ID check step by 15% within 3 months.\n3. Validate the revised error messages with at least 8 participants using screen readers.\n4. Produce a prioritised backlog of improvements agreed with policy and service design."
			} : {
				summary: "Clarify scope and outcomes; surface research questions; avoid PII.",
				suggestions: [
					{ category: "Scope", tip: "State what is in and out of scope.", why: "Prevents drift and sets clear boundaries.", severity: "high" },
					{ category: "Research questions", tip: "List 2–4 key questions.", why: "Focuses method and analysis.", severity: "medium" },
					{ category: "Outcomes & measures", tip: "Add a numeric target with a timeframe.", why: "Enables tracking of success.", severity: "high" }
				],
				rewrite: "## Research focus\n\nApplicants abandon the address step because instructions and error messages are unclear.\n\n## Scope\n\n- In scope: address capture and validation screens in the online flow.\n- Out of scope: payment provider changes.\n\n## Users and context\n\nFirst-time visa applicants on mobile, including people using screen readers and with low bandwidth.\n\n## Outcomes\n\nIdentify the top 3 blockers and reduce abandonment by 15% within the next quarter."
			}, null, 2
		);

		/**
		 * Provide the curated suggestion library so the model can pick relevant items.
		 * Keep it after the schema/example to bias structured outputs first.
		 * @const {string}
		 */
		const SUGGESTION_GUIDANCE = [
			"Use the following suggestion patterns only if they apply to the input:",
			SUGGESTION_LIBRARY
		].join("\n\n");

		/** @const {string} */
		const INSTRUCTIONS = [
			"Return JSON ONLY, matching this schema:",
			OUTPUT_SCHEMA_STR,
			"",
			"Constraints:",
			`- suggestions: max ${DEFAULTS.MAX_SUGGESTIONS} items; each tip/why <= ${DEFAULTS.MAX_SUGGESTION_LEN} chars; include a balanced mix across categories.`,
			"- rewrite: include the complete rewrite in full; markdown is allowed inside rewrite; remove emails/NI/NHS numbers; no placeholders like 'lorem' or 'TBD'.",
			"- Do not include markdown code fences or any text outside JSON.",
			"",
			"If unsure, still return valid JSON using best-effort values. Here is a minimal valid example:",
			OUTPUT_EXAMPLE,
			"",
			SUGGESTION_GUIDANCE,
			"",
			"INPUT (verbatim):"
		].join("\n");

		const fallbackBody = () => buildFallbackResponse({ mode, input, hasPII, cfg: this.cfg });

		// ---- Model call
		let modelOutput = "";
		if (!this.env.AI || typeof this.env.AI.run !== "function") {
			if (this.env.AUDIT === "true") {
				console.warn("ai.run.missing_binding", { mode });
			}
			return json(fallbackBody(), 200, corsHeaders(this.env, origin));
		}

		try {
			const resp = await this.env.AI.run(model, {
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: `${RULES_PROMPT}\n\n${INSTRUCTIONS}\n${input}` }
				],
				temperature: 0.15, // tightened for determinism
				top_p: 0.9,// smallest set of tokens whose combined probability is at least 90% of the distribution
				max_tokens: 2048, // Allow complete JSON with summary, suggestions and full markdown rewrite.
				stop: ["```", "\nINPUT (verbatim):"] // conservative stops to prevent run-on prose
			});

			modelOutput = typeof resp === "string" ? resp : (resp?.response || resp?.result || "");
		} catch (e) {
			if (this.env.AUDIT === "true") {
				console.warn("ai.run.fail", { err: String(e?.message || e) });
			}
			return json(fallbackBody(), 200, corsHeaders(this.env, origin));
		}

		// Trim any accidental prose around JSON
		const first = modelOutput.indexOf("{");
		const last = modelOutput.lastIndexOf("}");
		if (first !== -1 && last !== -1 && last > first) {
			modelOutput = modelOutput.slice(first, last + 1);
		}

		// Parse + clamp + sanitize
		const parsed = safeParseJSON(modelOutput);
		if (!Array.isArray(parsed.suggestions) && typeof parsed.rewrite !== "string" && typeof parsed.summary !== "string") {
			if (this.env.AUDIT === "true") {
				console.warn("ai.output.invalid", { mode });
			}
			return json(fallbackBody(), 200, corsHeaders(this.env, origin));
		}

		let suggestions = Array.isArray(parsed.suggestions) ?
			parsed.suggestions
			.slice(0, this.cfg.MAX_SUGGESTIONS)
			.map(s => ({
				category: typeof s?.category === "string" ? s.category : "General",
				tip: clamp(typeof s?.tip === "string" ? s.tip : "", this.cfg.MAX_SUGGESTION_LEN),
				why: clamp(typeof s?.why === "string" ? s.why : "", this.cfg.MAX_SUGGESTION_LEN),
				severity: ["high", "medium", "low"].includes(s?.severity) ? s?.severity : "medium"
			}))
			.filter(s => s.tip.trim().length > 0) : [];

		let rewrite = sanitizeRewrite(typeof parsed.rewrite === "string" ? parsed.rewrite : "");

		// === Post-processing guardrail for invented metrics/timeframes/methods ===
		// Compare rewrite vs input; neutralise invented quantifiers and add notes.
		const { text: cleanedRewrite, notes } = neutraliseInventedQuantifiers(rewrite, input);
		// Remove invented method specifics not present in input
		rewrite = neutraliseInventedMethods(cleanedRewrite, input);

		// Merge quantifier notes into suggestions without exceeding MAX_SUGGESTIONS
		if (notes.length) {
			const remainingSlots = Math.max(0, this.cfg.MAX_SUGGESTIONS - suggestions.length);
			const toAdd = notes.slice(0, remainingSlots);
			suggestions = suggestions.concat(
				toAdd.map(n => ({
					category: n.category,
					tip: clamp(n.tip, this.cfg.MAX_SUGGESTION_LEN),
					why: clamp(n.why, this.cfg.MAX_SUGGESTION_LEN),
					severity: n.severity
				}))
			);
		}

		// Bias audit (neutralises phrasing + adds suggestion items)
		const { text: biasFixed, issues: biasIssues } = auditForBias(rewrite, input);
		rewrite = biasFixed;

		if (biasIssues.length) {
			const remaining = Math.max(0, this.cfg.MAX_SUGGESTIONS - suggestions.length);
			suggestions = suggestions.concat(
				biasIssues.slice(0, remaining).map(i => ({
					category: i.category,
					tip: clamp(i.tip, this.cfg.MAX_SUGGESTION_LEN),
					why: clamp(i.why, this.cfg.MAX_SUGGESTION_LEN),
					severity: i.severity
				}))
			);
		}

		if (!rewrite) return json(fallbackBody(), 200, corsHeaders(this.env, origin));

		// Final PII sweep on rewrite
		if (detectPII(rewrite)) {
			rewrite = sanitizeRewrite(rewrite);
		}

		const body = {
			summary: typeof parsed.summary === "string" ?
				clamp(parsed.summary, 300) : mode === "objectives" ?
				"Suggestions to strengthen your Initial Objectives" : "Suggestions to strengthen your Description",
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
						`https://api.airtable.com/v0/${this.env.AIRTABLE_BASE_ID}/${encodeURIComponent(
              this.env.AIRTABLE_TABLE_AI_LOG
            )}`, {
							method: "POST",
							headers: {
								authorization: `Bearer ${this.env.AIRTABLE_API_KEY}`,
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
