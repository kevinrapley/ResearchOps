/**
 * @file /js/project-context.js
 * @summary Hydrates project route breadcrumbs, parent links and journal page feedback from the ?id= project context.
 */

const API_ORIGIN = resolveApiBase();
const FIELD_ERROR_IDS = ["code-name", "memo-content", "entry-category", "entry-content"];

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function projectApiUrl(path) {
	const value = String(path || "");
	return `${API_ORIGIN}${value.startsWith("/") ? value : "/" + value}`;
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
	}
	return "";
}

function projectPayloadFrom(data = {}) {
	return data?.project || data?.record || data;
}

function normaliseProject(project = {}) {
	const source = projectPayloadFrom(project);
	const publicId = firstPresent(source.id, source.airtableId, source.recordId, source.LocalId, source.localId);
	return {
		id: publicId,
		localId: firstPresent(source.localId, source.LocalId, publicId),
		airtableId: firstPresent(source.airtableId, source.recordId, publicId),
		name: firstPresent(source.name, source.Name, source.title, source.Title)
	};
}

async function readJsonResponse(response, label) {
	const data = await response.json().catch(() => null);
	if (!response.ok || data?.ok === false) {
		throw new Error(data?.error || data?.detail || `${label} load failed (${response.status})`);
	}
	return data;
}

