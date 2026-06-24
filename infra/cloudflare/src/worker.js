import { resolveAuthenticatedContext as resolveBaseAuthenticatedContext } from "./core/auth/access.js";
import { handleMeRoute } from "./core/auth/access-scoped.js";
import { resolveAuthenticatedContext } from "./core/auth/access-scoped.js";
import { handlePasswordlessAuthRoute } from "./core/auth/passwordless.js";
import { handleRegistrationRequestsRoute } from "./core/auth/registration-requests.js";
import { handleRoleAssignmentsRoute } from "./core/auth/role-assignments-scoped.js";
import { assertRoutePermission } from "./core/auth/route-permissions.js";
import { handleTeamAccessRequestsRoute } from "./core/auth/team-access-requests.js";
import { handleRequest } from "./core/router.js";
import { ResearchOpsService } from "./service/index.js";
import { createProjectRecord, getProjectRecord, listProjectRecords, updateProjectRecord } from "./service/project-record-routes.js";
import { diagnoseProjectLinkedRecords } from "./service/studies.js";

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
	if (/\.(?:css|js|mjs|json|svg|ico|webp|png|jpg|jpeg|gif|woff2?)$/i.test(pathname)) return "public, max-age=3600, stale-while-revalidate=86400";
	if (pathname.startsWith("/partials/") || pathname.startsWith("/components/")) return "public, max-age=3600, stale-while-revalidate=86400";
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
		if (!headers.has("X-ResearchOps-Worker-SHA")) headers.set("X-ResearchOps-Worker-SHA", env.RESEARCHOPS_BUILD_SHA || "unknown");
		if (!headers.has("X-ResearchOps-Worker-Branch")) headers.set("X-ResearchOps-Worker-Branch", env.RESEARCHOPS_BUILD_BRANCH || "unknown");
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

function requestForRoutePermission(request, routePattern) {
	const url = new URL(request.url);
	url.pathname = routePattern;
	url.search = "";
	return new Request(url.toString(), { method: request.method, headers: request.headers });
}

const STUDY_SUPPORT_AUTH_PERMISSIONS = [
	["study.support.view", "View study support setup", "Can view note taker and observer setup for a study."],
	["study.support.manage", "Manage study support setup", "Can create, update or remove note taker and observer setup for a study."]
];

const STUDY_SUPPORT_ROLE_PERMISSIONS = [
	["role_researcher", "study.support.view"],
	["role_researcher", "study.support.manage"],
	["role_research_lead", "study.support.view"],
	["role_research_lead", "study.support.manage"],
	["role_team_admin", "study.support.view"],
	["role_team_admin", "study.support.manage"]
];

const STUDY_SUPPORT_ROUTE_PERMISSIONS = [
	["route_api_study_support_get", "GET", "/api/study-support", "[\"study.support.view\"]"],
	["route_api_study_support_setup_put", "PUT", "/api/study-support/setup", "[\"study.support.manage\"]"],
	["route_api_study_support_people_post", "POST", "/api/study-support/people", "[\"study.support.manage\"]"],
	["route_api_study_support_people_delete", "DELETE", "/api/study-support/people/:id", "[\"study.support.manage\"]"]
];

const REPOSITORY_AUTH_PERMISSIONS = [
	["repository.view", "View research repository", "Can view published, non-PII research repository artefacts."],
	["repository.curate", "Curate research repository", "Can review candidate artefacts and manage repository publication queues."]
];

const REPOSITORY_ROLE_PERMISSIONS = [
	["role_researcher", "repository.view"],
	["role_research_lead", "repository.view"],
	["role_research_lead", "repository.curate"],
	["role_team_admin", "repository.view"],
	["role_team_admin", "repository.curate"]
];

const REPOSITORY_ROUTE_PERMISSIONS = [
	["route_api_repository_get", "GET", "/api/repository", "[\"repository.view\"]"],
	["route_api_repository_artefacts_get", "GET", "/api/repository/artefacts", "[\"repository.view\"]"],
	["route_api_repository_artefacts_post", "POST", "/api/repository/artefacts", "[\"repository.view\"]"],
	["route_api_repository_artefact_get", "GET", "/api/repository/artefacts/:id", "[\"repository.view\"]"],
	["route_api_repository_review_candidates_get", "GET", "/api/repository/review/candidates", "[\"repository.curate\"]"],
	["route_api_repository_review_stale_get", "GET", "/api/repository/review/stale", "[\"repository.curate\"]"],
	["route_api_repository_review_withdrawn_get", "GET", "/api/repository/review/withdrawn", "[\"repository.curate\"]"],
	["route_api_repository_review_actions_post", "POST", "/api/repository/review/:id/actions", "[\"repository.curate\"]"]
];
const repositoryAuthDeclarationsReadyByDatabase = new WeakMap();

