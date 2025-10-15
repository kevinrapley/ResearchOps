/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: tabs, entries, codes, memos, analysis.
 */

import { initJournalExcerpts } from "/components/journal-excerpts.js";

const entryForm = document.getElementById("entry-form");
const entryTextarea = document.getElementById("entry-content");

let excerptMgr = null;

function initExcerpts(entryId) {
	excerptMgr = initJournalExcerpts({
		entryId, // supply the real entry id after save
		textarea: "#entry-content",
		list: "#excerpts-list",
		addBtn: "#btn-add-excerpt"
	});

	entryTextarea.addEventListener("excerpt:created", (e) => {
		// Persist a single excerpt (POST)
		// fetch("/api/journal/excerpts", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(e.detail.excerpt) });
	});

	entryTextarea.addEventListener("excerpts:changed", (e) => {
		// Optionally persist the whole set
		// fetch("/api/journal/excerpts/sync", { method: "PUT", headers: {"content-type":"application/json"}, body: JSON.stringify(e.detail.excerpts) });
	});
}

/* Example: after a new entry is saved, call initExcerpts with the returned id */
document.getElementById("add-entry-form")?.addEventListener("submit", async (ev) => {
	ev.preventDefault();
	const form = ev.currentTarget;
	const payload = {
		category: form.category.value,
		content: form.content.value,
		tags: form.tags.value
	};
	// const res = await fetch("/api/journal/entries", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(payload) });
	// const saved = await res.json();

	const fakeId = crypto.randomUUID(); // replace with saved.id
	if (!excerptMgr) initExcerpts(fakeId);
});

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
 * @property {string} [colour]
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
	if (!state.projectId) {
		console.debug("[journals] skip load: no projectId");
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

		console.debug("[journals] loaded", { count: state.entries.length, sample: state.entries[0] });
		renderEntries();
	} catch (err) {
		console.error("loadEntries error:", err);
		flash(`Could not load journal entries. ${err && err.message ? err.message : ""}`);
		// still render the placeholder so the section is deterministic
		state.entries = [];
		renderEntries();
	}
}

// try multiple containers so we don't depend on a single id
function getJournalContainer() {
	return (
		document.querySelector("#journal-entries") ||
		document.querySelector('[data-role="journal-entries"]') ||
		document.querySelector("#entries") ||
		document.querySelector("#journalList")
	);
}

/**
 * Renders the journal entries list.
 */
