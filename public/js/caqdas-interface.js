/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: tabs, entries, codes, memos, analysis.
 */

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
 * Adds the error text to the thrown Error.message for on-screen debugging.
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
		$("main")?.prepend(el);
	}
	el.textContent = msg;
}

/* =========================
 * State
 * ========================= */

/**
 * @typedef {Object} JournalEntry
 * @property {string} id
 * @property {string} category
 * @property {string} [content]
 * @property {string} [body]
 * @property {string} createdAt
 */

/**
 * @typedef {Object} Code
 * @property {string} id
 * @property {string} name
 * @property {string} [color]
 * @property {string} [description]
 */

/**
 * @typedef {Object} Memo
 * @property {string} id
 * @property {string} memoType
 * @property {string} content
 * @property {string} createdAt
 */

/**
 * @typedef {Object} CooccurrenceGraph
 * @property {{id:string,label?:string,name?:string}[]} nodes
 * @property {{source:string,target:string,weight?:number}[]} links
 */

/**
 * Application state (in-memory).
 * @type {{
 *  projectId: string|null,
 *  currentTab: 'journal'|'codes'|'memos'|'analysis',
 *  entries: JournalEntry[],
 *  codes: Code[],
 *  memos: Memo[],
 *  analysis: { timeline: JournalEntry[], graph: CooccurrenceGraph, results: any[] }
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
		tab.setAttribute("aria-selected", tab.id === `${name}-tab`);
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
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/journal-entries?project=${encodeURIComponent(state.projectId)}`);
		state.entries = Array.isArray(data?.entries) ? data.entries : [];
		renderEntries();
	} catch (e) {
		console.error("loadEntries error:", e);
		flash(`Could not load journal entries. ${e?.message || ""}`.trim());
	}
}

/**
 * Renders the journal entries list.
 */
function renderEntries() {
	const wrap = $("#journal-entries");
	if (!wrap) return;

	if (!state.entries.length) {
		wrap.innerHTML = "<p>No journal entries yet.</p>";
		return;
	}

	wrap.innerHTML = state.entries.map(en => `
		<article class="journal-card" data-id="${en.id}">
			<header class="journal-header">
				<strong>${escapeHtml(en.category || "—")}</strong>
				<time>${formatWhen(en.createdAt)}</time>
			</header>
			<p>${escapeHtml(en.content || en.body || "")}</p>
			<footer class="journal-footer">
				<button class="btn btn--secondary btn-small" data-act="delete" data-id="${en.id}">Delete</button>
			</footer>
		</article>
	`).join("");

	$$('[data-act="delete"]', wrap).forEach(btn => {
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
 * Quick inline “create entry” when the page has no form section.
 * Prompts for category and content then POSTs to the API.
 * @returns {Promise<void>}
 */
async function quickCreateEntry() {
	const category = prompt("Category (e.g., perceptions, procedures, decisions, introspections):") || "";
	const content = prompt("Entry content:") || "";
	if (!category.trim() || !content.trim()) {
		flash("Category and content are required.");
		return;
	}
	const payload = {
		project_airtable_id: state.projectId,
		category: category.trim(),
		content: content.trim(),
		tags: []
	};
	try {
		await httpJSON("/api/journal-entries", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload)
		});
		flash("Entry saved.");
		await loadEntries();
	} catch (err) {
		console.error("quickCreateEntry error:", err);
		flash(`Could not save entry. ${err?.message || ""}`.trim());
	}
}

/**
 * Wires the “+ New entry” toggle and submit handlers.
 * Primary trigger: #new-entry-btn.
 * If no section/form exists, falls back to quickCreateEntry().
 */
function setupNewEntryWiring() {
	const section =
		$("#add-entry-section") ||
		$("#new-entry-section") ||
		document.querySelector('[data-section="add-entry"]');

	const form =
		$("#add-entry-form") ||
		$("#new-entry-form") ||
		section?.querySelector("form");

	const toggleBtn =
		$("#new-entry-btn") || // primary id you provided
		$("#toggle-form-btn");

	const cancelBtn =
		$("#cancel-form-btn") ||
		$("#cancel-entry-btn") ||
		section?.querySelector('[data-role="cancel"]');

	/**
	 * Shows/hides the new-entry section.
	 * @param {boolean} [force]
	 */
	function toggleForm(force) {
		if (!section) return;
		const show = typeof force === "boolean" ? force : section.hidden;
		section.hidden = !show;
		if (show)($("#entry-content") || section.querySelector("textarea, [contenteditable]"))?.focus();
	}

	// Button wiring
	if (toggleBtn) {
		toggleBtn.addEventListener("click", async () => {
			// If there is no section on this page, fall back to quick create
			if (!section) {
				await quickCreateEntry();
			} else {
				toggleForm();
			}
		});
	}

	if (cancelBtn && section) {
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			toggleForm(false);
		});
	}

	// Form submit wiring (only if a form exists)
	if (form && section) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fd = new FormData( /** @type {HTMLFormElement} */ (form));
			const payload = {
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
				await httpJSON("/api/journal-entries", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
				/** @type {HTMLFormElement} */
				(form).reset?.();
				toggleForm(false);
				flash("Entry saved.");
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
	}
}

