import { handleMeRoute } from "./core/auth/access-scoped.js";
import { resolveAuthenticatedContext } from "./core/auth/access-scoped.js";
import { handlePasswordlessAuthRoute } from "./core/auth/passwordless.js";
import { handleRegistrationRequestsRoute } from "./core/auth/registration-requests.js";
import { handleRoleAssignmentsRoute } from "./core/auth/role-assignments-scoped.js";
import { handleRequest } from "./core/router.js";
import { ResearchOpsService } from "./service/index.js";
import { createProjectRecord, getProjectRecord, listProjectRecords } from "./service/project-record-routes.js";

function coerceResponse(res) {
	if (res instanceof Response) return res;
	if (res === undefined || res === null) {
		return new Response(JSON.stringify({ error: "Handler returned no response" }), {
			status: 500,
			headers: { "content-type": "application/json; charset=utf-8" }
		});
	}
	if (typeof res === "string" || res instanceof ArrayBuffer || res instanceof Uint8Array) return new Response(res);
	return new Response(JSON.stringify(res), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
}

function authErrorResponse(error) {
	return new Response(JSON.stringify({ ok: false, error: error.code, message: error.message }), {
		status: error.status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}

function isResearchOpsPagesOrigin(origin) {
	try {
		const { hostname, protocol } = new URL(origin);
		if (protocol !== "https:") return false;
		return hostname === "researchops.pages.dev" || hostname.endsWith(".researchops.pages.dev");
	} catch {
		return false;
	}
}

function resolveAllowedOrigin(env, request) {
	try {
		const origin = request.headers.get("Origin") || "";
		const raw = env.ALLOWED_ORIGINS;
		const list = Array.isArray(raw) ? raw : String(raw || "").split(",").map(s => s.trim()).filter(Boolean);
		if (!origin) return "*";
		if (list.includes(origin)) return origin;
		if (isResearchOpsPagesOrigin(origin)) return origin;
		return "null";
	} catch {
		return "*";
	}
}

function buildCorsHeaders(env, request) {
	return {
		"Access-Control-Allow-Origin": resolveAllowedOrigin(env, request),
		"Vary": "Origin",
		"Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		"Access-Control-Allow-Headers": "Authorization, Content-Type, X-ResearchOps-Team-Id",
		"Access-Control-Allow-Credentials": "true"
	};
}

function assetCacheControl(pathname) {
	if (pathname.startsWith("/api/")) return "no-store";
	if (pathname.endsWith(".html") || pathname === "/" || pathname.endsWith("/")) return "no-store";
	if (/\.(?:css|js|mjs|json|svg|ico|webp|png|jpg|jpeg|gif|woff2?)$/i.test(pathname)) {
		return "public, max-age=3600, stale-while-revalidate=86400";
	}
	if (pathname.startsWith("/partials/") || pathname.startsWith("/components/")) {
		return "public, max-age=3600, stale-while-revalidate=86400";
	}
	return "no-store";
}

function withCORS(env, request, response) {
	try {
		const url = new URL(request.url);
		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(buildCorsHeaders(env, request))) {
			if (!headers.has(key)) headers.set(key, value);
		}
		if (!headers.has("Cache-Control")) headers.set("Cache-Control", assetCacheControl(url.pathname));
		if (!headers.has("X-Content-Type-Options")) headers.set("X-Content-Type-Options", "nosniff");
		return new Response(response.body, { status: response.status, headers });
	} catch {
		return response;
	}
}

function normaliseApiPath(pathname) {
	let path = pathname || "/";
	path = path.replace(/\/{2,}/g, "/");
	if (path.startsWith("/api/") && path.endsWith("/") && path !== "/api/") path = path.slice(0, -1);
	return path;
}

function envCompat(env) {
	const allowed = Array.isArray(env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS.join(",") : String(env.ALLOWED_ORIGINS || "");
	return { ...env, ALLOWED_ORIGINS: allowed };
}

function serviceFor(env) {
	return new ResearchOpsService(envCompat(env));
}

async function authContextFor(request, env) {
	return resolveAuthenticatedContext(request, env);
}

async function handleProjects(request, env) {
	const authContext = await authContextFor(request, env);

	if (request.method === "GET") return listProjectRecords(request, env, authContext);
	if (request.method === "POST") return createProjectRecord(request, env, authContext);

	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}

async function handleProjectRecord(request, env, apiPath) {
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	const authContext = await authContextFor(request, env);
	const match = apiPath.match(/^\/api\/projects\/([^/]+)$/);

	if (!match) {
		return new Response(JSON.stringify({ error: "Not found", path: apiPath }), {
			status: 404,
			headers: { "content-type": "application/json; charset=utf-8" }
		});
	}

	const projectId = decodeURIComponent(match[1]);
	if (request.method === "GET") return getProjectRecord(request, env, projectId, authContext);
	if (request.method === "PATCH") return service.updateProjectFraming(request, origin, projectId, authContext);

	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}

async function handleSynthesis(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);

	if (apiPath === "/api/synthesis/evidence" && request.method === "GET") return service.listSynthesisEvidence(origin, url);
	if (apiPath === "/api/synthesis" && request.method === "GET") return service.listSynthesis(origin, url);
	if (apiPath === "/api/synthesis/clusters" && request.method === "POST") return service.createSynthesisCluster(request, origin, url);
	if (apiPath === "/api/synthesis/themes" && request.method === "POST") return service.createSynthesisTheme(request, origin, url);

	const clusterMatch = apiPath.match(/^\/api\/synthesis\/clusters\/([^/]+)$/);
	if (clusterMatch) {
		const clusterId = decodeURIComponent(clusterMatch[1]);
		if (request.method === "PATCH") return service.updateSynthesisCluster(request, origin, url, clusterId);
		if (request.method === "DELETE") return service.deleteSynthesisCluster(origin, url, clusterId);
	}

	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleConsentForms(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	if (apiPath === "/api/consent-forms" && request.method === "GET") return service.listConsentForms(origin, url);
	if (apiPath === "/api/consent-forms" && request.method === "POST") return service.createConsentForm(request, origin);
	const match = apiPath.match(/^\/api\/consent-forms\/([^/]+)(\/publish)?$/);
	if (!match) return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
	const id = decodeURIComponent(match[1]);
	const publish = match[2] === "/publish";
	if (request.method === "GET" && !publish) return service.readConsentForm(origin, id);
	if (request.method === "PATCH" && !publish) return service.updateConsentForm(request, origin, id);
	if (request.method === "POST" && publish) return service.publishConsentForm(origin, id);
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleParticipantConsent(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	if (apiPath === "/api/participant-consent" && request.method === "GET") return service.listParticipantConsent(origin, url);
	if (apiPath === "/api/participant-consent" && request.method === "POST") return service.createParticipantConsent(request, origin);
	const match = apiPath.match(/^\/api\/participant-consent\/([^/]+)$/);
	if (match && request.method === "PATCH") return service.updateParticipantConsent(request, origin, decodeURIComponent(match[1]));
	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

export default {
	async fetch(request, env, ctx) {
		const { method, url } = request;
		const pathname = new URL(url).pathname;
		const apiPath = normaliseApiPath(pathname);

		if (method === "OPTIONS") return withCORS(env, request, new Response(null, { status: 204 }));

		try {
			let result;
			if ((method === "GET" || method === "POST") && apiPath === "/api/auth/registration-requests") result = await handleRegistrationRequestsRoute(request, env, apiPath);
			else if (method === "POST" && apiPath.startsWith("/api/auth/email/")) result = await handlePasswordlessAuthRoute(request, env, apiPath);
			else if (method === "POST" && apiPath === "/api/auth/logout") result = await handlePasswordlessAuthRoute(request, env, apiPath);
			else if (method === "GET" && (apiPath === "/api/me" || apiPath === "/api/me/permissions")) result = await handleMeRoute(request, env, apiPath);
			else if (method === "POST" && apiPath === "/api/auth/role-assignments") result = await handleRoleAssignmentsRoute(request, env);
			else if ((method === "GET" || method === "POST") && apiPath === "/api/projects") result = await handleProjects(request, env);
			else if (apiPath.startsWith("/api/projects/")) result = await handleProjectRecord(request, env, apiPath);
			else if (apiPath === "/api/synthesis" || apiPath.startsWith("/api/synthesis/")) result = await handleSynthesis(request, env, apiPath);
			else if (apiPath === "/api/consent-forms" || apiPath.startsWith("/api/consent-forms/")) result = await handleConsentForms(request, env, apiPath);
			else if (apiPath === "/api/participant-consent" || apiPath.startsWith("/api/participant-consent/")) result = await handleParticipantConsent(request, env, apiPath);
			else result = await handleRequest(request, env, ctx);
			return withCORS(env, request, coerceResponse(result));
		} catch (e) {
			if (e?.status && e?.code) return withCORS(env, request, authErrorResponse(e));
			return withCORS(env, request, new Response(JSON.stringify({ error: "Internal error", detail: String(e?.message || e) }), {
				status: 500,
				headers: { "content-type": "application/json; charset=utf-8" }
			}));
		}
	}
};