function renderEntries() {
	const wrap = getJournalContainer();
	if (!wrap) {
		console.warn("[journals] container not found; tried #journal-entries, [data-role=journal-entries], #entries, #journalList");
		return;
	}

	// Ensure the panel is visible if we're on the Journal tab
	const panel = document.getElementById("journal-panel");
	if (panel && state.currentTab === "journal") {
		panel.hidden = false;
	}

	if (!state.entries.length) {
		wrap.innerHTML = "<p>No entries yet.</p>";
		return;
	}

	wrap.innerHTML = state.entries.map(en => `
		<article class="journal-card" data-id="${en.id}">
			<header class="journal-header">
				<strong>${escapeHtml(en.category)}</strong>
				<time>${formatWhen(en.createdAt)}</time>
			</header>
			<p>${escapeHtml(en.content)}</p>
			<footer class="journal-footer">
				<button class="btn btn--secondary btn-small" data-act="delete" data-id="${en.id}">Delete</button>
			</footer>
		</article>
	`).join("");

	// hook delete handlers
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
 * Wires the “+ New entry” toggle and submit handlers.
 * Primary trigger: #toggle-form-btn (and supports #new-entry-btn alias).
 * Uses the dedicated inline form section: #entry-form and #add-entry-form.
 */
function setupNewEntryWiring() {
	// Dedicated inline form section used on your page
	const section = $("#entry-form");
	const form = $("#add-entry-form");

	// Primary trigger on this page; also accept the alias you mentioned
	const toggleBtn = $("#toggle-form-btn") || $("#new-entry-btn");
	const cancelBtn = $("#cancel-form-btn") || $("#cancel-entry-btn") || section?.querySelector('[data-role="cancel"]');

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

	if (toggleBtn && section) {
		toggleBtn.addEventListener("click", () => toggleForm());
	}

	if (cancelBtn && section) {
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			toggleForm(false);
		});
	}

	if (form && section) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fd = new FormData( /** @type {HTMLFormElement} */ (form));
			const payload = {
				// send BOTH keys so your Worker can accept either format
				project: state.projectId, // <— add this
				project_airtable_id: state.projectId, // keep this for backward compat
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
 * @function setupAddCodeWiring
 * @description
 * Handles all client-side interactions for the “Add Code” workflow, including:
 *  - Displaying and hiding the code creation form.
 *  - Submitting new code data to the API.
 *  - Resetting form fields and refreshing the code list.
 *
 * Expected HTML structure:
 * ```html
 * <button id="new-code-btn" type="button">+ Add Code</button>
 *
 * <form id="code-form" hidden novalidate>
 *   <label for="code-name">Code name</label>
 *   <input id="code-name" name="name" />
 *
 *   <label for="code-color">Color</label>
 *   <input id="code-color" name="color" />
 *
 *   <label for="code-description">Description</label>
 *   <textarea id="code-description" name="description"></textarea>
 *
 *   <label for="code-parent">Parent code</label>
 *   <input id="code-parent" name="parent" />
 *
 *   <button id="save-code-btn" type="submit">Save</button>
 *   <button id="cancel-code-btn" type="button">Cancel</button>
 * </form>
 * ```
 *
 * Dependencies:
 *  - `state.projectId` : global identifier for the current project
 *  - `httpJSON(url, init)` : JSON fetch helper
 *  - `loadCodes()` : refreshes code list
 *  - `flash(msg)` : small UI message banner
 */
function setupAddCodeWiring() {
	const btn = document.getElementById("new-code-btn");
	const form = document.getElementById("code-form");
	const nameInput = document.getElementById("code-name");
	const colourInput = document.getElementById("code-color");
	const descInput = document.getElementById("code-description");
	const parentInput = document.getElementById("code-parent");
	const cancelBtn = document.getElementById("cancel-code-btn");

	/**
	 * Toggle form visibility.
	 * @param {boolean} show - True to show form, false to hide it.
	 */
	function showForm(show) {
		if (!form) return;
		form.hidden = !show;
		if (show) nameInput?.focus();
	}

	btn?.addEventListener("click", () => showForm(form?.hidden ?? true));

	cancelBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		showForm(false);
	});

	/**
	 * Handle form submission for creating a new code.
	 * @param {SubmitEvent} e
	 */
	form?.addEventListener("submit", async (e) => {
		e.preventDefault();
		e.stopPropagation();

		const name = (nameInput?.value || "").trim();
		if (!name) {
			flash("Please enter a code name.");
			return;
		}

		/** @type {{
		 *  name: string;
		 *  projectId: string|null;
		 *  colour?: string;
		 *  description?: string;
		 *  parentId?: string;
		 *  linked_memos?: string[];
		 *  linked_entries?: string[];
		 * }} */
		const payload = {
			name,
			projectId: state.projectId,
			colour: (colourInput?.value || "").trim(),
			description: (descInput?.value || "").trim(),
			parentId: (parentInput?.value || "").trim()
		};

		try {
			await httpJSON("/api/codes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});

			// Reset inputs
			if (nameInput) nameInput.value = "";
			if (colourInput) colourInput.value = "";
			if (descInput) descInput.value = "";
			if (parentInput) parentInput.value = "";

			showForm(false);
			flash(`Code “${payload.name}” created.`);
			await loadCodes();

			// Clean any accidental query params left by browser autofill
			if (location.search.includes("name=")) {
				const url = new URL(location.href);
				["name", "definition", "colour", "parent"].forEach(p => url.searchParams.delete(p));
				history.replaceState(null, "", url.toString());
			}
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
		renderMemos(true);
	}
}

/**
 * Renders memos; shows a friendly message on error/empty.
 * @param {boolean} [error=false]
 */
function renderMemos(error = false) {
	const wrap = document.querySelector('[data-role="memos-container"]') || document.getElementById("memos-container");
	if (!wrap) return;

	if (error) {
		wrap.innerHTML = "<p>Could not load memos.</p>";
		return;
	}

	const activeFilter = document.querySelector('.filter-btn.active')?.dataset.memoFilter || "all";
	const items = (state.memos || []).filter(m => {
		if (activeFilter === "all") return true;
		const t = (m.memoType || m.type || "").toLowerCase();
		return t === activeFilter.toLowerCase();
	});

	if (!items.length) {
		wrap.innerHTML = "<p>No memos yet.</p>";
		return;
	}

	wrap.innerHTML = items.map(m => `
    <article class="memo-card" data-id="${m.id || ""}">
      <header class="memo-header">
        <strong>${escapeHtml(m.title || m.memoType || "Memo")}</strong>
        <time>${formatWhen(m.createdAt)}</time>
      </header>
      ${m.title ? `<p class="memo-title">${escapeHtml(m.title)}</p>` : ""}
      <p>${escapeHtml(m.content || "")}</p>
    </article>
  `).join("");
}

/**
 * Wire the "+ New Memo" button, form show/hide, submit, and filter chips.
 * Matches your exact HTML:
 *  - #new-memo-btn
 *  - #memo-form (section)
 *  - #add-memo-form
 *  - #cancel-memo-btn
 *  - .filter-btn[data-memo-filter]
 */
function setupNewMemoWiring() {
	const newBtn = document.getElementById("new-memo-btn");
	const formSection = document.getElementById("memo-form");
	const form = document.getElementById("add-memo-form");
	const cancelBtn = document.getElementById("cancel-memo-btn");

	function toggleForm(show) {
		if (!formSection) return;
		const shouldShow = typeof show === "boolean" ? show : formSection.hidden;
		formSection.hidden = !shouldShow;
		if (shouldShow) form?.querySelector("#memo-content, textarea, input, select")?.focus();
	}

	if (newBtn) newBtn.addEventListener("click", () => toggleForm(true));
	if (cancelBtn) cancelBtn.addEventListener("click", () => toggleForm(false));

	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fd = new FormData(form);

			const payload = {
				project_id: state.projectId,
				memo_type: (fd.get("memo_type") || "analytical").toString(),
				title: (fd.get("title") || "").toString(), // optional; server will ignore if unused
				content: (fd.get("content") || "").toString(),
				// you can add author/linked_entries here later if you surface them in the form
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
	}

	// Filters
	document.querySelectorAll('.filter-btn[data-memo-filter]').forEach(btn => {
		btn.addEventListener("click", (e) => {
			const target = e.currentTarget;
			document.querySelectorAll('.filter-btn[data-memo-filter]').forEach(b => b.classList.remove("active"));
			target.classList.add("active");
			renderMemos(); // re-render with the new filter
		});
	});
}

/* =========================
 * ANALYSIS TOOLS
 * ========================= */
/**
 * 
 * Wires the Analysis panel buttons and renders dedicated UIs for:
 *  - Timeline View
 *  - Code Co-occurrence
 *  - Code Retrieval
 *  - Export Analysis
 *
 * Assumes these globals/utilities exist elsewhere in your file:
 *   - state.projectId : string
 *   - httpJSON(url, init?) : Promise<any>
 *   - escapeHtml(str) : string
 *   - formatWhen(iso) : string
 *   - flash(msg) : void
 *   - $ and $$ query helpers (optional, only used lightly)
 *
 * Works with this HTML structure:
 *   <div role="tabpanel" id="analysis-panel" ...>
 *     <div class="analysis-options">
 *       <button class="analysis-btn" data-analysis="timeline">...</button>
 *       <button class="analysis-btn" data-analysis="co-occurrence">...</button>
 *       <button class="analysis-btn" data-analysis="retrieval">...</button>
 *       <button class="analysis-btn" data-analysis="export">...</button>
 *     </div>
 *     <div id="analysis-container" data-role="analysis-container"></div>
 *   </div>
 */

/* --------------------------
 * Container + DOM helpers (scoped to Analysis panel)
 * -------------------------- */

/**
 * Return the host container that receives analysis render output.
 * @returns {HTMLElement|null}
 */
function getAnalysisContainer() {
	return document.querySelector('[data-role="analysis-container"]') || document.getElementById('analysis-container');
}

/**
 * Ensure an analysis subsection exists inside the host container; create if missing.
 * @param {string} id - The section element id (e.g., "analysis-timeline").
 * @param {string} [headingText] - Optional heading text prepended inside the section.
 * @returns {HTMLElement|null}
 */
function ensureSection(id, headingText) {
	const host = getAnalysisContainer();
	if (!host) return null;
	let sec = document.getElementById(id);
	if (sec) return sec;

	sec = document.createElement('section');
	sec.id = id;
	sec.setAttribute('aria-live', 'polite');
	sec.className = 'analysis-section';
	if (headingText) {
		const h = document.createElement('h3');
		h.className = 'analysis-section__heading';
		h.textContent = headingText;
		sec.appendChild(h);
	}
	host.appendChild(sec);
	return sec;
}

/**
 * Create a DOM element from a string of HTML.
 * @param {string} html
 * @returns {HTMLElement}
 */
function elFromHTML(html) {
	const t = document.createElement('template');
	t.innerHTML = html.trim();
	return /** @type {HTMLElement} */ (t.content.firstChild);
}

/* --------------------------
 * JSON Viewer (self-creates inside Analysis container)
 * -------------------------- */
/**
 * Ensure a `<details>` JSON viewer exists with Copy/Download actions.
 * @returns {{ codeEl: HTMLElement|null }}
 */
function ensureJsonViewer() {
	const host = getAnalysisContainer();
	if (!host) return { codeEl: null };

	let details = document.getElementById('json-viewer');
	if (!details) {
		details = document.createElement('details');
		details.id = 'json-viewer';
		details.innerHTML = `
      <summary><span>View raw JSON</span></summary>
      <div>
        <div class="analysis-json-actions">
          <button type="button" id="json-copy">Copy JSON</button>
          <button type="button" id="json-download">Download JSON</button>
        </div>
        <pre tabindex="0" aria-label="Raw JSON"><code id="json-code"></code></pre>
      </div>`;
		host.appendChild(details);
		setupJsonButtons();
	}
	return { codeEl: document.getElementById('json-code') };
}

/**
 * Syntax-highlight JSON for display within <pre><code>.
 * Note: colouring relies on simple <span> wrappers; provide styles in your CSS if desired.
 * @param {unknown} obj
 * @returns {string}
 */
function jsonSyntaxHighlight(obj) {
	const json = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
	const esc = json.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } [c]));
	return esc
		// keys
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"(?=\s*:)/g, m => `<span class="k">${m}</span>`)
		// strings
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"/g, m => `<span class="s">${m}</span>`)
		// numbers
		.replace(/\b-?(0x[\da-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, m => `<span class="n">${m}</span>`)
		// booleans/null
		.replace(/\b(true|false|null)\b/g, m => `<span class="b">${m}</span>`);
}

/**
 * Populate the JSON viewer with data and filename metadata (for download).
 * @param {unknown} data
 * @param {string} [filename="analysis.json"]
 */
function updateJsonPanel(data, filename = "analysis.json") {
	const { codeEl } = ensureJsonViewer();
	if (!codeEl) return;
	codeEl.innerHTML = jsonSyntaxHighlight(data);
	codeEl.dataset.filename = filename;
}

/**
 * Wire the JSON viewer Copy/Download buttons (called once on first creation).
 */
function setupJsonButtons() {
	const copyBtn = document.getElementById("json-copy");
	const dlBtn = document.getElementById("json-download");
	const code = document.getElementById("json-code");

	copyBtn?.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(code?.textContent || "");
			flash("JSON copied.");
		} catch {
			flash("Copy failed.");
		}
	});

	dlBtn?.addEventListener("click", () => {
		const raw = code?.textContent || "{}";
		const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = code?.dataset.filename || "analysis.json";
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 0);
	});
}

