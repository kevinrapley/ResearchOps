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
 *   - GET  /api/projects                           (list; FAIL-SAFE in this file)
 *   - GET  /api/projects.csv                       (CSV stream from GitHub; FAIL-SAFE in this file)
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
 *   - GET   /api/sessions/:id                      (read one)
 *   - POST  /api/sessions                          (create)
 *   - PATCH /api/sessions/:id                      (update)
 *   - GET   /api/sessions/:id/ics                  (download .ics)
 * - Session Notes:
 *   - GET   /api/session-notes?session=:id         (list by session)
 *   - POST  /api/session-notes                     (create)
 *   - PATCH /api/session-notes/:id                 (update)
 * - Comms:
 *   - POST /api/comms/send                         (send + log)
 * - Mural:
 *   - GET  /api/mural/auth                         (start OAuth)
 *   - GET  /api/mural/callback                     (OAuth redirect)
 *   - GET  /api/mural/verify                       (check connection + workspace)
 *   - POST /api/mural/setup                        (create folder + “Reflexive Journal”)
 *   - GET  /api/mural/resolve                      (resolve existing Reflexive board mapping)
 *   - GET  /api/mural/debug-env                    (TEMP: show bound env vars)
 *
 * Any non-/api requests fall through to static ASSETS with SPA index.html fallback.
 */

import { ResearchOpsService } from "./service.js";
import { aiRewrite } from "./ai-rewrite.js";

/* ────────────────────────────────────────────────────────────────────────────
   Path canonicalisation
   ──────────────────────────────────────────────────────────────────────────── */

function canonicalizePath(pathname) {
	let p = pathname || "/";

	p = p.replace(/\/(pages|components|partials|css|js|images|img|assets)\/(\1\/)+/g, "/$1/");
	p = p.replace(/\/{2,}/g, "/");
	p = p.replace(/\/index\.html$/i, "/");

	if (p.startsWith("/api/") && p.endsWith("/") && p !== "/api/") {
		p = p.slice(0, -1);
	}
	return p;
}

