/**
 * @file health.js
 * @module health
 * @summary Health/diagnostic endpoints for the ResearchOps Worker.
 *
 * Exposes lightweight diagnostics that do not hit external dependencies.
 * Designed to plug into the composed service in `src/service/index.js`.
 */

/**
 * Health probe — lightweight liveness check.
 *
 * Returns a tiny JSON object so it’s fast and cache-safe. Uses the service’s
 * `json` helper and CORS header builder for consistency with other modules.
 *
 * @function health
 * @param {import("./index.js").ResearchOpsService} svc
 *        Composed service instance (provides env, cfg, log, json, corsHeaders).
 * @param {string} origin
 *        Request Origin header value used for CORS filtering.
 * @returns {Promise<Response>}
 *
 * @example
 * // In your router:
 * if (url.pathname === "/api/health") {
 *   return Health.health(service, origin);
 * }
 */
export async function health(svc, origin) {
	return svc.json({
			ok: true,
			time: new Date().toISOString()
		},
		200,
		svc.corsHeaders(origin)
	);
}