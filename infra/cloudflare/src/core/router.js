/**
 * @file router.js
 * @summary Router for Cloudflare Worker entrypoint.
 */

import { ResearchOpsService } from "./service.js";
import { aiRewrite } from "./ai-rewrite.js";

/**
 * @async
 * @function handleRequest
 * @description Entry router for all /api/ routes and asset fallback.
 */
export async function handleRequest(request, env) {
	const service = new ResearchOpsService(env);
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";

	try {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: { ...service.corsHeaders(origin), "Access-Control-Max-Age": "600" }
			});
		}

		// Route map (abbreviated here — import full logic from worker.js)
		if (url.pathname === "/api/health") return service.health(origin);
		if (url.pathname === "/api/ai-rewrite" && request.method === "POST")
			return aiRewrite(request, env, origin);

		if (url.pathname.startsWith("/api/projects"))
			return request.method === "GET" ?
				service.listProjectsFromAirtable(origin, url) :
				service.createProject?.(request, origin);

		if (url.pathname === "/api/studies" && request.method === "GET")
			return service.listStudies(origin, url);

		if (url.pathname === "/api/studies" && request.method === "POST")
			return service.createStudy(request, origin);

		// Static fallback
		let resp = await env.ASSETS.fetch(request);
		if (resp.status === 404)
			resp = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));

		return resp;

	} catch (e) {
		service.log.error("unhandled.error", { err: String(e?.message || e) });
		return new Response(JSON.stringify({ error: "Internal error" }), {
			status: 500,
			headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
		});
	} finally {
		service.destroy();
	}
}
