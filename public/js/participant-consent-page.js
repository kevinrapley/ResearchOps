/**
 * @file public/js/participant-consent-page.js
 * @module participant-consent-page
 * @summary Study-scoped participant consent management controller.
 */

const API_ORIGIN =
	document.documentElement?.dataset?.apiOrigin ||
	window.API_ORIGIN ||
	window.RESEARCHOPS_API_ORIGIN ||
	(location.hostname.endsWith("pages.dev") ?
		"https://rops-api.digikev-kevin-rapley.workers.dev" :
		location.origin);

const DEFAULT_CONSENT_ITEMS = [
	{
		id: "participation",
		label: "I understand what taking part involves and I agree to take part in this research.",
		required: true
	},
	{
		id: "voluntary",
		label: "I understand that taking part is voluntary and that I can stop the session at any time.",
		required: true
	},
	{
		id: "data-use",
		label: "I understand how my information will be used for this research.",
		required: true
	},
	{
		id: "recording",
		label: "I agree to the session being recorded if recording is being used for this study.",
		required: false
	},
	{
		id: "observers",
		label: "I agree to observers joining the session if observers are part of this study.",
		required: false
	},
	{
		id: "transcription",
		label: "I agree to transcription being used if transcription is part of this study.",
		required: false
	}
];

const state = {
	projectId: "",
	studyId: "",
	project: null,
	study: null,
	participants: [],
	consentForms: [],
	participantConsentRecords: [],
	selectedParticipantId: ""
};

const $ = (selector, root = document) => root.querySelector(selector);

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function safeToken(value) {
	return String(value || "item").replace(/[^a-zA-Z0-9_-]/g, "-");
}

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

function setHidden(selector, hidden) {
	const el = $(selector);
	if (!el) return;
	el.hidden = hidden;
	if (hidden) el.setAttribute("aria-hidden", "true");
	else el.removeAttribute("aria-hidden");
}

function setText(selector, value) {
	const el = $(selector);
	if (el) el.textContent = value || "—";
}

function clearErrors() {
	const summary = $("#consent-error");
	const list = $("#consent-error-list");
	if (!summary || !list) return;
	list.innerHTML = "";
	summary.hidden = true;
	summary.setAttribute("aria-hidden", "true");
}

function showErrors(messages) {
	const summary = $("#consent-error");
	const list = $("#consent-error-list");
	if (!summary || !list) return;
	list.innerHTML = "";
	for (const message of messages) {
		const item = document.createElement("li");
		item.textContent = message;
		list.appendChild(item);
	}
	summary.hidden = false;
	summary.removeAttribute("aria-hidden");
	summary.focus();
}

async function jsonFetch(url, options = {}) {
	const response = await fetch(url, { cache: "no-store", ...options });
	const text = await response.text();
	const body = text ? JSON.parse(text) : {};
	if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
	return body;
}

async function loadProject(projectId) {
	try {
		const body = await jsonFetch(apiUrl("/api/projects"));
		const projects = Array.isArray(body?.projects) ? body.projects : [];
		return projects.find(project => project.id === projectId) || null;
	} catch (error) {
		console.warn("[participant-consent] project lookup failed", error);
		return null;
	}
}

async function loadStudies(projectId) {
	const url = new URL(apiUrl("/api/studies"));
	url.searchParams.set("project", projectId);
	const body = await jsonFetch(url.toString());
	return Array.isArray(body?.studies) ? body.studies : [];
}

async function loadStudyCollection(path, studyId, key) {
	try {
		const url = new URL(apiUrl(path));
		url.searchParams.set("study", studyId);
		const body = await jsonFetch(url.toString());
		return Array.isArray(body?.[key]) ? body[key] : [];
	} catch (error) {
		console.warn(`[participant-consent] ${key} lookup failed`, error);
		return [];
	}
}

function normaliseStatus(value) {
	return String(value || "").trim().toLowerCase();
}

function isPublishedLike(form = {}) {
	return ["published", "ready", "approved", "complete", "completed"].includes(normaliseStatus(form.status));
}

function latestPublishedForm() {
	const forms = state.consentForms.filter(isPublishedLike);
	forms.sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
	return forms[0] || null;
}

function consentItemsForForm(form) {
	return Array.isArray(form?.consentItems) && form.consentItems.length ? form.consentItems : DEFAULT_CONSENT_ITEMS;
}

