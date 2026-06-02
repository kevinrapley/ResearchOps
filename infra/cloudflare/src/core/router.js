/**
 * @file src/core/router.js
 * @module core/router
 * @summary Router for Cloudflare Worker entrypoint (modular ResearchOps service).
 */

import { aiRewrite } from "./ai-rewrite.js";

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

function bearerToken(request) {
	const header = request.headers.get("Authorization") || "";
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match ? match[1].trim() : "";
}

function hasFetchBinding(obj) {
	return !!(obj && typeof obj.fetch === "function");
}

async function projectsCsvDirect(request, env, origin) {
	try {
		requireEnv(env, ["GH_OWNER", "GH_REPO", "GH_BRANCH", "GH_PATH_PROJECTS"]);
		const rawUrl = `https://raw.githubusercontent.com/${env.GH_OWNER}/${env.GH_REPO}/${env.GH_BRANCH}/${env.GH_PATH_PROJECTS}`;
		const r = await fetch(rawUrl, { headers: { accept: "text/plain" } });
		if (!r.ok) {
			return new Response(`Upstream CSV fetch failed: ${r.status}`, {
				status: 502,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}
		const body = await r.text();
		return new Response(body, {
			status: 200,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/csv; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		return new Response(`Handler error (projects.csv): ${String(e?.message || e)}`, {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}

async function studiesJsonDirect(request, env, origin, url) {
	try {
		assertAirtableEnv(env);
		requireEnv(env, ["AIRTABLE_TABLE_STUDIES"]);
		const projectId = url.searchParams.get("project") || "";
		const base = env.AIRTABLE_BASE || env.AIRTABLE_BASE_ID;
		const key = env.AIRTABLE_API_KEY || env.AIRTABLE_PAT;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_STUDIES);
		const atUrl = `https://api.airtable.com/v0/${base}/${table}?pageSize=100`;
		const r = await fetch(atUrl, { headers: { authorization: `Bearer ${key}`, accept: "application/json" } });
		if (!r.ok) {
			const raw = await r.text().catch(() => "");
			return new Response(json({ ok: false, source: "airtable", status: r.status, error: safeSlice(raw, 2000) }), {
				status: 500,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}
		const data = await r.json();
		const records = Array.isArray(data?.records) ? data.records : [];
		const filtered = projectId ? records.filter(rec => {
			const f = rec?.fields || {};
			const proj = f.Project || f.project;
			if (Array.isArray(proj)) return proj.includes(projectId);
			return String(proj || "") === projectId;
		}) : records;
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
		return new Response(json({ ok: true, studies }), {
			status: 200,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		return new Response(json({ ok: false, error: String(e?.message || e) }), {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}

async function agentPagesDeployDirect(request, env, origin) {
	try {
		requireEnv(env, ["AGENT_PAGES_DEPLOY_TOKEN", "AGENT_PAGES_DEPLOY_HOOK_URL"]);
		const suppliedToken = bearerToken(request);
		if (!suppliedToken || suppliedToken !== env.AGENT_PAGES_DEPLOY_TOKEN) {
			return new Response(json({ ok: false, error: "unauthorised" }), {
				status: 401,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
			});
		}
		let payload = {};
		try { payload = await request.json(); } catch (_error) { payload = {}; }
		const deployResponse = await fetch(env.AGENT_PAGES_DEPLOY_HOOK_URL, { method: "POST" });
		const deployBody = await deployResponse.text().catch(() => "");
		return new Response(json({
			ok: deployResponse.ok,
			status: deployResponse.status,
			branch: payload.branch || null,
			commit: payload.commit || null,
			source: payload.source || "unknown",
			cloudflare: safeSlice(deployBody, 2000)
		}), {
			status: deployResponse.ok ? 202 : 502,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
		});
	} catch (e) {
		return new Response(json({ ok: false, error: String(e?.message || e) }), {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
		});
	}
}

export async function handleRequest(request, env) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const canonical = canonicalizePath(url.pathname);
	const redirect = maybeRedirect(request, canonical);
	if (redirect) return redirect;
	url.pathname = canonical;

	try {
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: { ...corsHeadersForEnv(env, origin), "Access-Control-Max-Age": "86400" }
			});
		}
		if (url.pathname === "/api/_diag/ping" && request.method === "GET") {
			return new Response(json({ ok: true, time: new Date().toISOString(), note: "handleRequest" }), {
				status: 200,
				headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
			});
		}
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
					hasAgentPagesDeployHook: !!env.AGENT_PAGES_DEPLOY_HOOK_URL,
					hasAgentPagesDeployToken: !!env.AGENT_PAGES_DEPLOY_TOKEN,
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
		if (url.pathname === "/api/agent-pages/deploy" && request.method === "POST") return agentPagesDeployDirect(request, env, origin);
		if (url.pathname === "/api/projects.csv" && request.method === "GET") return projectsCsvDirect(request, env, origin);
		if (url.pathname === "/api/studies" && request.method === "GET") return studiesJsonDirect(request, env, origin, url);

		let ResearchOpsService;
		let serviceLoadFailed = false;
		try {
			({ ResearchOpsService } = await import("./service.js"));
		} catch (e) {
			serviceLoadFailed = true;
			console.error("Failed to load ResearchOpsService", e);
			if (url.pathname.startsWith("/api/")) {
				return new Response(json({ ok: false, error: "Service temporarily unavailable", note: "Project CSV and Studies APIs are still available via direct handlers" }), {
					status: 503,
					headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
				});
			}
		}

		if (ResearchOpsService && !serviceLoadFailed) {
			const envCompat = { ...env, ALLOWED_ORIGINS: normalizeAllowedOrigins(env.ALLOWED_ORIGINS).join(",") };
			const service = new ResearchOpsService(envCompat);

			if (url.pathname === "/api/_diag/airtable" && request.method === "GET") return service.airtableProbe(origin, url);
			if (url.pathname === "/api/ai-rewrite" && request.method === "POST") return aiRewrite(request, envCompat, origin);
			if (url.pathname === "/api/project-details.csv" && request.method === "GET") return service.streamCsv(origin, envCompat.GH_PATH_DETAILS);

			if (url.pathname === "/api/journal-entries" && request.method === "GET") return service.listJournalEntries(origin, url);
			if (url.pathname === "/api/journal-entries" && request.method === "POST") return service.createJournalEntry(request, origin);
			if (url.pathname.startsWith("/api/journal-entries/")) {
				const entryId = decodeURIComponent(url.pathname.slice("/api/journal-entries/".length));
				if (request.method === "GET") return service.getJournalEntry(origin, entryId);
				if (request.method === "PATCH") return service.updateJournalEntry(request, origin, entryId);
				if (request.method === "DELETE") return service.deleteJournalEntry(origin, entryId);
			}

			if (url.pathname === "/api/excerpts" && request.method === "GET") return service.listExcerpts(origin, url);
			if (url.pathname === "/api/excerpts" && request.method === "POST") return service.createExcerpt(request, origin);
			if (url.pathname.startsWith("/api/excerpts/") && request.method === "PATCH") return service.updateExcerpt(request, origin, decodeURIComponent(url.pathname.slice("/api/excerpts/".length)));

			if (url.pathname === "/api/memos" && request.method === "GET") return service.listMemos(origin, url);
			if (url.pathname === "/api/memos" && request.method === "POST") return service.createMemo(request, origin);
			if (url.pathname.startsWith("/api/memos/") && request.method === "PATCH") return service.updateMemo(request, origin, decodeURIComponent(url.pathname.slice("/api/memos/".length)));

			if (url.pathname === "/api/code-applications" && request.method === "GET") return service.listCodeApplications(origin, url);
			if (url.pathname === "/api/codes" && request.method === "GET") return service.listCodes(origin, url);
			if (url.pathname === "/api/codes" && request.method === "POST") return service.createCode(request, origin);
			if (url.pathname.startsWith("/api/codes/") && request.method === "PATCH") {
				const codeId = decodeURIComponent(url.pathname.slice("/api/codes/".length));
				return typeof service.updateCode === "function" ? service.updateCode(request, origin, codeId) : service.createCode(request, origin);
			}

			if (url.pathname === "/api/analysis/timeline" && request.method === "GET") return service.timeline(origin, url);
			if (url.pathname === "/api/analysis/cooccurrence" && request.method === "GET") return service.cooccurrence(origin, url);
			if (url.pathname === "/api/analysis/retrieval" && request.method === "GET") return service.retrieval(origin, url);
			if (url.pathname === "/api/analysis/export" && request.method === "GET") return service.exportAnalysis(origin, url);

			if (url.pathname === "/api/impact" && request.method === "GET" && typeof service.listImpact === "function") return service.listImpact(origin, url);
			if (url.pathname === "/api/impact" && request.method === "POST" && typeof service.createImpact === "function") return service.createImpact(request, origin);
			if (url.pathname.startsWith("/api/impact/")) {
				const impactId = decodeURIComponent(url.pathname.slice("/api/impact/".length));
				if (request.method === "GET" && typeof service.getImpact === "function") return service.getImpact(origin, impactId);
				if (request.method === "PATCH" && typeof service.updateImpact === "function") return service.updateImpact(request, origin, impactId);
				if (request.method === "DELETE" && typeof service.deleteImpact === "function") return service.deleteImpact(origin, impactId);
			}

			if (url.pathname === "/api/studies" && request.method === "POST") return service.createStudy(request, origin);
			if (url.pathname.startsWith("/api/studies/")) {
				const m = url.pathname.match(/^\/api\/studies\/([^/]+)$/);
				if (m && request.method === "PATCH") return service.updateStudy(request, origin, decodeURIComponent(m[1]));
			}
			if (url.pathname === "/api/studies.csv" && request.method === "GET" && envCompat.GH_PATH_STUDIES) return service.streamCsv(origin, envCompat.GH_PATH_STUDIES);

			if (url.pathname === "/api/guides" && request.method === "GET") return service.listGuides(origin, url);
			if (url.pathname === "/api/guides" && request.method === "POST") return service.createGuide(request, origin);
			if (url.pathname.startsWith("/api/guides/")) {
				const parts = url.pathname.split("/").filter(Boolean);
				if (parts.length === 3) {
					const guideId = decodeURIComponent(parts[2]);
					if (request.method === "GET") return service.readGuide(origin, guideId);
					if (request.method === "PATCH") return service.updateGuide(request, origin, guideId);
				}
				if (parts.length === 4 && parts[3] === "publish" && request.method === "POST") return service.publishGuide(origin, decodeURIComponent(parts[2]));
			}

			if (url.pathname === "/api/partials" && request.method === "GET") return service.listPartials(origin);
			if (url.pathname === "/api/partials" && request.method === "POST") return service.createPartial(request, origin);
			if (url.pathname.startsWith("/api/partials/")) {
				const parts = url.pathname.split("/").filter(Boolean);
				if (parts.length === 3) {
					const partialId = decodeURIComponent(parts[2]);
					if (request.method === "GET") return service.readPartial(origin, partialId);
					if (request.method === "PATCH") return service.updatePartial(request, origin, partialId);
					if (request.method === "DELETE") return service.deletePartial(origin, partialId);
				}
			}

			if (url.pathname === "/api/participants/contact" && request.method === "GET" && typeof service.revealParticipantContact === "function") return service.revealParticipantContact(request, origin, url);
			if (url.pathname === "/api/participants" && request.method === "GET" && typeof service.listParticipants === "function") return service.listParticipants(request, origin, url);
			if (url.pathname === "/api/participants" && request.method === "POST" && typeof service.createParticipant === "function") return service.createParticipant(request, origin);

			if (url.pathname === "/api/sessions" && request.method === "GET" && typeof service.listSessions === "function") return service.listSessions(origin, url);
			if (url.pathname === "/api/sessions" && request.method === "POST" && typeof service.createSession === "function") return service.createSession(request, origin);
			if (url.pathname.startsWith("/api/sessions/")) {
				const match = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/ics)?$/);
				if (match) {
					const sessionId = decodeURIComponent(match[1]);
					const isIcs = match[2] === "/ics";
					if (request.method === "GET" && !isIcs && typeof service.getSession === "function") return service.getSession(origin, sessionId);
					if (request.method === "PATCH" && !isIcs && typeof service.updateSession === "function") return service.updateSession(request, origin, sessionId);
					if (request.method === "GET" && isIcs && typeof service.sessionIcs === "function") return service.sessionIcs(origin, sessionId);
				}
			}

			if (url.pathname === "/api/session-notes" && request.method === "GET") return service.listSessionNotes(origin, url);
			if (url.pathname === "/api/session-notes" && request.method === "POST") return service.createSessionNote(request, origin);
			if (url.pathname.startsWith("/api/session-notes/")) {
				const m = url.pathname.match(/^\/api\/session-notes\/([^/]+)$/);
				if (m && request.method === "PATCH") return service.updateSessionNote(request, origin, decodeURIComponent(m[1]));
			}

			if (url.pathname === "/api/comms/send" && request.method === "POST" && typeof service.sendComms === "function") return service.sendComms(request, origin);

			if (url.pathname === "/api/mural/auth" && request.method === "GET") return service.mural.muralAuth(origin, url);
			if (url.pathname === "/api/mural/callback" && request.method === "GET") return service.mural.muralCallback(origin, url);
			if (url.pathname === "/api/mural/verify" && request.method === "GET") return service.mural.muralVerify(origin, url);
			if (url.pathname === "/api/mural/resolve" && request.method === "GET") return service.mural.muralResolve(origin, url);
			if (url.pathname === "/api/mural/setup" && request.method === "POST") return service.mural.muralSetup(request, origin);
			if (url.pathname === "/api/mural/find" && request.method === "GET" && service?.mural && typeof service.mural.muralFind === "function") return service.mural.muralFind(origin, url);
			if (url.pathname === "/api/mural/await" && request.method === "GET" && service?.mural && typeof service.mural.muralAwait === "function") return service.mural.muralAwait(origin, url);
			if (request.method === "POST" && url.pathname === "/api/mural/journal-sync") {
				if (service?.mural && typeof service.mural.muralJournalSync === "function") return service.mural.muralJournalSync(request, origin);
				return new Response(json({ ok: false, error: "mural_journal_sync_not_configured" }), {
					status: 501,
					headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
				});
			}
			if (url.pathname === "/api/mural/workspaces" && request.method === "GET" && service?.mural && typeof service.mural.muralListWorkspaces === "function") return service.mural.muralListWorkspaces(origin, url);
			if (url.pathname === "/api/mural/me" && request.method === "GET" && service?.mural && typeof service.mural.muralMe === "function") return service.mural.muralMe(origin, url);
			if (url.pathname === "/api/mural/debug-env" && request.method === "GET" && service?.mural && typeof service.mural.muralDebugEnv === "function") return service.mural.muralDebugEnv(origin);

			if (url.pathname.startsWith("/api/")) {
				return new Response(json({ error: "Not found", path: url.pathname }), {
					status: 404,
					headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
				});
			}
		}

		if (!hasFetchBinding(env.ASSETS)) {
			return new Response("Not found (assets binding missing)", {
				status: 404,
				headers: { ...corsHeadersForEnv(env, origin), "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" }
			});
		}
		return env.ASSETS.fetch(request);
	} catch (e) {
		console.error("Router fatal", e);
		return new Response(json({ error: "Internal error", message: String(e?.message || e) }), {
			status: 500,
			headers: { ...corsHeadersForEnv(env, origin), "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff" }
		});
	}
}