/* --------------------------
 * Timeline View
 * -------------------------- */
/**
 * Fetch and render a chronological view of journal entries.
 * Renders GOV.UK-style summary cards (structure), degrades gracefully as a list.
 * Also updates the shared JSON viewer with the response.
 * @returns {Promise<void>}
 */
async function runTimeline() {
	const wrap = ensureSection("analysis-timeline", "Timeline");
	if (!wrap) return;
	wrap.innerHTML = '<p>Loading timeline…</p>';

	const res = await httpJSON(`/api/analysis/timeline?project=${encodeURIComponent(state.projectId)}`);
	const items = Array.isArray(res?.timeline) ? res.timeline : [];
	updateJsonPanel({ timeline: items }, `timeline-${state.projectId}.json`);

	if (!items.length) {
		wrap.innerHTML = '<p class="hint">No journal entries yet.</p>';
		return;
	}

	wrap.innerHTML = `
    <ul class="analysis-list">
      ${items.map(en => `
        <li class="analysis-list__item">
          <div class="summary-card">
            <div class="summary-card__title-row">
              <h4 class="summary-card__title">${formatWhen(en.createdAt)}</h4>
              ${en.category ? `<span class="tag">${escapeHtml(en.category)}</span>` : ""}
            </div>
            <div class="summary-card__content">
              <dl class="summary">
                <div class="summary__row">
                  <dt class="summary__key">Entry</dt>
                  <dd class="summary__value">${escapeHtml(en.body || en.content || "")}</dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      `).join("")}
    </ul>
  `;
}

