/**
 * @file public/js/study-ethics-risk-page.js
 * @module study-ethics-risk-page
 * @summary Controls the study ethics and research risk setup form.
 */

import {
	clearStudyEthicsRisk,
	loadSeededStudyEthicsRisk,
	recordStudyEthicsRisk,
	requiredEthicsRiskGroups
} from "./study-ethics-risk-model.js";
import {
	resolveStudyContextFromUrl,
	route,
	studyTitle
} from "./study-route-context.js";

const $ = (selector, root = document) => root.querySelector(selector);
let currentStudyId = "";
let currentStudyHref = "/pages/study/";
let currentNextStepsHref = "/pages/study/ethics-risk/next-steps/";
const exclusiveCheckboxValues = new Map([
	["topics", "none-sensitive-topics"],
	["data", "no-sensitive-data"],
	["researcherSupport", "no-additional-support"]
]);

function projectTitle(project = {}) {
	return (
		project?.name ||
		project?.Name ||
		project?.title ||
		project?.Title ||
		project?.projectName ||
		project?.ProjectName ||
		project?.["Project name"] ||
		project?.["Project Name"] ||
		"Project"
	);
}

function setText(selector, value) {
	const element = $(selector);
	if (element) element.textContent = value || "—";
}

function tagClassForEthicsRisk(status) {
	const normalised = String(status || "").trim();
	if (normalised === "ready") return "govuk-tag--green";
	if (normalised === "blocked") return "govuk-tag--red";
	return "govuk-tag--yellow";
}

function setCheckedValues(name, values = []) {
	const selected = new Set(normaliseExclusiveValues(name, values));
	document.querySelectorAll(`[name="${name}"]`).forEach(input => {
		if (input instanceof HTMLInputElement) input.checked = selected.has(input.value);
	});
}

function normaliseExclusiveValues(name, values = []) {
	const selected = Array.isArray(values) ? values.filter(Boolean) : [values].filter(Boolean);
	const exclusiveValue = exclusiveCheckboxValues.get(name);
	if (!exclusiveValue || !selected.includes(exclusiveValue)) return selected;
	return selected.length > 1 ? selected.filter(value => value !== exclusiveValue) : [exclusiveValue];
}

function enforceExclusiveCheckbox(input) {
	if (!(input instanceof HTMLInputElement) || input.type !== "checkbox" || !input.checked) return;
	const form = input.form;
	const selector = `input[type="checkbox"][name="${input.name}"]`;
	const group = [...(form || document).querySelectorAll(selector)].filter(item => item.form === form);
	const isExclusive = input.dataset.behaviour === "exclusive";
	group.forEach(item => {
		if (item === input) return;
		if (isExclusive || item.dataset.behaviour === "exclusive") item.checked = false;
	});
}

function formAnswers(form) {
	const checkedValues = name =>
		normaliseExclusiveValues(
			name,
			[...form.querySelectorAll(`[name="${name}"]:checked`)]
				.map(input => input.value)
				.filter(Boolean)
		);
	return {
		participants: checkedValues("participants"),
		topics: checkedValues("topics"),
		setting: checkedValues("setting"),
		data: checkedValues("data"),
		recruitment: form.querySelector("[name='recruitment']:checked")?.value || "",
		researcherSupport: checkedValues("researcherSupport")
	};
}

function populateForm(outcome = {}) {
	const answers = outcome.answers || {};
	setCheckedValues("participants", answers.participants);
	setCheckedValues("topics", answers.topics);
	setCheckedValues("setting", answers.setting);
	setCheckedValues("data", answers.data);
	setCheckedValues("recruitment", answers.recruitment);
	setCheckedValues("researcherSupport", answers.researcherSupport);
}

function textValue(value, fallback) {
	return typeof value === "string" ? value : value?.label || value?.reason || fallback;
}

