/**
 * @file public/js/study-page.js
 * @module study-page
 * @summary Loads a study page and renders a readiness-led control page.
 */

function resolveApiBase() {
	const explicit =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		window.RESEARCHOPS_API_ORIGIN ||
		"";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

const API_ORIGIN = resolveApiBase();
const $ = (selector, root = document) => root.querySelector(selector);

function apiUrl(path) {
	const p = String(path || "");
	return `${API_ORIGIN}${p.startsWith("/") ? p : "/" + p}`;
}

function route(path, params) {
	const url = new URL(path, window.location.origin);
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value);
	}
	return `${url.pathname}${url.search}`;
}

function setText(selector, value) {
	const el = $(selector);
	if (el) el.textContent = value || "—";
}

function fallbackTitle(study = {}) {
	const method = (study.method || "Study").trim();
	const d = study.createdAt ? new Date(study.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

function studyTitle(study = {}) {
	return (study.title || study.Title || "").trim() || fallbackTitle(study);
}

function showError(message) {
	const summary = $("#study-error");
	const messageEl = $("#study-error-message");
	if (!summary || !messageEl) return;
	summary.hidden = false;
	summary.removeAttribute("aria-hidden");
	messageEl.textContent = message;
	summary.focus();
}

function hideError() {
	const summary = $("#study-error");
	if (!summary) return;
	summary.hidden = true;
	summary.setAttribute("aria-hidden", "true");
}

async function jsonFetch(url) {
	const response = await fetch(url, { cache: "no-store", credentials: "include" });
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	if (!contentType.includes("application/json")) {
		const preview = await response.text().catch(() => "");
		throw new Error(`Request returned non-JSON (${response.status}) ${preview.slice(0, 120)}`);
	}
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok || body?.ok === false) {
		throw new Error(body?.error || body?.detail || `Request failed (${response.status})`);
	}
	return body;
}

async function loadProject(projectId) {
	try {
		const body = await jsonFetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}`));
		return body?.project || body;
	} catch (error) {
		console.warn("[study-page] project lookup failed", error);
		return null;
	}
}

async function loadStudy(studyId) {
	const url = new URL(apiUrl("/api/studies"), window.location.origin);
	url.searchParams.set("id", studyId);
	const body = await jsonFetch(url.toString());
	if (body?.ok !== true || !body.study) {
		throw new Error(body?.error || "Could not load study");
	}
	return body.study;
}

async function resolveStudyContext(params) {
	const studyId = params.get("id") || "";
	const legacyProjectId = params.get("pid") || "";
	const legacyStudyId = params.get("sid") || "";

	if (studyId) {
		const study = await loadStudy(studyId);
		if (!study.projectId) throw new Error("The study record does not include a linked project.");
		return { projectId: study.projectId, studyId: study.id, study, routeMode: "canonical" };
	}

	if (legacyProjectId && legacyStudyId) {
		const study = await loadStudy(legacyStudyId);
		if (!study.projectId || study.projectId !== legacyProjectId) {
			throw new Error("The legacy project and study URL does not match the linked records.");
		}
		return { projectId: study.projectId, studyId: study.id, study, routeMode: "legacy-resolved" };
	}

	throw new Error("The study page needs a Study record ID in the URL.");
}

async function loadStudyCollection(path, studyId, key) {
	try {
		const url = new URL(apiUrl(path), window.location.origin);
		url.searchParams.set("study", studyId);
		const body = await jsonFetch(url.toString());
		return Array.isArray(body?.[key]) ? body[key] : [];
	} catch (error) {
		console.warn(`[study-page] ${key} lookup failed`, error);
		return [];
	}
}

async function loadReadinessContext(studyId) {
	const [participants, guides, consentForms, participantConsentRecords] = await Promise.all([
		loadStudyCollection("/api/participants", studyId, "participants"),
		loadStudyCollection("/api/guides", studyId, "guides"),
		loadStudyCollection("/api/consent-forms", studyId, "consentForms"),
		loadStudyCollection("/api/participant-consent", studyId, "participantConsentRecords")
	]);

	return {
		participants,
		guides,
		consentForms,
		participantConsentRecords
	};
}

function enableLink(selector, href) {
	const el = $(selector);
	if (!el) return;
	el.href = href;
	el.classList.remove("link--disabled");
	el.removeAttribute("aria-disabled");
	el.removeAttribute("data-disabled-link");
	el.removeAttribute("tabindex");
	el.removeAttribute("title");
}

function disableLink(selector, fallbackHref, reason) {
	const el = $(selector);
	if (!el) return;
	el.href = fallbackHref || "#study-readiness-title";
	el.classList.add("link--disabled");
	el.setAttribute("aria-disabled", "true");
	el.setAttribute("data-disabled-link", "true");
	el.setAttribute("tabindex", "-1");
	if (reason) el.setAttribute("title", reason);
}

function setReadinessItem(key, state, text) {
	const item = document.querySelector(`[data-readiness-item="${key}"]`);
	if (!item) return;
	const status = item.querySelector(".readiness-item__status");
	const body = item.querySelector(".readiness-item__body");
	if (status) status.textContent = state;
	if (body) body.textContent = text;
}

function normaliseStatus(value) {
	return String(value || "").trim().toLowerCase();
}

function isPublishedLike(item = {}) {
	const status = normaliseStatus(item.status || item.Status);
	return ["published", "ready", "approved", "complete", "completed"].includes(status);
}

function isParticipantConsentReady(record = {}) {
	const status = normaliseStatus(record.status);
	return status === "ready for session" && record.withdrawn !== true;
}

function evaluateReadiness(study, context = {}) {
	const hasDescription = !!String(study.description || "").trim();
	const status = String(study.status || "").trim() || "Planned";
	const hasStatus = !!status;
	const participants = Array.isArray(context.participants) ? context.participants : [];
	const guides = Array.isArray(context.guides) ? context.guides : [];
	const consentForms = Array.isArray(context.consentForms) ? context.consentForms : [];
	const participantConsentRecords = Array.isArray(context.participantConsentRecords) ? context.participantConsentRecords : [];

	const participantsReady = participants.length > 0;
	const guideReady = guides.some(isPublishedLike);
	const consentMaterialsReady = consentForms.some(isPublishedLike);
	const readyParticipantConsent = participantConsentRecords.filter(isParticipantConsentReady);
	const participantConsentReady = readyParticipantConsent.length > 0;

	return {
		description: {
			ready: hasDescription,
			state: hasDescription ? "Ready" : "Needs attention",
			text: hasDescription ? "The study has a description." : "Add a short description before running sessions."
		},
		status: {
			ready: hasStatus,
			state: hasStatus ? "Set" : "Needs attention",
			text: hasStatus ? `Study status is ${status}.` : "Set the study status before running sessions."
		},
		participants: {
			ready: participantsReady,
			state: participantsReady ? "Ready" : "Action needed",
			text: participantsReady ? `${participants.length} participant${participants.length === 1 ? " is" : "s are"} available for this study.` : "Add or review participants for this study."
		},
		guide: {
			ready: guideReady,
			state: guideReady ? "Ready" : "Action needed",
			text: guideReady ? "A published discussion guide is available for this study." : "Create, review and publish the discussion guide before running a session."
		},
		consentMaterials: {
			ready: consentMaterialsReady,
			state: consentMaterialsReady ? "Ready" : "Action needed",
			text: consentMaterialsReady ? "A published consent form is available for this study." : "Create, review and publish consent forms before recording participant consent."
		},
		participantConsent: {
			ready: participantConsentReady,
			state: participantConsentReady ? "Ready" : "Action needed",
			text: participantConsentReady ? `${readyParticipantConsent.length} participant${readyParticipantConsent.length === 1 ? " is" : "s are"} ready for session.` : "Record required participant consent before beginning a session."
		}
	};
}

function isStudyReady(readiness) {
	return Object.values(readiness).every(item => item.ready === true);
}

function renderSessionGate(readiness, sessionHref) {
	const ready = isStudyReady(readiness);
	const blockedReasons = Object.entries(readiness)
		.filter(([, item]) => item.ready !== true)
		.map(([key]) => key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`));

	if (ready) {
		setReadinessItem("session", "Available", "Open the session workspace when the study setup is ready.");
		enableLink("#link-session", sessionHref);
		return;
	}

	setReadinessItem(
		"session",
		"Not available yet",
		`Complete the ${blockedReasons.join(", ")} setup ${blockedReasons.length === 1 ? "task" : "tasks"} before beginning a session.`
	);
	disableLink("#link-session", "#study-readiness-title", "Complete study readiness tasks before beginning a session.");
}

