/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: tabs, entries, codes, memos, analysis.
 */

let excerptManagerInstance;

/* =========================
 * Config + tiny helpers
 * ========================= */

/**
 * Global configuration for the CAQDAS interface.
 * @readonly
 * @type {{API_BASE: string, TIMEOUT_MS: number}}
 */
const CONFIG = Object.freeze({
	API_BASE: window.location.origin,
	TIMEOUT_MS: 15000
});

/**
 * Shorthand for querySelector.
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {HTMLElement|null}
 */
const $ = (selector, root = document) => root.querySelector(selector);

/**
 * Shorthand for querySelectorAll (arrayified).
 * @param {string} selector
 * @param {ParentNode} [root=document]
 * @returns {HTMLElement[]}
 */
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * fetch() with AbortController timeout.
 * @param {RequestInfo|URL} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, init = {}, timeoutMs = CONFIG.TIMEOUT_MS) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { cache: "no-store", signal: ctrl.signal, ...init });
	} finally {
		clearTimeout(t);
	}
}

/**
 * JSON fetch with error text details and content-type guard.
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
async function httpJSON(url, init = {}, timeoutMs = CONFIG.TIMEOUT_MS) {
	const res = await fetchWithTimeout(url, init, timeoutMs);
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
	}
	const ct = (res.headers.get("content-type") || "").toLowerCase();
	return ct.includes("application/json") ? res.json() : {};
}

/**
 * HTML-escape text for safe insertion.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
	if (!s) return "";
	const d = document.createElement("div");
	d.textContent = s;
	return d.innerHTML;
}

/**
 * Formats an ISO datetime string for display.
 * @param {string} iso
 * @returns {string}
 */
function formatWhen(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleString();
}

/**
 * Lightweight flash/status banner.
 * @param {string} msg
 */
function flash(msg) {
	let el = $("#flash");
	if (!el) {
		el = document.createElement("div");
		el.id = "flash";
		el.setAttribute("role", "status");
		el.setAttribute("aria-live", "polite");
		el.style.margin = "12px 0";
		el.style.padding = "12px";
		el.style.border = "1px solid #d0d7de";
		el.style.background = "#fff";
		el.style.borderRadius = "4px";
		$("main")?.prepend(el);
	}
	el.textContent = msg;
	// Auto-hide after 5 seconds
	setTimeout(() => {
		if (el.textContent === msg) el.textContent = "";
	}, 5000);
}

/* =========================
 * State
 * ========================= */

/**
 * Application state (in-memory).
 * @type {{
 *  projectId: string|null,
 *  currentTab: 'journal'|'codes'|'memos'|'analysis',
 *  entries: Array<any>,
 *  codes: Array<any>,
 *  memos: Array<any>,
 *  analysis: { timeline: Array<any>, graph: { nodes: Array<any>, links: Array<any> }, results: Array<any> }
 * }}
 */
const state = {
	projectId: null,
	currentTab: "journal",
	entries: [],
	codes: [],
	memos: [],
	analysis: { timeline: [], graph: { nodes: [], links: [] }, results: [] }
};

/* =========================
 * Tabs
 * ========================= */

/**
 * Attach click handlers to ARIA tabs using currentTarget for reliability.
 */
function setupTabs() {
	$$('[role="tab"]').forEach(tab => {
		tab.addEventListener("click", (e) => {
			const id = /** @type {HTMLElement} */ (e.currentTarget).id || "";
			const tabName = id.replace("-tab", "");
			switchTab(tabName);
		});
	});
}

/**
 * Switches the visible tab and triggers data loads for the selected panel.
 * @param {'journal'|'codes'|'memos'|'analysis'} name
 */
function switchTab(name) {
	state.currentTab = name;

	$$('[role="tab"]').forEach(tab => {
		tab.setAttribute("aria-selected", (tab.id === `${name}-tab`).toString());
	});
	$$('[role="tabpanel"]').forEach(panel => {
		panel.hidden = panel.id !== `${name}-panel`;
	});

	if (name === "journal") loadEntries();
	if (name === "codes") loadCodes();
	if (name === "memos") loadMemos();
	if (name === "analysis") loadAnalysis();
}

/* =========================
 * Journal
 * ========================= */

/**
 * Loads journal entries for the current project and renders them.
 * @returns {Promise<void>}
 */
