/**
 * @file /components/journal-tabs.js
 * @module JournalTabs
 * @summary Handles GOV.UK tabs, entry editing, excerpts, and filter chips.
 *
 * @description
 * Manages the tabbed interface for Journal Entries, Codes, Memos, and Analysis.
 * Implements inline editing for journal entries with validation and autosave.
 * Supports excerpt creation from selected text within entry content.
 * Provides category filtering distinct from tab navigation.
 *
 * @requires /css/journal.css
 * @requires /components/journal-excerpts.js
 */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const CONFIG = Object.freeze({
	API_BASE: window.location.origin,
	TIMEOUT_MS: 15000
});

const state = {
	projectId: null,
	entries: [],
	editingId: null,
	activeFilter: "all",
	excerpts: new Map() // entryId -> Array<Excerpt>
};

/* =========================
 * GOV.UK Tabs Initialization
 * ========================= */

/**
 * Initialize GOV.UK tabs component.
 * Works with existing markup structure.
 */
function initGovukTabs() {
	const tabs = $$(".govuk-tabs__tab");
	const panels = $$(".govuk-tabs__panel");

	tabs.forEach(tab => {
		tab.addEventListener("click", (e) => {
			e.preventDefault();

			// Remove selected state from all tabs
			$$(".govuk-tabs__list-item").forEach(item => {
				item.classList.remove("govuk-tabs__list-item--selected");
			});

			// Hide all panels
			panels.forEach(panel => {
				panel.classList.add("govuk-tabs__panel--hidden");
				panel.hidden = true;
			});

			// Activate clicked tab
			tab.closest(".govuk-tabs__list-item").classList.add("govuk-tabs__list-item--selected");

			// Show corresponding panel
			const targetId = tab.getAttribute("href").substring(1);
			const targetPanel = $(`#${targetId}-panel`) || $(`#${targetId}`);

			if (targetPanel) {
				targetPanel.classList.remove("govuk-tabs__panel--hidden");
				targetPanel.hidden = false;

				// Load data for the newly visible tab
				if (targetId === "journal-entries" || targetId === "journal") loadEntries();
				if (targetId === "codes") loadCodes();
				if (targetId === "memos") loadMemos();
				if (targetId === "analysis") loadAnalysis();
			}
		});
	});
}

/* =========================
 * Filter Chips (Category)
 * ========================= */

/**
 * Wire up filter chip buttons for journal entry categories.
 */
function initFilterChips() {
	$$(".filter-chip[data-filter]").forEach(btn => {
		btn.addEventListener("click", (e) => {
			const filter = e.currentTarget.dataset.filter;
			state.activeFilter = filter;

			// Update active state
			$$(".filter-chip[data-filter]").forEach(chip => {
				chip.classList.remove("filter-chip--active");
			});
			e.currentTarget.classList.add("filter-chip--active");

			// Re-render entries with filter
			renderEntries();
		});
	});
}

/* =========================
 * Journal Entries
 * ========================= */

/**
 * Load journal entries from API.
 * @returns {Promise<void>}
 */
async function loadEntries() {
	if (!state.projectId) {
		console.warn("[journal] No projectId set");
		return;
	}

	try {
		const url = `/api/journal-entries?project=${encodeURIComponent(state.projectId)}`;
		const res = await fetch(url, { cache: "no-store" });

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();
		state.entries = Array.isArray(data?.entries) ? data.entries : [];

		renderEntries();
	} catch (err) {
		console.error("[journal] Load failed:", err);
		flash("Could not load journal entries.");
	}
}

/**
 * Render journal entries with current filter applied.
 */
