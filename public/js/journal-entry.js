const API_ORIGIN = resolveApiBase();
const PROJECT_CONTEXT_STORAGE_KEY = "researchops.journalEntry.projectContext";

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

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && text(value)) return text(value);
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

function firstProjectIdFromParams(params) {
	return text(
		params.get("project") ||
		params.get("project_id") ||
		params.get("project_local_id") ||
		params.get("project_airtable_id") ||
		params.get("id")
	);
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

function projectIdFromReferrer() {
	try {
		if (!document.referrer) return "";
		const referrer = new URL(document.referrer);
		if (!referrer.pathname.includes("/pages/projects/journals")) return "";
		return firstProjectIdFromParams(referrer.searchParams);
	} catch {
		return "";
	}
}

function storedProjectId() {
	try {
		return text(window.sessionStorage?.getItem(PROJECT_CONTEXT_STORAGE_KEY));
	} catch {
		return "";
	}
}

function rememberProjectId(projectId) {
	const id = text(projectId);
	if (!id) return;
	try {
		window.sessionStorage?.setItem(PROJECT_CONTEXT_STORAGE_KEY, id);
	} catch {}
}

function projectIdFromEntry(entry = {}) {
	return text(entry.project || entry.projectId || entry.localProjectId || entry.local_project_id || entry.project_id);
}

function resolveProjectId(entry = {}) {
	const projectId = text(projectIdFromRoute() || projectIdFromReferrer() || storedProjectId() || projectIdFromEntry(entry));
	rememberProjectId(projectId);
	return projectId;
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

function categoryLabel(value) {
	const raw = text(value).toLowerCase();
	if (raw === "perceptions") return "Perceptions";
	if (raw === "procedures") return "Procedures";
	if (raw === "decisions") return "Decisions";
	if (raw === "introspections") return "Introspections";
	return text(value) || "Journal entry";
}

function setHidden(element, hidden) {
	if (!element) return;
	if (hidden) {
		element.setAttribute("hidden", "hidden");
	} else {
		element.removeAttribute("hidden");
	}
}

function showError(message) {
	const summary = document.getElementById("journal-entry-error-summary");
	const item = summary?.querySelector(".govuk-error-summary__list li");
	if (item) item.textContent = message;
	setHidden(summary, false);
	setHidden(document.getElementById("journal-entry-loading"), true);
}

async function readJsonResponse(response) {
	const contentType = (response.headers.get("content-type") || "").toLowerCase();
	const body = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
	if (!response.ok || body?.ok === false) {
		throw new Error(body?.error || body?.detail || `Journal entry load failed (${response.status})`);
	}
	return body || {};
}

async function loadProject(projectId) {
	if (!projectId) return null;
	const response = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}?ts=${Date.now()}`), {
		cache: "no-store",
		credentials: "include"
	});
	return normaliseProject(await readJsonResponse(response));
}

async function hydrateProjectBreadcrumb(projectId, breadcrumbProject) {
	if (!projectId || !breadcrumbProject) return;
	try {
		const project = await loadProject(projectId);
		if (!project) return;
		const resolvedProjectId = project.id || project.localId || project.airtableId || projectId;
		breadcrumbProject.href = `/pages/project-dashboard/?id=${encodeURIComponent(resolvedProjectId)}`;
		if (project.name) breadcrumbProject.textContent = project.name;
	} catch (error) {
		console.warn("[journal-entry] Could not hydrate project breadcrumb", error);
	}
}

function setBackLinks(entry) {
	const projectId = resolveProjectId(entry);
	const href = projectId ? `/pages/projects/journals/?id=${encodeURIComponent(projectId)}` : "/pages/projects/journals/";
	const dashboardHref = projectId ? `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}` : "/pages/project-dashboard/";
	const editHref = text(entry.id) ? `/pages/journal/edit?id=${encodeURIComponent(entry.id)}` : href;

	const backLink = document.getElementById("back-to-journals");
	const returnLink = document.getElementById("journal-entry-return-link");
	const breadcrumbJournals = document.getElementById("breadcrumb-journals");
	const breadcrumbProject = document.getElementById("breadcrumb-project");
	const editLink = document.getElementById("journal-entry-edit-link");

	if (backLink) backLink.href = href;
	if (returnLink) returnLink.href = href;
	if (breadcrumbJournals) breadcrumbJournals.href = href;
	if (breadcrumbProject) {
		breadcrumbProject.href = dashboardHref;
		hydrateProjectBreadcrumb(projectId, breadcrumbProject);
	}
	if (editLink) editLink.href = editHref;
}

function renderEntry(entry) {
	window.__journalEntry = entry;
	const category = categoryLabel(entry.category);
	const created = when(entry.createdAt || entry.created_at);
	const content = text(entry.content || entry.body);
	const tags = Array.isArray(entry.tags) ? entry.tags.map(text).filter(Boolean) : text(entry.tags).split(",").map(text).filter(Boolean);

	const title = document.getElementById("journal-entry-title");
	const categoryElement = document.getElementById("journal-entry-category");
	const createdElement = document.getElementById("journal-entry-created");
	const contentElement = document.getElementById("journal-entry-content");
	const tagsElement = document.getElementById("journal-entry-tags");

	if (title) title.textContent = `${category} journal entry`;
	if (categoryElement) categoryElement.textContent = category;
	if (createdElement) {
		createdElement.textContent = created ? `Created ${created}` : "Created date not recorded";
		setHidden(createdElement, false);
	}
	if (contentElement) {
		contentElement.textContent = content || "This journal entry has no content.";
		setHidden(contentElement, false);
	}
	if (tagsElement && tags.length) {
		tagsElement.textContent = `Tags: ${tags.join(", ")}`;
		setHidden(tagsElement, false);
	}

	setBackLinks(entry);
	setHidden(document.getElementById("journal-entry-actions"), false);
	setHidden(document.getElementById("journal-entry-loading"), true);
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

async function deleteJournalEntry() {
	const entry = window.__journalEntry;
	const entryId = text(entry?.id);
	if (!entryId || !confirm("Delete this entry?")) return;

	try {
		await readJsonResponse(await fetch(apiUrl(`/api/journal-entries/${encodeURIComponent(entryId)}`), {
			method: "DELETE",
			credentials: "include"
		}));
		const project = text(entry?.localProjectId || entry?.local_project_id || entry?.project || entry?.projectId);
		queueJournalFeedback("Journal entry deleted.", { success: true, title: "Success" });
		window.location.href = project ? `/pages/projects/journals/?id=${encodeURIComponent(project)}` : "/pages/projects/journals/";
	} catch (error) {
		showError(error?.message || "Could not delete this journal entry.");
	}
}

async function loadJournalEntry() {
	const id = new URLSearchParams(window.location.search).get("id") || "";
	if (!id) {
		showError("Missing journal entry ID.");
		return;
	}

	resolveProjectId();

	try {
		const data = await readJsonResponse(await fetch(apiUrl(`/api/journal-entries/${encodeURIComponent(id)}?ts=${Date.now()}`), {
			cache: "no-store",
			credentials: "include"
		}));
		const entry = data.entry || data.record || data;
		if (!entry || !text(entry.id)) throw new Error("Journal entry was not found.");
		renderEntry(entry);
	} catch (error) {
		console.error("[journal-entry] Could not load journal entry", error);
		showError(error?.message || "Could not load this journal entry.");
	}
}

document.getElementById("journal-entry-delete-btn")?.addEventListener("click", deleteJournalEntry);
loadJournalEntry();