async function ensureStudySupportAuthDeclarations(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) return;

	for (const [code, label, description] of STUDY_SUPPORT_AUTH_PERMISSIONS) {
		await db.prepare(`
			INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved)
			VALUES (?, ?, ?, 1, 0)
		`).bind(code, label, description).run();
	}

	for (const [roleId, permissionCode] of STUDY_SUPPORT_ROLE_PERMISSIONS) {
		await db.prepare(`
			INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code)
			VALUES (?, ?)
		`).bind(roleId, permissionCode).run();
	}

	for (const [id, method, routePattern, requiredPermissionsJson] of STUDY_SUPPORT_ROUTE_PERMISSIONS) {
		await db.prepare(`
			INSERT OR IGNORE INTO auth_route_permissions
				(id, method, route_pattern, required_permissions_json, auth_required, implementation_status)
			VALUES (?, ?, ?, ?, 1, 'implemented')
		`).bind(id, method, routePattern, requiredPermissionsJson).run();
	}
}

async function ensureRepositoryAuthDeclarations(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) return;
	if (repositoryAuthDeclarationsReadyByDatabase.has(db)) {
		return repositoryAuthDeclarationsReadyByDatabase.get(db);
	}

	const pending = (async () => {
		for (const [code, label, description] of REPOSITORY_AUTH_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved)
				VALUES (?, ?, ?, 1, 0)
			`).bind(code, label, description).run();
		}

		for (const [roleId, permissionCode] of REPOSITORY_ROLE_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code)
				VALUES (?, ?)
			`).bind(roleId, permissionCode).run();
		}

		for (const [id, method, routePattern, requiredPermissionsJson] of REPOSITORY_ROUTE_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_route_permissions
					(id, method, route_pattern, required_permissions_json, auth_required, implementation_status)
				VALUES (?, ?, ?, ?, 1, 'implemented')
			`).bind(id, method, routePattern, requiredPermissionsJson).run();
		}
	})();

	repositoryAuthDeclarationsReadyByDatabase.set(db, pending);
	pending.catch(() => repositoryAuthDeclarationsReadyByDatabase.delete(db));
	return pending;
}

function workerBuild(env) {
	return { sha: env.RESEARCHOPS_BUILD_SHA || "unknown", branch: env.RESEARCHOPS_BUILD_BRANCH || "unknown" };
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function missingEnv(env, keys) {
	return keys.filter((key) => !env?.[key]);
}

function safeAirtableHeaders(response) {
	const retryAfter = response.headers.get("retry-after") || "";
	const limit = response.headers.get("x-ratelimit-limit") || "";
	const remaining = response.headers.get("x-ratelimit-remaining") || "";
	const reset = response.headers.get("x-ratelimit-reset") || "";
	return {
		...(retryAfter ? { retryAfter } : {}),
		...(limit ? { rateLimit: limit } : {}),
		...(remaining ? { rateLimitRemaining: remaining } : {}),
		...(reset ? { rateLimitReset: reset } : {})
	};
}

function projectsTableProbe(table, requestAttempted, status, firstRecordIdValid = false) {
	let verificationStatus = "not_attempted";
	if (requestAttempted && status === 200 && firstRecordIdValid) verificationStatus = "verified";
	else if (requestAttempted && status === 200) verificationStatus = "records_missing_or_unverified";
	else if (requestAttempted && status === 429) verificationStatus = "blocked_by_rate_limit";
	else if (requestAttempted && status === 401) verificationStatus = "blocked_by_authentication";
	else if (requestAttempted && status === 403) verificationStatus = "blocked_by_permission";
	else if (requestAttempted && status === 404) verificationStatus = "table_or_base_not_found";
	else if (requestAttempted) verificationStatus = "blocked_by_upstream_error";
	return { configuredTableName: table, requestAttempted, verificationStatus, ...(requestAttempted ? { httpStatus: status } : {}) };
}

async function probeAirtableProjects(env) {
	const missing = missingEnv(env, ["AIRTABLE_BASE_ID", "AIRTABLE_TABLE_PROJECTS", "AIRTABLE_API_KEY"]);
	const table = env.AIRTABLE_TABLE_PROJECTS || "Projects";
	const base = { configured: missing.length === 0, baseIdPresent: Boolean(env.AIRTABLE_BASE_ID), apiKeyPresent: Boolean(env.AIRTABLE_API_KEY), table, missing };
	if (missing.length) return { ...base, status: "not_configured", recordCount: 0, projectsTable: projectsTableProbe(table, false, "not_configured") };
	const params = new URLSearchParams({ pageSize: "1", maxRecords: "1" });
	const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${params.toString()}`;
	const response = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${env.AIRTABLE_API_KEY}` } });
	const text = await response.text();
	let data = {};
	try {
		data = text ? JSON.parse(text) : {};
	} catch {
		data = {};
	}
	if (!response.ok) {
		return { ...base, status: response.status, errorType: data?.error?.type || "", errorMessage: data?.error?.message || "", message: data?.error?.message || data?.error?.type || `airtable_http_${response.status}`, headers: safeAirtableHeaders(response), recordCount: 0, projectsTable: projectsTableProbe(table, true, response.status) };
	}
	const records = Array.isArray(data.records) ? data.records : [];
	const first = records[0] || null;
	const firstRecordId = first?.id || "";
	const firstRecordIdValid = isAirtableRecordId(firstRecordId);
	return { ...base, status: response.status, headers: safeAirtableHeaders(response), recordCount: records.length, firstRecordId, firstRecordIdValid, fieldNames: Object.keys(first?.fields || {}).sort(), projectsTable: projectsTableProbe(table, true, response.status, firstRecordIdValid) };
}

async function probeProjectCache(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) return { bindingPresent: false, cacheTablePresent: false, activeProjectCount: 0, validProjectCount: 0, invalidProjectCount: 0 };
	try {
		const response = await db.prepare("SELECT id, name, payload_json FROM rops_projects_cache WHERE active = 1").all();
		const rows = response?.results || [];
		const validProjectCount = rows.filter((row) => isAirtableRecordId(row.id) && (row.name || row.payload_json)).length;
		return { bindingPresent: true, cacheTablePresent: true, activeProjectCount: rows.length, validProjectCount, invalidProjectCount: Math.max(rows.length - validProjectCount, 0) };
	} catch (error) {
		return { bindingPresent: true, cacheTablePresent: false, activeProjectCount: 0, validProjectCount: 0, invalidProjectCount: 0, message: String(error?.message || error) };
	}
}

async function handleProjectSourceDiagnostics(request, env) {
	const authContext = await authContextFor(request, env);
	const [airtable, d1] = await Promise.all([probeAirtableProjects(env), probeProjectCache(env)]);
	const airtableUsable = airtable.status === 200 && airtable.firstRecordIdValid === true;
	const d1Usable = d1.bindingPresent === true && d1.cacheTablePresent === true && d1.validProjectCount > 0;
	return new Response(JSON.stringify({ ok: airtableUsable || d1Usable, route: "/api/_diag/projects-source", build: workerBuild(env), auth: { authenticated: true, userIdPresent: Boolean(authContext?.user?.id || authContext?.userId), teamCount: [...(authContext?.teamMemberships || []), ...(authContext?.memberTeams || []), ...(authContext?.teams || [])].length, activeTeamPresent: Boolean(authContext?.activeTeam) }, airtable, d1 }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function handleProjectLinkedDiagnostics(request, env) {
	const authContext = await authContextFor(request, env);
	const origin = request.headers.get("Origin") || "";
	const url = new URL(request.url);
	const service = serviceFor(env);
	return diagnoseProjectLinkedRecords(service, origin, url, authContext);
}

async function handleProjects(request, env) {
	const authContext = await authContextFor(request, env);
	if (request.method === "GET") return listProjectRecords(request, env, authContext);
	if (request.method === "POST") return createProjectRecord(request, env, authContext);
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleProjectRecord(request, env, apiPath, executionCtx) {
	const authContext = await authContextFor(request, env);
	const match = apiPath.match(/^\/api\/projects\/([^/]+)$/);
	if (!match) return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
	const projectId = decodeURIComponent(match[1]);
	if (request.method === "GET") return getProjectRecord(request, env, projectId, authContext);
	if (request.method === "PATCH") return updateProjectRecord(request, env, projectId, authContext, executionCtx);
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleStudies(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	if (apiPath === "/api/studies" && request.method === "GET") return service.listStudies(origin, url);
	if (apiPath === "/api/studies" && request.method === "POST") return service.createStudy(request, origin);
	const match = apiPath.match(/^\/api\/studies\/([^/]+)$/);
	if (match && request.method === "PATCH") return service.updateStudy(request, origin, decodeURIComponent(match[1]));
	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
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

async function handleStudySupport(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	await ensureStudySupportAuthDeclarations(env);
	const authContext = await authContextFor(request, env);
	const routePermissionRequest = apiPath.match(/^\/api\/study-support\/people\/([^/]+)$/)
		? requestForRoutePermission(request, "/api/study-support/people/:id")
		: request;
	await assertRoutePermission(routePermissionRequest, env, authContext);
	if (apiPath === "/api/study-support" && request.method === "GET") return service.readStudySupport(origin, url);
	if (apiPath === "/api/study-support/setup" && request.method === "PUT") return service.saveStudySupportSetup(request, origin);
	if (apiPath === "/api/study-support/people" && request.method === "POST") return service.createStudySupportPerson(request, origin);
	const match = apiPath.match(/^\/api\/study-support\/people\/([^/]+)$/);
	if (match && request.method === "DELETE") return service.deleteStudySupportPerson(origin, decodeURIComponent(match[1]));
	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleRepository(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	await ensureRepositoryAuthDeclarations(env);
	const authContext = await resolveBaseAuthenticatedContext(request, env);
	const routePermissionRequest = apiPath.match(/^\/api\/repository\/artefacts\/([^/]+)$/)
		? requestForRoutePermission(request, "/api/repository/artefacts/:id")
		: apiPath.match(/^\/api\/repository\/review\/([^/]+)\/actions$/)
			? requestForRoutePermission(request, "/api/repository/review/:id/actions")
			: request;
	await assertRoutePermission(routePermissionRequest, env, authContext);

	const reviewMatch = apiPath.match(/^\/api\/repository\/review\/(candidates|stale|withdrawn)$/);
	if (reviewMatch && request.method === "GET") {
		return service.listRepositoryReviewQueue(origin, reviewMatch[1], url, authContext);
	}

	const reviewActionMatch = apiPath.match(/^\/api\/repository\/review\/([^/]+)\/actions$/);
	if (reviewActionMatch && request.method === "POST") {
		return service.applyRepositoryReviewAction(request, origin, decodeURIComponent(reviewActionMatch[1]), authContext);
	}

	if ((apiPath === "/api/repository" || apiPath === "/api/repository/artefacts") && request.method === "GET") {
		return service.listRepository(origin, url, authContext);
	}

	if (apiPath === "/api/repository/artefacts" && request.method === "POST") {
		return service.createRepositoryCandidate(request, origin, authContext);
	}

	const match = apiPath.match(/^\/api\/repository\/artefacts\/([^/]+)$/);
	if (match && request.method === "GET") {
		return service.readRepositoryArtefact(origin, decodeURIComponent(match[1]));
	}

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
			else if (method === "GET" && (apiPath === "/api/me" || apiPath === "/api/me/identity" || apiPath === "/api/me/permissions")) result = await handleMeRoute(request, env, apiPath);
			else if ((method === "GET" || method === "POST") && apiPath.startsWith("/api/team-access/requests")) result = await handleTeamAccessRequestsRoute(request, env, apiPath);
			else if (method === "POST" && apiPath === "/api/auth/role-assignments") result = await handleRoleAssignmentsRoute(request, env);
			else if (method === "GET" && apiPath === "/api/_diag/projects-source") result = await handleProjectSourceDiagnostics(request, env);
			else if (method === "GET" && apiPath === "/api/_diag/project-linked-records") result = await handleProjectLinkedDiagnostics(request, env);
			else if ((method === "GET" || method === "POST") && apiPath === "/api/projects") result = await handleProjects(request, env);
			else if (apiPath.startsWith("/api/projects/")) result = await handleProjectRecord(request, env, apiPath, ctx);
			else if (apiPath === "/api/studies" || apiPath.startsWith("/api/studies/")) result = await handleStudies(request, env, apiPath);
			else if (apiPath === "/api/synthesis" || apiPath.startsWith("/api/synthesis/")) result = await handleSynthesis(request, env, apiPath);
			else if (apiPath === "/api/consent-forms" || apiPath.startsWith("/api/consent-forms/")) result = await handleConsentForms(request, env, apiPath);
			else if (apiPath === "/api/participant-consent" || apiPath.startsWith("/api/participant-consent/")) result = await handleParticipantConsent(request, env, apiPath);
			else if (apiPath === "/api/study-support" || apiPath.startsWith("/api/study-support/")) result = await handleStudySupport(request, env, apiPath);
			else if (apiPath === "/api/repository" || apiPath.startsWith("/api/repository/")) result = await handleRepository(request, env, apiPath);
			else result = await handleRequest(request, env, ctx);
			return withCORS(env, request, coerceResponse(result));
		} catch (e) {
			if (e?.status && e?.code) return withCORS(env, request, authErrorResponse(e));
			return withCORS(env, request, new Response(JSON.stringify({ error: "Internal error", detail: String(e?.message || e) }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }));
		}
	}
};