function renderEntries() {
	const container = $("#entries-container");
	if (!container) return;

	// Apply filter
	const filtered = state.entries.filter(e => {
		if (state.activeFilter === "all") return true;
		return e.category === state.activeFilter;
	});

	if (!filtered.length) {
		container.innerHTML = `
			<div class="govuk-inset-text">
				<p>No entries match the current filter.</p>
			</div>
		`;
		return;
	}

	container.innerHTML = filtered.map(entry => `
		<div class="entry-card" data-id="${entry.id}" data-category="${entry.category}">
			<div class="entry-header">
				<div class="entry-meta">
					<strong class="govuk-tag govuk-tag--${getCategoryColor(entry.category)}">
						${escapeHtml(capitalizeFirst(entry.category))}
					</strong>
					<time class="govuk-body-s govuk-!-margin-top-1">
						${formatDateTime(entry.createdAt)}
					</time>
				</div>
				<div class="entry-actions">
					<button type="button" class="govuk-button govuk-button--secondary govuk-button--small" 
							data-module="govuk-button" data-action="edit" data-id="${entry.id}">
						Edit
					</button>
					<button type="button" class="govuk-button govuk-button--warning govuk-button--small" 
							data-module="govuk-button" data-action="delete" data-id="${entry.id}">
						Delete
					</button>
				</div>
			</div>
			<div class="entry-content" data-entry-id="${entry.id}" data-selectable="true">
				<p class="govuk-body">${escapeHtml(entry.content)}</p>
			</div>
			${entry.tags?.length ? `
				<div class="entry-tags">
					${entry.tags.map(tag => `<span class="govuk-tag govuk-tag--grey">${escapeHtml(tag)}</span>`).join("")}
				</div>
			` : ""}
			${renderExcerpts(entry.id)}
			<div class="entry-edit-form" id="edit-form-${entry.id}"></div>
		</div>
	`).join("");

	// Attach handlers
	$$('[data-action="edit"]').forEach(btn => {
		btn.addEventListener("click", onEditEntry);
	});

	$$('[data-action="delete"]').forEach(btn => {
		btn.addEventListener("click", onDeleteEntry);
	});

	// Initialize excerpt selection for each entry
	$$('[data-selectable="true"]').forEach(contentDiv => {
		initExcerptSelection(contentDiv);
	});
}

/* =========================
 * Excerpts
 * ========================= */

/**
 * Render excerpts list for an entry.
 * @param {string} entryId
 * @returns {string}
 */
function renderExcerpts(entryId) {
	const excerpts = state.excerpts.get(entryId) || [];

	if (!excerpts.length) return "";

	return `
		<details class="govuk-details govuk-!-margin-top-2" data-module="govuk-details">
			<summary class="govuk-details__summary">
				<span class="govuk-details__summary-text">
					View excerpts (${excerpts.length})
				</span>
			</summary>
			<div class="govuk-details__text">
				<ul class="excerpts-list">
					${excerpts.map(ex => `
						<li class="excerpt-item">
							<span class="excerpt-item__meta">${ex.start}–${ex.end}</span>
							<span class="excerpt-item__text">${escapeHtml(ex.text.substring(0, 60))}${ex.text.length > 60 ? "…" : ""}</span>
							<button type="button" class="govuk-button govuk-button--secondary govuk-button--small" 
									data-action="delete-excerpt" data-excerpt-id="${ex.id}">
								Remove
							</button>
						</li>
					`).join("")}
				</ul>
			</div>
		</details>
	`;
}

/**
 * Initialize excerpt selection for entry content.
 * @param {HTMLElement} contentDiv
 */
function initExcerptSelection(contentDiv) {
	const entryId = contentDiv.dataset.entryId;
	if (!entryId) return;

	contentDiv.addEventListener("mouseup", () => {
		const selection = window.getSelection();
		const selectedText = selection.toString().trim();

		if (!selectedText || selectedText.length < 10) return;

		// Check if selection is within this content div
		const range = selection.getRangeAt(0);
		if (!contentDiv.contains(range.commonAncestorContainer)) return;

		// Calculate character offsets
		const fullText = contentDiv.textContent;
		const start = fullText.indexOf(selectedText);
		const end = start + selectedText.length;

		if (start === -1) return;

		// Show excerpt creation prompt
		showExcerptPrompt(entryId, selectedText, start, end, selection);
	});
}