function renderReadiness(study, context, sessionHref) {
	const readiness = evaluateReadiness(study, context);

	setReadinessItem("description", readiness.description.state, readiness.description.text);
	setReadinessItem("status", readiness.status.state, readiness.status.text);
	setReadinessItem("participants", readiness.participants.state, readiness.participants.text);
	setReadinessItem("guide", readiness.guide.state, readiness.guide.text);
	setReadinessItem("consent-materials", readiness.consentMaterials.state, readiness.consentMaterials.text);
	setReadinessItem("participant-consent", readiness.participantConsent.state, readiness.participantConsent.text);
	renderSessionGate(readiness, sessionHref);
}

function renderRoutes(projectId, studyId) {
	const params = { pid: projectId, sid: studyId };
	enableLink("#back-to-project", route("/pages/project-dashboard/", { id: projectId }));
	enableLink("#breadcrumb-project", route("/pages/project-dashboard/", { id: projectId }));
	enableLink("#link-consent-forms", route("/pages/study/consent-forms/", params));
	enableLink("#link-participant-consent", route("/pages/study/participant-consent/", params));
	enableLink("#link-guides", route("/pages/study/guides/", params));
	enableLink("#link-participants", route("/pages/study/participants/", params));
	enableLink("#link-synthesis", route("/pages/synthesize/", params));

	const editStudy = $("#edit-study");
	if (editStudy) editStudy.href = `${route("/pages/study/", { id: studyId })}#edit`;

	return {
		sessionHref: route("/pages/study/session/", params)
	};
}