async function loadProjectFromRecord(projectId) {
	const response = await fetch(projectApiUrl(`/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	return normaliseProject(await readJsonResponse(response, "Project"));
}

async function loadProjects() {
	const response = await fetch(projectApiUrl(`/api/projects?limit=200&ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	const data = await readJsonResponse(response, "Projects list");
	const list = Array.isArray(data) ? data : Array.isArray(data?.projects) ? data.projects : [];
	return list.map(normaliseProject);
}

function findProject(projects, projectId) {
	const requested = String(projectId || "").trim();
	return projects.find((project) => [project.id, project.localId, project.airtableId].includes(requested)) || null;
}

async function loadProject(projectId) {
	try {
		return await loadProjectFromRecord(projectId);
	} catch (recordError) {
		console.warn("[project-context] Project record load failed; falling back to project list", recordError);
		return findProject(await loadProjects(), projectId);
	}
}

function dashboardHref(projectId) {
	return `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}`;
}

function setProjectAnchor(anchor, project) {
	if (!anchor || !project) return;
	const projectId = project.id || project.localId || project.airtableId;

	anchor.textContent = project.name || "Project Dashboard";
	anchor.href = dashboardHref(projectId);
}

function findProjectBreadcrumb() {
	return (
		document.getElementById("breadcrumb-project") ||
		document.querySelector('.govuk-breadcrumbs__link[href="/pages/project-dashboard/"]') ||
		document.querySelector('.govuk-breadcrumbs__link[href^="/pages/project-dashboard/?id="]')
	);
}

function ensureProjectActionBar(anchor) {
	if (!anchor) return;

	anchor.classList.remove("govuk-back-link");
	anchor.classList.add("govuk-button", "govuk-button--secondary");

	if (anchor.parentElement?.classList.contains("actions-bar")) return;

	const actionsBar = document.createElement("div");
	actionsBar.className = "actions-bar";
	anchor.parentNode.insertBefore(actionsBar, anchor);
	actionsBar.appendChild(anchor);
}

function setProjectRouteFallback(projectId) {
	const href = dashboardHref(projectId);
	const breadcrumb = findProjectBreadcrumb();
	if (breadcrumb) breadcrumb.href = href;

	const legacyProjectLink = document.getElementById("project-link");
	if (legacyProjectLink) legacyProjectLink.href = href;

	const parentLink = document.getElementById("back-to-project");
	if (parentLink) parentLink.href = href;
}

function setProjectParentLink(anchor, project) {
	if (!anchor || !project) return;
	const projectId = project.id || project.localId || project.airtableId;

	anchor.textContent = "Back to Project";
	anchor.href = dashboardHref(projectId);
	ensureProjectActionBar(anchor);
}

function feedbackMessageFrom(flash) {
	return String(flash?.textContent || "").trim();
}

function errorClassForField(field) {
	if (field?.classList.contains("govuk-select")) return "govuk-select--error";
	if (field?.classList.contains("govuk-textarea")) return "govuk-textarea--error";
	return "govuk-input--error";
}

function fieldErrorId(fieldId) {
	return `${fieldId}-error`;
}

function fieldValue(fieldId) {
	return String(document.getElementById(fieldId)?.value || "").trim();
}

function clearFieldError(fieldId) {
	const field = document.getElementById(fieldId);
	const group = field?.closest(".govuk-form-group");
	const error = document.getElementById(fieldErrorId(fieldId));
	if (error) error.remove();
	if (group) group.classList.remove("govuk-form-group--error");
	if (field) {
		field.classList.remove("govuk-input--error", "govuk-select--error", "govuk-textarea--error");
		field.removeAttribute("aria-invalid");
		const describedBy = String(field.getAttribute("aria-describedby") || "")
			.split(/\s+/)
			.filter((id) => id && id !== fieldErrorId(fieldId))
			.join(" ");
		if (describedBy) field.setAttribute("aria-describedby", describedBy);
		else field.removeAttribute("aria-describedby");
	}
}

function clearValidationErrors() {
	for (const fieldId of FIELD_ERROR_IDS) clearFieldError(fieldId);
}

function setFieldError(fieldId, message) {
	const field = document.getElementById(fieldId);
	const group = field?.closest(".govuk-form-group");
	if (!field || !group) return;
	clearFieldError(fieldId);

	const error = document.createElement("p");
	error.className = "govuk-error-message";
	error.id = fieldErrorId(fieldId);
	const prefix = document.createElement("span");
	prefix.className = "govuk-visually-hidden";
	prefix.textContent = "Error:";
	error.append(prefix, document.createTextNode(` ${message}`));
	group.insertBefore(error, field);

	group.classList.add("govuk-form-group--error");
	field.classList.add(errorClassForField(field));
	field.setAttribute("aria-invalid", "true");
	const describedBy = new Set(String(field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
	describedBy.add(error.id);
	field.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
}

function validationErrorsFor(message) {
	if (message === "Code name is required.") return [{ text: message, href: "code-name" }];
	if (message === "Memo content is required.") return [{ text: message, href: "memo-content" }];
	if (message === "Category and content are required.") {
		const errors = [];
		if (!fieldValue("entry-category")) errors.push({ text: "Select a category.", href: "entry-category" });
		if (!fieldValue("entry-content")) errors.push({ text: "Enter journal entry content.", href: "entry-content" });
		return errors.length ? errors : [{ text: message, href: "entry-content" }];
	}
	return [];
}

function isErrorFlash(flash) {
	const text = feedbackMessageFrom(flash).toLowerCase();
	return (
		flash?.dataset?.type === "error" ||
		flash?.classList.contains("error") ||
		text.startsWith("could not") ||
		text.includes("failed") ||
		validationErrorsFor(feedbackMessageFrom(flash)).length > 0
	);
}

function setHidden(element, hidden) {
	if (!element) return;
	if (hidden) {
		element.setAttribute("hidden", "hidden");
	} else {
		element.removeAttribute("hidden");
	}
}

function showJournalErrors(errors) {
	const errorSummary = document.getElementById("journal-error-summary");
	const errorList = errorSummary?.querySelector(".govuk-error-summary__list");
	if (!errorSummary || !errorList || !errors.length) return false;

	errorList.textContent = "";
	for (const error of errors) {
		const item = document.createElement("li");
		if (error.href) {
			const link = document.createElement("a");
			link.href = `#${error.href}`;
			link.textContent = error.text;
			item.appendChild(link);
		} else {
			item.textContent = error.text;
		}
		errorList.appendChild(item);
	}
	setHidden(errorSummary, false);
	setHidden(document.getElementById("journal-notification-banner"), true);
	return true;
}

function showJournalError(message, targetId = "") {
	return showJournalErrors([{ text: message, href: targetId }]);
}

function showJournalNotification(message) {
	const notification = document.getElementById("journal-notification-banner");
	const notificationMessage = document.getElementById("journal-notification-message");
	if (!notification || !notificationMessage) return false;

	notificationMessage.textContent = message;
	setHidden(notification, false);
	setHidden(document.getElementById("journal-error-summary"), true);
	return true;
}

function showValidationErrors(errors) {
	clearValidationErrors();
	for (const error of errors) setFieldError(error.href, error.text);
	return showJournalErrors(errors);
}

function handleFlashElement(flash) {
	const message = feedbackMessageFrom(flash);
	if (!message) return;

	const validationErrors = validationErrorsFor(message);
	let displayed = false;
	if (validationErrors.length) displayed = showValidationErrors(validationErrors);
	else if (isErrorFlash(flash)) displayed = showJournalError(message, flash?.dataset?.target || "");
	else {
		clearValidationErrors();
		displayed = showJournalNotification(message);
	}
	if (displayed) flash.remove();
}

function observeJournalFeedbackPlacement() {
	handleFlashElement(document.getElementById("flash"));

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLElement && node.id === "flash") handleFlashElement(node);
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
}

async function hydrateProjectRouteContext() {
	const parentLink = document.getElementById("back-to-project");
	ensureProjectActionBar(parentLink);

	const params = new URLSearchParams(window.location.search);
	const projectId = params.get("id");
	if (!projectId) return;
	setProjectRouteFallback(projectId);

	const project = await loadProject(projectId);
	if (!project) return;

	setProjectAnchor(findProjectBreadcrumb(), project);
	setProjectAnchor(document.getElementById("project-link"), project);
	setProjectParentLink(parentLink, project);

	const main = document.querySelector("main");
	if (main) {
		main.dataset.projectId = project.id || projectId;
		main.dataset.projectName = project.name || "";
	}
}

document.addEventListener("DOMContentLoaded", observeJournalFeedbackPlacement);

hydrateProjectRouteContext().catch((error) => {
	console.warn("[project-context] Could not hydrate project route context", error);
});
