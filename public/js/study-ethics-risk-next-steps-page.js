/**
 * @file public/js/study-ethics-risk-next-steps-page.js
 * @module study-ethics-risk-next-steps-page
 * @summary Renders route-specific next steps after a study ethics risk assessment.
 */

import { loadSeededStudyEthicsRisk } from "./study-ethics-risk-model.js";
import {
	resolveStudyContextFromUrl,
	route,
	studyTitle
} from "./study-route-context.js";

const $ = (selector, root = document) => root.querySelector(selector);
let currentStudyId = "";
let currentWorkflowKey = "";

const workflowDefinitions = {
	"ethics-advice-required": {
		key: "ethics-advice",
		title: "Ethics advice needed",
		tag: "Ethics advice needed",
		tagClass: "govuk-tag--yellow",
		summary: "Use this workflow to prepare the question, get the right advice and record the decision before recruitment or fieldwork.",
		tasks: [
			{
				title: "Prepare the ethics advice question",
				hint: "Summarise the study method, participants, sensitive triggers and the specific decision you need."
			},
			{
				title: "Share the assessment and study materials",
				hint: "Include consent materials, recruitment wording, safeguarding controls, data handling and session support arrangements."
			},
			{
				title: "Record advice received",
				hint: "Record who gave advice, when it was received, what route was recommended and any conditions."
			},
			{
				title: "Update the study before recruitment",
				hint: "Apply any advice to the study plan, participant materials and session controls before inviting people."
			}
		],
		evidenceIntro: "Keep enough evidence to show why the study could proceed and what conditions apply.",
		evidence: [
			"Risk assessment outcome",
			"Triage outcome",
			"Advice request or question",
			"Ethics, safeguarding or governance response",
			"Updated study controls and participant materials"
		]
	},
	"sensitive-research-controls": {
		key: "extra-controls",
		title: "Extra controls needed",
		tag: "Extra controls needed",
		tagClass: "govuk-tag--yellow",
		summary: "Use this workflow to convert sensitive research triggers into controls before recruitment or fieldwork.",
		tasks: [
			{
				title: "Turn each trigger into a control",
				hint: "Record the control for distress, safeguarding, privacy, recruitment pressure, data handling or researcher support."
			},
			{
				title: "Update study materials",
				hint: "Make sure consent forms, recruitment wording and the discussion guide reflect the controls."
			},
			{
				title: "Confirm the support and escalation route",
				hint: "Check who will support the researcher and what happens if a session needs to pause or stop."
			},
			{
				title: "Record controls before sessions",
				hint: "Treat the study as not ready until the controls are recorded and visible to the team."
			}
		],
		evidenceIntro: "Keep evidence that the controls exist and are reflected in the study materials.",
		evidence: [
			"Risk assessment outcome",
			"Triage outcome",
			"Control log or study plan update",
			"Updated consent, recruitment and guide materials",
			"Researcher support or escalation route"
		]
	},
	"ethics-board-submission-likely": {
		key: "ethics-submission",
		title: "Ethics submission likely needed",
		tag: "Ethics submission likely needed",
		tagClass: "govuk-tag--red",
		summary: "Use this workflow to pause fieldwork, prepare the submission pack and record approval before any participant contact.",
		tasks: [
			{
				title: "Pause recruitment and fieldwork",
				hint: "Do not invite participants or begin sessions while the formal route is unresolved."
			},
			{
				title: "Prepare the submission pack",
				hint: "Include the risk assessment, method, participant group, consent materials, data handling, safeguarding and researcher safety controls."
			},
			{
				title: "Submit through the required route",
				hint: "Use the departmental ethics, governance or assurance route and keep a record of the submission."
			},
			{
				title: "Record approval and conditions",
				hint: "Record approval, conditions, expiry or review points before the study can move back towards readiness."
			}
		],
		evidenceIntro: "Keep the evidence pack needed to show formal review, approval and any conditions.",
		evidence: [
			"Risk assessment outcome",
			"Triage outcome",
			"Ethics or governance submission pack",
			"Approval, conditions or rejection decision",
			"Updated study materials reflecting approval conditions"
		]
	},
	"default": {
		key: "complete-assessment",
		title: "Complete the risk assessment first",
		tag: "Action needed",
		tagClass: "govuk-tag--yellow",
		summary: "The next-steps workflow starts after the ethics and research risk assessment has been recorded.",
		tasks: [
			{
				title: "Complete the ethics and research risk assessment",
				hint: "Answer the risk discovery questions and record the study risk outcome."
			}
		],
		evidenceIntro: "No escalation evidence is needed until an assessment outcome has been recorded.",
		evidence: ["Risk assessment outcome", "Triage outcome"]
	},
	"ready": {
		key: "no-escalation",
		title: "No ethics escalation required",
		tag: "No escalation required",
		tagClass: "govuk-tag--green",
		summary: "The recorded risk assessment does not require a dedicated ethics escalation workflow. Continue with the standard study setup controls.",
		tasks: [
			{
				title: "Return to study readiness",
				hint: "Continue with standard consent, privacy, data handling and session controls."
			}
		],
		evidenceIntro: "Keep the standard Sourcebook evidence record for study readiness.",
		evidence: ["Risk assessment outcome", "Triage outcome", "Standard consent and data handling controls"]
	}
};

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
		"Project"
	);
}