/* --------------------------
 * Code Co-occurrence
 * -------------------------- */
/**
 * Utility to get a node's human label from id.
 * @param {{id:string,label?:string,name?:string}[]} nodes
 * @param {string} id
 * @returns {string}
 */
function nodeLabel(nodes, id) {
	const n = nodes.find(n => n.id === id);
	return n?.label || n?.name || String(id);
}

/**
 * Fetch and render a simple, accessible co-occurrence table (source–target–weight).
 * Also updates the shared JSON viewer with the response.
 * @returns {Promise<void>}
 */
async function runCooccurrence() {
	const wrap = ensureSection("analysis-cooccurrence", "Code co-occurrence");
	if (!wrap) return;
	wrap.innerHTML = '<p>Loading co-occurrence…</p>';

	const res = await httpJSON(`/api/analysis/cooccurrence?project=${encodeURIComponent(state.projectId)}`);
	const nodes = Array.isArray(res?.nodes) ? res.nodes : [];
	const links = Array.isArray(res?.links) ? res.links : [];
	updateJsonPanel({ nodes, links }, `cooccurrence-${state.projectId}.json`);

	if (!links.length) {
		wrap.innerHTML = '<p class="hint">No co-occurrences yet.</p>';
		return;
	}

	links.sort((a, b) => (b.weight || 0) - (a.weight || 0));
	wrap.innerHTML = `
    <table class="table">
      <caption>Code pairs by strength</caption>
      <thead>
        <tr><th>Source</th><th>Target</th><th>Weight</th></tr>
      </thead>
      <tbody>
        ${links.map(l => `
          <tr>
            <td><span class="tag">${escapeHtml(nodeLabel(nodes, l.source))}</span></td>
            <td><span class="tag">${escapeHtml(nodeLabel(nodes, l.target))}</span></td>
            <td>${escapeHtml(String(l.weight ?? 1))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* --------------------------
 * Code Retrieval
 * -------------------------- */
/**
 * Ensure the Retrieval form exists and wire submit to render results.
 * Also updates the shared JSON viewer with the results.
 */
function setupRetrievalUI() {
	const wrap = ensureSection("analysis-retrieval", "Code/text retrieval");
	if (!wrap) return;

	// Build form only once if it doesn't exist
	if (!document.getElementById("retrieval-form")) {
		const form = document.createElement("form");
		form.id = "retrieval-form";
		form.noValidate = true;
		form.innerHTML = `
      <label for="retrieval-q">Search term</label>
      <input id="retrieval-q" name="q" type="text" spellcheck="true" autocomplete="off" />
      <div class="hint">Searches code names and journal text.</div>
      <button type="submit">Run search</button>
      <div id="retrieval-results" class="analysis-results"><p class="hint">Enter a term and run search.</p></div>`;
		wrap.appendChild(form);
	}

	const form = /** @type {HTMLFormElement} */ (document.getElementById("retrieval-form"));
	const input = /** @type {HTMLInputElement} */ (document.getElementById("retrieval-q"));
	const results = document.getElementById("retrieval-results");
	if (!form || !input || !results) return;

	// Prevent duplicate listeners in case of re-initialisation
	form.replaceWith(form.cloneNode(true));
	const newForm = /** @type {HTMLFormElement} */ (document.getElementById("retrieval-form"));
	const newInput = /** @type {HTMLInputElement} */ (document.getElementById("retrieval-q"));
	const newResults = document.getElementById("retrieval-results");

	newForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		const q = (newInput.value || "").trim();
		if (!q) { newResults.innerHTML = '<p class="hint">Enter a term to search.</p>'; return; }

		newResults.innerHTML = '<p>Searching…</p>';
		const res = await httpJSON(`/api/analysis/retrieval?project=${encodeURIComponent(state.projectId)}&q=${encodeURIComponent(q)}`);
		const out = Array.isArray(res?.results) ? res.results : [];
		updateJsonPanel({ query: q, results: out }, `retrieval-${state.projectId}.json`);

		if (!out.length) {
			newResults.innerHTML = '<p class="hint">No matches found.</p>';
			return;
		}

		newResults.innerHTML = `
      <ul class="analysis-list analysis-list--spaced" aria-live="polite">
        ${out.map(r => `
          <li>
            <h5 class="analysis-subheading">
              ${r.codes.map(c => `<span class="tag">${escapeHtml(c.name)}</span>`).join(" ")}
            </h5>
            <p>${highlightSnippet(r.snippet, q)}</p>
          </li>
        `).join("")}
      </ul>
    `;
	});
}