function consentRecordForParticipant(participantId) {
	return state.participantConsentRecords.find(record => record.participantId === participantId) || null;
}

function statusForParticipant(participant, record = consentRecordForParticipant(participant.id), form = latestPublishedForm()) {
	if (!record) return "Not recorded";
	if (record.withdrawn || normaliseStatus(record.status) === "withdrawn") return "Withdrawn";
	if (form && Number(record.consentFormVersion || 0) < Number(form.version || 0)) return "Needs review";
	const items = consentItemsForForm(form);
	const missingRequired = items.some(item => item.required && record.responses?.[item.id] !== "agreed");
	if (missingRequired) return "Needs consent";
	return "Ready for session";
}

function permissionTags(record, form = latestPublishedForm()) {
	if (!record) return ["No permissions recorded"];
	if (record.withdrawn) return ["Do not proceed"];
	return consentItemsForForm(form)
		.filter(item => !item.required)
		.map(item => {
			const value = record.responses?.[item.id] || "not-asked";
			const label = item.label.split(".")[0].replace(/^I agree to\s*/i, "");
			if (value === "agreed") return `${label}: agreed`;
			if (value === "declined") return `${label}: declined`;
			return `${label}: not asked`;
		});
}

function updateRoutes() {
	const params = { pid: state.projectId, sid: state.studyId };
	const projectHref = route("/pages/project-dashboard/", { id: state.projectId });
	const studyHref = route("/pages/study/", params);
	const consentFormsHref = route("/pages/study/consent-forms/", params);
	const participantsHref = route("/pages/study/participants/", params);

	const breadcrumbProject = $("#breadcrumb-project");
	if (breadcrumbProject) {
		breadcrumbProject.href = projectHref;
		breadcrumbProject.textContent = state.project?.name || "Project";
	}
	const breadcrumbStudy = $("#breadcrumb-study");
	if (breadcrumbStudy) {
		breadcrumbStudy.href = studyHref;
		breadcrumbStudy.textContent = studyTitle(state.study || {});
	}
	const backToStudy = $("#back-to-study");
	if (backToStudy) backToStudy.href = studyHref;
	const createConsentFormsLink = $("#create-consent-forms-link");
	if (createConsentFormsLink) createConsentFormsLink.href = consentFormsHref;
	const scheduleParticipantsLink = $("#schedule-participants-link");
	if (scheduleParticipantsLink) scheduleParticipantsLink.href = participantsHref;
}

function renderPageState() {
	const hasContext = !!(state.projectId && state.studyId);
	const hasPublishedForms = state.consentForms.some(isPublishedLike);
	const hasParticipants = state.participants.length > 0;

	setHidden("#no-context-state", hasContext);
	setHidden("#no-consent-form-state", !hasContext || hasPublishedForms);
	setHidden("#no-participants-state", !hasContext || !hasPublishedForms || hasParticipants);
	setHidden("#consent-workspace", !hasContext || !hasPublishedForms || !hasParticipants);

	if (!hasContext) setText("#participant-consent-status", "Missing study context.");
	else if (!hasPublishedForms) setText("#participant-consent-status", "Consent form materials are needed before participant consent can be recorded.");
	else if (!hasParticipants) setText("#participant-consent-status", "Participants are needed before consent can be recorded.");
	else setText("#participant-consent-status", "Participant consent loaded.");
}

function renderSummary() {
	const form = latestPublishedForm();
	const readyCount = state.participants.filter(participant => statusForParticipant(participant) === "Ready for session").length;
	const actionCount = Math.max(0, state.participants.length - readyCount);
	setText("#summary-published-form", form ? `${form.title || "Published consent form"} — version ${form.version || 1}` : "No published consent form");
	setText("#summary-participants", `${state.participants.length}`);
	setText("#summary-ready", `${readyCount}`);
	setText("#summary-action-needed", `${actionCount}`);
}

