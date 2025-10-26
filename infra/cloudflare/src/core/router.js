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
 *   - GET  /api/projects                           (list)
 *   - GET  /api/projects.csv                       (CSV stream from GitHub)
 *   - GET  /api/project-details.csv                (CSV stream from GitHub)
 *   - POST /api/projects                           (create; only if service.createProject exists)
 * - Journals:
 *   - GET /api/journal-entries                     (list)
 *   - GET /api/journal-entries?project=:id         (list by project)
 *   - POST /api/journal-entries                    (create)
 *   - GET /api/journal-entries/:id.                (read)
 *   - PATCH /api/journal-entries/:id               (update)
 *   - DELETE /api/journal-entries/:id              (delete)
 * - Studies:
 *   - GET  /api/studies?project=:id                (list by project)
 *   - POST /api/studies                            (create)
 *   - PATCH /api/studies/:id                       (update)
 *   - GET  /api/studies.csv                        (CSV stream from GitHub; optional path if configured)
 * - Guides:
 *   - GET  /api/guides?study=:id                   (list by study)
 *   - POST /api/guides                             (create)
 *   - GET  /api/guides/:id                         (read)
 *   - PATCH /api/guides/:id                        (update)
 *   - POST /api/guides/:id/publish                 (publish)
 * - Partials:
 *   - GET    /api/partials                         (list)
 *   - POST   /api/partials                         (create)
 *   - GET    /api/partials/:id                     (read)
 *   - PATCH  /api/partials/:id                     (update)
 *   - DELETE /api/partials/:id                     (delete)
 * - Participants:
 *   - GET  /api/participants?study=:id             (list by study)
 *   - POST /api/participants                       (create)
 * - Sessions:
 *   - GET   /api/sessions?study=:id                (list by study)
 *   - POST  /api/sessions                          (create)
 *   - PATCH /api/sessions/:id                      (update)
 *   - GET   /api/sessions/:id/ics                  (download .ics)
 * - Comms:
 *   - POST /api/comms/send                         (send + log)
 * - Mural:
 *   - GET  /api/mural/auth                         (start OAuth)
 *   - GET  /api/mural/callback                     (OAuth redirect)
 *   - GET  /api/mural/verify                       (check connection + workspace)
 *   - POST /api/mural/setup                        (create folder + “Reflexive Journal”)
 *   - GET  /api/mural/debug-env                    (TEMP: show bound env vars)
 *
 * Any non-/api requests fall through to static ASSETS with SPA index.html fallback.
 */

import { ResearchOpsService } from "./service.js";
import { aiRewrite } from "./ai-rewrite.js";

/**
 * Collapse any duplicated static segments and normalize trailing slashes.
 * @param {string} pathname
 * @returns {string}
 */
function canonicalizePath(pathname) {
	let p = pathname || "/";

	// Collapse duplicate segment runs: /pages/pages/... -> /pages/...
	p = p.replace(/\/(pages|components|partials|css|js|images|img|assets)\/(\1\/)+/g, "/$1/");

	// Collapse any triple/double slashes (excluding scheme)
	p = p.replace(/\/{2,}/g, "/");

	// Remove trailing /index.html -> /
	p = p.replace(/\/index\.html$/i, "/");

	// Remove trailing slash from API paths (but keep root /)
	if (p.startsWith("/api/") && p.endsWith("/") && p !== "/api/") {
		p = p.slice(0, -1);
	}

	return p;
}

