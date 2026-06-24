const RESEARCHOPS_CUSTOM_ORIGINS = new Set([
	"https://research-operations.com",
	"https://www.research-operations.com",
	"https://govuk.research-operations.com"
]);

/**
 * Check whether an origin belongs to the ResearchOps Pages site, branch previews or production custom domains.
 * @param {string} origin
 * @returns {boolean}
 */
function isResearchOpsOrigin(origin) {
	if (RESEARCHOPS_CUSTOM_ORIGINS.has(origin)) return true;
	try {
		const { hostname, protocol } = new URL(origin);
		return (
			protocol === "https:" &&
			(hostname === "researchops.pages.dev" || hostname.endsWith(".researchops.pages.dev"))
		);
	} catch {
		return false;
	}
}

/**
 * Check whether the AI rewrite endpoint may accept the request origin.
 * @param {Env} env
 * @param {string} origin
 * @returns {boolean}
 */
export function isAllowedOrigin(env, origin) {
	if (!origin) return true;
	const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
	return allowed.includes(origin) || isResearchOpsOrigin(origin);
}

/**
 * Build CORS headers for the given origin based on ALLOWED_ORIGINS.
 * @function corsHeaders
 * @inner
 * @param {Env} env
 * @param {string} origin
 * @returns {Record<string,string>}
 */
export function corsHeaders(env, origin) {
	const h = {
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin"
	};
	if (origin && isAllowedOrigin(env, origin)) h["Access-Control-Allow-Origin"] = origin;
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