/**
 * Renders the code cards list.
 */
function renderCodes() {
	const wrap = $("#codes-container");
	if (!wrap) return;

	if (!state.codes.length) {
		wrap.innerHTML = "<p>No codes yet.</p>";
		return;
	}

	wrap.innerHTML = state.codes.map(c => `
		<article class="code-card" data-id="${c.id}">
			<header>
				<span class="code-swatch" style="background-color:${c.color || "#505a5f"};"></span>
				<strong>${escapeHtml(c.name || "—")}</strong>
			</header>
			${c.description ? `<p>${escapeHtml(c.description)}</p>` : ""}
		</article>
	`).join("");
}

/**
 * Wires the Codes panel quick-add flow.
 * Expects: #new-code-btn, #code-form (hidden), #save-code-btn, #cancel-code-btn, inputs #code-name, #code-color, #code-description, optional #code-parent.
 */
function setupAddCodeWiring() {
	const btn = $("#new-code-btn");
	const form = $("#code-form");
	const nameInput = $("#code-name");
	const colorInput = $("#code-color");
	const descInput = $("#code-description");
	const parentInput = $("#code-parent"); // optional
	const saveBtn = $("#save-code-btn");
	const cancelBtn = $("#cancel-code-btn");

	/**
	 * Shows/hides the inline code form.
	 * @param {boolean} show
	 */
	function showForm(show) {
		if (!form) return;
		form.hidden = !show;
		if (show) nameInput?.focus();
	}

	if (btn) {
		btn.addEventListener("click", () => showForm(form?.hidden ?? true));
	}

	if (cancelBtn) {
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			showForm(false);
		});
	}

	if (saveBtn) {
		saveBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const name = ( /** @type {HTMLInputElement|null} */ (nameInput))?.value?.trim() || "";
			if (!name) { flash("Please enter a code name."); return; }

			const payload = {
				name,
				projectId: state.projectId,
				color: ( /** @type {HTMLInputElement|null} */ (colorInput))?.value?.trim() || "",
				description: ( /** @type {HTMLInputElement|null} */ (descInput))?.value?.trim() || "",
				parentId: ( /** @type {HTMLInputElement|null} */ (parentInput))?.value?.trim() || ""
			};

			try {
				await httpJSON("/api/codes", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
				if (nameInput) nameInput.value = "";
				if (colorInput) colorInput.value = "";
				if (descInput) descInput.value = "";
				if (parentInput) parentInput.value = "";
				showForm(false);
				flash(`Code “${payload.name}” created.`);
				await loadCodes();
			} catch (err) {
				console.error(err);
				flash(`Could not create code. ${err?.message || ""}`.trim());
			}
		});
	}
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
		renderMemos(true);
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
	if (!state.memos.length) {
		wrap.innerHTML = "<p>No memos yet.</p>";
		return;
	}

	wrap.innerHTML = state.memos.map(m => `
		<article class="memo-card">
			<header>
				<strong>${escapeHtml(m.memoType || "Memo")}</strong>
				<time>${formatWhen(m.createdAt)}</time>
			</header>
			<p>${escapeHtml(m.content || "")}</p>
		</article>
	`).join("");
}