/**
 * Lightweight router used by some call sites; not the main entry in Cloudflare.
 * Retained for compatibility.
 * @param {ResearchOpsService} service
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function routeRequest(service, request) {
	const origin = request.headers.get("Origin") || "*";
	const url = new URL(request.url);
	const p = (url.pathname || "/").replace(/\/+$/, "").toLowerCase();

	// Direct ping (no service dependencies)
	if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
		return new Response(JSON.stringify({
			ok: true,
			time: new Date().toISOString(),
			note: "direct route"
		}), {
			status: 200,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store"
			}
		});
	}

	try {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: service.corsHeaders(origin) });
		}

		// Journals GET
		if (p === "/api/journal-entries" && request.method === "GET") {
			return service.listJournalEntries(origin, url);
		}

		// Journals POST
		if (p === "/api/journal-entries" && request.method === "POST") {
			return service.createJournalEntry(request, origin);
		}

		// Journals DELETE
		if (p.startsWith("/api/journal-entries/") && request.method === "DELETE") {
			const entryId = decodeURIComponent(p.split("/").pop());
			return service.deleteJournalEntry(origin, entryId);
		}

		// 404 JSON (avoid HTML error page)
		return new Response(JSON.stringify({ error: "Not found", path: url.pathname }), {
			status: 404,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	} catch (e) {
		const msg = String(e?.message || e || "");
		service?.log?.error?.("router.fatal", { err: msg, path: url.pathname, method: request.method });
		return new Response(JSON.stringify({ error: "Internal error", detail: msg }), {
			status: 500,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	}
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
		// 302 for safety (avoid caching). Switch to 301 once confirmed.
		return Response.redirect(url.toString(), 302);
	}
	return null;
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
	const origin = request.headers.get("Origin") || "";

	// Canonicalise path early (removes trailing slashes from API paths)
	{
		const canonical = canonicalizePath(url.pathname);
		const redirect = maybeRedirect(request, canonical);
		if (redirect) return redirect;
		url.pathname = canonical;
	}

	try {
		// Early diagnostic ping (verifies this handler runs)
		if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
			return new Response(JSON.stringify({
				ok: true,
				time: new Date().toISOString(),
				note: "handleRequest"
			}), {
				status: 200,
				headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
			});
		}

		// CORS preflight
		if (request.method === "OPTIONS") {
			const reqOrigin = request.headers.get("Origin") || "";
			return new Response(null, {
				status: 204,
				headers: {
					...service.corsHeaders(reqOrigin),
					"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400"
				}
			});
		}

		// ─────────────────────────────────────────────────────────────────
		// Diagnostics (Airtable create capability)
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/_diag/airtable" && request.method === "GET") {
			// Requires service.airtableProbe to be implemented
			return service.airtableProbe(origin, url);
		}

		// ─────────────────────────────────────────────────────────────────
		// Health
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/health") {
			return service.health(origin);
		}

		// ─────────────────────────────────────────────────────────────────
		// AI Assist
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
			return aiRewrite(request, env, origin);
		}

		// ─────────────────────────────────────────────────────────────────
		// Projects
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/projects" && request.method === "GET") {
			return service.listProjectsFromAirtable(origin, url);
		}
		if (url.pathname === "/api/projects" && request.method === "POST") {
			if (typeof service.createProject === "function") {
				return service.createProject(request, origin);
			}
		}
		if (url.pathname === "/api/projects.csv" && request.method === "GET") {
			return service.streamCsv(origin, env.GH_PATH_PROJECTS);
		}
		if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
			return service.streamCsv(origin, env.GH_PATH_DETAILS);
		}

		// ─────────────────────────────────────────────────────────────────
		// Journal Entries
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/journal-entries" && request.method === "GET") {
			return service.listJournalEntries(origin, url);
		}
		if (url.pathname === "/api/journal-entries" && request.method === "POST") {
			return service.createJournalEntry(request, origin);
		}
		if (url.pathname.startsWith("/api/journal-entries/")) {
			const entryId = decodeURIComponent(url.pathname.slice("/api/journal-entries/".length));

			if (request.method === "GET") {
				return service.getJournalEntry(origin, entryId);
			}
			if (request.method === "PATCH") {
				return service.updateJournalEntry(request, origin, entryId);
			}
			if (request.method === "DELETE") {
				return service.deleteJournalEntry(origin, entryId);
			}
		}

		// ──────────────────────────────
		// Journal Excerpts (explicit routes)
		// ──────────────────────────────
		if (url.pathname === "/api/excerpts" && request.method === "GET") {
			// Optional filter: ?entry=<AirtableJournalEntryId>
			return service.listExcerpts(origin, url);
		}
		if (url.pathname === "/api/excerpts" && request.method === "POST") {
			// Body: { entryId, start, end, text, createdAt?, author?, codes?, memos?, muralWidgetId?, syncedAt? }
			return service.createExcerpt(request, origin);
		}
		if (url.pathname.startsWith("/api/excerpts/") && request.method === "PATCH") {
			const excerptId = decodeURIComponent(url.pathname.slice("/api/excerpts/".length));
			return service.updateExcerpt(request, origin, excerptId);
		}

		// ─────────────────────────────────────────────────────────────────
		// Memos
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/memos" && request.method === "GET") {
			return service.listMemos(origin, url);
		}
		if (url.pathname === "/api/memos" && request.method === "POST") {
			return service.createMemo(request, origin);
		}
		if (url.pathname.startsWith("/api/memos/") && request.method === "PATCH") {
			const memoId = decodeURIComponent(url.pathname.slice("/api/memos/".length));
			return service.updateMemo(request, origin, memoId);
		}

		// ─────────────────────────────────────────────────────────────────
		// Code Applications
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/code-applications" && request.method === "GET") {
			return service.listCodeApplications(origin, url);
		}

		// ─────────────────────────────────────────────────────────────────
		// Codes
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/codes" && request.method === "GET") {
			return service.listCodes(origin, url);
		}
		if (url.pathname === "/api/codes" && request.method === "POST") {
			return service.createCode(request, origin);
		}
		if (url.pathname.startsWith("/api/codes/") && request.method === "PATCH") {
			const codeId = decodeURIComponent(url.pathname.slice("/api/codes/".length));
			return (typeof service.updateCode === "function") ?
				service.updateCode(request, origin, codeId) :
				service.createCode(request, origin);
		}

		// ─────────────────────────────────────────────────────────────────
		// Analysis
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/analysis/timeline" && request.method === "GET") {
			return service.timeline(origin, url);
		}
		if (url.pathname === "/api/analysis/cooccurrence" && request.method === "GET") {
			return service.cooccurrence(origin, url);
		}
		if (url.pathname === "/api/analysis/retrieval" && request.method === "GET") {
			return service.retrieval(origin, url);
		}
		if (url.pathname === "/api/analysis/export" && request.method === "GET") {
			return service.exportAnalysis(origin, url);
		}

		// ─────────────────────────────────────────────────────────────────
		// Studies
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/studies" && request.method === "GET") {
			return service.listStudies(origin, url);
		}
		if (url.pathname === "/api/studies" && request.method === "POST") {
			return service.createStudy(request, origin);
		}
		if (url.pathname.startsWith("/api/studies/")) {
			const match = url.pathname.match(/^\/api\/studies\/([^/]+)$/);
			if (match && request.method === "PATCH") {
				const studyId = decodeURIComponent(match[1]);
				return service.updateStudy(request, origin, studyId);
			}
		}
		if (url.pathname === "/api/studies.csv" && request.method === "GET") {
			if (env.GH_PATH_STUDIES) {
				return service.streamCsv(origin, env.GH_PATH_STUDIES);
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Guides
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/guides" && request.method === "GET") {
			return service.listGuides(origin, url);
		}
		if (url.pathname === "/api/guides" && request.method === "POST") {
			return service.createGuide(request, origin);
		}
		if (url.pathname.startsWith("/api/guides/")) {
			const parts = url.pathname.split("/").filter(Boolean);
			// parts: ["api", "guides", ":id"] or ["api", "guides", ":id", "publish"]

			if (parts.length === 3) {
				// /api/guides/:id
				const guideId = decodeURIComponent(parts[2]);

				if (request.method === "GET") {
					return service.readGuide(origin, guideId);
				}
				if (request.method === "PATCH") {
					return service.updateGuide(request, origin, guideId);
				}
			}

			if (parts.length === 4 && parts[3] === "publish") {
				// /api/guides/:id/publish
				const guideId = decodeURIComponent(parts[2]);

				if (request.method === "POST") {
					return service.publishGuide(origin, guideId);
				}
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Partials
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/partials" && request.method === "GET") {
			return service.listPartials(origin);
		}
		if (url.pathname === "/api/partials" && request.method === "POST") {
			return service.createPartial(request, origin);
		}
		if (url.pathname.startsWith("/api/partials/")) {
			const parts = url.pathname.split("/").filter(Boolean);
			// parts: ["api", "partials", ":id"]

			if (parts.length === 3) {
				const partialId = decodeURIComponent(parts[2]);

				if (request.method === "GET") {
					return service.readPartial(origin, partialId);
				}
				if (request.method === "PATCH") {
					return service.updatePartial(request, origin, partialId);
				}
				if (request.method === "DELETE") {
					return service.deletePartial(origin, partialId);
				}
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Participants (optional)
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/participants" && request.method === "GET") {
			if (typeof service.listParticipants === "function") {
				return service.listParticipants(origin, url);
			}
		}
		if (url.pathname === "/api/participants" && request.method === "POST") {
			if (typeof service.createParticipant === "function") {
				return service.createParticipant(request, origin);
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Sessions (optional)
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/sessions" && request.method === "GET") {
			if (typeof service.listSessions === "function") {
				return service.listSessions(origin, url);
			}
		}
		if (url.pathname === "/api/sessions" && request.method === "POST") {
			if (typeof service.createSession === "function") {
				return service.createSession(request, origin);
			}
		}
		if (url.pathname.startsWith("/api/sessions/")) {
			const match = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/ics)?$/);
			if (match) {
				const sessionId = decodeURIComponent(match[1]);
				const isIcs = match[2] === "/ics";

				if (request.method === "PATCH" && !isIcs) {
					if (typeof service.updateSession === "function") {
						return service.updateSession(request, origin, sessionId);
					}
				}
				if (request.method === "GET" && isIcs) {
					if (typeof service.sessionIcs === "function") {
						return service.sessionIcs(origin, sessionId);
					}
				}
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Comms (optional)
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/comms/send" && request.method === "POST") {
			if (typeof service.sendComms === "function") {
				return service.sendComms(request, origin);
			}
		}

		// ─────────────────────────────────────────────────────────────────
		// Mural (OAuth + setup)
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname === "/api/mural/auth" && request.method === "GET") {
			return service.mural.muralAuth(origin, url);
		}
		if (url.pathname === "/api/mural/callback" && request.method === "GET") {
			return service.mural.muralCallback(origin, url);
		}
		if (url.pathname === "/api/mural/verify" && request.method === "GET") {
			return service.mural.muralVerify(origin, url);
		}
		if (url.pathname === "/api/mural/setup" && request.method === "POST") {
			return service.mural.muralSetup(request, origin);
		}
		// List user workspaces (TEMP)
		if (url.pathname === "/api/mural/workspaces" && request.method === "GET") {
			return service.mural.muralListWorkspaces(origin, url);
		}

		// Current user profile (TEMP)
		if (url.pathname === "/api/mural/me" && request.method === "GET") {
			return service.mural.muralMe(origin, url);
		}
		// TEMP: env visibility to confirm secrets are bound to this deployment
		if (url.pathname === "/api/mural/debug-env" && request.method === "GET") {
			return service.mural.muralDebugEnv(origin);
		}

		// ─────────────────────────────────────────────────────────────────
		// Unknown API route
		// ─────────────────────────────────────────────────────────────────
		if (url.pathname.startsWith("/api/")) {
			return service.json({ error: "Not found", path: url.pathname },
				404,
				service.corsHeaders(origin)
			);
		}

		// ─────────────────────────────────────────────────────────────────
		// Static assets with SPA fallback
		// ─────────────────────────────────────────────────────────────────
		let resp = await env.ASSETS.fetch(request);
		if (resp.status === 404) {
			const indexReq = new Request(new URL("/index.html", url), request);
			resp = await env.ASSETS.fetch(indexReq);
		}
		return resp;

	} catch (e) {
		service.log?.error?.("unhandled.error", { err: String(e?.message || e) });
		return new Response(JSON.stringify({ error: "Internal error" }), {
			status: 500,
			headers: { "Content-Type": "application/json", ...service.corsHeaders(origin) }
		});
	} finally {
		try { service.destroy(); } catch { /* no-op */ }
	}
}
