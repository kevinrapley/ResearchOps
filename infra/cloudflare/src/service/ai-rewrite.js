/**
 * @file src/service/ai-rewrite.js
 * @module service/ai-rewrite
 * @summary Rule-guided rewrite endpoint (Workers AI).
 */

import { fetchWithTimeout, safeText, mdToAirtableRich } from "../core/utils.js";

/**
 * POST /api/ai-rewrite
 * Body: { text:string }
 * Output:
 * {
 *   summary:string,
 *   suggestions:Array<{category:string,tip:string,why:string,severity:"high"|"medium"|"low"}>,
 *   rewrite:string,
 *   flags:{possible_personal_data:boolean}
 * }
 *
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function runAiRewrite(svc, request, origin) {
	// Validate env
	if (!svc.env.AI || !svc.env.MODEL) {
		return svc.json({ error: "AI model not configured" }, 501, svc.corsHeaders(origin));
	}

	// Validate payload
	const buf = await request.arrayBuffer();
	let payload;
	try { payload = JSON.parse(new TextDecoder().decode(buf)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}
	const src = String(payload?.text || "");
	if (src.length < 50) {
		return svc.json({ error: "Text too short (min 50 chars)" }, 400, svc.corsHeaders(origin));
	}

	// Prompt (keep deterministic, no PII echo; plain-English, GOV.UK tone)
	const system = [
		"You are an assistant that rewrites research descriptions to be plain-English, concise, and compliant with GOV.UK Service Manual tone.",
		"Return JSON with fields: summary, suggestions[], rewrite, flags.possible_personal_data (boolean).",
		"Do not invent facts. Keep the scope identical to the original."
	].join(" ");

	const user = [
		"Rewrite the following research description. Keep it factual, short, accessible.",
		"Also propose targeted suggestions with category, tip, why, and severity.",
		"",
		src
	].join("\n");

	// Workers AI
	let result;
	try {
		result = await svc.env.AI.run(svc.env.MODEL, {
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user }
			],
			max_tokens: 800
		});
	} catch (e) {
		svc.log.error("ai.rewrite.fail", { err: String(e?.message || e) });
		return svc.json({ error: "AI inference failed", detail: String(e?.message || e) }, 502, svc.corsHeaders(origin));
	}

	// Expect either a JSON string or an object
	let out = {};
	try {
		const content = result?.response || result?.output || result;
		if (typeof content === "string") out = JSON.parse(content);
		else if (typeof content === "object") out = content;
	} catch (e) {
		svc.log.warn("ai.rewrite.parse", { err: String(e?.message || e) });
		// Fallback: minimal shape
		out = { summary: "", suggestions: [], rewrite: "", flags: { possible_personal_data: false } };
	}

	// Normalise shape
	const summary = String(out.summary || "").trim();
	const rewrite = String(out.rewrite || "").trim();
	const suggestions = Array.isArray(out.suggestions) ? out.suggestions.map(s => ({
		category: String(s.category || "").trim(),
		tip: String(s.tip || "").trim(),
		why: String(s.why || "").trim(),
		severity: /** @type {"high"|"medium"|"low"} */(String(s.severity || "low").toLowerCase())
	})) : [];
	const flags = {
		possible_personal_data: Boolean(out?.flags?.possible_personal_data)
	};

	return svc.json({ summary, suggestions, rewrite, flags }, 200, svc.corsHeaders(origin));
}