function renderParticipantTable() {
	const tbody = $("#participant-consent-tbody");
	if (!tbody) return;
	tbody.innerHTML = "";
	for (const participant of state.participants) {
		const record = consentRecordForParticipant(participant.id);
		const status = statusForParticipant(participant, record);
		const tr = document.createElement("tr");
		tr.className = "govuk-table__row";
		tr.dataset.participantConsentRow = participant.id;

		const tags = permissionTags(record)
			.map(tag => `<span class="participant-consent-tag${/declined|not asked|Do not proceed/i.test(tag) ? " participant-consent-tag--warning" : ""}">${escapeHtml(tag)}</span>`)
			.join(" ");
		const action = record ? "Review consent" : "Record consent";
		const participantName = participant.display_name || participant.name || "Participant";

		tr.innerHTML = `
			<th scope="row" class="govuk-table__header">${escapeHtml(participantName)}</th>
			<td class="govuk-table__cell">${escapeHtml(status)}</td>
			<td class="govuk-table__cell"><span class="participant-consent-tag-list">${tags}</span></td>
			<td class="govuk-table__cell">${escapeHtml(record?.recordedAt || "Not recorded")}</td>
			<td class="govuk-table__cell"><button type="button" class="govuk-button govuk-button--secondary" data-record-consent="${escapeHtml(participant.id)}">${escapeHtml(action)}</button></td>
		`;
		tbody.appendChild(tr);
	}
}

function renderFormOptions(selectedFormId = "") {
	const select = $("#consent-form-select");
	if (!select) return;
	select.innerHTML = "";
	for (const form of state.consentForms.filter(isPublishedLike)) {
		const option = document.createElement("option");
		option.value = form.id;
		option.dataset.version = String(form.version || 1);
		option.textContent = `${form.title || "Consent form"} — version ${form.version || 1}`;
		select.appendChild(option);
	}
	if (selectedFormId) select.value = selectedFormId;
}

function renderConsentItems(record = null, form = latestPublishedForm()) {
	const list = $("#consent-items-list");
	if (!list) return;
	list.innerHTML = "";
	for (const item of consentItemsForForm(form)) {
		const group = document.createElement("div");
		group.className = "participant-consent-item";
		const current = record?.responses?.[item.id] || "not-asked";
		const token = safeToken(item.id);
		group.innerHTML = `
			<p class="participant-consent-item__label">${escapeHtml(item.label)}<span class="participant-consent-item__requirement">${item.required ? "Required" : "Optional"}</span></p>
			<div class="govuk-radios govuk-radios--inline">
				<div class="govuk-radios__item">
					<input id="consent-${token}-agreed" class="govuk-radios__input" name="consent-${token}" type="radio" value="agreed" ${current === "agreed" ? "checked" : ""} />
					<label class="govuk-label govuk-radios__label" for="consent-${token}-agreed">Agreed</label>
				</div>
				<div class="govuk-radios__item">
					<input id="consent-${token}-declined" class="govuk-radios__input" name="consent-${token}" type="radio" value="declined" ${current === "declined" ? "checked" : ""} />
					<label class="govuk-label govuk-radios__label" for="consent-${token}-declined">Declined</label>
				</div>
				<div class="govuk-radios__item">
					<input id="consent-${token}-not-asked" class="govuk-radios__input" name="consent-${token}" type="radio" value="not-asked" ${current === "not-asked" ? "checked" : ""} />
					<label class="govuk-label govuk-radios__label" for="consent-${token}-not-asked">Not asked</label>
				</div>
			</div>
		`;
		list.appendChild(group);
	}
}