/**
 * Show excerpt creation prompt.
 * @param {string} entryId
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {Selection} selection
 */
function showExcerptPrompt(entryId, text, start, end, selection) {
	// Remove any existing prompt
	const existing = $(".excerpt-prompt");
	if (existing) existing.remove();

	// Create prompt element
	const prompt = document.createElement("div");
	prompt.className = "excerpt-prompt";
	prompt.innerHTML = `
		<p class="govuk-body-s">
			<strong>Create excerpt?</strong><br>
			"${escapeHtml(text.substring(0, 50))}${text.length > 50 ? "…" : ""}"
		</p>
		<div class="govuk-button-group">
			<button type="button" class="govuk-button govuk-button--small" data-action="save-excerpt">
				Save excerpt
			</button>
			<button type="button" class="govuk-button govuk-button--secondary govuk-button--small" data-action="cancel-excerpt">
				Cancel
			</button>
		</div>
	`;

	// Position near selection
	const range = selection.getRangeAt(0);
	const rect = range.getBoundingClientRect();
	prompt.style.position = "fixed";
	prompt.style.left = `${rect.left}px`;
	prompt.style.top = `${rect.bottom + 8}px`;
	prompt.style.zIndex = "1000";

	document.body.appendChild(prompt);

	// Wire buttons
	const saveBtn = prompt.querySelector('[data-action="save-excerpt"]');
	const cancelBtn = prompt.querySelector('[data-action="cancel-excerpt"]');

	saveBtn?.addEventListener("click", async () => {
		await createExcerpt(entryId, text, start, end);
		prompt.remove();
		selection.removeAllRanges();
	});

	cancelBtn?.addEventListener("click", () => {
		prompt.remove();
		selection.removeAllRanges();
	});

	// Auto-close after 10 seconds
	setTimeout(() => {
		if (document.body.contains(prompt)) {
			prompt.remove();
		}
	}, 10000);
}

/**
 * Create an excerpt via API.
 * @param {string} entryId
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {Promise<void>}
 */
