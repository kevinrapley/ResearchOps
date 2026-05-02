/**
 * @file /components/session-consent-controller.js
 * @summary Adds participant consent checks to the study session page.
 */

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	window.RESEARCHOPS_API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

const $ = (selector, root = document) => root.querySelector(selector);

const state = {
	projectId: "",
	studyId: "",
	participantConsentRecords: []
};

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

async function jsonFetch(url) {
	const response = await fetch(url, { cache: "no-store" });
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
	return body;
}

async function loadParticipantConsent() {
	if (!state.studyId) return [];
	try {
		const url = new URL(apiUrl("/api/participant-consent"));
		url.searchParams.set("study", state.studyId);
		const body = await jsonFetch(url.toString());
		return Array.isArray(body.participantConsentRecords) ? body.participantConsentRecords : [];
	} catch (error) {
		console.warn("[session-consent] participant consent lookup failed", error);
		return [];
	}
}

function consentRecordForSelection() {
	const select = $("#participant-select");
	const option = select?.selectedOptions?.[0];
	const participantId = option?.dataset?.airtableId || select?.value || "";
	if (!participantId) return null;
	return state.participantConsentRecords.find(record => record.participantId === participantId) || null;
}

function consentStatus(record) {
	if (!record) return "Not recorded";
	if (record.withdrawn === true || /^withdrawn$/i.test(String(record.status || ""))) return "Withdrawn";
	if (/^ready for session$/i.test(String(record.status || ""))) return "Ready for session";
	if (/^needs review$/i.test(String(record.status || ""))) return "Needs review";
	return "Needs consent";
}

function optionalPermissionText(record, key, label) {
	const value = record?.responses?.[key] || "not-asked";
	if (value === "agreed") return `${label} agreed`;
	if (value === "declined") return `${label} not permitted`;
	return `${label} not asked`;
}

function appendConsentSummary(record) {
	const summary = $("#consent-summary");
	if (!summary) return;
	const existing = summary.querySelectorAll("[data-session-consent-row='true']");
	existing.forEach(item => item.remove());

	const add = (term, value) => {
		const dt = document.createElement("dt");
		dt.dataset.sessionConsentRow = "true";
		dt.textContent = term;
		const dd = document.createElement("dd");
		dd.dataset.sessionConsentRow = "true";
		dd.textContent = value;
		summary.append(dt, dd);
	};

	add("Required consent", consentStatus(record));
	if (record) {
		add("Capture method", record.captureMethod || "Not recorded");
		add("Consent form version", String(record.consentFormVersion || "Not recorded"));
		add("Recording", optionalPermissionText(record, "recording", "Recording"));
		add("Observers", optionalPermissionText(record, "observers", "Observers"));
		add("Transcription", optionalPermissionText(record, "transcription", "Transcription"));
	}
}

function setGate(blocked, message) {
	const gate = $("#consent-gate-message");
	const body = $("#consent-gate-message-body");
	const start = $("#btn-start");
	if (body) body.textContent = message;
	if (gate) gate.hidden = !blocked;
	if (start) {
		start.disabled = blocked;
		start.setAttribute("aria-describedby", blocked ? "consent-gate-message-body" : "");
	}
}

function updateGate() {
	const select = $("#participant-select");
	const selected = select?.value || "";
	if (!selected) {
		appendConsentSummary(null);
		setGate(true, "Choose a participant to review consent status before starting a session.");
		return;
	}

	const record = consentRecordForSelection();
	const status = consentStatus(record);
	appendConsentSummary(record);

	if (status === "Ready for session") {
		setGate(false, "Required participant consent has been recorded.");
		return;
	}
	if (status === "Withdrawn") {
		setGate(true, "Participant consent has been withdrawn. Do not proceed with this session.");
		return;
	}
	if (status === "Needs review") {
		setGate(true, "Participant consent needs review before this session can start.");
		return;
	}
	if (status === "Not recorded") {
		setGate(true, "Record required participant consent before starting this session.");
		return;
	}
	setGate(true, "Required participant consent is missing or has been declined.");
}

function updateRoutes() {
	const link = $("#manage-participant-consent-link");
	if (link) link.href = route("/pages/study/participant-consent/", { pid: state.projectId, sid: state.studyId });
}

async function init() {
	const params = new URLSearchParams(window.location.search);
	state.projectId = params.get("pid") || "";
	state.studyId = params.get("sid") || "";
	updateRoutes();
	state.participantConsentRecords = await loadParticipantConsent();
	$("#participant-select")?.addEventListener("change", updateGate);
	updateGate();
}

document.addEventListener("DOMContentLoaded", init);
