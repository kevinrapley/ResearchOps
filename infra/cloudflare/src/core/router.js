/**
 * @file src/core/router.js
 * @module core/router
 * @summary Router for Cloudflare Worker entrypoint (modular ResearchOps service).
 * @version 2.2.1
 *
 * Changes since 2.2.0:
 *  - Guarded static assets fallback when ASSETS binding is missing to avoid
 *    "Cannot read properties of undefined (reading 'fetch')" crashes.
 *  - Small helper `hasFetchBinding` to check for .fetch presence on bindings.
 *
 * Changes since 2.1.1:
 *  - Guard optional Mural endpoints to avoid crashes if not implemented
 *  - Consistent CORS headers (incl. Access-Control-Allow-Headers)
 *  - Minor hardening on diagnostics/static fallbacks
 */

import { aiRewrite } from "./ai-rewrite.js";

/* ────────────────── Small utils ────────────────── */

function canonicalizePath(pathname) {
	let p = pathname || "/";
	p = p.replace(/\/(pages|components|partials|css|js|images|img|assets)\/(\1\/)+/g, "/$1/");
	p = p.replace(/\/{2,}/g, "/");
	p = p.replace(/\/index\.html$/i, "/");
	if (p.startsWith("/api/") && p.endsWith("/") && p !== "/api/") p = p.slice(0, -1);
	return p;
}

function maybeRedirect(request, canonicalPath) {
	const url = new URL(request.url);
	if (url.pathname !== canonicalPath) {
		url.pathname = canonicalPath;
		return Response.redirect(url.toString(), 302);
	}
	return null;
}

function normalizeAllowedOrigins(val) {
	if (!val) return [];
	if (Array.isArray(val)) return val;
	if (typeof val === "string") return val.split(",").map(s => s.trim()).filter(Boolean);
	return [];
}

function corsHeadersForEnv(env, origin) {
	const allowList = normalizeAllowedOrigins(env?.ALLOWED_ORIGINS);
	const allow = allowList.includes(origin);
	return {
		"Access-Control-Allow-Origin": allow ? origin : (allowList[0] || "*"),
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		"Vary": "Origin"
	};
}

function json(obj) {
	return JSON.stringify(obj);
}

function safeSlice(s, n) {
	if (!s) return s;
	return s.length > n ? s.slice(0, n) + "…" : s;
}

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

/**
 * Safely detect whether a binding exposes a fetch function.
 * Avoids calling `.fetch` on undefined bindings (e.g., ASSETS not bound).
 */
function hasFetchBinding(obj) {
	return !!(obj && typeof obj.fetch === "function");
}

/* ────────────────── Direct endpoints (no service.js dependency) ────────────────── */

