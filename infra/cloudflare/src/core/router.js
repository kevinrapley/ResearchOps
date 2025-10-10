/**
 * @file src/core/router.js
 * @module core/router
 * @summary Router for Cloudflare Worker entrypoint (modular ResearchOps service).
 *
 * Routes covered:
 * - Health:
 *   - GET  /api/health
 * - AI Assist:
 *   - POST /api/ai-rewrite
 * - Projects:
 *   - GET  /api/projects               (list)
 *   - GET  /api/projects.csv           (CSV stream from GitHub)
 *   - GET  /api/project-details.csv    (CSV stream from GitHub)
 *   // NOTE: createProject is optional; only wired if provided by the service
 *   - POST /api/projects               (create; only if service.createProject exists)
 * - Studies:
 *   - GET  /api/studies?project=:id    (list by project)
 *   - POST /api/studies                (create)
 *   - PATCH /api/studies/:id           (update)
 *   - GET  /api/studies.csv            (CSV stream from GitHub; optional path if configured)
 * - Guides:
 *   - GET  /api/guides?study=:id       (list by study)
 *   - POST /api/guides                 (create)
 *   - GET  /api/guides/:id             (read)
 *   - PATCH /api/guides/:id            (update)
 *   - POST /api/guides/:id/publish     (publish)
 * - Partials:
 *   - GET    /api/partials             (list)
 *   - POST   /api/partials             (create)
 *   - GET    /api/partials/:id         (read)
 *   - PATCH  /api/partials/:id         (update)
 *   - DELETE /api/partials/:id         (delete)
 * - Participants:
 *   - GET  /api/participants?study=:id (list by study)
 *   - POST /api/participants           (create)
 * - Sessions:
 *   - GET   /api/sessions?study=:id    (list by study)
 *   - POST  /api/sessions              (create)
 *   - PATCH /api/sessions/:id          (update)
 *   - GET   /api/sessions/:id/ics      (download .ics)
 * - Comms:
 *   - POST /api/comms/send             (send + log)
 *
 * Any non-/api requests fall through to static ASSETS with SPA index.html fallback.
 */

import { ResearchOpsService } from "./service.js"; // shim -> ../service/index.js
import { aiRewrite } from "../service/ai-rewrite.js"; // lives alongside other service modules

/**
 * Quick test for “is this an API path?”
 * @param {string} pathname
 * @returns {boolean}
 */
function isApiPath(pathname) {
	return pathname.startsWith("/api/");
}

/**
 * Require origin to be in env.ALLOWED_ORIGINS for API routes (if Origin header present).
 * @param {ResearchOpsService} service
 * @param {string} origin
 * @returns {null|Response}
 */
function enforceAllowedOrigin(service, origin) {
	const allowed = (service.env.ALLOWED_ORIGINS || "")
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
	if (origin && !allowed.includes(origin)) {
		return service.json({ error: "Origin not allowed" }, 403, service.corsHeaders(origin));
	}
	return null;
}

/**
 * Extract a path segment safely by index.
 * Example: seg("/api/guides/rec123/publish", 3) -> "rec123"
 * @param {string} pathname
 * @param {number} idx
 * @returns {string}
 */
function seg(pathname, idx) {
	const parts = pathname.split("/"); // ["", "api", "..."]
	return decodeURIComponent(parts[idx] || "");
}