/**
 * Wrap search matches with <mark>.
 * @param {string} text
 * @param {string} term
 * @returns {string}
 */
function highlightSnippet(text, term) {
	if (!text || !term) return escapeHtml(text || "");
	const escTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return escapeHtml(text).replace(new RegExp(escTerm, "ig"), m => `<mark>${m}</mark>`);
}

/* --------------------------
 * Export Analysis
 * -------------------------- */
/**
 * Assemble an export payload (timeline + co-occurrence) and surface it in the JSON viewer.
 * Users can then click "Download JSON" to save the file locally.
 * @returns {Promise<void>}
 */
async function runExport() {
	try {
		const [timeline, cooc] = await Promise.all([
			httpJSON(`/api/analysis/timeline?project=${encodeURIComponent(state.projectId)}`),
			httpJSON(`/api/analysis/cooccurrence?project=${encodeURIComponent(state.projectId)}`)
		]);
		const payload = {
			projectId: state.projectId,
			generatedAt: new Date().toISOString(),
			timeline: timeline.timeline || [],
			nodes: cooc.nodes || [],
			links: cooc.links || []
		};
		updateJsonPanel(payload, `analysis-${state.projectId}.json`);
		flash("Export ready in JSON panel. Use Download JSON.");
	} catch (e) {
		console.error(e);
		flash("Failed to prepare export.");
	}
}