export async function routeRequest(service, request) {
	const origin = request.headers.get("Origin") || "*";
	const url = new URL(request.url);
	const p = (url.pathname || "/").replace(/\/+$/, "").toLowerCase();

	if (p === "/api/_diag/ping" && request.method === "GET") {
		return new Response(JSON.stringify({ ok: true, time: new Date().toISOString(), note: "direct route" }), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
		});
	}

	try {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: service.corsHeaders(origin) });
		}

		if (p === "/api/health" && request.method === "GET") {
			return service.health(origin);
		}

		if (p === "/api/projects" && request.method === "GET") {
			return safeProjectsJson(service, request, origin);
		}
		if (p === "/api/projects" && request.method === "POST") {
			if (typeof service.createProject === "function") {
				return service.createProject(request, origin);
			}
		}

		if (p.startsWith("/api/sessions/") && request.method === "GET") {
			const parts = p.split("/").filter(Boolean);
			if (parts.length >= 3 && parts[0] === "api" && parts[1] === "sessions") {
				const sessionId = decodeURIComponent(parts[2]);
				if (parts[3] !== "ics" && typeof service.getSession === "function") {
					return service.getSession(origin, sessionId);
				}
			}
		}

		return new Response(JSON.stringify({ error: "Not found", path: url.pathname }), {
			status: 404,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	} catch (e) {
		const msg = String(e?.message || e || "");
		service?.log?.error?.("router.direct.fatal", { err: msg, path: url.pathname, method: request.method });
		return new Response(JSON.stringify({ error: "Internal error", detail: msg }), {
			status: 500,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	}
}

function maybeRedirect(request, canonicalPath) {
	const url = new URL(request.url);
	if (url.pathname !== canonicalPath) {
		url.pathname = canonicalPath;
		return Response.redirect(url.toString(), 302);
	}
	return null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Entry router
   ──────────────────────────────────────────────────────────────────────────── */

export async function handleRequest(request, env) {
	const service = new ResearchOpsService(env);
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";

	{
		const canonical = canonicalizePath(url.pathname);
		const redirect = maybeRedirect(request, canonical);
		if (redirect) return redirect;
		url.pathname = canonical;
	}

	try {
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

		// Diagnostics
		if (url.pathname === "/api/_diag/airtable" && request.method === "GET") {
			return service.airtableProbe(origin, url);
		}

		// Health
		if (url.pathname === "/api/health") {
			return service.health(origin);
		}

		// AI Assist
		if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
			return aiRewrite(request, env, origin);
		}

		// Projects (FAIL-SAFE overrides)
		if (url.pathname === "/api/projects" && request.method === "GET") {
			return safeProjectsJson(service, request, origin);
		}
		if (url.pathname === "/api/projects" && request.method === "POST") {
			if (typeof service.createProject === "function") {
				return service.createProject(request, origin);
			}
		}
		if (url.pathname === "/api/projects.csv" && request.method === "GET") {
			return safeProjectsCsv(service, request, env, origin);
		}
		if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
			return service.streamCsv(origin, env.GH_PATH_DETAILS);
		}

		// Journal Entries
		if (url.pathname === "/api/journal-entries" && request.method === "GET") {
			return service.listJournalEntries(origin, url);
		}
		if (url.pathname === "/api/journal-entries" && request.method === "POST") {
			return service.createJournalEntry(request, origin);
		}
		if (url.pathname.startsWith("/api/journal-entries/")) {
			const entryId = decodeURIComponent(url.pathname.slice("/api/journal-entries/".length));
			if (request.method === "GET") return service.getJournalEntry(origin, entryId);
			if (request.method === "PATCH") return service.updateJournalEntry(request, origin, entryId);
			if (request.method === "DELETE") return service.deleteJournalEntry(origin, entryId);
		}

		// Excerpts
		if (url.pathname === "/api/excerpts" && request.method === "GET") {
			return service.listExcerpts(origin, url);
		}
		if (url.pathname === "/api/excerpts" && request.method === "POST") {
			return service.createExcerpt(request, origin);
		}
		if (url.pathname.startsWith("/api/excerpts/") && request.method === "PATCH") {
			const excerptId = decodeURIComponent(url.pathname.slice("/api/excerpts/".length));
			return service.updateExcerpt(request, origin, excerptId);
		}

		// Memos
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

		// Code Applications
		if (url.pathname === "/api/code-applications" && request.method === "GET") {
			return service.listCodeApplications(origin, url);
		}

		// Codes
		if (url.pathname === "/api/codes" && request.method === "GET") {
			return service.listCodes(origin, url);
		}
		if (url.pathname === "/api/codes" && request.method === "POST") {
			return service.createCode(request, origin);
		}
		if (url.pathname.startsWith("/api/codes/") && request.method === "PATCH") {
			const codeId = decodeURIComponent(url.pathname.slice("/api/codes/".length));
			return (typeof service.updateCode === "function")
				? service.updateCode(request, origin, codeId)
				: service.createCode(request, origin);
		}

		// Analysis
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

		// Studies
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
			if (env.GH_PATH_STUDIES) return service.streamCsv(origin, env.GH_PATH_STUDIES);
		}

		// Guides
		if (url.pathname === "/api/guides" && request.method === "GET") {
			return service.listGuides(origin, url);
		}
		if (url.pathname === "/api/guides" && request.method === "POST") {
			return service.createGuide(request, origin);
		}
		if (url.pathname.startsWith("/api/guides/")) {
			const parts = url.pathname.split("/").filter(Boolean);
			if (parts.length === 3) {
				const guideId = decodeURIComponent(parts[2]);
				if (request.method === "GET") return service.readGuide(origin, guideId);
				if (request.method === "PATCH") return service.updateGuide(request, origin, guideId);
			}
			if (parts.length === 4 && parts[3] === "publish" && request.method === "POST") {
				const guideId = decodeURIComponent(parts[2]);
				return service.publishGuide(origin, guideId);
			}
		}

		// Partials
		if (url.pathname === "/api/partials" && request.method === "GET") {
			return service.listPartials(origin);
		}
		if (url.pathname === "/api/partials" && request.method === "POST") {
			return service.createPartial(request, origin);
		}
		if (url.pathname.startsWith("/api/partials/")) {
			const parts = url.pathname.split("/").filter(Boolean);
			if (parts.length === 3) {
				const partialId = decodeURIComponent(parts[2]);
				if (request.method === "GET") return service.readPartial(origin, partialId);
				if (request.method === "PATCH") return service.updatePartial(request, origin, partialId);
				if (request.method === "DELETE") return service.deletePartial(origin, partialId);
			}
		}

		// Participants (optional)
		if (url.pathname === "/api/participants" && request.method === "GET") {
			if (typeof service.listParticipants === "function") return service.listParticipants(origin, url);
		}
		if (url.pathname === "/api/participants" && request.method === "POST") {
			if (typeof service.createParticipant === "function") return service.createParticipant(request, origin);
		}

		// Sessions (optional)
		if (url.pathname === "/api/sessions" && request.method === "GET") {
			if (typeof service.listSessions === "function") return service.listSessions(origin, url);
		}
		if (url.pathname === "/api/sessions" && request.method === "POST") {
			if (typeof service.createSession === "function") return service.createSession(request, origin);
		}
		if (url.pathname.startsWith("/api/sessions/")) {
			const match = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/ics)?$/);
			if (match) {
				const sessionId = decodeURIComponent(match[1]);
				const isIcs = match[2] === "/ics";
				if (request.method === "GET" && !isIcs) {
					if (typeof service.getSession === "function") return service.getSession(origin, sessionId);
				}
				if (request.method === "PATCH" && !isIcs) {
					if (typeof service.updateSession === "function") return service.updateSession(request, origin, sessionId);
				}
				if (request.method === "GET" && isIcs) {
					if (typeof service.sessionIcs === "function") return service.sessionIcs(origin, sessionId);
				}
			}
		}

		// Session Notes
		if (url.pathname === "/api/session-notes" && request.method === "GET") {
			return service.listSessionNotes(origin, url);
		}
		if (url.pathname === "/api/session-notes" && request.method === "POST") {
			return service.createSessionNote(request, origin);
		}
		if (url.pathname.startsWith("/api/session-notes/")) {
			const match = url.pathname.match(/^\/api\/session-notes\/([^/]+)$/);
			if (match && request.method === "PATCH") {
				const noteId = decodeURIComponent(match[1]);
				return service.updateSessionNote(request, origin, noteId);
			}
		}

		// Comms (optional)
		if (url.pathname === "/api/comms/send" && request.method === "POST") {
			if (typeof service.sendComms === "function") return service.sendComms(request, origin);
		}

		// Mural
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
		if (url.pathname === "/api/mural/resolve" && request.method === "GET") {
			return service.mural.muralResolve(origin, url);
		}
		if (url.pathname === "/api/mural/find" && request.method === "GET") {
			return service.mural.muralFind(origin, url);
		}
		if (request.method === "POST" && url.pathname === "/api/mural/journal-sync") {
			return service.mural.muralJournalSync(request, origin);
		}
		if (url.pathname === "/api/mural/workspaces" && request.method === "GET") {
			return service.mural.muralListWorkspaces(origin, url);
		}
		if (url.pathname === "/api/mural/me" && request.method === "GET") {
			return service.mural.muralMe(origin, url);
		}
		if (url.pathname === "/api/mural/debug-env" && request.method === "GET") {
			return service.mural.muralDebugEnv(origin);
		}

		// Unknown API
		if (url.pathname.startsWith("/api/")) {
			return service.json({ error: "Not found", path: url.pathname }, 404, service.corsHeaders(origin));
		}

		// Static assets + SPA fallback
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

