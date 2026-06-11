const API_ORIGIN = resolveApiBase();

let entryId = "";
let projectId = "";

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || "";
	return String(explicit || "").trim().replace(/\/+$/, "");
}

function apiUrl(path) {
	const value = String(path || "");
	return `${API_ORIGIN}${value.startsWith("/") ? value : "/" + value}`;
}

function text(value) {
	return String(value || "").trim();
}

function when(iso) {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return text(iso);
	return date.toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}

function setHidden(element, hidden) {
	if (!element) return;
	if (hidden) {
		element.setAttribute("hidden", "hidden");
	} else {
		element.removeAttribute("hidden");
	}
}

function projectIdFromRoute() {
	const params = new URLSearchParams(window.location.search);
	return text(
		params.get("project") ||
		params.get("project_id") ||
		params.get("project_local_id") ||
		params.get("project_airtable_id")
	);
}

function projectContextParam() {
	return projectId ? `&project=${encodeURIComponent(projectId)}` : "";
}

function queueJournalFeedback(message, options = {}) {
	try {
		sessionStorage.setItem("journal-feedback", JSON.stringify({
			message,
			success: !!options.success,
			title: options.title || "Information",
			type: options.type || "status"
		}));
	} catch {
		// Ignore storage failures.
	}
}

function showError(message) {
	const summary = document.getElementById("journal-entry-error-summary");
	const item = summary?.querySelector(".govuk-error-summary__list li");
	if (item) item.textContent = message;
	setHidden(summary, false);
	setHidden(document.getElementById("journal-entry-loading"), true);
}

function showStatus(message) {
	const banner = document.getElementById("journal-entry-notification");
	const body = document.getElementById("journal-entry-notification-message");
	if (body) body.textContent = message;
	setHidden(banner, false);
}

async function readJsonResponse(response) {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	const body = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
	if (!response.ok || body?.ok === false) {
		throw new Error(body?.error || body?.detail || `Journal entry request failed (${response.status})`);
	}
	return body || {};
}

function setBackLinks(currentProjectId, currentEntryId) {
	const journalsHref = currentProjectId ? `/pages/projects/journals/?id=${encodeURIComponent(currentProjectId)}` : "/pages/projects/journals/";
	const dashboardHref = currentProjectId ? `/pages/project-dashboard/?id=${encodeURIComponent(currentProjectId)}` : "/pages/project-dashboard/";
	const viewHref = currentEntryId ? `/pages/journal/entry?id=${encodeURIComponent(currentEntryId)}` : journalsHref;

	const backLink = document.getElementById("back-to-journals");
	const breadcrumbJournals = document.getElementById("breadcrumb-journals");
	const breadcrumbProject = document.getElementById("breadcrumb-project");
	const cancelLink = document.getElementById("journal-entry-cancel-link");

	if (backLink) backLink.href = journalsHref;
	if (breadcrumbJournals) breadcrumbJournals.href = journalsHref;
	if (breadcrumbProject) breadcrumbProject.href = dashboardHref;
	if (cancelLink) cancelLink.href = viewHref;
}

function ensureDeleteConfirmation() {
	let panel = document.getElementById("journal-entry-delete-confirmation");
	if (panel) return panel;

	const actions = document.querySelector("#journal-entry-edit-form .govuk-button-group");
	panel = document.createElement("div");
	panel.id = "journal-entry-delete-confirmation";
	panel.className = "govuk-inset-text govuk-!-margin-top-3";
	panel.hidden = true;
	panel.innerHTML = `
		<p class="govuk-body">Are you sure you want to delete this journal entry?</p>
		<div class="govuk-button-group">
			<button type="button" class="govuk-button govuk-button--warning" id="journal-entry-confirm-delete-btn">Yes, delete entry</button>
			<button type="button" class="govuk-button govuk-button--secondary" id="journal-entry-cancel-delete-btn">Cancel</button>
		</div>`;
	actions?.after(panel);
	document.getElementById("journal-entry-confirm-delete-btn")?.addEventListener("click", confirmDeleteEntry);
	document.getElementById("journal-entry-cancel-delete-btn")?.addEventListener("click", () => {
		panel.hidden = true;
		document.getElementById("journal-entry-delete-btn")?.focus();
	});
	return panel;
}