function renderStudy(project, study, projectId, studyId, readinessContext) {
	const projectName = project?.name || "Project";
	document.body.setAttribute("data-study-id", studyId);
	document.body.setAttribute("data-project-id", projectId);

	setText("#breadcrumb-project", projectName);
	setText("#study-title", studyTitle(study));
	setText("#description", String(study.description || "").trim() || "No study description has been added yet.");
	setText("#kv-method", study.method || "—");
	setText("#kv-status", study.status || "—");
	setText("#kv-studyid", String(study.studyId || study.id || "—").toUpperCase());

	const routes = renderRoutes(projectId, studyId);
	renderReadiness(study, readinessContext, routes.sessionHref);
}

async function init() {
	hideError();
	const params = new URLSearchParams(window.location.search);

	try {
		const context = await resolveStudyContext(params);
		const [project, readinessContext] = await Promise.all([
			loadProject(context.projectId),
			loadReadinessContext(context.studyId)
		]);
		renderStudy(project, context.study, context.projectId, context.studyId, readinessContext);
	} catch (error) {
		console.error("[study-page] init failed", error);
		showError(error?.message || "Could not load the study. Check the study link, then try again.");
	}
}

document.addEventListener("click", event => {
	const disabledLink = event.target instanceof Element ? event.target.closest("a[data-disabled-link='true']") : null;
	if (!disabledLink) return;
	event.preventDefault();
	const target = $("#study-readiness-title");
	if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.addEventListener("study:desc:save", async event => {
	const studyId = document.body.getAttribute("data-study-id") || "";
	if (!studyId) return;
	try {
		await fetch(apiUrl(`/api/studies/${encodeURIComponent(studyId)}`), {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ description: event.detail?.markdown || "" })
		});
	} catch (error) {
		console.error("[study-page] description save failed", error);
	}
});

init();
