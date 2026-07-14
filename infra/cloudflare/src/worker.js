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
import { enforceRetention } from "./service/retention.js";
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

const RESEARCHOPS_CUSTOM_ORIGINS = new Set([
	"https://research-operations.com",
	"https://www.research-operations.com",
	"https://govuk.research-operations.com"
]);

function isResearchOpsCustomDomainOrigin(origin) {
	return RESEARCHOPS_CUSTOM_ORIGINS.has(origin);
}

function isResearchOpsPagesOrigin(origin) {
	try {
		const { hostname, protocol } = new URL(origin);
		if (protocol !== "https:") return false;
		return hostname === "researchops.pages.dev";
	} catch {
		return false;
	}
}

function allowPreviewPagesWildcard(env) {
	return String(env.RESEARCHOPS_ALLOW_PAGES_PREVIEW_ORIGINS || "").toLowerCase() === "true";
}

function isAllowedPreviewPagesOrigin(env, origin) {
	if (!allowPreviewPagesWildcard(env)) return false;
	try {
		const { hostname, protocol } = new URL(origin);
		return protocol === "https:" && hostname.endsWith(".researchops.pages.dev") && hostname !== "researchops.pages.dev";
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
		if (isResearchOpsCustomDomainOrigin(origin)) return origin;
		if (isResearchOpsPagesOrigin(origin)) return origin;
		if (isAllowedPreviewPagesOrigin(env, origin)) return origin;
		return "null";
	} catch {
		return "*";
	}
}

function isAllowedRequestOrigin(env, request) {
	const origin = request.headers.get("Origin") || "";
	if (!origin) return true;
	const raw = env.ALLOWED_ORIGINS;
	const list = Array.isArray(raw) ? raw : String(raw || "").split(",").map(s => s.trim()).filter(Boolean);
	return list.includes(origin) || isResearchOpsCustomDomainOrigin(origin) || isResearchOpsPagesOrigin(origin) || isAllowedPreviewPagesOrigin(env, origin);
}

function buildCorsHeaders(env, request) {
	return {
		"Access-Control-Allow-Origin": resolveAllowedOrigin(env, request),
		"Vary": "Origin",
		"Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		"Access-Control-Allow-Headers": "Authorization, Content-Type, X-ResearchOps-Team-Id, X-ResearchOps-CSRF",
		"Access-Control-Allow-Credentials": "true"
	};
}

function diagnosticsEnabled(env = {}) {
	return String(env.RESEARCHOPS_DIAGNOSTICS_ENABLED || "").toLowerCase() === "true";
}