/* --------------------------
 * Wiring: attach to .analysis-btn[data-analysis] buttons
 * -------------------------- */
/**
 * Initialise the Analysis tools panel:
 *  - Delegates button clicks (timeline / co-occurrence / retrieval / export).
 *  - Creates friendly placeholders and retrieval UI.
 * Call this once in your page initialiser.
 */
function setupAnalysisTools() {
	const panel = document.getElementById('analysis-panel') || document;
	panel.addEventListener('click', (e) => {
		const btn = e.target && typeof e.target.closest === 'function' ?
			/** @type {HTMLElement|null} */
			(e.target.closest('.analysis-btn[data-analysis]')) :
			null;
		if (!btn) return;
		const mode = btn.dataset.analysis;
		if (mode === 'timeline') return void runTimeline();
		if (mode === 'co-occurrence') return void runCooccurrence();
		if (mode === 'retrieval') return void setupRetrievalUI();
		if (mode === 'export') return void runExport();
	});

	// Friendly placeholders, built only once:
	ensureSection("analysis-timeline", "Timeline")
		?.replaceChildren(elFromHTML('<p class="hint">Timeline not loaded yet.</p>'));
	ensureSection("analysis-cooccurrence", "Code co-occurrence")
		?.replaceChildren(elFromHTML('<p class="hint">Co-occurrence not loaded yet.</p>'));
	setupRetrievalUI(); // creates the form + empty state if missing
}

// NOTE: Call setupAnalysisTools() from your main init() after state.projectId is set.
// Example:
// document.addEventListener("DOMContentLoaded", () => { /* set state.projectId ... */ setupAnalysisTools(); });

/* =========================
 * Bootstrap
 * ========================= */

// Back-compat: satisfy older calls to loadAnalysis()
function loadAnalysis() {
	try {
		// Ensure the analysis buttons, placeholders, and retrieval form are wired
		if (typeof setupAnalysisTools === "function") setupAnalysisTools();
	} catch (e) {
		console.debug("[analysis] loadAnalysis noop/shim failed:", e);
	}
	// Keep a promise interface if callers await it
	return Promise.resolve();
}

/**
 * Entry-point: reads project id, wires UI, and loads initial data.
 * @returns {Promise<void>}
 */
async function init() {
	const url = new URL(location.href);
	project: state.projectId,
		state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	if (!state.projectId) {
		flash("No project id in URL. Some features disabled.");
		return;
	}

	setupTabs();
	setupNewEntryWiring();
	setupAddCodeWiring();
	setupNewMemoWiring();

	await Promise.allSettled([
		loadEntries(),
		loadCodes(),
		loadMemos(),
		loadAnalysis()
	]);

	switchTab("journal");
}

document.addEventListener("DOMContentLoaded", init);