/* =========================
 * Analysis
 * ========================= */

/**
 * Loads timeline and co-occurrence for the current project.
 * Provides immediate placeholders so the UI feels responsive.
 * @returns {Promise<void>}
 */
async function loadAnalysis() {
	if (!state.projectId) return;

	const timelineSel = $("#analysis-timeline");
	const coocSel = $("#analysis-cooccurrence");
	const retrievalSel = $("#analysis-retrieval");

	if (timelineSel) timelineSel.innerHTML = "<p>Loading timeline…</p>";
	if (coocSel) coocSel.innerHTML = "<p>Loading co-occurrence…</p>";
	if (retrievalSel) retrievalSel.innerHTML = "<p>Ready for search.</p>";

	try {
		const t = await httpJSON(`/api/analysis/timeline?project=${encodeURIComponent(state.projectId)}`);
		state.analysis.timeline = Array.isArray(t?.timeline) ? t.timeline : [];
		renderTimeline(state.analysis.timeline);

		const g = await httpJSON(`/api/analysis/cooccurrence?project=${encodeURIComponent(state.projectId)}`);
		state.analysis.graph = { nodes: g.nodes || [], links: g.links || [] };
		renderCooccurrence(state.analysis.graph);
	} catch (e) {
		console.error(e);
		if (timelineSel) timelineSel.innerHTML = "<p>Timeline unavailable.</p>";
		if (coocSel) coocSel.innerHTML = "<p>Co-occurrence unavailable.</p>";
	}
}

/**
 * Renders the analysis timeline.
 * @param {JournalEntry[]} items
 */
function renderTimeline(items) {
	const wrap = $("#analysis-timeline");
	if (!wrap) return;

	if (!items.length) {
		wrap.innerHTML = "<p>No journal entries yet.</p>";
		return;
	}

	wrap.innerHTML = items.map(en => `
		<article class="entry">
			<header><time>${formatWhen(en.createdAt)}</time></header>
			<p>${escapeHtml(en.body || "")}</p>
		</article>
	`).join("");
}

/**
 * Renders the co-occurrence table.
 * @param {CooccurrenceGraph} graph
 */
function renderCooccurrence(graph) {
	const wrap = $("#analysis-cooccurrence");
	if (!wrap) return;

	const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
	const links = Array.isArray(graph.links) ? graph.links : [];

	if (!links.length) {
		wrap.innerHTML = "<p>No co-occurrences yet.</p>";
		return;
	}

	const nameById = new Map(nodes.map(n => [n.id, n.label || n.name || n.id]));
	const rows = links.map(l => `
		<tr>
			<td>${escapeHtml(nameById.get(l.source) || String(l.source))}</td>
			<td>${escapeHtml(nameById.get(l.target) || String(l.target))}</td>
			<td>${escapeHtml(String(l.weight ?? 1))}</td>
		</tr>
	`).join("");

	wrap.innerHTML = `
		<table class="table">
			<thead>
				<tr><th>Source</th><th>Target</th><th>Weight</th></tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}

/* =========================
 * Bootstrap
 * ========================= */

/**
 * Entry-point: reads project id, wires UI, and loads initial data.
 * @returns {Promise<void>}
 */
async function init() {
	const url = new URL(location.href);
	state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	if (!state.projectId) {
		flash("No project id in URL. Some features disabled.");
		return;
	}

	setupTabs();
	setupNewEntryWiring();
	setupAddCodeWiring();

	await Promise.allSettled([
		loadEntries(),
		loadCodes(),
		loadMemos(),
		loadAnalysis()
	]);

	switchTab("journal");
}

document.addEventListener("DOMContentLoaded", init);