async function loadEntries() {
	if (!state.projectId) {
		console.debug("[journals] skip load: no projectId");
		renderEntries(); // Still render empty state
		return;
	}

	try {
		const url = `/api/journal-entries?project=${encodeURIComponent(state.projectId)}`;
		const data = await httpJSON(url);

		// Accept either {entries:[...]} or a raw array (belt & braces)
		const entries = Array.isArray(data?.entries) ? data.entries :
			Array.isArray(data) ? data : [];

		// Normalize minimal shape for render
		state.entries = entries.map(e => ({
			id: e.id,
			category: e.category || "—",
			content: e.content ?? e.body ?? "",
			tags: Array.isArray(e.tags) ? e.tags : String(e.tags || "")
				.split(",").map(s => s.trim()).filter(Boolean),
			createdAt: e.createdAt || e.created_at || ""
		}));

		console.debug("[journals] loaded", { count: state.entries.length });
		renderEntries();
	} catch (err) {
		console.error("loadEntries error:", err);
		flash(`Could not load journal entries. ${err && err.message ? err.message : ""}`);
		state.entries = [];
		renderEntries();
	}
}

/**
 * Renders the journal entries list.
 */
function renderEntries() {
	const wrap = $("#entries-container");
	if (!wrap) {
		console.warn("[journals] container #entries-container not found");
		return;
	}

	if (!state.entries.length) {
		// Keep the empty state that's already in HTML
		return;
	}

	wrap.innerHTML = state.entries.map(en => `
		<article class="journal-card" data-id="${en.id}">
			<header class="journal-header">
				<strong>${escapeHtml(en.category)}</strong>
				<time>${formatWhen(en.createdAt)}</time>
			</header>
			<p>${escapeHtml(en.content)}</p>
			${en.tags?.length ? `<div class="tags">${en.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>` : ''}
			<footer class="journal-footer">
				<button class="btn btn--secondary btn-small" data-act="delete" data-id="${en.id}">Delete</button>
			</footer>
		</article>
	`).join("");

	// Hook delete handlers
	wrap.querySelectorAll('[data-act="delete"]').forEach(btn => {
		btn.addEventListener("click", onDeleteEntry);
	});
}

/**
 * Deletes a journal entry and refreshes the list.
 * @param {MouseEvent} e
 * @returns {Promise<void>}
 */
async function onDeleteEntry(e) {
	const id = /** @type {HTMLElement} */ (e.currentTarget).dataset.id;
	if (!id) return;
	if (!confirm("Delete this entry?")) return;

	try {
		await httpJSON(`/api/journal-entries/${encodeURIComponent(id)}`, { method: "DELETE" });
		flash("Entry deleted.");
		await loadEntries();
	} catch (err) {
		console.error(err);
		flash("Could not delete entry.");
	}
}

/**
 * Wires the "+ New entry" toggle and submit handlers.
 * Fixed to use the correct button ID from HTML
 */
function setupNewEntryWiring() {
	const section = $("#entry-form");
	const form = $("#add-entry-form");
	const newBtn = $("#new-entry-btn"); // This is the actual button in HTML
	const cancelBtn = $("#cancel-form-btn");

	/**
	 * Shows/hides the new-entry section.
	 * @param {boolean} [force]
	 */
	function toggleForm(force) {
		if (!section) return;
		const show = typeof force === "boolean" ? force : section.hidden;
		section.hidden = !show;
		if (show) {
			const textarea = $("#entry-content");
			if (textarea) textarea.focus();
		}
	}

	// Wire the new entry button
	if (newBtn && section) {
		newBtn.addEventListener("click", () => {
			console.debug("New entry button clicked");
			toggleForm(true);
		});
	}

	// Wire the cancel button
	if (cancelBtn && section) {
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			toggleForm(false);
		});
	}

	// Wire the form submission
	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fd = new FormData(form);
			const payload = {
				project: state.projectId,
				project_airtable_id: state.projectId,
				category: (fd.get("category") || "").toString(),
				content: (fd.get("content") || "").toString(),
				tags: (fd.get("tags") || "").toString().split(",").map(s => s.trim()).filter(Boolean)
			};

			if (!payload.category || !payload.content) {
				flash("Category and content are required.");
				return;
			}

			try {
				const result = await httpJSON("/api/journal-entries", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});

				form.reset();
				toggleForm(false);
				flash("Entry saved.");

				// Initialize excerpts if we got an ID back
				if (result.id && typeof window.initJournalExcerpts === 'function') {
					await bootExcerpts(result.id);
				}

				await loadEntries();
			} catch (err) {
				console.error("add-entry submit error:", err);
				flash(`Could not save entry. ${err?.message || ""}`.trim());
			}
		});
	}
}