function isStateChangingMethod(method) {
	return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

function hasPasswordlessSessionCookie(request) {
	return String(request.headers.get("Cookie") || "")
		.split(";")
		.map(part => part.trim())
		.some(part => part.startsWith("rops_session="));
}

function sameOriginRequest(request) {
	const origin = request.headers.get("Origin") || "";
	if (!origin) return false;
	try {
		return new URL(origin).origin === new URL(request.url).origin;
	} catch {
		return false;
	}
}

function isCsrfExemptPath(apiPath) {
	return apiPath === "/api/auth/logout" ||
		apiPath === "/api/auth/registration-requests" ||
		apiPath.startsWith("/api/auth/email/");
}

function hasCsrfHeader(request) {
	const value = String(request.headers.get("X-ResearchOps-CSRF") || "").trim().toLowerCase();
	return value === "1" || value === "required" || value === "pages-proxy";
}

function assertTrustedMutationRequest(request, env, apiPath = "") {
	if (!isStateChangingMethod(request.method)) return;
	if (!isAllowedRequestOrigin(env, request)) {
		const error = new Error("This request origin is not allowed.");
		error.status = 403;
		error.code = "origin_not_allowed";
		throw error;
	}
	const secFetchSite = String(request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
	if (secFetchSite === "cross-site" && !request.headers.get("Origin")) {
		const error = new Error("Cross-site browser mutations require an allowed Origin header.");
		error.status = 403;
		error.code = "csrf_origin_required";
		throw error;
	}
	if (!isCsrfExemptPath(apiPath) && hasPasswordlessSessionCookie(request) && !sameOriginRequest(request) && !hasCsrfHeader(request)) {
		const error = new Error("Cookie-authenticated mutations require CSRF confirmation.");
		error.status = 403;
		error.code = "csrf_header_required";
		throw error;
	}
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
		if (!headers.has("Referrer-Policy")) headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
		if (!headers.has("Permissions-Policy")) headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
		if (!headers.has("X-Frame-Options")) headers.set("X-Frame-Options", "DENY");
		if (!headers.has("Content-Security-Policy")) headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
		if (url.protocol === "https:" && !headers.has("Strict-Transport-Security")) headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
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
const researchDataAuthDeclarationsReadyByDatabase = new WeakMap();

const RESEARCH_DATA_AUTH_PERMISSIONS = [
	["project.view", "View projects", "Can view project records and project-level research context."],
	["project.manage", "Manage projects", "Can create or update project records."],
	["study.view", "View studies", "Can view study records and associated research planning data."],
	["study.manage", "Manage studies", "Can create or update study records."],
	["study.ethics.view", "View study ethics records", "Can view study ethics and research risk records and generated submission documents."],
	["study.ethics.manage", "Manage study ethics records", "Can record study ethics risk next steps and generate submission documents."],
	["research.content.view", "View research content", "Can view journal entries, memos, codes, guides, sessions and analysis."],
	["research.content.manage", "Manage research content", "Can create, update or delete journal entries, memos, codes, guides, sessions and analysis."],
	["research.integration.manage", "Manage research integrations", "Can use integrations that write or synchronise research data."],
	["deployment.trigger", "Trigger deployments", "Can trigger governed ResearchOps deployment hooks."],
	["synthesis.view", "View synthesis", "Can view research evidence, clusters and themes."],
	["synthesis.manage", "Manage synthesis", "Can create, update or delete research synthesis records."],
	["consent.form.view", "View consent forms", "Can view consent form templates and versions."],
	["consent.form.manage", "Manage consent forms", "Can create, update or publish consent forms."],
	["participant.consent.view", "View participant consent", "Can view participant consent status for a study."],
	["participant.consent.manage", "Manage participant consent", "Can record or update participant consent."],
	["sourcebook.view", "View sourcebook", "Can view Sourcebook pillars, clauses and governance guidance."],
	["project.diagnostics.view", "View project diagnostics", "Can view project source diagnostics for operational assurance."]
];

const RESEARCH_DATA_ROLE_PERMISSIONS = [
	["role_researcher", "project.view"],
	["role_researcher", "project.manage"],
	["role_researcher", "study.view"],
	["role_researcher", "study.manage"],
	["role_researcher", "study.ethics.view"],
	["role_researcher", "study.ethics.manage"],
	["role_researcher", "research.content.view"],
	["role_researcher", "research.content.manage"],
	["role_researcher", "research.integration.manage"],
	["role_researcher", "synthesis.view"],
	["role_researcher", "synthesis.manage"],
	["role_researcher", "consent.form.view"],
	["role_researcher", "consent.form.manage"],
	["role_researcher", "participant.consent.view"],
	["role_researcher", "participant.consent.manage"],
	["role_researcher", "sourcebook.view"],
	["role_research_lead", "project.view"],
	["role_research_lead", "project.manage"],
	["role_research_lead", "study.view"],
	["role_research_lead", "study.manage"],
	["role_research_lead", "study.ethics.view"],
	["role_research_lead", "study.ethics.manage"],
	["role_research_lead", "research.content.view"],
	["role_research_lead", "research.content.manage"],
	["role_research_lead", "research.integration.manage"],
	["role_research_lead", "synthesis.view"],
	["role_research_lead", "synthesis.manage"],
	["role_research_lead", "consent.form.view"],
	["role_research_lead", "consent.form.manage"],
	["role_research_lead", "participant.consent.view"],
	["role_research_lead", "participant.consent.manage"],
	["role_research_lead", "sourcebook.view"],
	["role_research_lead", "project.diagnostics.view"],
	["role_team_admin", "project.view"],
	["role_team_admin", "project.manage"],
	["role_team_admin", "study.view"],
	["role_team_admin", "study.manage"],
	["role_team_admin", "study.ethics.view"],
	["role_team_admin", "study.ethics.manage"],
	["role_team_admin", "research.content.view"],
	["role_team_admin", "research.content.manage"],
	["role_team_admin", "research.integration.manage"],
	["role_team_admin", "deployment.trigger"],
	["role_team_admin", "synthesis.view"],
	["role_team_admin", "synthesis.manage"],
	["role_team_admin", "consent.form.view"],
	["role_team_admin", "consent.form.manage"],
	["role_team_admin", "participant.consent.view"],
	["role_team_admin", "participant.consent.manage"],
	["role_team_admin", "sourcebook.view"],
	["role_team_admin", "project.diagnostics.view"]
];

const RESEARCH_DATA_ROUTE_PERMISSIONS = [
	["route_api_health_get", "GET", "/api/health", "[]", 0],
	["route_api_diag_ping_get", "GET", "/api/_diag/ping", "[]", 0],
	["route_api_diag_env_get", "GET", "/api/_diag/env", "[\"project.diagnostics.view\"]", 1],
	["route_api_diag_airtable_get", "GET", "/api/_diag/airtable", "[\"project.diagnostics.view\"]", 1],
	["route_api_diag_projects_source_get", "GET", "/api/_diag/projects-source", "[\"project.diagnostics.view\"]"],
	["route_api_diag_project_linked_records_get", "GET", "/api/_diag/project-linked-records", "[\"project.diagnostics.view\"]"],
	["route_api_projects_csv_get", "GET", "/api/projects.csv", "[\"project.view\"]", 1],
	["route_api_project_details_csv_get", "GET", "/api/project-details.csv", "[\"project.view\"]", 1],
	["route_api_studies_csv_get", "GET", "/api/studies.csv", "[\"study.view\"]", 1],
	["route_api_projects_get", "GET", "/api/projects", "[\"project.view\"]", 1],
	["route_api_projects_post", "POST", "/api/projects", "[\"project.manage\"]", 1],
	["route_api_project_get", "GET", "/api/projects/:id", "[\"project.view\"]", 1],
	["route_api_project_patch", "PATCH", "/api/projects/:id", "[\"project.manage\"]", 1],
	["route_api_studies_get", "GET", "/api/studies", "[\"study.view\"]"],
	["route_api_studies_post", "POST", "/api/studies", "[\"study.manage\"]"],
	["route_api_studies_patch", "PATCH", "/api/studies/:id", "[\"study.manage\"]"],
	["route_api_card_sorts_config_get", "GET", "/api/card-sorts/config", "[\"study.view\"]"],
	["route_api_card_sorts_config_post", "POST", "/api/card-sorts/config", "[\"study.manage\"]"],
	["route_api_card_sorts_results_get", "GET", "/api/card-sorts/results", "[\"research.content.view\"]"],
	["route_api_card_sorts_results_post", "POST", "/api/card-sorts/results", "[\"research.content.manage\"]"],
	["route_api_card_sorts_result_patch", "PATCH", "/api/card-sorts/results/:id", "[\"research.content.manage\"]"],
	["route_api_tree_tests_config_get", "GET", "/api/tree-tests/config", "[\"study.view\"]"],
	["route_api_tree_tests_config_post", "POST", "/api/tree-tests/config", "[\"study.manage\"]"],
	["route_api_tree_tests_results_get", "GET", "/api/tree-tests/results", "[\"research.content.view\"]"],
	["route_api_tree_tests_results_post", "POST", "/api/tree-tests/results", "[\"research.content.manage\"]"],
	["route_api_tree_tests_result_patch", "PATCH", "/api/tree-tests/results/:id", "[\"research.content.manage\"]"],
	["route_api_ai_rewrite_post", "POST", "/api/ai-rewrite", "[\"research.content.manage\"]", 1],
	["route_api_journal_entries_get", "GET", "/api/journal-entries", "[\"research.content.view\"]", 1],
	["route_api_journal_entries_post", "POST", "/api/journal-entries", "[\"research.content.manage\"]", 1],
	["route_api_journal_entry_get", "GET", "/api/journal-entries/:id", "[\"research.content.view\"]", 1],
	["route_api_journal_entry_patch", "PATCH", "/api/journal-entries/:id", "[\"research.content.manage\"]", 1],
	["route_api_journal_entry_delete", "DELETE", "/api/journal-entries/:id", "[\"research.content.manage\"]", 1],
	["route_api_excerpts_get", "GET", "/api/excerpts", "[\"research.content.view\"]", 1],
	["route_api_excerpts_post", "POST", "/api/excerpts", "[\"research.content.manage\"]", 1],
	["route_api_excerpt_patch", "PATCH", "/api/excerpts/:id", "[\"research.content.manage\"]", 1],
	["route_api_memos_get", "GET", "/api/memos", "[\"research.content.view\"]", 1],
	["route_api_memos_post", "POST", "/api/memos", "[\"research.content.manage\"]", 1],
	["route_api_memo_patch", "PATCH", "/api/memos/:id", "[\"research.content.manage\"]", 1],
	["route_api_memo_delete", "DELETE", "/api/memos/:id", "[\"research.content.manage\"]", 1],
	["route_api_code_applications_get", "GET", "/api/code-applications", "[\"research.content.view\"]", 1],
	["route_api_codes_get", "GET", "/api/codes", "[\"research.content.view\"]", 1],
	["route_api_codes_post", "POST", "/api/codes", "[\"research.content.manage\"]", 1],
	["route_api_code_patch", "PATCH", "/api/codes/:id", "[\"research.content.manage\"]", 1],
	["route_api_code_delete", "DELETE", "/api/codes/:id", "[\"research.content.manage\"]", 1],
	["route_api_analysis_timeline_get", "GET", "/api/analysis/timeline", "[\"research.content.view\"]", 1],
	["route_api_analysis_cooccurrence_get", "GET", "/api/analysis/cooccurrence", "[\"research.content.view\"]", 1],
	["route_api_analysis_retrieval_get", "GET", "/api/analysis/retrieval", "[\"research.content.view\"]", 1],
	["route_api_analysis_export_get", "GET", "/api/analysis/export", "[\"research.content.view\"]", 1],
	["route_api_impact_get", "GET", "/api/impact", "[\"repository.view\"]", 1],
	["route_api_impact_post", "POST", "/api/impact", "[\"repository.curate\"]", 1],
	["route_api_impact_record_get", "GET", "/api/impact/:id", "[\"repository.view\"]", 1],
	["route_api_impact_record_patch", "PATCH", "/api/impact/:id", "[\"repository.curate\"]", 1],
	["route_api_impact_record_delete", "DELETE", "/api/impact/:id", "[\"repository.curate\"]", 1],
	["route_api_sourcebook_get", "GET", "/api/sourcebook", "[\"sourcebook.view\"]", 1],
	["route_api_sourcebook_pillars_get", "GET", "/api/sourcebook/pillars", "[\"sourcebook.view\"]", 1],
	["route_api_sourcebook_clauses_get", "GET", "/api/sourcebook/clauses", "[\"sourcebook.view\"]", 1],
	["route_api_sourcebook_evaluate_get", "GET", "/api/sourcebook/evaluate", "[\"sourcebook.view\"]", 1],
	["route_api_sourcebook_clause_get", "GET", "/api/sourcebook/clauses/:id", "[\"sourcebook.view\"]", 1],
	["route_api_guides_get", "GET", "/api/guides", "[\"research.content.view\"]", 1],
	["route_api_guides_post", "POST", "/api/guides", "[\"research.content.manage\"]", 1],
	["route_api_guide_get", "GET", "/api/guides/:id", "[\"research.content.view\"]", 1],
	["route_api_guide_patch", "PATCH", "/api/guides/:id", "[\"research.content.manage\"]", 1],
	["route_api_guide_publish_post", "POST", "/api/guides/:id/publish", "[\"research.content.manage\"]", 1],
	["route_api_partials_get", "GET", "/api/partials", "[\"research.content.view\"]", 1],
	["route_api_partials_post", "POST", "/api/partials", "[\"research.content.manage\"]", 1],
	["route_api_partial_get", "GET", "/api/partials/:id", "[\"research.content.view\"]", 1],
	["route_api_partial_patch", "PATCH", "/api/partials/:id", "[\"research.content.manage\"]", 1],
	["route_api_partial_delete", "DELETE", "/api/partials/:id", "[\"research.content.manage\"]", 1],
	["route_api_sessions_get", "GET", "/api/sessions", "[\"research.content.view\"]", 1],
	["route_api_sessions_post", "POST", "/api/sessions", "[\"research.content.manage\"]", 1],
	["route_api_session_get", "GET", "/api/sessions/:id", "[\"research.content.view\"]", 1],
	["route_api_session_patch", "PATCH", "/api/sessions/:id", "[\"research.content.manage\"]", 1],
	["route_api_session_ics_get", "GET", "/api/sessions/:id/ics", "[\"research.content.view\"]", 1],
	["route_api_session_notes_get", "GET", "/api/session-notes", "[\"research.content.view\"]", 1],
	["route_api_session_notes_post", "POST", "/api/session-notes", "[\"research.content.manage\"]", 1],
	["route_api_session_note_patch", "PATCH", "/api/session-notes/:id", "[\"research.content.manage\"]", 1],
	["route_api_comms_send_post", "POST", "/api/comms/send", "[\"research.content.manage\"]", 1],
	["route_api_agent_pages_deploy_post", "POST", "/api/agent-pages/deploy", "[\"deployment.trigger\"]", 1],
	["route_api_mural_auth_get", "GET", "/api/mural/auth", "[\"research.integration.manage\"]", 1],
	["route_api_mural_callback_get", "GET", "/api/mural/callback", "[]", 0],
	["route_api_mural_verify_get", "GET", "/api/mural/verify", "[\"research.integration.manage\"]", 1],
	["route_api_mural_resolve_get", "GET", "/api/mural/resolve", "[\"research.integration.manage\"]", 1],
	["route_api_mural_setup_post", "POST", "/api/mural/setup", "[\"research.integration.manage\"]", 1],
	["route_api_mural_find_get", "GET", "/api/mural/find", "[\"research.integration.manage\"]", 1],
	["route_api_mural_await_get", "GET", "/api/mural/await", "[\"research.integration.manage\"]", 1],
	["route_api_mural_journal_sync_post", "POST", "/api/mural/journal-sync", "[\"research.integration.manage\"]", 1],
	["route_api_mural_workspaces_get", "GET", "/api/mural/workspaces", "[\"research.integration.manage\"]", 1],
	["route_api_mural_me_get", "GET", "/api/mural/me", "[\"research.integration.manage\"]", 1],
	["route_api_mural_debug_env_get", "GET", "/api/mural/debug-env", "[\"project.diagnostics.view\"]", 1],
	["route_api_synthesis_get", "GET", "/api/synthesis", "[\"synthesis.view\"]"],
	["route_api_synthesis_evidence_get", "GET", "/api/synthesis/evidence", "[\"synthesis.view\"]"],
	["route_api_synthesis_clusters_post", "POST", "/api/synthesis/clusters", "[\"synthesis.manage\"]"],
	["route_api_synthesis_themes_post", "POST", "/api/synthesis/themes", "[\"synthesis.manage\"]"],
	["route_api_synthesis_clusters_patch", "PATCH", "/api/synthesis/clusters/:id", "[\"synthesis.manage\"]"],
	["route_api_synthesis_clusters_delete", "DELETE", "/api/synthesis/clusters/:id", "[\"synthesis.manage\"]"],
	["route_api_consent_forms_get", "GET", "/api/consent-forms", "[\"consent.form.view\"]"],
	["route_api_consent_forms_post", "POST", "/api/consent-forms", "[\"consent.form.manage\"]"],
	["route_api_consent_forms_id_get", "GET", "/api/consent-forms/:id", "[\"consent.form.view\"]"],
	["route_api_consent_forms_id_patch", "PATCH", "/api/consent-forms/:id", "[\"consent.form.manage\"]"],
	["route_api_consent_forms_publish_post", "POST", "/api/consent-forms/:id/publish", "[\"consent.form.manage\"]"],
	["route_api_participant_consent_get", "GET", "/api/participant-consent", "[\"participant.consent.view\"]"],
	["route_api_participant_consent_post", "POST", "/api/participant-consent", "[\"participant.consent.manage\"]"],
	["route_api_participant_consent_patch", "PATCH", "/api/participant-consent/:id", "[\"participant.consent.manage\"]"],
	["route_api_study_ethics_submission_documents_post", "POST", "/api/study-ethics-risk/submissions", "[\"study.ethics.manage\"]"],
	["route_api_study_ethics_submission_document_get", "GET", "/api/study-ethics-risk/submissions/:id", "[\"study.ethics.view\"]"]
];

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

async function ensureResearchDataAuthDeclarations(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db?.prepare) return;
	if (researchDataAuthDeclarationsReadyByDatabase.has(db)) {
		return researchDataAuthDeclarationsReadyByDatabase.get(db);
	}

	const pending = (async () => {
		for (const [code, label, description] of RESEARCH_DATA_AUTH_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_permissions (code, label, description, is_sensitive, is_reserved)
				VALUES (?, ?, ?, 1, 0)
			`).bind(code, label, description).run();
		}

		for (const [roleId, permissionCode] of RESEARCH_DATA_ROLE_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_role_permissions (role_id, permission_code)
				VALUES (?, ?)
			`).bind(roleId, permissionCode).run();
		}

		for (const [id, method, routePattern, requiredPermissionsJson, authRequired = 1] of RESEARCH_DATA_ROUTE_PERMISSIONS) {
			await db.prepare(`
				INSERT OR IGNORE INTO auth_route_permissions
					(id, method, route_pattern, required_permissions_json, auth_required, implementation_status)
				VALUES (?, ?, ?, ?, ?, 'implemented')
			`).bind(id, method, routePattern, requiredPermissionsJson, authRequired).run();
		}
	})();

	researchDataAuthDeclarationsReadyByDatabase.set(db, pending);
	pending.catch(() => researchDataAuthDeclarationsReadyByDatabase.delete(db));
	return pending;
}

function researchDataRoutePermissionRequest(request, apiPath) {
	if (apiPath.match(/^\/api\/projects\/([^/]+)$/)) return requestForRoutePermission(request, "/api/projects/:id");
	if (apiPath.match(/^\/api\/studies\/([^/]+)$/)) return requestForRoutePermission(request, "/api/studies/:id");
	if (apiPath.match(/^\/api\/journal-entries\/([^/]+)$/)) return requestForRoutePermission(request, "/api/journal-entries/:id");
	if (apiPath.match(/^\/api\/excerpts\/([^/]+)$/)) return requestForRoutePermission(request, "/api/excerpts/:id");
	if (apiPath.match(/^\/api\/memos\/([^/]+)$/)) return requestForRoutePermission(request, "/api/memos/:id");
	if (apiPath.match(/^\/api\/codes\/([^/]+)$/)) return requestForRoutePermission(request, "/api/codes/:id");
	if (apiPath.match(/^\/api\/impact\/([^/]+)$/)) return requestForRoutePermission(request, "/api/impact/:id");
	if (apiPath.match(/^\/api\/sourcebook\/clauses\/([^/]+)$/)) return requestForRoutePermission(request, "/api/sourcebook/clauses/:id");
	if (apiPath.match(/^\/api\/guides\/([^/]+)\/publish$/)) return requestForRoutePermission(request, "/api/guides/:id/publish");
	if (apiPath.match(/^\/api\/guides\/([^/]+)$/)) return requestForRoutePermission(request, "/api/guides/:id");
	if (apiPath.match(/^\/api\/partials\/([^/]+)$/)) return requestForRoutePermission(request, "/api/partials/:id");
	if (apiPath.match(/^\/api\/sessions\/([^/]+)\/ics$/)) return requestForRoutePermission(request, "/api/sessions/:id/ics");
	if (apiPath.match(/^\/api\/sessions\/([^/]+)$/)) return requestForRoutePermission(request, "/api/sessions/:id");
	if (apiPath.match(/^\/api\/session-notes\/([^/]+)$/)) return requestForRoutePermission(request, "/api/session-notes/:id");
	if (apiPath.match(/^\/api\/card-sorts\/results\/([^/]+)$/)) return requestForRoutePermission(request, "/api/card-sorts/results/:id");
	if (apiPath.match(/^\/api\/tree-tests\/results\/([^/]+)$/)) return requestForRoutePermission(request, "/api/tree-tests/results/:id");
	if (apiPath.match(/^\/api\/synthesis\/clusters\/([^/]+)$/)) return requestForRoutePermission(request, "/api/synthesis/clusters/:id");
	if (apiPath.match(/^\/api\/consent-forms\/([^/]+)\/publish$/)) return requestForRoutePermission(request, "/api/consent-forms/:id/publish");
	if (apiPath.match(/^\/api\/consent-forms\/([^/]+)$/)) return requestForRoutePermission(request, "/api/consent-forms/:id");
	if (apiPath.match(/^\/api\/participant-consent\/([^/]+)$/)) return requestForRoutePermission(request, "/api/participant-consent/:id");
	if (apiPath.match(/^\/api\/study-ethics-risk\/submissions\/([^/]+)$/)) return requestForRoutePermission(request, "/api/study-ethics-risk/submissions/:id");
	return request;
}

async function assertResearchDataRoutePermission(request, env, apiPath) {
	await ensureResearchDataAuthDeclarations(env);
	const authContext = await authContextFor(request, env);
	await assertRoutePermission(researchDataRoutePermissionRequest(request, apiPath), env, authContext);
	return authContext;
}

async function assertFallbackApiRoutePermission(request, env, apiPath) {
	await ensureResearchDataAuthDeclarations(env);
	const routePermissionRequest = researchDataRoutePermissionRequest(request, apiPath);
	const probeDeclaration = await assertRoutePermission(routePermissionRequest, env, { authenticated: false, permissions: [] })
		.catch((error) => {
			if (error?.code !== "authentication_required" && error?.code !== "permission_denied") throw error;
			return null;
		});
	if (probeDeclaration?.authRequired === false) return null;
	const authContext = await authContextFor(request, env);
	await assertRoutePermission(routePermissionRequest, env, authContext);
	return authContext;
}

function workerBuild(env) {
	return { sha: env.RESEARCHOPS_BUILD_SHA || "unknown", branch: env.RESEARCHOPS_BUILD_BRANCH || "unknown" };
}

async function sanitizedApiErrorResponse(request, response) {
	try {
		const url = new URL(request.url);
		if (!url.pathname.startsWith("/api/") || response.status < 500) return response;
		const contentType = response.headers.get("content-type") || "";
		if (!contentType.toLowerCase().includes("application/json")) return response;
		const body = await response.clone().json().catch(() => null);
		if (!body || typeof body !== "object" || (!("detail" in body) && !("errors" in body))) return response;
		const headers = new Headers(response.headers);
		return new Response(JSON.stringify({
			ok: false,
			error: body.error || "request_failed",
			message: "The request could not be completed."
		}), { status: response.status, headers });
	} catch {
		return response;
	}
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
	if (!diagnosticsEnabled(env)) return new Response(JSON.stringify({ error: "Not found", path: "/api/_diag/projects-source" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
	const authContext = await assertResearchDataRoutePermission(request, env, "/api/_diag/projects-source");
	const [airtable, d1] = await Promise.all([probeAirtableProjects(env), probeProjectCache(env)]);
	const airtableUsable = airtable.status === 200 && airtable.firstRecordIdValid === true;
	const d1Usable = d1.bindingPresent === true && d1.cacheTablePresent === true && d1.validProjectCount > 0;
	return new Response(JSON.stringify({ ok: airtableUsable || d1Usable, route: "/api/_diag/projects-source", build: workerBuild(env), auth: { authenticated: true, userIdPresent: Boolean(authContext?.user?.id || authContext?.userId), teamCount: [...(authContext?.teamMemberships || []), ...(authContext?.memberTeams || []), ...(authContext?.teams || [])].length, activeTeamPresent: Boolean(authContext?.activeTeam) }, airtable, d1 }), { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function handleProjectLinkedDiagnostics(request, env) {
	if (!diagnosticsEnabled(env)) return new Response(JSON.stringify({ error: "Not found", path: "/api/_diag/project-linked-records" }), { status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
	const authContext = await assertResearchDataRoutePermission(request, env, "/api/_diag/project-linked-records");
	const origin = request.headers.get("Origin") || "";
	const url = new URL(request.url);
	const service = serviceFor(env);
	return diagnoseProjectLinkedRecords(service, origin, url, authContext);
}

async function handleProjects(request, env) {
	await ensureResearchDataAuthDeclarations(env);
	const authContext = await authContextFor(request, env);
	await assertRoutePermission(request, env, authContext);
	if (request.method === "GET") return listProjectRecords(request, env, authContext);
	if (request.method === "POST") return createProjectRecord(request, env, authContext);
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleProjectRecord(request, env, apiPath, executionCtx) {
	await ensureResearchDataAuthDeclarations(env);
	const authContext = await authContextFor(request, env);
	const match = apiPath.match(/^\/api\/projects\/([^/]+)$/);
	if (!match) return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
	await assertRoutePermission(researchDataRoutePermissionRequest(request, apiPath), env, authContext);
	const projectId = decodeURIComponent(match[1]);
	if (request.method === "GET") return getProjectRecord(request, env, projectId, authContext);
	if (request.method === "PATCH") return updateProjectRecord(request, env, projectId, authContext, executionCtx);
	return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleStudies(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	await assertResearchDataRoutePermission(request, env, apiPath);
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
	await assertResearchDataRoutePermission(request, env, apiPath);
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
	await assertResearchDataRoutePermission(request, env, apiPath);
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
	await assertResearchDataRoutePermission(request, env, apiPath);
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

async function handleSourcebook(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	await assertResearchDataRoutePermission(request, env, apiPath);

	if (apiPath === "/api/sourcebook" && request.method === "GET") return service.readSourcebook(origin);
	if (apiPath === "/api/sourcebook/pillars" && request.method === "GET") return service.listSourcebookPillars(origin, url);
	if (apiPath === "/api/sourcebook/clauses" && request.method === "GET") return service.listSourcebookClauses(origin, url);
	if (apiPath === "/api/sourcebook/evaluate" && request.method === "GET") return service.evaluateSourcebookGovernance(origin, url);

	const match = apiPath.match(/^\/api\/sourcebook\/clauses\/([^/]+)$/);
	if (match && request.method === "GET") return service.readSourcebookClause(origin, decodeURIComponent(match[1]));

	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleStudyEthicsRisk(request, env, apiPath) {
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);
	const authContext = await assertResearchDataRoutePermission(request, env, apiPath);

	if (apiPath === "/api/study-ethics-risk/submissions" && request.method === "POST") {
		return service.createEthicsSubmissionDocument(request, origin, authContext);
	}

	const documentMatch = apiPath.match(/^\/api\/study-ethics-risk\/submissions\/([^/]+)$/);
	if (documentMatch && request.method === "GET") {
		return service.readEthicsSubmissionDocument(origin, decodeURIComponent(documentMatch[1]));
	}

	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleMural(request, env, apiPath) {
	const url = new URL(request.url);
	const origin = request.headers.get("Origin") || "";
	const service = serviceFor(env);

	if (apiPath === "/api/mural/callback" && request.method === "GET") {
		return service.mural.muralCallback(origin, url);
	}

	await ensureResearchDataAuthDeclarations(env);
	const authContext = await authContextFor(request, env);
	await assertRoutePermission(researchDataRoutePermissionRequest(request, apiPath), env, authContext);

	if (apiPath === "/api/mural/auth" && request.method === "GET") return service.mural.muralAuth(origin, url, authContext);
	if (apiPath === "/api/mural/verify" && request.method === "GET") return service.mural.muralVerify(origin, url, authContext);
	if (apiPath === "/api/mural/resolve" && request.method === "GET") return service.mural.muralResolve(origin, url, authContext);
	if (apiPath === "/api/mural/setup" && request.method === "POST") return service.mural.muralSetup(request, origin, authContext);
	if (apiPath === "/api/mural/journal-sync" && request.method === "POST") return service.mural.muralJournalSync(request, origin, authContext);
	if (apiPath === "/api/mural/workspaces" && request.method === "GET") return service.mural.muralListWorkspaces(origin, url, authContext);
	if (apiPath === "/api/mural/me" && request.method === "GET") return service.mural.muralMe(origin, url, authContext);
	if (apiPath === "/api/mural/find" && request.method === "GET" && typeof service.mural.muralFind === "function") return service.mural.muralFind(origin, url);
	if (apiPath === "/api/mural/await" && request.method === "GET" && typeof service.mural.muralAwait === "function") return service.mural.muralAwait(origin, url);
	if (apiPath === "/api/mural/debug-env" && request.method === "GET" && typeof service.mural.muralDebugEnv === "function") return service.mural.muralDebugEnv(origin);
	return new Response(JSON.stringify({ error: "Not found", path: apiPath }), { status: 404, headers: { "content-type": "application/json; charset=utf-8" } });
}

async function handleAuthenticatedMeRoute(request, env, apiPath) {
	await ensureResearchDataAuthDeclarations(env);
	return handleMeRoute(request, env, apiPath);
}

export default {
	async fetch(request, env, ctx) {
		const { method, url } = request;
		const pathname = new URL(url).pathname;
		const apiPath = normaliseApiPath(pathname);
			if (method === "OPTIONS") return withCORS(env, request, new Response(null, { status: 204 }));
			try {
				assertTrustedMutationRequest(request, env, apiPath);
				let result;
			if ((method === "GET" || method === "POST") && apiPath === "/api/auth/registration-requests") result = await handleRegistrationRequestsRoute(request, env, apiPath);
			else if (method === "POST" && apiPath.startsWith("/api/auth/email/")) result = await handlePasswordlessAuthRoute(request, env, apiPath);
			else if (method === "POST" && apiPath === "/api/auth/logout") result = await handlePasswordlessAuthRoute(request, env, apiPath);
			else if (method === "GET" && (apiPath === "/api/me" || apiPath === "/api/me/identity" || apiPath === "/api/me/permissions")) result = await handleAuthenticatedMeRoute(request, env, apiPath);
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
				else if (apiPath === "/api/study-ethics-risk/submissions" || apiPath.startsWith("/api/study-ethics-risk/submissions/")) result = await handleStudyEthicsRisk(request, env, apiPath);
				else if (apiPath === "/api/study-support" || apiPath.startsWith("/api/study-support/")) result = await handleStudySupport(request, env, apiPath);
				else if (apiPath === "/api/repository" || apiPath.startsWith("/api/repository/")) result = await handleRepository(request, env, apiPath);
				else if (apiPath === "/api/sourcebook" || apiPath.startsWith("/api/sourcebook/")) result = await handleSourcebook(request, env, apiPath);
				else if (apiPath === "/api/mural/callback" || apiPath.startsWith("/api/mural/")) result = await handleMural(request, env, apiPath);
				else if ((apiPath === "/api/health" || apiPath === "/api/_diag/ping") && method === "GET") result = await handleRequest(request, env, ctx);
				else {
					if (apiPath.startsWith("/api/")) await assertFallbackApiRoutePermission(request, env, apiPath);
					result = await handleRequest(request, env, ctx);
				}
				return withCORS(env, request, await sanitizedApiErrorResponse(request, coerceResponse(result)));
			} catch (e) {
				if (e?.status && e?.code) return withCORS(env, request, authErrorResponse(e));
				console.error("worker.unhandled", e);
				return withCORS(env, request, new Response(JSON.stringify({ ok: false, error: "internal_error", message: "The request could not be completed." }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }));
			}
	},

	async scheduled(event, env, ctx) {
		ctx.waitUntil(enforceRetention(env, { scheduledTime: event?.scheduledTime || Date.now() }));
	}
};