function setText(selector, value) {
	const element = $(selector);
	if (element) element.textContent = value || "—";
}

function sourcebookClauseMarkup(clauses = []) {
	if (!clauses.length) return document.createTextNode("No Sourcebook clauses mapped.");
	const list = document.createElement("ul");
	list.className = "govuk-list study-ethics-risk-sourcebook-list";
	clauses.forEach(clause => {
		const item = document.createElement("li");
		const link = document.createElement("a");
		link.className = "govuk-link";
		link.href = clause.href;
		link.textContent = clause.id;
		item.append(link, `: ${clause.title}`);
		list.append(item);
	});
	return list;
}

function renderTextList(selector, values = []) {
	const list = $(selector);
	if (!list) return;
	list.replaceChildren(
		...values.map(value => {
			const item = document.createElement("li");
			item.textContent = value;
			return item;
		})
	);
}

function renderTasks(tasks = []) {
	const list = $("#ethics-next-steps-list");
	if (!list) return;
	list.replaceChildren(
		...tasks.map((task, index) => {
			const item = document.createElement("li");
			item.className = "govuk-task-list__item govuk-task-list__item--with-link";
			const body = document.createElement("div");
			body.className = "govuk-task-list__name-and-hint";
			const link = document.createElement("a");
			link.className = "govuk-link govuk-task-list__link";
			link.href = "#ethics-next-steps-record";
			link.textContent = task.title;
			const hint = document.createElement("div");
			hint.className = "govuk-task-list__hint";
			hint.textContent = task.hint;
			body.append(link, hint);
			const statusWrap = document.createElement("div");
			statusWrap.className = "govuk-task-list__status";
			const status = document.createElement("strong");
			status.className = `govuk-tag ${index === 0 ? "govuk-tag--yellow" : "govuk-tag--grey"}`;
			status.textContent = index === 0 ? "Next" : "To do";
			statusWrap.append(status);
			item.append(body, statusWrap);
			return item;
		})
	);
}

function workflowForOutcome(outcome = {}) {
	if (!outcome.started || ["incomplete-assessment", "not-assessed", "not-recorded"].includes(outcome.route)) {
		return workflowDefinitions.default;
	}
	if (outcome.ready === true) return workflowDefinitions.ready;
	return workflowDefinitions[outcome.route] || workflowDefinitions.default;
}

function nextStepsStorageKey(studyId) {
	return `researchops:study-ethics-risk-next-steps:${studyId}`;
}

function loadNextStepsRecord(studyId) {
	if (!studyId) return null;
	try {
		return JSON.parse(window.localStorage.getItem(nextStepsStorageKey(studyId)) || "null");
	} catch {
		return null;
	}
}

function saveNextStepsRecord(studyId, record) {
	if (!studyId) return null;
	const payload = {
		...record,
		savedAt: new Date().toISOString()
	};
	window.localStorage.setItem(nextStepsStorageKey(studyId), JSON.stringify(payload));
	return payload;
}

function renderRecordedState(record) {
	const element = $("#ethics-next-steps-recorded-state");
	if (!element) return;
	if (!record?.savedAt) {
		element.textContent = "No next step recorded yet.";
		return;
	}
	const date = new Date(record.savedAt);
	const formatted = Number.isNaN(date.getTime())
		? record.savedAt
		: new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(date);
	element.textContent = `Recorded ${formatted}.`;
}

