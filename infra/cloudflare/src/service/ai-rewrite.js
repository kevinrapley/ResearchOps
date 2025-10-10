/**
 * @file src/service/ai-rewrite.js
 * @module service/ai-rewrite
 * @summary Lightweight AI-assisted rewriter endpoint for Cloudflare Workers AI.
 *
 * POST /api/ai-rewrite
 * Body:
 * {
 *   "text": "string",                 // required: source text to rewrite
 *   "instruction": "string",          // optional: rewrite instruction (e.g. "Make it concise")
 *   "system": "string",               // optional: custom system prompt
 *   "model": "string"                 // optional: override model; defaults to env.MODEL or DEFAULT_MODEL
 * }
 *
 * Response:
 * { "ok": true, "output": "string", "model": "string" }
 */

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_BODY_BYTES = 64 * 1024; // 64KB guard, keep this light for edge usage

/**
 * Build CORS headers based on env.ALLOWED_ORIGINS
 * @param {any} env
 * @param {string} origin
 * @returns {Record<string,string>}
 */
function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/**
 * JSON response helper
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
 * @async
 * @function aiRewrite
 * @description Handles POST /api/ai-rewrite. Uses Workers AI to rewrite text per an instruction.
 * @param {Request} request
 * @param {any} env - Worker env (must contain AI binding)
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function aiRewrite(request, env, origin) {
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, corsHeaders(env, origin));
    }

    const ab = await request.arrayBuffer();
    if (ab.byteLength > MAX_BODY_BYTES) {
      return json({ error: "Payload too large" }, 413, corsHeaders(env, origin));
    }

    /** @type {{text?:string, instruction?:string, system?:string, model?:string}} */
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(ab));
    } catch {
      return json({ error: "Invalid JSON" }, 400, corsHeaders(env, origin));
    }

    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const instruction = typeof payload.instruction === "string"
      ? payload.instruction.trim()
      : "Rewrite for clarity and concision. Preserve meaning and key details.";
    const system = typeof payload.system === "string"
      ? payload.system.trim()
      : "You are a helpful writing assistant. Keep the output faithful and neutral.";
    const model = (payload.model && String(payload.model)) || env.MODEL || DEFAULT_MODEL;

    if (!text) {
      return json({ error: "Missing 'text' field" }, 400, corsHeaders(env, origin));
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "Workers AI not configured (missing env.AI binding)" }, 500, corsHeaders(env, origin));
    }

    // Compose a clear chat prompt
    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Instruction: ${instruction}\n\n` +
          `--- SOURCE START ---\n${text}\n--- SOURCE END ---\n\n` +
          `Return only the rewritten text.`
      }
    ];

    // Call Workers AI
    const aiRes = await env.AI.run(model, { messages });
    // Different model backends return different shapes; normalize a few common ones.
    const output =
      aiRes?.response ??
      aiRes?.result ??
      aiRes?.choices?.[0]?.message?.content ??
      aiRes?.choices?.[0]?.text ??
      "";

    if (!output) {
      return json({ error: "AI returned empty response", model }, 502, corsHeaders(env, origin));
    }

    return json({ ok: true, output, model }, 200, corsHeaders(env, origin));
  } catch (err) {
    const detail = String(err?.message || err);
    return json({ error: "AI rewrite failed", detail }, 500, corsHeaders(env, origin));
  }
}