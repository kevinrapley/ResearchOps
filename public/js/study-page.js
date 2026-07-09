/**
 * @file public/js/study-page.js
 * @module study-page
 * @summary Loads a study page and renders a readiness-led control page.
 */

import {
	applyEthicsRiskNextStepsOutcome,
	evaluateStudyEthicsRisk,
	loadSeededStudyEthicsRisk,
	loadStudyEthicsRiskNextSteps
} from "./study-ethics-risk-model.js?v=study-ethics-risk-20260704-2";

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

function projectTitle(project = {}) {
	const safeProject = project || {};
	return (
		safeProject.name ||
		safeProject.Name ||
		safeProject.title ||
		safeProject.Title ||
		safeProject.projectName ||
		safeProject.ProjectName ||
		safeProject["Project name"] ||
		safeProject["Project Name"] ||
		""
	).trim();
}

function linkedProjectIdForStudy(study = {}) {
	return (
		study.projectId ||
		study.project_id ||
		study.projectRecordId ||
		study.project_record_id ||
		(Array.isArray(study.projectIds) ? study.projectIds[0] : "") ||
		(Array.isArray(study.project_ids) ? study.project_ids[0] : "") ||
		""
	);
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
		// Project read route uses apiUrl("/api/projects") with a canonical Airtable record id path.
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

async function loadStudyFromProject(projectId, studyId) {
	const url = new URL(apiUrl("/api/studies"), window.location.origin);
	url.searchParams.set("project", projectId);
	const body = await jsonFetch(url.toString());
	const studies = Array.isArray(body?.studies) ? body.studies : [];
	const study = studies.find(item => item?.id === studyId || item?.recordId === studyId || item?.airtableId === studyId);
	if (!study?.id) throw new Error("Could not load study from project");
	return study;
}

async function resolveStudyContext(params) {
	const studyId = params.get("id") || "";
	const routeProjectId = params.get("project") || params.get("projectId") || "";

	if (studyId) {
		let study;
		try {
			study = await loadStudy(studyId);
		} catch (error) {
			if (!routeProjectId) throw error;
			study = await loadStudyFromProject(routeProjectId, studyId);
		}
		const projectId = routeProjectId || linkedProjectIdForStudy(study);
		if (!projectId) throw new Error("The Study record does not include a linked Project record.");
		return { projectId, studyId: study.id || studyId, study, routeMode: "canonical" };
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

async function loadStudySynthesisSummary(studyId) {
	try {
		const url = new URL(apiUrl("/api/synthesis"), window.location.origin);
		url.searchParams.set("study", studyId);
		const body = await jsonFetch(url.toString());
		return {
			clusters: Array.isArray(body?.clusters) ? body.clusters : [],
			themes: Array.isArray(body?.themes) ? body.themes : []
		};
	} catch (error) {
		console.warn("[study-page] synthesis summary lookup failed", error);
		return { clusters: [], themes: [] };
	}
}

async function loadReadinessContext(studyId) {
	const [participants, guides, consentForms, participantConsentRecords, supportSetup, evidence, synthesisSummary, studyEthicsRisk] =
		await Promise.all([
			loadStudyCollection("/api/participants", studyId, "participants"),
			loadStudyCollection("/api/guides", studyId, "guides"),
			loadStudyCollection("/api/consent-forms", studyId, "consentForms"),
			loadStudyCollection("/api/participant-consent", studyId, "participantConsentRecords"),
			loadStudySupportSetup(studyId),
			loadStudyCollection("/api/synthesis/evidence", studyId, "evidence"),
			loadStudySynthesisSummary(studyId),
			loadSeededStudyEthicsRisk(studyId)
		]);
	const studyEthicsRiskNextSteps = loadStudyEthicsRiskNextSteps(studyId);

	return {
		participants,
		guides,
		consentForms,
		participantConsentRecords,
		supportSetup,
		evidence,
		synthesisSummary,
		studyEthicsRisk,
		studyEthicsRiskNextSteps
	};
}

async function loadStudySupportSetup(studyId) {
	try {
		const url = new URL(apiUrl("/api/study-support"), window.location.origin);
		url.searchParams.set("study", studyId);
		const body = await jsonFetch(url.toString());
		return {
			setup: body?.setup || { decision: "", saved: false },
			people: Array.isArray(body?.people) ? body.people : []
		};
	} catch (error) {
		console.warn("[study-page] study support lookup failed", error);
		return { setup: { decision: "", saved: false }, people: [] };
	}
}

function enableLink(selector, href) {
	const el = $(selector);
	if (!el) return;
	el.href = href;
	el.hidden = false;
	el.classList.remove("link--disabled", "govuk-button--disabled");
	el.removeAttribute("aria-disabled");
	el.removeAttribute("data-disabled-link");
	el.removeAttribute("tabindex");
	el.removeAttribute("title");
}

function disableLink(selector, fallbackHref, reason) {
	const el = $(selector);
	if (!el) return;
	el.href = fallbackHref || "#study-readiness-title";
	if (selector === "#link-session") el.hidden = true;
	el.classList.add("link--disabled");
	if (el.classList.contains("govuk-button")) el.classList.add("govuk-button--disabled");
	el.setAttribute("aria-disabled", "true");
	el.setAttribute("data-disabled-link", "true");
	el.setAttribute("tabindex", "-1");
	if (reason) el.setAttribute("title", reason);
}

function readinessTagClass(state) {
	const normalised = String(state || "").trim().toLowerCase();
	if (["ready", "available"].includes(normalised)) return "govuk-tag--green";
	if (["set", "checking", "not available yet"].includes(normalised)) return "govuk-tag--grey";
	if (["action needed", "needs attention", "extra controls needed", "ethics advice needed"].includes(normalised)) return "govuk-tag--yellow";
	if (["pause before recruitment", "ethics submission likely needed"].includes(normalised)) return "govuk-tag--red";
	return "govuk-tag--grey";
}

function setReadinessItem(key, state, text) {
	const status = document.getElementById(`study-readiness-${key}-status`);
	const hint = document.getElementById(`study-readiness-${key}-hint`);
	if (status) {
		status.textContent = state;
		status.className = `govuk-tag ${readinessTagClass(state)} study-readiness-status`;
	}
	if (hint) hint.textContent = text;
}

function setSetupTaskStatus(selector, state) {
	const status = $(selector);
	if (!status) return;
	status.textContent = state;
	status.className = `govuk-tag ${readinessTagClass(state)}`;
}

function ethicsRiskNextStepsHref() {
	return document.body.dataset.ethicsRiskNextStepsHref || $("#link-ethics-risk")?.href || "#study-readiness-title";
}

function renderSetupTaskStatuses(readiness) {
	setSetupTaskStatus("#study-setup-ethics-risk-status", readiness.ethicsRisk.state);
	setSetupTaskStatus("#study-setup-consent-forms-status", readiness.consentMaterials.state);
	setSetupTaskStatus("#study-setup-participant-consent-status", readiness.participantConsent.state);
	setSetupTaskStatus("#study-setup-participants-status", readiness.participants.state);
	setSetupTaskStatus("#study-setup-guide-status", readiness.guide.state);
}

function blockerActionForKey(key) {
	const actions = {
		description: { label: "Edit the study description", selector: "#btn-edit-desc" },
		status: { label: "Review the study status", selector: "#edit-study" },
		ethicsRisk: { label: "Assess ethics and research risk", selector: "#link-ethics-risk" },
		participants: { label: "Add or review participants", selector: "#link-participants" },
		guide: { label: "Publish a discussion guide", selector: "#link-guides" },
		consentMaterials: { label: "Create or review consent forms", selector: "#link-consent-forms" },
		participantConsent: { label: "Record required participant consent", selector: "#link-participant-consent" }
	};
	return actions[key] || { label: key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`), selector: "" };
}

function ethicsEscalationAction(readiness = {}) {
	const ethicsRisk = readiness.ethicsRisk || {};
	if (ethicsRisk.route === "ethics-board-submission-likely") {
		return {
			label: "Prepare ethics submission next steps",
			message:
				"The ethics and research risk assessment is complete. Work through the ethics submission next steps before starting fieldwork."
		};
	}
	if (ethicsRisk.route === "sensitive-research-controls") {
		return {
			label: "Plan extra control next steps",
			message:
				"The ethics and research risk assessment is complete. Work through the extra control next steps before starting fieldwork."
		};
	}
	return {
		label: "Get ethics advice next steps",
		message:
			"The ethics and research risk assessment is complete. Work through the ethics advice next steps before starting fieldwork."
	};
}

function renderSessionGatePanel(ready, blockedKeys, escalationKeys, readiness = {}) {
	const summary = $("#study-session-gate-summary");
	const message = $("#study-session-gate-message");
	const blockers = $("#study-session-blockers");
	const action = $("#study-session-action");

	if (action) action.hidden = !ready;
	if (!summary || !message || !blockers) return;

	if (ready) {
		summary.textContent = "This study is ready to run";
		message.textContent = "All required setup tasks are complete. Begin a session when you are ready to start fieldwork.";
		blockers.hidden = true;
		blockers.replaceChildren();
		return;
	}

	if (blockedKeys.length === 0 && escalationKeys.includes("ethicsRisk")) {
		const escalation = ethicsEscalationAction(readiness);
		summary.textContent = readiness.ethicsRisk?.state || "Ethics advice needed";
		message.textContent = escalation.message;
		blockers.hidden = false;
		const item = document.createElement("li");
		const link = document.createElement("a");
		link.textContent = escalation.label;
		link.href = ethicsRiskNextStepsHref();
		item.append(link);
		blockers.replaceChildren(item);
		return;
	}

	summary.textContent = `${blockedKeys.length} setup ${blockedKeys.length === 1 ? "task needs" : "tasks need"} attention`;
	message.textContent = "Complete these tasks before starting fieldwork.";
	blockers.hidden = false;
	blockers.replaceChildren(
		...blockedKeys.map(key => {
			const actionInfo = blockerActionForKey(key);
			const item = document.createElement("li");
			const link = document.createElement("a");
			link.textContent = actionInfo.label;
			const target = actionInfo.selector ? $(actionInfo.selector) : null;
			link.href = target?.href || actionInfo.selector || "#study-readiness-title";
			item.append(link);
			return item;
		})
	);
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
	const studyEthicsRisk = applyEthicsRiskNextStepsOutcome(
		context.studyEthicsRisk || evaluateStudyEthicsRisk({}),
		context.studyEthicsRiskNextSteps
	);

	const participantsReady = participants.length > 0;
	const guideReady = guides.some(isPublishedLike);
	const consentMaterialsReady = consentForms.some(isPublishedLike);
	const readyParticipantConsent = participantConsentRecords.filter(isParticipantConsentReady);
	const participantConsentReady = readyParticipantConsent.length > 0;
	const ethicsRiskRoute = studyEthicsRisk.route || "";
	const ethicsRiskRecorded =
		studyEthicsRisk.started === true &&
		!["incomplete-assessment", "not-assessed", "not-recorded"].includes(ethicsRiskRoute);
	const ethicsRiskReady = studyEthicsRisk.ready === true;

	return {
		description: {
			ready: hasDescription,
			state: hasDescription ? "Ready" : "Needs attention",
			text: hasDescription ? "The study has a description." : "Add a short description before running sessions."
		},
		status: {
			ready: hasStatus,
			state: hasStatus ? "Ready" : "Needs attention",
			text: hasStatus ? `Study status is ${status}.` : "Set the study status before running sessions."
		},
		ethicsRisk: {
			ready: ethicsRiskReady,
			setupComplete: ethicsRiskRecorded || ethicsRiskReady,
			escalationRequired: ethicsRiskRecorded && !ethicsRiskReady,
			route: ethicsRiskRoute,
			state: studyEthicsRisk.readinessState || "Action needed",
			text: studyEthicsRisk.started
				? `${studyEthicsRisk.statusLabel}. ${studyEthicsRisk.summary}`
				: "Assess ethics and research risk before recruitment or fieldwork."
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

function isSetupTaskIncomplete(key, item = {}) {
	if (key === "ethicsRisk") return item.setupComplete !== true;
	return item.ready !== true;
}

function renderSessionGate(readiness, sessionHref) {
	const ready = isStudyReady(readiness);
	const blockedKeys = Object.entries(readiness)
		.filter(([key, item]) => isSetupTaskIncomplete(key, item))
		.map(([key]) => key);
	const escalationKeys = Object.entries(readiness)
		.filter(([, item]) => item.ready !== true && item.escalationRequired === true)
		.map(([key]) => key);
	const blockedReasons = blockedKeys.map(key => key.replace(/[A-Z]/g, match => ` ${match.toLowerCase()}`));

	renderSessionGatePanel(ready, blockedKeys, escalationKeys, readiness);

	if (ready) {
		setReadinessItem("session", "Available", "Open the session workspace when the study setup is ready.");
		enableLink("#link-session", sessionHref);
		return;
	}

	if (blockedKeys.length === 0 && escalationKeys.includes("ethicsRisk")) {
		setReadinessItem(
			"session",
			"Not available yet",
			"Complete the ethics risk next steps before beginning a session."
		);
		disableLink("#link-session", "#study-readiness-title", "Complete the ethics risk next steps before beginning a session.");
		return;
	}

	setReadinessItem(
		"session",
		"Not available yet",
		`Complete the ${blockedReasons.join(", ")} setup ${blockedReasons.length === 1 ? "task" : "tasks"} before beginning a session.`
	);
	disableLink("#link-session", "#study-readiness-title", "Complete study readiness tasks before beginning a session.");
}

function setSourcebookStatusClass(element, prefix, status) {
	if (!element) return;
	for (const className of [...element.classList]) {
		if (className.startsWith(prefix)) element.classList.remove(className);
	}
	element.classList.add(`${prefix}${status}`);
}

function normaliseEvidenceText(value) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, "-");
}

function hasSourcebookEvidenceRecord(records, evidenceId, aliases = []) {
	const needles = [evidenceId, ...aliases].map(normaliseEvidenceText).filter(Boolean);
	if (!needles.length) return false;
	return (Array.isArray(records) ? records : []).some(record => {
		const haystack = [
			record.id,
			record.evidenceId,
			record.sourcebookEvidenceId,
			record.type,
			record.category,
			record.label,
			record.title,
			record.summary,
			record.note,
			record.text,
			record.tags,
			Array.isArray(record.sourcebookEvidenceIds) ? record.sourcebookEvidenceIds.join(" ") : "",
			Array.isArray(record.evidenceIds) ? record.evidenceIds.join(" ") : ""
		]
			.map(normaliseEvidenceText)
			.join(" ");
		return needles.some(needle => haystack.includes(needle));
	});
}

function studySourcebookEvidenceIds(readiness, context = {}) {
	const provided = new Set();
	if (readiness.description?.ready) provided.add("research-intake");
	const studyEthicsRisk = applyEthicsRiskNextStepsOutcome(context.studyEthicsRisk || {}, context.studyEthicsRiskNextSteps);
	if (studyEthicsRisk.started && studyEthicsRisk.route !== "incomplete-assessment") {
		provided.add("risk-assessment");
		provided.add("triage-outcome");
		provided.add("participant-risk-rationale");
	}
	const nextStepsRecord = context.studyEthicsRiskNextSteps || {};
	if (Array.isArray(nextStepsRecord.evidenceIds) && nextStepsRecord.evidenceIds.includes("updated-controls")) {
		provided.add("participant-risk-rationale");
	}
	const evidenceRecords = Array.isArray(context.evidence) ? context.evidence : [];
	if (hasSourcebookEvidenceRecord(evidenceRecords, "risk-assessment", ["risk assessment", "risk-rating"])) {
		provided.add("risk-assessment");
	}
	if (hasSourcebookEvidenceRecord(evidenceRecords, "triage-outcome", ["governance-triage", "scope-triage", "triage outcome"])) {
		provided.add("triage-outcome");
	}
	if (hasSourcebookEvidenceRecord(evidenceRecords, "participant-risk-rationale", ["participant risk rationale", "method risk rationale"])) {
		provided.add("participant-risk-rationale");
	}
	if (readiness.guide?.ready) {
		provided.add("research-plan");
		provided.add("method-rationale");
	}
	if (readiness.participants?.ready) {
		provided.add("access-needs-check");
	}
	if (readiness.consentMaterials?.ready) provided.add("consent-form");
	if (readiness.participantConsent?.ready) provided.add("consent-log");

	const supportSetup = context.supportSetup || {};
	const setup = supportSetup.setup || {};
	const supportPeople = Array.isArray(supportSetup.people) ? supportSetup.people : [];
	if (setup.saved === true && (setup.decision === "no" || supportPeople.length > 0)) {
		provided.add("study-roles");
		provided.add("environment-risk-assessment");
	}

	return provided;
}

function updateSourcebookLedger(providedEvidence) {
	const ledger = document.querySelector(".study-sourcebook-evidence-details .sourcebook-evidence-ledger, .study-page > .sourcebook-evidence-ledger");
	const rows = ledger ? [...ledger.querySelectorAll("[data-sourcebook-evidence-id]")] : [];
	rows.forEach(row => {
		const evidenceId = row.getAttribute("data-sourcebook-evidence-id") || "";
		const present = providedEvidence.has(evidenceId);
		row.classList.toggle("sourcebook-evidence-ledger__row--present", present);
		row.classList.toggle("sourcebook-evidence-ledger__row--needed", !present);
		const tag = row.querySelector(".sourcebook-evidence-ledger__tag");
		if (!tag) return;
		tag.textContent = present ? "Present" : "Needed";
		setSourcebookStatusClass(tag, "sourcebook-evidence-ledger__tag--", present ? "present" : "needed");
	});

	return {
		total: rows.length,
		present: rows.filter(row => row.classList.contains("sourcebook-evidence-ledger__row--present")).length,
		needed: rows.filter(row => row.classList.contains("sourcebook-evidence-ledger__row--needed")).length
	};
}

function updateSourcebookGate(readiness, providedEvidence, ledgerStatus) {
	const gate = document.querySelector("[data-sourcebook-gate]");
	if (!gate) return;
	const sessionReady = isStudyReady(readiness);
	const missingEvidence = Number(ledgerStatus?.needed || 0);
	const ready = sessionReady && missingEvidence === 0;
	const setupBlockers = Object.entries(readiness).filter(([key, item]) => isSetupTaskIncomplete(key, item));
	const escalationBlockers = Object.values(readiness).filter(item => item.ready !== true && item.escalationRequired === true);
	const hasEscalationOnly = setupBlockers.length === 0 && escalationBlockers.length > 0;
	const readinessBlockers = setupBlockers.length + escalationBlockers.length;
	const gateStatus = gate.querySelector("[data-sourcebook-gate-status]");
	const gateSummary = gate.querySelector("[data-sourcebook-gate-summary]");
	const gateAction = gate.querySelector("[data-sourcebook-gate-action]");
	const status = ready ? "ready" : sessionReady || hasEscalationOnly ? "attention" : "blocked";

	gate.classList.toggle("sourcebook-gate--ready", ready);
	gate.classList.toggle("sourcebook-gate--blocked", !ready && !sessionReady && !hasEscalationOnly);
	gate.classList.toggle("sourcebook-gate--attention", !ready);

	if (gateStatus) {
		gateStatus.textContent = ready
			? "Sourcebook evidence complete"
			: sessionReady
				? "Evidence record incomplete"
				: hasEscalationOnly
					? "Governance escalation needed"
					: "Setup tasks incomplete";
		setSourcebookStatusClass(gateStatus, "sourcebook-gate__tag--", status);
	}
	if (gateSummary) {
		if (ready) {
			gateSummary.textContent = "Setup tasks and the Sourcebook evidence record are complete.";
		} else if (sessionReady) {
			gateSummary.textContent =
				"The study can run. The Sourcebook evidence record still has missing audit evidence to review.";
		} else if (hasEscalationOnly) {
			gateSummary.textContent =
				"The risk assessment is recorded. Complete the ethics risk next steps before starting sessions.";
		} else {
			gateSummary.textContent = "Complete the setup tasks before beginning a participant session.";
		}
	}
	if (gateAction) {
		if (ready) {
			gateAction.textContent = "Continue to session with controls in place.";
		} else if (sessionReady) {
			gateAction.textContent = "Review the Sourcebook evidence record.";
		} else if (hasEscalationOnly) {
			gateAction.textContent = "Use the ethics risk next steps workflow before starting fieldwork.";
		} else {
			gateAction.textContent = "Use the setup task list to complete what is missing.";
		}
	}

	const checks = [
		{
			id: "sourcebook-context",
			met: true,
			label: "Matched",
			detail: "5 clauses matched this study readiness route."
		},
		{
			id: "evidence-readiness",
			met: missingEvidence === 0,
			label: missingEvidence === 0 ? "Ready" : "Evidence needed",
			detail:
				missingEvidence === 0
					? "All mapped evidence items are present."
					: `${missingEvidence} evidence item${missingEvidence === 1 ? "" : "s"} needed.`
		},
		{
			id: "governance-action",
			met: sessionReady,
			label: ready
				? "Proceed with controls"
				: sessionReady
					? "Proceed, review evidence"
					: hasEscalationOnly
						? "Ethics advice needed"
						: "Pause for setup",
			detail:
				ready
					? "The study can proceed because readiness checks and required Sourcebook evidence are complete."
					: sessionReady
						? `${missingEvidence} Sourcebook evidence ${missingEvidence === 1 ? "item" : "items"} need audit review, but setup tasks are complete.`
							: hasEscalationOnly
								? "The risk assessment is recorded. Complete the route-specific ethics risk next steps before sessions begin."
							: `${readinessBlockers} readiness ${readinessBlockers === 1 ? "task" : "tasks"} and ${missingEvidence} Sourcebook evidence ${missingEvidence === 1 ? "item" : "items"} need attention.`
		}
	];

	for (const check of checks) {
		const item = gate.querySelector(`[data-sourcebook-check="${check.id}"]`);
		if (!item) continue;
		const checkStatus = item.querySelector("[data-sourcebook-check-status]");
		const checkDetail = item.querySelector("[data-sourcebook-check-detail]");
		item.classList.toggle("sourcebook-gate__check--met", check.met);
		item.classList.toggle("sourcebook-gate__check--unmet", !check.met);
		if (checkStatus) {
			checkStatus.textContent = check.label;
			setSourcebookStatusClass(checkStatus, "sourcebook-gate__check-tag--", check.met ? "met" : "unmet");
		}
		if (checkDetail) checkDetail.textContent = check.detail;
	}

	if (!providedEvidence.size && gateSummary) {
		gateSummary.textContent = "Checking whether the study can begin participant sessions.";
	}
}

function updateSourcebookAssurance(readiness, context = {}) {
	const providedEvidence = studySourcebookEvidenceIds(readiness, context);
	const ledgerStatus = updateSourcebookLedger(providedEvidence);
	updateSourcebookGate(readiness, providedEvidence, ledgerStatus);
}

function renderReadiness(study, context, sessionHref) {
	const readiness = evaluateReadiness(study, context);

	setReadinessItem("description", readiness.description.state, readiness.description.text);
	setReadinessItem("status", readiness.status.state, readiness.status.text);
	setReadinessItem("ethics-risk", readiness.ethicsRisk.state, readiness.ethicsRisk.text);
	setReadinessItem("participants", readiness.participants.state, readiness.participants.text);
	setReadinessItem("guide", readiness.guide.state, readiness.guide.text);
	setReadinessItem("consent-materials", readiness.consentMaterials.state, readiness.consentMaterials.text);
	setReadinessItem("participant-consent", readiness.participantConsent.state, readiness.participantConsent.text);
	renderSetupTaskStatuses(readiness);
	renderSessionGate(readiness, sessionHref);
	updateSourcebookAssurance(readiness, context);
}

function pluralise(count, singular, plural = `${singular}s`) {
	return `${count} ${count === 1 ? singular : plural}`;
}

function evidenceStateForContext(context = {}) {
	const evidence = Array.isArray(context.evidence) ? context.evidence : [];
	const synthesisSummary = context.synthesisSummary || {};
	const clusters = Array.isArray(synthesisSummary.clusters) ? synthesisSummary.clusters : [];
	const themes = Array.isArray(synthesisSummary.themes) ? synthesisSummary.themes : [];

	if (evidence.length === 0) {
		return {
			state: "No evidence captured",
			countText: "No evidence notes are linked to this study yet.",
			stateText: "Synthesis is not ready because there is no captured evidence.",
			nextAction: "Capture session evidence before starting synthesis.",
			status: "Not available yet",
			hint: "Capture evidence notes before grouping them into study-level themes."
		};
	}

	if (themes.length > 0) {
		return {
			state: "Themes available",
			countText: `${pluralise(evidence.length, "evidence note")} linked to this study.`,
			stateText: `${pluralise(clusters.length, "cluster")} and ${pluralise(themes.length, "theme")} available for review.`,
			nextAction: "Review the synthesis themes and evidence links before sharing findings.",
			status: "Ready",
			hint: "Review evidence clusters and traceable study-level themes."
		};
	}

	if (clusters.length > 0) {
		return {
			state: "Clusters drafted",
			countText: `${pluralise(evidence.length, "evidence note")} linked to this study.`,
			stateText: `${pluralise(clusters.length, "working cluster")} created; no study-level themes yet.`,
			nextAction: "Create traceable themes from the strongest evidence clusters.",
			status: "Action needed",
			hint: "Create traceable themes from the existing evidence clusters."
		};
	}

	return {
		state: "Evidence captured",
		countText: `${pluralise(evidence.length, "evidence note")} linked to this study.`,
		stateText: "Evidence is ready to group into working clusters.",
		nextAction: "Group evidence notes into clusters and then create study-level themes.",
		status: "Available",
		hint: "Group captured evidence notes into working clusters."
	};
}

function renderEvidenceStateSummary(context = {}) {
	const summary = evidenceStateForContext(context);
	setText("#study-evidence-count", summary.countText);
	setText("#study-evidence-state", summary.stateText);
	setText("#study-evidence-next-action", summary.nextAction);

	const synthesisStatus = $("#study-analysis-synthesis-status");
	const synthesisHint = $("#study-analysis-synthesis-hint");
	if (synthesisStatus) {
		synthesisStatus.textContent = summary.status;
		synthesisStatus.className = `govuk-tag ${readinessTagClass(summary.status)} study-readiness-status`;
	}
	if (synthesisHint) synthesisHint.textContent = summary.hint;
}

function renderSupportSetupStatus(supportSetup = {}) {
	const status = $("#study-setup-support-status");
	const hint = $("#study-setup-support-hint");
	if (!status || !hint) return;

	const setup = supportSetup.setup || {};
	const people = Array.isArray(supportSetup.people) ? supportSetup.people : [];
	const ready = setup.saved === true && (setup.decision === "no" || (setup.decision === "yes" && people.length > 0));
	status.textContent = ready ? "Ready" : "Action needed";
	status.className = `govuk-tag ${ready ? "govuk-tag--green" : "govuk-tag--yellow"}`;

	if (!setup.saved) {
		hint.textContent = "Confirm who, if anyone, will join sessions beyond the lead researcher.";
	} else if (setup.decision === "no") {
		hint.textContent = "No additional note takers or observers will join sessions.";
	} else if (people.length === 0) {
		hint.textContent = "Add at least one support person, or change the setup decision.";
	} else {
		hint.textContent = `${people.length} support ${people.length === 1 ? "person is" : "people are"} linked to this study.`;
	}
}

function cardSortTaskRow() {
	return $("#link-card-sort")?.closest("li") || null;
}

async function renderCardSortTask(study, projectId, studyId) {
	const row = cardSortTaskRow();
	if (!row) return;
	const isCardSort = String(study.method || "").trim().toLowerCase() === "card sort";
	row.hidden = !isCardSort;
	if (!isCardSort) return;

	enableLink("#link-card-sort", route("/pages/study/card-sort/", { id: studyId, project: projectId }));

	const status = $("#study-setup-card-sort-status");
	const hint = $("#study-setup-card-sort-hint");
	try {
		const res = await fetch(apiUrl(`/api/card-sorts/config?study=${encodeURIComponent(studyId)}&ts=${Date.now()}`), {
			cache: "no-store",
			credentials: "include"
		});
		const body = await res.json().catch(() => ({}));
		const config = body?.config || null;
		const ready = Boolean(config && Array.isArray(config.cards) && config.cards.length);
		if (status) {
			status.textContent = ready ? "Ready" : "Action needed";
			status.className = `govuk-tag ${ready ? "govuk-tag--green" : "govuk-tag--yellow"}`;
		}
		if (hint) {
			hint.textContent = ready
				? `${config.sort_type.charAt(0).toUpperCase()}${config.sort_type.slice(1)} sort with ${config.cards.length} card${config.cards.length === 1 ? "" : "s"}${config.groups?.length ? ` and ${config.groups.length} predefined group${config.groups.length === 1 ? "" : "s"}` : ""}.`
				: "Define the cards and groups participants will sort in sessions.";
		}
	} catch (error) {
		console.warn("[study-page] card sort status failed", error);
	}
}

function renderRoutes(projectId, studyId) {
	const studyParams = { id: studyId, project: projectId };
	enableLink("#breadcrumb-project", route("/pages/project-dashboard/", { id: projectId }));
	enableLink("#link-consent-forms", route("/pages/study/consent-forms/", studyParams));
	enableLink("#link-participant-consent", route("/pages/study/participant-consent/", studyParams));
	enableLink("#link-guides", route("/pages/study/guides/", studyParams));
	enableLink("#link-participants", route("/pages/study/participants/", studyParams));
	enableLink("#link-note-takers-observers", route("/pages/study/note-takers-observers/", studyParams));
	enableLink("#link-synthesis", route("/pages/study/synthesis/", studyParams));

	enableLink("#link-ethics-risk", route("/pages/study/ethics-risk/", studyParams));
	document.body.dataset.ethicsRiskNextStepsHref = route("/pages/study/ethics-risk/next-steps/", studyParams);

	const editStudy = $("#edit-study");
	if (editStudy) editStudy.href = `${route("/pages/study/", { id: studyId })}#edit`;

	return {
		sessionHref: route("/pages/study/session/", studyParams)
	};
}

function primeEthicsRiskLinkFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const studyId = params.get("id") || "";
	const projectId = params.get("project") || params.get("projectId") || "";
	if (!studyId) return;
	enableLink("#link-ethics-risk", route("/pages/study/ethics-risk/", { id: studyId, project: projectId }));
	document.body.dataset.ethicsRiskNextStepsHref = route("/pages/study/ethics-risk/next-steps/", { id: studyId, project: projectId });
}

function renderStudy(project, study, projectId, studyId, readinessContext) {
	const projectName = projectTitle(project) || "Project";
	document.body.setAttribute("data-study-id", studyId);
	document.body.setAttribute("data-project-id", projectId);

	setText("#breadcrumb-project", projectName);
	setText("#study-eyebrow", projectName);
	setText("#study-title", studyTitle(study));
	setText("#description", String(study.description || "").trim() || "No study description has been added yet.");
	setText("#kv-method", study.method || "—");
	setText("#kv-status", study.status || "—");
	setText("#kv-studyid", String(study.studyId || study.id || "—").toUpperCase());

	const routes = renderRoutes(projectId, studyId);
	renderCardSortTask(study, projectId, studyId);
	renderReadiness(study, readinessContext, routes.sessionHref);
	renderSupportSetupStatus(readinessContext.supportSetup);
	renderEvidenceStateSummary(readinessContext);
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

primeEthicsRiskLinkFromUrl();
// Hidden until the study loads; only Card Sort studies show this setup task.
const initialCardSortRow = cardSortTaskRow();
if (initialCardSortRow) initialCardSortRow.hidden = true;
init();