function populateRecordForm(record) {
	const form = $("#ethics-next-steps-form");
	if (!form || !record) return;
	const state = form.querySelector(`[name="nextStepState"][value="${record.state}"]`);
	if (state instanceof HTMLInputElement) state.checked = true;
	const note = $("#ethics-next-step-note");
	if (note) note.value = record.note || "";
}

function renderOutcome(outcome = {}) {
	const workflow = workflowForOutcome(outcome);
	currentWorkflowKey = workflow.key;
	setText("#ethics-next-steps-title", workflow.title);
	setText("#ethics-next-steps-summary", workflow.summary);
	setText("#ethics-next-steps-outcome-title", outcome.statusLabel || workflow.title);
	setText("#ethics-next-steps-outcome-summary", outcome.summary || workflow.summary);
	setText("#ethics-next-steps-evidence-intro", workflow.evidenceIntro);
	const tag = $("#ethics-next-steps-outcome-tag");
	if (tag) {
		tag.textContent = workflow.tag;
		tag.className = `govuk-tag ${workflow.tagClass}`;
	}

	const triggers = $("#ethics-next-steps-triggers");
	if (triggers) {
		triggers.textContent = outcome.triggers?.length
			? outcome.triggers.map(trigger => `${trigger.family}: ${trigger.label}`).join("; ")
			: "No sensitive research triggers recorded.";
	}

	const clauses = $("#ethics-next-steps-sourcebook-clauses");
	if (clauses) clauses.replaceChildren(sourcebookClauseMarkup(outcome.sourcebookClauses || []));
	renderTasks(workflow.tasks);
	renderTextList("#ethics-next-steps-evidence-list", workflow.evidence);
	renderRecordedState(loadNextStepsRecord(currentStudyId));
	populateRecordForm(loadNextStepsRecord(currentStudyId));
}

function bindRecordForm() {
	const form = $("#ethics-next-steps-form");
	if (!form) return;
	form.addEventListener("submit", event => {
		event.preventDefault();
		const state = form.querySelector("[name='nextStepState']:checked")?.value || "started";
		const note = $("#ethics-next-step-note")?.value || "";
		const record = saveNextStepsRecord(currentStudyId, {
			workflow: currentWorkflowKey,
			state,
			note
		});
		renderRecordedState(record);
	});
}

function bindContext(context) {
	const projectName = projectTitle(context.project);
	const title = studyTitle(context.study || {});
	const studyHref = route("/pages/study/", { id: context.studyId, project: context.projectId });
	const riskHref = route("/pages/study/ethics-risk/", { id: context.studyId, project: context.projectId });
	currentStudyId = context.studyId;

	const projectBreadcrumb = $("#breadcrumb-project");
	if (projectBreadcrumb) {
		projectBreadcrumb.href = route("/pages/project-dashboard/", { id: context.projectId });
		projectBreadcrumb.textContent = projectName;
	}
	const studyBreadcrumb = $("#breadcrumb-study");
	if (studyBreadcrumb) {
		studyBreadcrumb.href = studyHref;
		studyBreadcrumb.textContent = title;
	}
	const riskBreadcrumb = $("#breadcrumb-ethics-risk");
	if (riskBreadcrumb) riskBreadcrumb.href = riskHref;
	const backToRisk = $("#back-to-risk-assessment");
	if (backToRisk) backToRisk.href = riskHref;
	const backToStudy = $("#back-to-study");
	if (backToStudy) backToStudy.href = studyHref;
	setText("#study-eyebrow", title);
}

async function initContext() {
	const params = new URLSearchParams(window.location.search);
	try {
		const context = await resolveStudyContextFromUrl(params);
		bindContext(context);
		return context.studyId;
	} catch {
		const warning = $("#study-context-warning");
		if (warning) warning.hidden = false;
		currentStudyId = params.get("id") || params.get("sid") || "";
		const backToRisk = $("#back-to-risk-assessment");
		if (backToRisk) backToRisk.href = currentStudyId ? route("/pages/study/ethics-risk/", { id: currentStudyId }) : "/pages/study/ethics-risk/";
		const backToStudy = $("#back-to-study");
		if (backToStudy) backToStudy.href = currentStudyId ? route("/pages/study/", { id: currentStudyId }) : "/pages/study/";
		return currentStudyId;
	}
}

async function init() {
	const studyId = await initContext();
	renderOutcome(await loadSeededStudyEthicsRisk(studyId));
	bindRecordForm();
}

init();
