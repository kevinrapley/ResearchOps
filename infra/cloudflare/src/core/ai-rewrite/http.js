/**
 * Build CORS headers for the given origin based on ALLOWED_ORIGINS.
 * @function corsHeaders
 * @inner
 * @param {Env} env
 * @param {string} origin
 * @returns {Record<string,string>}
 */
export function corsHeaders(env, origin) {
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
export function json(body, status = 200, headers = {}) {
	const hdrs = Object.assign({ "Content-Type": "application/json" }, headers || {});
	return new Response(JSON.stringify(body), { status, headers: hdrs });
}
