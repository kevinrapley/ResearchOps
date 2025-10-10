/**
 * @file src/service/ai-rewrite.js
 * @module service/ai-rewrite
 * @summary Workers AI–backed rewrite endpoint for Step 1 Descriptions.
 *
 * Contract:
 *   POST /api/ai-rewrite
 *   Body: { text:string }
 *   Returns:
 *     {
 *       ok: true,
 *       summary: string,
 *       suggestions: Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>,
 *       rewrite: string,
 *       flags: { possible_personal_data: boolean }
 *     }
 *
 * - Enforces size limits
 * - Produces plain-English, GOV.UK-aligned output
 * - Optionally logs shallow usage stats to Airtable if AIRTABLE_TABLE_AI_LOG is configured
 */

import { DEFAULTS } from "../core/constants.js";
import { safeText, mdToAirtableRich, fetchWithTimeout } from "../core/utils.js";

/**
 * @typedef {import("./index.js").Env} Env
 * @typedef {import("./index.js").ServiceContext} ServiceContext
 */

/**
 * Minimal schema check for request body.
 * @param {any} js
 * @returns {{ok:true,text:string}|{ok:false,detail:string}}
 */
function validateInput(js) {
	if (!js || typeof js !== "object") return { ok: false, detail: "Invalid JSON body" };
	const text = String(js.text || "").trim();
	if (!text) return { ok: false, detail: "Missing field: text" };
	if (text.length > DEFAULTS.MAX_BODY_BYTES) return { ok: false, detail: "Text too large" };
	// We *encourage* ≥ 400 chars, but do not hard-fail to remain friendly
	return { ok: true, text };
}

/**
 * Build a system prompt that encodes stylistic constraints.
 * @param {string} text
 * @returns {string}
 */
function buildPrompt(text) {
	return [
		"You are an assistant that rewrites research project descriptions to be clear,",
		"succinct, and aligned to the GOV.UK Service Manual tone of voice. You must:",
		"- Use plain English and short sentences where possible.",
		"- Remove internal jargon and unexplained acronyms.",
		"- Keep participant safety, privacy and data minimisation in mind.",
		"- Avoid promising outcomes; describe intent and approach instead.",
		"",
		"Return a strict JSON object with these keys:",
		'  summary: short overview (max 75 words),',
		'  suggestions: array of {category, tip, why, severity},',
		'  rewrite: the improved description (Markdown OK),',
		'  flags: { possible_personal_data: boolean }.',
		"",
		"Base text to analyse and improve:",
		"---",
		text,
		"---"
	].join("\n");
}

/**
 * Try to parse an LLM JSON payload defensively.
 * @param {string} s
 * @returns {{summary:string,suggestions:any[],rewrite:string,flags:{possible_personal_data:boolean}}}
 */
function parseModelJson(s) {
	try {
		const start = s.indexOf("{");
		const end = s.lastIndexOf("}");
		const core = start >= 0 && end > start ? s.slice(start, end + 1) : s;
		const js = JSON.parse(core);
		return {
			summary: String(js.summary || "").trim(),
			suggestions: Array.isArray(js.suggestions) ? js.suggestions : [],
			rewrite: String(js.rewrite || "").trim(),
			flags: {
				possible_personal_data: Boolean(js.flags?.possible_personal_data)
			}
		};
	} catch {
		// Worst case fallback: treat the whole string as a rewrite
		return {
			summary: "",
			suggestions: [],
			rewrite: s.trim(),
			flags: { possible_personal_data: false }
		};
	}
}

/**
 * Optionally log counters-only usage to Airtable (best-effort, fire-and-forget).
 * @param {ServiceContext} ctx
 * @param {{input_len:number, output_len:number}} metrics
 * @returns {Promise<void>}
 */
async function logUsageToAirtable(ctx, { input_len, output_len }) {
	const table = ctx.env.AIRTABLE_TABLE_AI_LOG;
	if (!table) return;

	try {
		const base = ctx.env.AIRTABLE_BASE_ID;
		const t = encodeURIComponent(table);
		const url = `https://api.airtable.com/v0/${base}/${t}`;
		const fields = {
			"Kind": "ai-rewrite",
			"Input Len": input_len,
			"Output Len": output_len,
			"Model": ctx.env.MODEL || "@cf/meta/llama-3.1-8b-instruct",
			"Timestamp": new Date().toISOString()
		};
		for (const k of Object.keys(fields)) {
			if (fields[k] === undefined || fields[k] === null || fields[k] === "")
				delete fields[k];
		}
		await fetchWithTimeout(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${ctx.env.AIRTABLE_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ records: [{ fields }] })
		}, ctx.cfg.TIMEOUT_MS);
	} catch (e) {
		ctx.log.warn("ai.log.fail", { err: String(e?.message || e) });
	}
}

/**
 * Run the AI rewrite flow.
 *
 * @param {ServiceContext} ctx
 * @param {Request} req
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function runAiRewrite(ctx, req, origin) {
	try {
		const buf = await req.arrayBuffer();
		if (buf.byteLength > ctx.cfg.MAX_BODY_BYTES) {
			return ctx.json({ error: "Payload too large" }, 413, ctx.corsHeaders(origin));
		}

		/** @type {any} */
		let body;
		try { body = JSON.parse(new TextDecoder().decode(buf)); } catch { return ctx.json({ error: "Invalid JSON" }, 400, ctx.corsHeaders(origin)); }

		const v = validateInput(body);
		if (!v.ok) return ctx.json({ error: v.detail }, 400, ctx.corsHeaders(origin));

		const model = ctx.env.MODEL || "@cf/meta/llama-3.1-8b-instruct";
		if (!ctx.env.AI || !ctx.env.AI.run) {
			return ctx.json({ error: "Workers AI not configured" }, 501, ctx.corsHeaders(origin));
		}

		const prompt = buildPrompt(v.text);

		// Call Workers AI
		/** @type {{response?:string}|string} */
		const aiResp = await ctx.env.AI.run(model, {
			messages: [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: prompt }
			],
			max_tokens: 1024,
			temperature: 0.2
		});

		const raw = typeof aiResp === "string" ? aiResp : String(aiResp?.response || "");
		const parsed = parseModelJson(raw);

		// Normalise rewrite to Airtable Rich Text conventions
		const rewriteRich = mdToAirtableRich(parsed.rewrite || "");

		// Best-effort usage log
		logUsageToAirtable(ctx, { input_len: v.text.length, output_len: raw.length }).catch(() => {});

		return ctx.json({
			ok: true,
			summary: parsed.summary,
			suggestions: parsed.suggestions,
			rewrite: rewriteRich,
			flags: parsed.flags
		}, 200, ctx.corsHeaders(origin));
	} catch (e) {
		ctx.log.error("ai.rewrite.fail", { err: String(e?.message || e) });
		return ctx.json({ error: "AI rewrite error" }, 500, ctx.corsHeaders(origin));
	}
}
