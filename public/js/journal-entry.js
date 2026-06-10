const API_ORIGIN = resolveApiBase();

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

function setBackLinks(entry) {
	const projectId = text(entry.localProjectId || entry.local_project_id || entry.project || entry.projectId);
	const href = projectId ? `/pages/projects/journals/?id=${encodeURIComponent(projectId)}` : "/pages/projects/journals/";
	const dashboardHref = projectId ? `/pages/project-dashboard/?id=${encodeURIComponent(projectId)}` : "/pages/project-dashboard/";

	const backLink = document.getElementById("back-to-journals");
	const returnLink = document.getElementById("journal-entry-return-link");
	const breadcrumbJournals = document.getElementById("breadcrumb-journals");
	const breadcrumbProject = document.getElementById("breadcrumb-project");

	if (backLink) backLink.href = href;
	if (returnLink) returnLink.href = href;
	if (breadcrumbJournals) breadcrumbJournals.href = href;
	if (breadcrumbProject) breadcrumbProject.href = dashboardHref;
}

function renderEntry(entry) {
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
	setHidden(document.getElementById("journal-entry-loading"), true);
}

async function loadJournalEntry() {
	const id = new URLSearchParams(window.location.search).get("id") || "";
	if (!id) {
		showError("Missing journal entry ID.");
		return;
	}

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

loadJournalEntry();