function renderTextCollection(selector, items, fallback) {
	const current = $(selector);
	if (!current) return;
	const values = Array.isArray(items) && items.length ? items : [fallback];
	const renderedValues = values.map(value => textValue(value, fallback));
	const id = current.id;
	if (renderedValues.length === 1) {
		const paragraph = document.createElement("p");
		paragraph.id = id;
		paragraph.className = "govuk-body";
		paragraph.textContent = renderedValues[0];
		current.replaceWith(paragraph);
		return;
	}
	const list = document.createElement("ul");
	list.id = id;
	list.className = "govuk-list govuk-list--bullet";
	renderedValues.forEach(value => {
		const item = document.createElement("li");
		item.textContent = value;
		list.append(item);
	});
	current.replaceWith(list);
}

function renderSourcebookClauses(outcome = {}) {
	const current = $("#study-ethics-risk-sourcebook-clauses");
	if (!current) return;
	const clauses = Array.isArray(outcome.sourcebookClauses) ? outcome.sourcebookClauses : [];
	if (!clauses.length) {
		renderTextCollection("#study-ethics-risk-sourcebook-clauses", [], "No Sourcebook clauses mapped.");
		return;
	}
	const list = document.createElement("ul");
	list.id = current.id;
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
	current.replaceWith(list);
}

function formatRecordedState(outcome = {}) {
	if (!outcome.started || outcome.route === "incomplete-assessment") return "Not recorded yet.";
	if (!outcome.savedAt) return "Not recorded yet.";
	const date = new Date(outcome.savedAt);
	const formatted = Number.isNaN(date.getTime())
		? outcome.savedAt
		: new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(date);
	const actor = outcome.recordedBy ? ` by ${outcome.recordedBy}` : "";
	return `Recorded ${formatted}${actor}.`;
}

function renderOutcome(outcome = {}) {
	const title = $("#study-ethics-risk-outcome-title");
	const tag = $("#study-ethics-risk-outcome-tag");
	const summary = $("#study-ethics-risk-outcome-summary");
	const nextAction = $("#study-ethics-risk-next-action");
	const recordedState = $("#study-ethics-risk-recorded-state");
	const nextStepsWrap = $("#study-ethics-risk-next-steps-link-wrap");
	const nextStepsLink = $("#study-ethics-risk-next-steps-link");

	if (title) title.textContent = outcome.title || (outcome.started ? outcome.statusLabel : "Risk check not started");
	if (summary) summary.textContent = outcome.summary || "Complete the risk questions before recruitment, fieldwork or participant sessions begin.";
	if (nextAction) nextAction.textContent = outcome.nextAction || "Record the study risk outcome.";
	if (recordedState) recordedState.textContent = formatRecordedState(outcome);
	if (tag) {
		tag.textContent = outcome.statusLabel || "Action needed";
		tag.className = `govuk-tag ${tagClassForEthicsRisk(outcome.status)}`;
	}
	const hasEscalationRoute =
		outcome.started === true &&
		outcome.ready !== true &&
		!["incomplete-assessment", "not-assessed", "not-recorded"].includes(outcome.route);
	if (nextStepsWrap) nextStepsWrap.hidden = !hasEscalationRoute;
	if (nextStepsLink) {
		nextStepsLink.href = currentNextStepsHref;
		nextStepsLink.textContent =
			outcome.route === "ethics-board-submission-likely"
				? "Open ethics submission next steps"
				: outcome.route === "sensitive-research-controls"
					? "Open extra control next steps"
					: "Open ethics advice next steps";
	}
	renderTextCollection(
		"#study-ethics-risk-triggers",
		(outcome.triggers || []).map(trigger => `${trigger.family}: ${trigger.label}`),
		"No sensitive research triggers recorded."
	);
	renderTextCollection("#study-ethics-risk-controls", outcome.controls, "Record the study risk outcome.");
	renderSourcebookClauses(outcome);

	populateForm(outcome);
}

function hideError() {
	const summary = $("#ethics-risk-error");
	if (!summary) return;
	summary.hidden = true;
	summary.setAttribute("aria-hidden", "true");
}