function selectParticipant(participantId) {
	clearErrors();
	state.selectedParticipantId = participantId;
	const participant = state.participants.find(item => item.id === participantId);
	if (!participant) return;
	const record = consentRecordForParticipant(participantId);
	const form = state.consentForms.find(item => item.id === record?.consentFormId) || latestPublishedForm();
	setHidden("#consent-record-panel", false);
	setText("#record-consent-title", record ? `Review consent for ${participant.display_name}` : `Record consent for ${participant.display_name}`);
	setText("#record-consent-hint", "Consent can be reviewed, updated or withdrawn. Required consent is needed before a session can start.");
	$("#participant-id").value = participantId;
	$("#consent-record-id").value = record?.id || "";
	$("#capture-method").value = record?.captureMethod || "";
	$("#recorded-by").value = record?.recordedBy || "";
	$("#consent-withdrawn").checked = record?.withdrawn === true;
	$("#withdrawal-reason").value = record?.withdrawalReason || "";
	renderFormOptions(form?.id || "");
	renderConsentItems(record, form);
	$("#consent-record-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectResponses(form = latestPublishedForm()) {
	const responses = {};
	for (const item of consentItemsForForm(form)) {
		const token = safeToken(item.id);
		const checked = document.querySelector(`input[name="consent-${token}"]:checked`);
		responses[item.id] = checked?.value || "not-asked";
	}
	return responses;
}

function deriveStatus(responses, withdrawn, form = latestPublishedForm()) {
	if (withdrawn) return "Withdrawn";
	const missingRequired = consentItemsForForm(form).some(item => item.required && responses[item.id] !== "agreed");
	return missingRequired ? "Needs consent" : "Ready for session";
}

async function saveConsent(event) {
	event.preventDefault();
	clearErrors();
	const participantId = $("#participant-id")?.value || "";
	const recordId = $("#consent-record-id")?.value || "";
	const formId = $("#consent-form-select")?.value || "";
	const form = state.consentForms.find(item => item.id === formId) || latestPublishedForm();
	const responses = collectResponses(form);
	const captureMethod = $("#capture-method")?.value || "";
	const recordedBy = $("#recorded-by")?.value || "";
	const withdrawn = $("#consent-withdrawn")?.checked === true;
	const withdrawalReason = $("#withdrawal-reason")?.value || "";
	const errors = [];

	if (!participantId) errors.push("Choose a participant before saving consent.");
	if (!formId) errors.push("Choose a published consent form version.");
	if (!captureMethod) errors.push("Select how consent was captured.");
	if (withdrawn && !withdrawalReason.trim()) errors.push("Enter a reason or note when consent is withdrawn.");
	if (errors.length) {
		showErrors(errors);
		return;
	}

	const payload = {
		studyId: state.studyId,
		participantId,
		consentFormId: formId,
		consentFormVersion: Number(form?.version || 1),
		responses,
		status: deriveStatus(responses, withdrawn, form),
		captureMethod,
		withdrawn,
		withdrawalReason,
		recordedBy
	};

	try {
		const endpoint = recordId ? `/api/participant-consent/${encodeURIComponent(recordId)}` : "/api/participant-consent";
		const body = await jsonFetch(apiUrl(endpoint), {
			method: recordId ? "PATCH" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});
		const saved = body.participantConsent;
		if (!saved) throw new Error("Participant consent response was not returned.");
		state.participantConsentRecords = state.participantConsentRecords.filter(record => record.id !== saved.id && record.participantId !== saved.participantId);
		state.participantConsentRecords.push(saved);
		setText("#participant-consent-status", "Participant consent saved.");
		setHidden("#consent-record-panel", true);
		renderSummary();
		renderParticipantTable();
	} catch (error) {
		console.error("[participant-consent] save failed", error);
		showErrors(["Could not save participant consent. Check the Participant Consent Airtable table and try again."]);
	}
}

function wireEvents() {
	document.addEventListener("click", event => {
		const button = event.target instanceof Element ? event.target.closest("[data-record-consent]") : null;
		if (!button) return;
		selectParticipant(button.getAttribute("data-record-consent") || "");
	});
	$("#participant-consent-form")?.addEventListener("submit", saveConsent);
	$("#cancel-participant-consent")?.addEventListener("click", () => setHidden("#consent-record-panel", true));
	$("#consent-form-select")?.addEventListener("change", event => {
		const form = state.consentForms.find(item => item.id === event.target.value) || latestPublishedForm();
		renderConsentItems(null, form);
	});
}

async function init() {
	clearErrors();
	wireEvents();
	const params = new URLSearchParams(window.location.search);
	state.projectId = params.get("pid") || "";
	state.studyId = params.get("sid") || "";

	if (!state.projectId || !state.studyId) {
		renderPageState();
		return;
	}

	try {
		const [project, studies, participants, consentForms, participantConsentRecords] = await Promise.all([
			loadProject(state.projectId),
			loadStudies(state.projectId),
			loadStudyCollection("/api/participants", state.studyId, "participants"),
			loadStudyCollection("/api/consent-forms", state.studyId, "consentForms"),
			loadStudyCollection("/api/participant-consent", state.studyId, "participantConsentRecords")
		]);
		state.project = project;
		state.study = studies.find(item => item.id === state.studyId) || null;
		state.participants = participants;
		state.consentForms = consentForms;
		state.participantConsentRecords = participantConsentRecords;
		setText("#study-context", `Study: ${studyTitle(state.study || {})}`);
		updateRoutes();
		renderPageState();
		renderSummary();
		renderParticipantTable();
	} catch (error) {
		console.error("[participant-consent] init failed", error);
		showErrors(["Could not load participant consent. Check the project and study links, then try again."]);
	}
}

init();