/* ────────────────────────────────────────────────────────────────────────────
   Fail-safe handlers for Projects
   ──────────────────────────────────────────────────────────────────────────── */

async function safeProjectsCsv(service, request, env, origin) {
	try {
		requireEnv(env, ["GH_OWNER", "GH_REPO", "GH_BRANCH", "GH_PATH_PROJECTS"]);
		const url = `https://raw.githubusercontent.com/${env.GH_OWNER}/${env.GH_REPO}/${env.GH_BRANCH}/${env.GH_PATH_PROJECTS}`;
		const r = await fetch(url, { headers: { accept: "text/plain" } });
		if (!r.ok) {
			return new Response(`Upstream CSV fetch failed: ${r.status}`, {
				status: 502,
				headers: { ...service.corsHeaders(origin), "content-type": "text/plain; charset=utf-8" }
			});
		}
		const body = await r.text();
		return new Response(body, {
			status: 200,
			headers: { ...service.corsHeaders(origin), "content-type": "text/csv; charset=utf-8" }
		});
	} catch (e) {
		return new Response(`Handler error (projects.csv): ${String(e?.message || e)}`, {
			status: 500,
			headers: { ...service.corsHeaders(origin), "content-type": "text/plain; charset=utf-8" }
		});
	}
}

async function safeProjectsJson(service, request, origin) {
	try {
		const env = service.env || {};
		assertAirtableEnv(env);
		requireEnv(env, ["AIRTABLE_TABLE_PROJECTS"]);

		const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
		const key = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
		const url = `https://api.airtable.com/v0/${base}/${table}?pageSize=100`;

		const r = await fetch(url, {
			headers: { authorization: `Bearer ${key}`, accept: "application/json" }
		});

		if (!r.ok) {
			const raw = await r.text().catch(() => "");
			return new Response(JSON.stringify({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
				status: 500,
				headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
			});
		}

		const data = await r.json();
		const records = Array.isArray(data?.records) ? data.records : [];
		const projects = records.map(rec => ({ id: rec.id, ...(rec.fields || {}) }));

		return new Response(JSON.stringify({ ok: true, projects }), {
			status: 200,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
			status: 500,
			headers: { ...service.corsHeaders(origin), "content-type": "application/json; charset=utf-8" }
		});
	}
}

/* ────────────────────────────────────────────────────────────────────────────
   Small guards/utilities
   ──────────────────────────────────────────────────────────────────────────── */

function requireEnv(env, keys) {
	const missing = keys.filter(k => !env[k]);
	if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
}

function assertAirtableEnv(env) {
	if (!env.AIRTABLE_BASE && !env.AIRTABLE_BASE_ID) {
		throw new Error("Missing env: AIRTABLE_BASE or AIRTABLE_BASE_ID");
	}
	if (!env.AIRTABLE_API_KEY && !env.AIRTABLE_PAT) {
		throw new Error("Missing env: AIRTABLE_API_KEY or AIRTABLE_PAT");
	}
}

function safeSlice(s, n) {
	if (!s) return s;
	return s.length > n ? s.slice(0, n) + "…" : s;
}