function clearFieldErrors(form) {
	if (!form) return;
	form.querySelectorAll(".govuk-form-group--error").forEach(group => {
		group.classList.remove("govuk-form-group--error");
	});
	form.querySelectorAll(".study-ethics-risk-field-error").forEach(error => {
		error.remove();
	});
}

function fieldGroupForHref(href) {
	const target = href ? document.querySelector(href) : null;
	return target?.closest(".govuk-form-group") || null;
}

function showFieldErrors(groups = []) {
	groups.forEach(group => {
		const formGroup = fieldGroupForHref(group.href);
		const fieldset = formGroup?.querySelector(".govuk-fieldset");
		if (!formGroup || !fieldset) return;
		formGroup.classList.add("govuk-form-group--error");
		const error = document.createElement("p");
		error.className = "govuk-error-message study-ethics-risk-field-error";
		error.textContent = `Error: Answer ${group.label.toLowerCase()}`;
		fieldset.prepend(error);
	});
}

function showErrors(groups = []) {
	const summary = $("#ethics-risk-error");
	if (!summary) return;
	const list = summary.querySelector(".govuk-error-summary__list");
	if (list) {
		list.replaceChildren(
			...groups.map(group => {
				const item = document.createElement("li");
				const link = document.createElement("a");
				link.href = group.href || "#study-ethics-risk-form";
				link.textContent = `Answer ${group.label.toLowerCase()}`;
				item.append(link);
				return item;
			})
		);
	}
	summary.hidden = false;
	summary.removeAttribute("aria-hidden");
	summary.focus();
}

function bindContext(context) {
	const projectName = projectTitle(context.project);
	const title = studyTitle(context.study || {});
	currentStudyId = context.studyId;
	currentStudyHref = route("/pages/study/", { id: context.studyId, project: context.projectId });
	currentNextStepsHref = route("/pages/study/ethics-risk/next-steps/", {
		id: context.studyId,
		project: context.projectId
	});

	const projectBreadcrumb = $("#breadcrumb-project");
	if (projectBreadcrumb) {
		projectBreadcrumb.href = route("/pages/project-dashboard/", { id: context.projectId });
		projectBreadcrumb.textContent = projectName;
	}

	const studyBreadcrumb = $("#breadcrumb-study");
	if (studyBreadcrumb) {
		studyBreadcrumb.href = currentStudyHref;
		studyBreadcrumb.textContent = title;
	}

	const backToStudy = $("#back-to-study");
	if (backToStudy) backToStudy.href = currentStudyHref;
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
		currentStudyHref = currentStudyId ? route("/pages/study/", { id: currentStudyId }) : "/pages/study/";
		currentNextStepsHref = currentStudyId
			? route("/pages/study/ethics-risk/next-steps/", { id: currentStudyId })
			: "/pages/study/ethics-risk/next-steps/";
		const backToStudy = $("#back-to-study");
		if (backToStudy) backToStudy.href = currentStudyHref;
		return currentStudyId;
	}
}

function bindForm() {
	const form = $("#study-ethics-risk-form");
	const clear = $("#study-ethics-risk-clear");
	if (!form) return;

	form.addEventListener("change", event => {
		enforceExclusiveCheckbox(event.target);
		clearFieldErrors(form);
		hideError();
	});

	form.addEventListener("submit", async event => {
		event.preventDefault();
		hideError();
		clearFieldErrors(form);
		const answers = formAnswers(form);
		const missingGroups = requiredEthicsRiskGroups(answers).filter(group => !group.complete);
		if (missingGroups.length) {
			showFieldErrors(missingGroups);
			showErrors(missingGroups);
		}
		const outcome = await recordStudyEthicsRisk(currentStudyId, answers);
		renderOutcome(outcome);
	});

	if (clear) {
		clear.addEventListener("click", () => {
			hideError();
			clearFieldErrors(form);
			form.reset();
			renderOutcome(clearStudyEthicsRisk(currentStudyId));
		});
	}
}

async function init() {
	hideError();
	const studyId = await initContext();
	renderOutcome(await loadSeededStudyEthicsRisk(studyId));
	bindForm();
}

init();