/* =========================
 * Codes
 * ========================= */

/**
 * Loads codes for the current project and renders them.
 * @returns {Promise<void>}
 */
async function loadCodes() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/codes?project=${encodeURIComponent(state.projectId)}`);
		state.codes = Array.isArray(data?.codes) ? data.codes : [];
		renderCodes();
	} catch (e) {
		console.error(e);
		flash(`Could not load codes. ${e?.message || ""}`.trim());
		state.codes = [];
		renderCodes();
	}
}

/**
 * Renders the code cards list.
 */
function renderCodes() {
	const wrap = $("#codebook-display");
	if (!wrap) return;

	if (!state.codes.length) {
		wrap.innerHTML = "<p>No codes yet. Click '+ Add Code' to create your first code.</p>";
		return;
	}

	wrap.innerHTML = state.codes.map(c => `
		<article class="code-card" data-id="${c.id}">
			<header>
				<span class="code-swatch" style="background-color:${c.color || c.colour || "#505a5f"};"></span>
				<strong>${escapeHtml(c.name || "—")}</strong>
			</header>
			${c.description || c.definition ? `<p>${escapeHtml(c.description || c.definition)}</p>` : ""}
		</article>
	`).join("");
}

/**
 * Wire the Add Code form
 */
function setupAddCodeWiring() {
	const btn = $("#new-code-btn");
	const form = $("#add-code-form");
	const section = $("#code-form");
	const cancelBtn = $("#cancel-code-btn");

	function toggleForm(show) {
		if (!section) return;
		section.hidden = !show;
		if (show) $("#code-name")?.focus();
	}

	btn?.addEventListener("click", () => {
		console.debug("Add code button clicked");
		toggleForm(true);
	});

	cancelBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		toggleForm(false);
	});

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const fd = new FormData(form);

		const payload = {
			name: (fd.get("name") || "").toString().trim(),
			projectId: state.projectId,
			colour: (fd.get("color") || "").toString().trim(),
			description: (fd.get("definition") || "").toString().trim(),
			parentId: (fd.get("parent") || "").toString().trim()
		};

		if (!payload.name) {
			flash("Please enter a code name.");
			return;
		}

		try {
			await httpJSON("/api/codes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});

			form.reset();
			toggleForm(false);
			flash(`Code "${payload.name}" created.`);
			await loadCodes();
		} catch (err) {
			console.error(err);
			flash("Could not create code.");
		}
	});
}

/* =========================
 * Memos
 * ========================= */

/**
 * Loads memos for the current project and renders them.
 * @returns {Promise<void>}
 */
async function loadMemos() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/memos?project=${encodeURIComponent(state.projectId)}`);
		state.memos = Array.isArray(data?.memos) ? data.memos : [];
		renderMemos();
	} catch (e) {
		console.error(e);
		state.memos = [];
		renderMemos();
	}
}

/**
 * Renders memos; shows a friendly message on error/empty.
 * @param {boolean} [error=false]
 */
function renderMemos(error = false) {
	const wrap = $("#memos-container");
	if (!wrap) return;

	if (error) {
		wrap.innerHTML = "<p>Could not load memos.</p>";
		return;
	}

	const activeFilter = document.querySelector('.filter-btn[data-memo-filter].active')?.dataset.memoFilter || "all";
	const items = (state.memos || []).filter(m => {
		if (activeFilter === "all") return true;
		const t = (m.memoType || m.type || "").toLowerCase();
		return t === activeFilter.toLowerCase();
	});

	if (!items.length) {
		wrap.innerHTML = `<p>No ${activeFilter === 'all' ? '' : activeFilter} memos yet.</p>`;
		return;
	}

	wrap.innerHTML = items.map(m => `
		<article class="memo-card" data-id="${m.id || ""}">
			<header class="memo-header">
				<strong>${escapeHtml(m.title || m.memoType || "Memo")}</strong>
				<time>${formatWhen(m.createdAt)}</time>
			</header>
			${m.title && m.title !== m.memoType ? `<p class="memo-title">${escapeHtml(m.title)}</p>` : ""}
			<p>${escapeHtml(m.content || "")}</p>
		</article>
	`).join("");
}