/**
 * @async
 * @function handleRequest
 * @description Entry router for all /api/ routes and asset fallback.
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env) {
	const service = new ResearchOpsService(env);
	const url = new URL(request.url);
	const pathname = url.pathname;
	const origin = request.headers.get("Origin") || "";

	try {
		// CORS preflight (always answer quickly)
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: { ...service.corsHeaders(origin), "Access-Control-Max-Age": "600" }
			});
		}

		// API: common guard — enforce ALLOWED_ORIGINS
		if (isApiPath(pathname)) {
			const guard = enforceAllowedOrigin(service, origin);
			if (guard) return guard;
		}

		/* ────────────────────────── Health & AI ────────────────────────── */
		if (pathname === "/api/health" && request.method === "GET") {
			return service.health(origin);
		}
		if (pathname === "/api/ai-rewrite" && request.method === "POST") {
			return aiRewrite(request, env, origin);
		}

		/* ────────────────────────── Projects ───────────────────────────── */
		if (pathname === "/api/projects" && request.method === "GET") {
			return service.listProjectsFromAirtable(origin, url);
		}
		// Optional: only wire POST if the composed service implements it
		if (pathname === "/api/projects" && request.method === "POST" && typeof service.createProject === "function") {
			return service.createProject(request, origin);
		}

		// CSV streams
		if (pathname === "/api/projects.csv" && request.method === "GET") {
			return service.streamCsv(origin, env.GH_PATH_PROJECTS);
		}
		if (pathname === "/api/project-details.csv" && request.method === "GET") {
			return service.streamCsv(origin, env.GH_PATH_DETAILS);
		}
		if (pathname === "/api/studies.csv" && request.method === "GET" && env.GH_PATH_STUDIES) {
			return service.streamCsv(origin, env.GH_PATH_STUDIES);
		}

		/* ────────────────────────── Studies ────────────────────────────── */
		if (pathname === "/api/studies" && request.method === "GET") {
			return service.listStudies(origin, url);
		}
		if (pathname === "/api/studies" && request.method === "POST") {
			return service.createStudy(request, origin);
		}
		if (pathname.startsWith("/api/studies/") && request.method === "PATCH") {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing study id" }, 400, service.corsHeaders(origin));
			return service.updateStudy(request, origin, id);
		}

		/* ────────────────────────── Guides ─────────────────────────────── */
		if (pathname === "/api/guides" && request.method === "GET") {
			return service.listGuides(origin, url);
		}
		if (pathname === "/api/guides" && request.method === "POST") {
			return service.createGuide(request, origin);
		}
		// /api/guides/:id/publish
		if (/^\/api\/guides\/[^/]+\/publish\/?$/.test(pathname) && request.method === "POST") {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing guide id" }, 400, service.corsHeaders(origin));
			return service.publishGuide(origin, id);
		}
		// /api/guides/:id (GET read, PATCH update)
		if (pathname.startsWith("/api/guides/")) {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing guide id" }, 400, service.corsHeaders(origin));
			if (request.method === "GET") return service.readGuide(origin, id);
			if (request.method === "PATCH") return service.updateGuide(request, origin, id);
		}

		/* ────────────────────────── Partials ───────────────────────────── */
		if (pathname === "/api/partials" && request.method === "GET") {
			return service.listPartials(origin);
		}
		if (pathname === "/api/partials" && request.method === "POST") {
			return service.createPartial(request, origin);
		}
		if (pathname.startsWith("/api/partials/")) {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing partial id" }, 400, service.corsHeaders(origin));
			if (request.method === "GET") return service.readPartial(origin, id);
			if (request.method === "PATCH") return service.updatePartial(request, origin, id);
			if (request.method === "DELETE") return service.deletePartial(origin, id);
		}

		/* ─────────────────────── Participants ──────────────────────────── */
		if (pathname === "/api/participants" && request.method === "GET") {
			return service.listParticipants(origin, url);
		}
		if (pathname === "/api/participants" && request.method === "POST") {
			return service.createParticipant(request, origin);
		}

		/* ────────────────────────── Sessions ───────────────────────────── */
		if (pathname === "/api/sessions" && request.method === "GET") {
			return service.listSessions(origin, url);
		}
		if (pathname === "/api/sessions" && request.method === "POST") {
			return service.createSession(request, origin);
		}
		if (pathname.startsWith("/api/sessions/") && request.method === "PATCH") {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing session id" }, 400, service.corsHeaders(origin));
			return service.updateSession(request, origin, id);
		}
		if (pathname.startsWith("/api/sessions/") && request.method === "GET" && pathname.endsWith("/ics")) {
			const id = seg(pathname, 3);
			if (!id) return service.json({ error: "Missing session id" }, 400, service.corsHeaders(origin));
			return service.sessionIcs(origin, id);
		}

		/* ─────────────────────────── Comms ─────────────────────────────── */
		if (pathname === "/api/comms/send" && request.method === "POST") {
			return service.sendComms(request, origin);
		}

		/* ───────────────────── Static assets fallback ──────────────────── */
		// Not an API route, or unknown API path → serve ASSETS with SPA fallback.
		let resp = await env.ASSETS.fetch(request);
		if (resp.status === 404) {
			const indexReq = new Request(new URL("/index.html", url), request);
			resp = await env.ASSETS.fetch(indexReq);
		}
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