async function projectsCsvDirect(request, env, origin) {
	console.log("[projectsCsvDirect] Called");
	try {
		requireEnv(env, ["GH_OWNER", "GH_REPO", "GH_BRANCH", "GH_PATH_PROJECTS"]);
		const rawUrl = `https://raw.githubusercontent.com/${env.GH_OWNER}/${env.GH_REPO}/${env.GH_BRANCH}/${env.GH_PATH_PROJECTS}`;

		console.log("[projectsCsvDirect] Fetching GitHub CSV:", rawUrl);
		const r = await fetch(rawUrl, { headers: { accept: "text/plain" } });

		if (!r.ok) {
			console.error("[projectsCsvDirect] GitHub fetch failed:", r.status);
			return new Response(`Upstream CSV fetch failed: ${r.status}`, {
				status: 502,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}
		const body = await r.text();
		console.log("[projectsCsvDirect] Returning CSV, length:", body.length);
		return new Response(body, {
			status: 200,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/csv; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		console.error("[projectsCsvDirect] Exception:", e);
		return new Response(`Handler error (projects.csv): ${String(e?.message || e)}`, {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}

async function projectsJsonDirect(request, env, origin) {
	console.log("[projectsJsonDirect] Called");
	try {
		assertAirtableEnv(env);
		requireEnv(env, ["AIRTABLE_TABLE_PROJECTS"]);

		const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
		const key = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_PROJECTS);
		const url = `https://api.airtable.com/v0/${base}/${table}?pageSize=100`;

		console.log("[projectsJsonDirect] Fetching Airtable:", { url, hasBase: !!base, hasKey: !!key, table });

		const r = await fetch(url, {
			headers: { authorization: `Bearer ${key}`, accept: "application/json" }
		});

		console.log("[projectsJsonDirect] Airtable response:", {
			ok: r.ok,
			status: r.status,
			contentType: r.headers.get("content-type")
		});

		if (!r.ok) {
			const raw = await r.text().catch(() => "");
			console.error("[projectsJsonDirect] Airtable error:", { status: r.status, body: safeSlice(raw, 500) });
			return new Response(json({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
				status: 500,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}

		const data = await r.json();
		const records = Array.isArray(data?.records) ? data.records : [];
		const projects = records.map(rec => ({ id: rec.id, ...(rec.fields || {}) }));

		console.log("[projectsJsonDirect] Returning projects:", projects.length);
		return new Response(json({ ok: true, projects }), {
			status: 200,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		console.error("[projectsJsonDirect] Exception:", e);
		return new Response(json({ ok: false, error: String(e?.message || e) }), {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}

async function studiesJsonDirect(request, env, origin, url) {
	console.log("[studiesJsonDirect] Called");
	try {
		assertAirtableEnv(env);
		requireEnv(env, ["AIRTABLE_TABLE_STUDIES"]);

		const projectId = url.searchParams.get("project") || "";
		const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
		const key = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);
		const atUrl = `https://api.airtable.com/v0/${base}/${table}?pageSize=100`;

		console.log("[studiesJsonDirect] Fetching studies from Airtable");
		const r = await fetch(atUrl, {
			headers: { authorization: `Bearer ${key}`, accept: "application/json" }
		});

		if (!r.ok) {
			const raw = await r.text().catch(() => "");
			console.error("[studiesJsonDirect] Airtable error:", { status: r.status });
			return new Response(json({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
				status: 500,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}

		const data = await r.json();
		const records = Array.isArray(data?.records) ? data.records : [];

		// Filter by project client-side
		const filtered = projectId ?
			records.filter(rec => {
				const f = rec?.fields || {};
				const proj = f.Project || f.project;
				if (Array.isArray(proj)) return proj.includes(projectId);
				return String(proj || "") === projectId;
			}) :
			records;

		const studies = filtered.map(rec => {
			const f = rec.fields || {};
			return {
				id: rec.id,
				studyId: f["Study ID"] || f.studyId || "",
				method: f.Method || f.method || "",
				status: f.Status || f.status || "",
				description: f.Description || f.description || "",
				title: f.Title || f.title || "",
				createdAt: rec.createdTime || f.CreatedAt || ""
			};
		});

		console.log("[studiesJsonDirect] Returning studies:", studies.length);
		return new Response(json({ ok: true, studies }), {
			status: 200,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		console.error("[studiesJsonDirect] Exception:", e);
		return new Response(json({ ok: false, error: String(e?.message || e) }), {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}

/* ────────────────── Main entry router ────────────────── */

export async function handleRequest(request, env) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";

	// Canonicalize early
	{
		const canonical = canonicalizePath(url.pathname);
		const redirect = maybeRedirect(request, canonical);
		if (redirect) return redirect;
		url.pathname = canonical;
	}

	try {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					...corsHeadersForEnv(env, origin),
					"Access-Control-Max-Age": "86400"
				}
			});
		}

		// Lightweight pings
		if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
			return new Response(json({ ok: true, time: new Date().toISOString(), note: "handleRequest" }), {
				status: 200,
				headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
			});
		}

		// Environment diagnostics
		if (url.pathname === "/api/_diag/env" && request.method === "GET") {
			return new Response(json({
				ok: true,
				env: {
					hasAirtableBase: !!(env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID),
					hasAirtableKey: !!(env.AIRTABLE_API_KEY || env.AIRTABLE_PAT),
					hasAirtableTableProjects: !!env.AIRTABLE_TABLE_PROJECTS,
					hasAirtableTableStudies: !!env.AIRTABLE_TABLE_STUDIES,
					hasMuralClientId: !!env.MURAL_CLIENT_ID,
					hasMuralClientSecret: !!env.MURAL_CLIENT_SECRET,
					muralRedirectUri: env.MURAL_REDIRECT_URI || "(not set)",
					hasGithubConfig: !!(env.GH_OWNER && env.GH_REPO && env.GH_BRANCH),
					timestamp: new Date().toISOString()
				}
			}), {
				status: 200,
				headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}

		if (url.pathname === "/api/health") {
			return new Response(json({ ok: true, service: "ResearchOps API", time: new Date().toISOString() }), {
				status: 200,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}

		// ═══════════════════════════════════════════════════════════════════════════════
		// DIRECT ROUTES: Projects & Studies (no service.js dependency)
		// ═══════════════════════════════════════════════════════════════════════════════

		if (url.pathname === "/api/projects" && request.method === "GET") {
			console.log("[router] ✓ Matched /api/projects (direct)");
			const res = await projectsJsonDirect(request, env, origin);
			console.log("[router] projectsJsonDirect returned status:", res?.status);
			return res;
		}

		if (url.pathname === "/api/projects.csv" && request.method === "GET") {
			console.log("[router] ✓ Matched /api/projects.csv (direct)");
			return projectsCsvDirect(request, env, origin);
		}

		if (url.pathname === "/api/studies" && request.method === "GET") {
			console.log("[router] ✓ Matched /api/studies (direct)");
			return studiesJsonDirect(request, env, origin, url);
		}

		// ═══════════════════════════════════════════════════════════════════════════════
		// SERVICE-DEPENDENT ROUTES: Load service.js for everything else
		// ═══════════════════════════════════════════════════════════════════════════════

		let ResearchOpsService;
		let serviceLoadFailed = false;

		try {
			console.log("[router] Attempting dynamic import of service.js");
			({ ResearchOpsService } = await import("./service.js"));
			console.log("[router] ✓ service.js imported successfully");
		} catch (e) {
			console.error("[router] ✗ Service module load failed:", e);
			serviceLoadFailed = true;

			// For API routes that REQUIRE service, return 503
			if (url.pathname.startsWith("/api/")) {
				return new Response(json({
					ok: false,
					error: "Service temporarily unavailable",
					detail: String(e?.message || e),
					note: "Projects and Studies APIs are still available via direct handlers"
				}), {
					status: 503,
					headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
				});
			}
			// For non-API routes (pages), continue to static asset handler below
		}

		// Service-dependent routes (only if ResearchOpsService loaded successfully)
		if (ResearchOpsService && !serviceLoadFailed) {
			// ── IMPORTANT: normalize ALLOWED_ORIGINS to a string for legacy service code
			const envCompat = {
				...env,
				ALLOWED_ORIGINS: normalizeAllowedOrigins(env.ALLOWED_ORIGINS).join(",")
			};

			const service = new ResearchOpsService(envCompat);

			// Diagnostics
			if (url.pathname === "/api/_diag/airtable" && request.method === "GET") {
				return service.airtableProbe(origin, url);
			}

			// AI Assist
			if (url.pathname === "/api/ai-rewrite" && request.method === "POST") {
				return aiRewrite(request, envCompat, origin);
			}

			// Project details CSV (uses service util)
			if (url.pathname === "/api/project-details.csv" && request.method === "GET") {
				return service.streamCsv(origin, envCompat.GH_PATH_DETAILS);
			}

			// Journals
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
				return (typeof service.updateCode === "function") ?
					service.updateCode(request, origin, codeId) :
					service.createCode(request, origin);
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

			// Impact
			if (url.pathname === "/api/impact" && request.method === "GET") {
				if (typeof service.listImpact === "function") {
					return service.listImpact(origin, url);
				}
			}
			if (url.pathname === "/api/impact" && request.method === "POST") {
				if (typeof service.createImpact === "function") {
					return service.createImpact(request, origin);
				}
			}

			// Studies (POST/PATCH need service)
			if (url.pathname === "/api/studies" && request.method === "POST") {
				return service.createStudy(request, origin);
			}
			if (url.pathname.startsWith("/api/studies/")) {
				const m = url.pathname.match(/^\/api\/studies\/([^/]+)$/);
				if (m && request.method === "PATCH") {
					const studyId = decodeURIComponent(m[1]);
					return service.updateStudy(request, origin, studyId);
				}
			}
			if (url.pathname === "/api/studies.csv" && request.method === "GET") {
				if (envCompat.GH_PATH_STUDIES) return service.streamCsv(origin, envCompat.GH_PATH_STUDIES);
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
					if (request.method === "DELETE") return service.deletePartial(request, origin, partialId);
				}
			}

			// Participants
			if (url.pathname === "/api/participants" && request.method === "GET") {
				if (typeof service.listParticipants === "function") return service.listParticipants(origin, url);
			}
			if (url.pathname === "/api/participants" && request.method === "POST") {
				if (typeof service.createParticipant === "function") return service.createParticipant(request, origin);
			}

			// Sessions
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
				const m = url.pathname.match(/^\/api\/session-notes\/([^/]+)$/);
				if (m && request.method === "PATCH") {
					const noteId = decodeURIComponent(m[1]);
					return service.updateSessionNote(request, origin, noteId);
				}
			}

			// Comms
			if (url.pathname === "/api/comms/send" && request.method === "POST") {
				if (typeof service.sendComms === "function") return service.sendComms(request, origin);
			}

			// MURAL ROUTES (require service.js)
			if (url.pathname === "/api/mural/auth" && request.method === "GET") {
				console.log("[router] ✓ Matched /api/mural/auth (service)");
				return service.mural.muralAuth(origin, url);
			}
			if (url.pathname === "/api/mural/callback" && request.method === "GET") {
				console.log("[router] ✓ Matched /api/mural/callback (service)");
				return service.mural.muralCallback(origin, url);
			}
			if (url.pathname === "/api/mural/verify" && request.method === "GET") {
				console.log("[router] ✓ Matched /api/mural/verify (service)");
				return service.mural.muralVerify(origin, url);
			}
			if (url.pathname === "/api/mural/resolve" && request.method === "GET") {
				console.log("[router] ✓ Matched /api/mural/resolve (service)");
				return service.mural.muralResolve(origin, url);
			}
			if (url.pathname === "/api/mural/setup" && request.method === "POST") {
				console.log("[router] ✓ Matched /api/mural/setup (service)");
				return service.mural.muralSetup(request, origin);
			}
			if (url.pathname === "/api/mural/find" && request.method === "GET") {
				if (service?.mural && typeof service.mural.muralFind === "function") {
					return service.mural.muralFind(origin, url);
				}
			}
			if (url.pathname === "/api/mural/await" && request.method === "GET") {
				if (service?.mural && typeof service.mural.muralAwait === "function") {
					return service.mural.muralAwait(origin, url);
				}
			}

			if (request.method === "POST" && url.pathname === "/api/mural/journal-sync") {
				if (service?.mural && typeof service.mural.muralJournalSync === "function") {
					return service.mural.muralJournalSync(request, origin);
				}

				console.warn("[router] muralJournalSync handler missing on service.mural");
				return new Response(JSON.stringify({
					ok: false,
					error: "mural_journal_sync_not_configured"
				}), {
					status: 501,
					headers: {
						...corsHeadersForEnv(env, origin),
						"content-type": "application/json; charset=utf-8",
						"x-content-type-options": "nosniff"
					}
				});
			}

			if (url.pathname === "/api/mural/workspaces" && request.method === "GET") {
				if (service?.mural && typeof service.mural.muralListWorkspaces === "function") {
					return service.mural.muralListWorkspaces(origin, url);
				}
			}
			if (url.pathname === "/api/mural/me" && request.method === "GET") {
				if (service?.mural && typeof service.mural.muralMe === "function") {
					return service.mural.muralMe(origin, url);
				}
			}
			if (url.pathname === "/api/mural/debug-env" && request.method === "GET") {
				if (service?.mural && typeof service.mural.muralDebugEnv === "function") {
					return service.mural.muralDebugEnv(origin);
				}
			}

			// Unknown API route
			if (url.pathname.startsWith("/api/")) {
				console.log("[router] No handler matched for API route:", url.pathname);
				return new Response(json({ error: "Not found", path: url.pathname }), {
					status: 404,
					headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
				});
			}
		}

		// Static assets (SPA fallback) - only reached if not an API route
		console.log("[router] Serving static asset:", url.pathname);
		if (!hasFetchBinding(env.ASSETS)) {
			console.warn("[router] ASSETS binding is missing; returning minimal 404 fallback");
			return new Response("Not found (assets binding missing)", {
				status: 404,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}
		let resp = await env.ASSETS.fetch(request);
		if (resp.status === 404) {
			const indexReq = new Request(new URL("/index.html", url), request);
			resp = await env.ASSETS.fetch(indexReq);
		}
		return resp;

	} catch (e) {
		// Last-resort safety net
		console.error("[router] Unhandled error:", e);
		return new Response(json({ error: "Internal error", detail: String(e?.message || e) }), {
			status: 500,
			headers: { "Content-Type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...corsHeadersForEnv(env, origin) }
		});
	}
}