/**
 * Wire the memo form and filter buttons
 */
function setupNewMemoWiring() {
	const newBtn = $("#new-memo-btn");
	const formSection = $("#memo-form");
	const form = $("#add-memo-form");
	const cancelBtn = $("#cancel-memo-btn");

	function toggleForm(show) {
		if (!formSection) return;
		formSection.hidden = !show;
		if (show) $("#memo-content")?.focus();
	}

	newBtn?.addEventListener("click", () => {
		console.debug("New memo button clicked");
		toggleForm(true);
	});

	cancelBtn?.addEventListener("click", () => toggleForm(false));

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		const fd = new FormData(form);

		const payload = {
			project_id: state.projectId,
			memo_type: (fd.get("memo_type") || "analytical").toString(),
			title: (fd.get("title") || "").toString(),
			content: (fd.get("content") || "").toString(),
		};

		if (!payload.content.trim()) {
			flash("Content is required.");
			return;
		}

		try {
			await httpJSON("/api/memos", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			form.reset();
			toggleForm(false);
			flash("Memo created.");
			await loadMemos();
		} catch (err) {
			console.error(err);
			flash("Could not create memo.");
		}
	});

	// Wire filter buttons
	document.querySelectorAll('.filter-btn[data-memo-filter]').forEach(btn => {
		btn.addEventListener("click", (e) => {
			const target = /** @type {HTMLElement} */ (e.currentTarget);
			document.querySelectorAll('.filter-btn[data-memo-filter]').forEach(b => b.classList.remove("active"));
			target.classList.add("active");
			renderMemos();
		});
	});
}

/* =========================
 * Analysis
 * ========================= */

/**
 * Setup analysis tools - stub for now
 */
function setupAnalysisTools() {
	console.debug("Analysis tools setup");
	// Analysis functionality would go here
}

/**
 * Load analysis - stub for now
 */
async function loadAnalysis() {
	setupAnalysisTools();
	return Promise.resolve();
}

/* =========================
 * Journal Excerpts
 * ========================= */

/**
 * Initialize journal excerpts functionality
 * @param {string} entryId
 */
async function bootExcerpts(entryId) {
	try {
		const mod = await import("/components/journal-excerpts.js");
		const { initJournalExcerpts } = mod;

		excerptManagerInstance = initJournalExcerpts({
			entryId,
			textarea: "#entry-content",
			list: "#excerpts-list",
			addBtn: "#btn-add-excerpt"
		});

		const textarea = document.getElementById("entry-content");
		if (textarea) {
			textarea.addEventListener("excerpt:created", async (e) => {
				const payload = e.detail.excerpt;
				try {
					await fetch("/api/excerpts", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							entryId,
							start: payload.start,
							end: payload.end,
							text: payload.text,
							author: payload.author
						})
					});
				} catch (err) {
					console.warn("Failed to save excerpt:", err);
				}
			});
		}
	} catch (err) {
		console.warn("Journal excerpts module not available:", err);
	}
}

/* =========================
 * Bootstrap
 * ========================= */

/**
 * Entry-point: reads project id, wires UI, and loads initial data.
 * @returns {Promise<void>}
 */
async function init() {
	console.debug("Initializing CAQDAS interface...");

	const url = new URL(location.href);
	// Fix: properly get the 'id' parameter
	state.projectId = url.searchParams.get("id") || url.searchParams.get("project") || "";

	if (!state.projectId) {
		flash("No project id in URL. Some features disabled.");
		console.warn("No project ID found in URL params");
	} else {
		console.debug("Project ID:", state.projectId);

		// Update the project link
		const projectLink = $("#project-link");
		if (projectLink) {
			projectLink.href = `/pages/projects/project.html?id=${encodeURIComponent(state.projectId)}`;
		}
	}

	// Wire up all UI components
	setupTabs();
	setupNewEntryWiring();
	setupAddCodeWiring();
	setupNewMemoWiring();

	// Load initial data
	await Promise.allSettled([
		loadEntries(),
		loadCodes(),
		loadMemos()
	]);

	// Switch to journal tab by default
	switchTab("journal");

	console.debug("CAQDAS interface initialized");
}

// Start the app when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	// DOM already loaded
	init();
}
