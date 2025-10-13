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

import { ResearchOpsService } from "./service.js";
import { aiRewrite } from "./ai-rewrite.js";
import { readPartial } from "../service/features/partials.js";
import { readGuide } from "../service/features/guides.js";

/**
 * Collapse any duplicated static segments (pages|components|partials|css|js|images|assets).
 * Also removes accidental multiple slashes.
 * @param {string} pathname
 * @returns {string}
 */
function canonicalizePath(pathname) {
	let p = pathname;

	// Collapse duplicate segment runs: /pages/pages/... -> /pages/...
	p = p.replace(/\/(pages|components|partials|css|js|images|img|assets)\/(\1\/)+/g, "/$1/");

	// Collapse any triple/double slashes (excluding scheme).
	p = p.replace(/\/{2,}/g, "/");

	// Remove trailing /index.html -> /
	p = p.replace(/\/index\.html$/i, "/");

	return p;
}

/**
 * Issue a redirect if canonical path differs (preserve query/hash).
 * @param {Request} request
 * @param {string} canonicalPath
 * @returns {Response|null}
 */
function maybeRedirect(request, canonicalPath) {
	const url = new URL(request.url);
	if (url.pathname !== canonicalPath) {
		url.pathname = canonicalPath;
		// 302 for safety (avoid caching), switch to 301 once you’re confident
		return Response.redirect(url.toString(), 302);
	}
	return null;
}

/**
 * @async
 * @function handleRequest
 * @description Entry router for all /api/ routes and asset fallback.
 */
export async function handleRequest(request, env) {
	const service = new ResearchOpsService(env);
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";

	// ── Canonicalize path early
	{
		const canonical = canonicalizePath(url.pathname);
		const redirect = maybeRedirect(request, canonical);
		if (redirect) return redirect;
	}

	try {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: { ...service.corsHeaders(origin), "Access-Control-Max-Age": "600" }
			});
		}

		// Health
		if (url.pathname === "/api/health") return service.health(origin);

		// AI Assist
		if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
			return aiRewrite(request, env, origin);
		}

		// Projects
		if (url.pathname.startsWith("/api/projects")) {
			if (request.method === "GET") return service.listProjectsFromAirtable(origin, url);
			if (request.method === "POST" && typeof service.createProject === "function") {
				return service.createProject(request, origin);
			}
		}

		// Studies
		if (url.pathname === "/api/studies" && request.method === "GET") {
			return service.listStudies(origin, url);
		}
		if (url.pathname === "/api/studies" && request.method === "POST") {
			return service.createStudy(request, origin);
		} {
			const m = url.pathname.match(/^\/api\/studies\/([^/]+)$/);
			if (m && request.method === "PATCH" && typeof service.updateStudy === "function") {
				const urlWithId = new URL(url.toString());
				urlWithId.searchParams.set("id", m[1]);
				return service.updateStudy(request, origin, urlWithId);
			}
		}

		// Guides
		if (url.pathname.startsWith("/api/guides")) {
			if (url.pathname === "/api/guides" && request.method === "GET") {
				return service.listGuides(origin, url);
			}
			if (url.pathname === "/api/guides" && request.method === "POST") {
				return service.createGuide(request, origin);
			}
			if (/^\/api\/guides\/[^/]+$/.test(url.pathname) && request.method === "GET") {
				const id = url.pathname.split("/").pop();
				return readGuide(env, (o) => service.corsHeaders(o), id);
			}
			const gm = url.pathname.match(/^\/api\/guides\/([^/]+)(?:\/(publish))?$/);
			if (gm) {
				const [, guideId, action] = gm;
				const urlWithId = new URL(url.toString());
				urlWithId.searchParams.set("id", guideId);
				if (action === "publish" && request.method === "POST") {
					return service.publishGuide(origin, urlWithId);
				}
				if (request.method === "GET") return service.readGuide(origin, urlWithId);
				if (request.method === "PATCH") return service.updateGuide(request, origin, urlWithId);
			}
		}

		// Partials
		if (url.pathname.startsWith("/api/partials")) {
			if (url.pathname === "/api/partials" && request.method === "GET") {
				// list, or single by ?id=…
				return service.listPartials(origin, url);
			}
			if (url.pathname === "/api/partials" && request.method === "POST") {
				return service.createPartial(request, origin);
			}
			if (/^\/api\/partials\/[^/]+$/.test(url.pathname) && request.method === "GET") {
				const id = url.pathname.split("/").pop();
				return readPartial(env, (o) => service.corsHeaders(o), id);
			}
			const pm = url.pathname.match(/^\/api\/partials\/([^/]+)$/);
			if (pm) {
				const [, partialId] = pm;
				const urlWithId = new URL(url.toString());
				urlWithId.searchParams.set("id", partialId);
				if (request.method === "GET") return service.readPartial(origin, urlWithId);
				if (request.method === "PATCH") return service.updatePartial(request, origin, urlWithId);
				if (request.method === "DELETE") return service.deletePartial(origin, urlWithId);
			}
		}

		// Participants (optional)
		if (url.pathname === "/api/participants" && request.method === "GET" && typeof service.listParticipants === "function") {
			return service.listParticipants(origin, url);
		}
		if (url.pathname === "/api/participants" && request.method === "POST" && typeof service.createParticipant === "function") {
			return service.createParticipant(request, origin);
		}

		// Sessions (optional)
		if (url.pathname === "/api/sessions" && request.method === "GET" && typeof service.listSessions === "function") {
			return service.listSessions(origin, url);
		}
		if (url.pathname === "/api/sessions" && request.method === "POST" && typeof service.createSession === "function") {
			return service.createSession(request, origin);
		} {
			const sm = url.pathname.match(/^\/api\/sessions\/([^/]+)(?:\/ics)?$/);
			if (sm && request.method === "PATCH" && typeof service.updateSession === "function") {
				const urlWithId = new URL(url.toString());
				urlWithId.searchParams.set("id", sm[1]);
				return service.updateSession(request, origin, urlWithId);
			}
			if (sm && /\/ics$/.test(url.pathname) && request.method === "GET" && typeof service.sessionIcs === "function") {
				const urlWithId = new URL(url.toString());
				urlWithId.searchParams.set("id", sm[1]);
				return service.sessionIcs(origin, urlWithId);
			}
		}

		// Static fallback (assets + SPA)
		let resp = await env.ASSETS.fetch(request);
		if (resp.status === 404) {
			resp = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
		}
		return resp;

	} catch (e) {
		service.log?.error?.("unhandled.error", { err: String(e?.message || e) });
		return new Response(JSON.stringify({ error: "Internal error" }), {
			status: 500,
			headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
		});
	} finally {
		try { service.destroy(); } catch {}
	}
}