async function createExcerpt(entryId, text, start, end) {
	try {
		const payload = {
			entryId,
			start,
			end,
			text,
			createdAt: new Date().toISOString(),
			author: "" // Can be populated from user context
		};

		const res = await fetch("/api/excerpts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();

		// Update state
		const excerpts = state.excerpts.get(entryId) || [];
		excerpts.push({
			id: data.record?.id || crypto.randomUUID(),
			text,
			start,
			end,
			createdAt: payload.createdAt
		});
		state.excerpts.set(entryId, excerpts);

		flash("Excerpt saved.");
		renderEntries();
	} catch (err) {
		console.error("[excerpts] Create failed:", err);
		flash("Could not save excerpt.");
	}
}

/**
 * Load excerpts for an entry.
 * @param {string} entryId
 * @returns {Promise<void>}
 */
async function loadExcerpts(entryId) {
	try {
		const url = `/api/excerpts?entry=${encodeURIComponent(entryId)}`;
		const res = await fetch(url, { cache: "no-store" });

		if (!res.ok) return;

		const data = await res.json();
		const excerpts = (data.records || []).map(r => ({
			id: r.id,
			text: r.fields?.Text || "",
			start: r.fields?.Start || 0,
			end: r.fields?.End || 0,
			createdAt: r.fields?.["Created At"] || ""
		}));

		state.excerpts.set(entryId, excerpts);
	} catch (err) {
		console.error("[excerpts] Load failed:", err);
	}
}

/* =========================
 * Entry Editing
 * ========================= */

/**
 * Handle edit button click: show inline editing form.
 * @param {Event} e
 */
function onEditEntry(e) {
	const entryId = e.currentTarget.dataset.id;
	const card = $(`.entry-card[data-id="${entryId}"]`);
	if (!card) return;

	const entry = state.entries.find(e => e.id === entryId);
	if (!entry) return;

	// Mark as editing
	state.editingId = entryId;
	card.classList.add("entry-card--editing");

	// Build inline edit form
	const editContainer = $(`#edit-form-${entryId}`);
	if (!editContainer) return;

	editContainer.innerHTML = `
		<form class="entry-inline-edit" data-entry-id="${entryId}" novalidate>
			<div class="govuk-form-group">
				<label class="govuk-label govuk-label--s" for="edit-category-${entryId}">
					Category
				</label>
				<select class="govuk-select" id="edit-category-${entryId}" name="category">
					<option value="perceptions" ${entry.category === "perceptions" ? "selected" : ""}>Evolving perceptions</option>
					<option value="procedures" ${entry.category === "procedures" ? "selected" : ""}>Day-to-day procedures</option>
					<option value="decisions" ${entry.category === "decisions" ? "selected" : ""}>Methodological decision points</option>
					<option value="introspections" ${entry.category === "introspections" ? "selected" : ""}>Personal introspections</option>
				</select>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label govuk-label--s" for="edit-content-${entryId}">
					Entry
				</label>
				<textarea class="govuk-textarea" id="edit-content-${entryId}" name="content" rows="6">${escapeHtml(entry.content)}</textarea>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label govuk-label--s" for="edit-tags-${entryId}">
					Tags
				</label>
				<input class="govuk-input" type="text" id="edit-tags-${entryId}" name="tags" value="${escapeHtml((entry.tags || []).join(", "))}" />
			</div>
			<div class="govuk-button-group">
				<button type="submit" class="govuk-button" data-module="govuk-button">
					Save changes
				</button>
				<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-action="cancel-edit">
					Cancel
				</button>
			</div>
		</form>
	`;

	// Wire form handlers
	const form = editContainer.querySelector("form");
	form?.addEventListener("submit", onSaveEdit);

	const cancelBtn = editContainer.querySelector('[data-action="cancel-edit"]');
	cancelBtn?.addEventListener("click", () => cancelEdit(entryId));
}

/**
 * Handle save edit form submission.
 * @param {Event} e
 */
async function onSaveEdit(e) {
	e.preventDefault();
	const form = /** @type {HTMLFormElement} */ (e.currentTarget);
	const entryId = form.dataset.entryId;

	const payload = {
		category: form.category.value,
		content: form.content.value.trim(),
		tags: form.tags.value.split(",").map(s => s.trim()).filter(Boolean)
	};

	if (!payload.content) {
		flash("Content cannot be empty.");
		return;
	}

	try {
		const url = `/api/journal-entries/${encodeURIComponent(entryId)}`;
		const res = await fetch(url, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		flash("Entry updated.");
		cancelEdit(entryId);
		await loadEntries();
	} catch (err) {
		console.error("[journal] Save failed:", err);
		flash("Could not save changes.");
	}
}

/**
 * Cancel editing and restore view mode.
 * @param {string} entryId
 */
function cancelEdit(entryId) {
	const card = $(`.entry-card[data-id="${entryId}"]`);
	if (!card) return;

	card.classList.remove("entry-card--editing");
	state.editingId = null;
}

/**
 * Handle delete button click.
 * @param {Event} e
 */
async function onDeleteEntry(e) {
	const entryId = e.currentTarget.dataset.id;
	if (!confirm("Delete this entry?")) return;

	try {
		const url = `/api/journal-entries/${encodeURIComponent(entryId)}`;
		const res = await fetch(url, { method: "DELETE" });

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		flash("Entry deleted.");
		await loadEntries();
	} catch (err) {
		console.error("[journal] Delete failed:", err);
		flash("Could not delete entry.");
	}
}

/* =========================
 * New Entry Form
 * ========================= */

/**
 * Wire the new entry form toggle and submit.
 */
function initNewEntryForm() {
	const btn = $("#new-entry-btn");
	const form = $("#entry-form");
	const cancelBtn = $("#cancel-form-btn");

	if (!btn || !form) return;

	btn.addEventListener("click", () => {
		form.hidden = !form.hidden;
		if (!form.hidden) {
			$("#entry-content")?.focus();
		}
	});

	cancelBtn?.addEventListener("click", () => {
		form.hidden = true;
		$("#add-entry-form")?.reset();
	});

	const entryForm = $("#add-entry-form");
	entryForm?.addEventListener("submit", async (e) => {
		e.preventDefault();

		const payload = {
			project: state.projectId,
			project_airtable_id: state.projectId,
			category: entryForm.category.value,
			content: entryForm.content.value.trim(),
			tags: entryForm.tags.value.split(",").map(s => s.trim()).filter(Boolean)
		};

		if (!payload.content) {
			flash("Content is required.");
			return;
		}

		try {
			const res = await fetch("/api/journal-entries", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			entryForm.reset();
			form.hidden = true;
			flash("Entry saved.");
			await loadEntries();
		} catch (err) {
			console.error("[journal] Create failed:", err);
			flash("Could not save entry.");
		}
	});
}

/* =========================
 * Codes & Memos (stubs)
 * ========================= */

async function loadCodes() {
	console.debug("[codes] Load triggered");
	// Implementation from existing caqdas-interface.js
}

async function loadMemos() {
	console.debug("[memos] Load triggered");
	// Implementation from existing caqdas-interface.js
}

async function loadAnalysis() {
	console.debug("[analysis] Load triggered");
	// Implementation from existing caqdas-interface.js
}

/* =========================
 * Utilities
 * ========================= */

/**
 * Map category to GOV.UK tag colour.
 * @param {string} category
 * @returns {string}
 */
function getCategoryColor(category) {
	const map = {
		perceptions: "blue",
		procedures: "green",
		decisions: "orange",
		introspections: "purple"
	};
	return map[category] || "grey";
}

/**
 * Capitalize first letter.
 * @param {string} str
 * @returns {string}
 */
function capitalizeFirst(str) {
	if (!str) return "";
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format ISO datetime for display.
 * @param {string} iso
 * @returns {string}
 */
function formatDateTime(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	});
}

/**
 * HTML escape.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
	if (!str) return "";
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

/**
 * Flash message banner.
 * @param {string} msg
 */
function flash(msg) {
	let banner = $("#flash-banner");
	if (!banner) {
		banner = document.createElement("div");
		banner.id = "flash-banner";
		banner.className = "govuk-notification-banner";
		banner.setAttribute("role", "region");
		banner.setAttribute("aria-labelledby", "flash-title");
		banner.innerHTML = `
			<div class="govuk-notification-banner__header">
				<h2 class="govuk-notification-banner__title" id="flash-title">
					Important
				</h2>
			</div>
			<div class="govuk-notification-banner__content">
				<p class="govuk-notification-banner__heading" id="flash-message"></p>
			</div>
		`;
		$("main")?.prepend(banner);
	}

	const msgEl = $("#flash-message");
	if (msgEl) msgEl.textContent = msg;

	banner.hidden = false;
	setTimeout(() => { banner.hidden = true; }, 5000);
}

/* =========================
 * Bootstrap
 * ========================= */

/**
 * Initialize the application.
 */
async function init() {
	const url = new URL(location.href);
	state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	if (!state.projectId) {
		flash("No project ID in URL. Some features disabled.");
		return;
	}

	// Initialize GOV.UK tabs
	initGovukTabs();

	// Initialize filter chips
	initFilterChips();

	// Initialize new entry form
	initNewEntryForm();

	// Load initial data for the default tab (Journal Entries)
	await loadEntries();

	// Load excerpts for all entries
	for (const entry of state.entries) {
		await loadExcerpts(entry.id);
	}

	// Update project link in breadcrumbs
	const projectLink = $("#project-link");
	if (projectLink) {
		projectLink.href = `/pages/projects/?id=${encodeURIComponent(state.projectId)}`;
	}
}

document.addEventListener("DOMContentLoaded", init);