function renderEntry(entry) {
	entryId = text(entry.id);
	projectId = text(projectIdFromRoute() || entry.localProjectId || entry.local_project_id || entry.project || entry.projectId);
	setBackLinks(projectId, entryId);

	const createdElement = document.getElementById("journal-entry-created");
	if (createdElement) {
		const created = when(entry.createdAt || entry.created_at);
		createdElement.textContent = created ? `Created ${created}` : "Created date not recorded";
		setHidden(createdElement, false);
	}

	const categoryInput = document.getElementById("entry-category");
	const contentInput = document.getElementById("entry-content");
	const tagsInput = document.getElementById("entry-tags");

	if (categoryInput) categoryInput.value = text(entry.category || "perceptions");
	if (contentInput) contentInput.value = text(entry.content || entry.body);
	if (tagsInput) {
		const tags = Array.isArray(entry.tags) ? entry.tags : text(entry.tags).split(",").map(text).filter(Boolean);
		tagsInput.value = tags.join(", ");
	}

	setHidden(document.getElementById("journal-entry-loading"), true);
	setHidden(document.getElementById("journal-entry-edit-form"), false);
}

async function deleteEntry() {
	const panel = ensureDeleteConfirmation();
	panel.hidden = false;
	document.getElementById("journal-entry-confirm-delete-btn")?.focus();
}

async function confirmDeleteEntry() {
	if (!entryId) return;
	try {
		await readJsonResponse(await fetch(apiUrl(`/api/journal-entries/${encodeURIComponent(entryId)}`), {
			method: "DELETE",
			credentials: "include"
		}));
		queueJournalFeedback("Journal entry deleted.", { success: true, title: "Success" });
		window.location.href = projectId ? `/pages/projects/journals/?id=${encodeURIComponent(projectId)}` : "/pages/projects/journals/";
	} catch (error) {
		showError(error?.message || "Could not delete this journal entry.");
	}
}

async function submitForm(event) {
	event.preventDefault();
	if (!entryId) {
		showError("Missing journal entry ID.");
		return;
	}

	const form = event.currentTarget;
	const fd = new FormData(form);
	const category = text(fd.get("category"));
	const content = text(fd.get("content"));
	const tags = text(fd.get("tags"))
		.split(",")
		.map(text)
		.filter(Boolean);

	if (!category || !content) {
		showError("Category and content are required.");
		return;
	}

	try {
		await readJsonResponse(await fetch(apiUrl(`/api/journal-entries/${encodeURIComponent(entryId)}`), {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ category, content, tags })
		}));
		showStatus("Journal entry updated.");
		queueJournalFeedback("Journal entry updated.", { success: true, title: "Success" });
		window.location.href = `/pages/journal/entry?id=${encodeURIComponent(entryId)}${projectContextParam()}`;
	} catch (error) {
		showError(error?.message || "Could not update this journal entry.");
	}
}

async function loadJournalEntry() {
	entryId = new URLSearchParams(window.location.search).get("id") || "";
	if (!entryId) {
		showError("Missing journal entry ID.");
		return;
	}

	try {
		const data = await readJsonResponse(await fetch(apiUrl(`/api/journal-entries/${encodeURIComponent(entryId)}?ts=${Date.now()}`), {
			cache: "no-store",
			credentials: "include"
		}));
		const entry = data.entry || data.record || data;
		if (!entry || !text(entry.id)) throw new Error("Journal entry was not found.");
		renderEntry(entry);
	} catch (error) {
		console.error("[journal-entry-edit] Could not load journal entry", error);
		showError(error?.message || "Could not load this journal entry.");
	}
}

document.getElementById("journal-entry-edit-form")?.addEventListener("submit", submitForm);
document.getElementById("journal-entry-delete-btn")?.addEventListener("click", deleteEntry);
loadJournalEntry();
