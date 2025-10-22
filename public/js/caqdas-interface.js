/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: entries, codes, memos, analysis (works with your HTML).
 *
 * This version:
 *  - Codebook management: uses Coloris colour picker and always sends 8-digit hex (#RRGGBBAA).
 *  - Parent code is a dropdown of existing codes, shown only when the project already has codes.
 *  - Journal + Memo filter chips correctly filter and re-render items (click + keyboard).
 */

/* ---------------------------
 * DOM helpers
 * --------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------------------
 * Config + HTTP helpers
 * --------------------------- */
const CONFIG = Object.freeze({ API_BASE: location.origin, TIMEOUT_MS: 15000 });

function flash(msg) {
	let el = $("#flash");
	if (!el) {
		el = document.createElement("div");
		el.id = "flash";
		el.role = "status";
		el.ariaLive = "polite";
		el.style.cssText = "margin:12px 0;padding:12px;border:1px solid #d0d7de;background:#fff;";
		$("main")?.prepend(el);
	}
	el.textContent = msg;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = CONFIG.TIMEOUT_MS) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { cache: "no-store", signal: ctrl.signal, ...init });
	} finally {
		clearTimeout(t);
	}
}

async function httpJSON(url, init = {}, timeoutMs = CONFIG.TIMEOUT_MS) {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);

	// DEBUG: outgoing
	console.groupCollapsed("[httpJSON] →", init?.method || "GET", url);
	if (init?.headers) console.debug("headers:", init.headers);
	if (init?.body) {
		try { console.debug("body:", JSON.parse(init.body)); } catch { console.debug("body(text):", init.body); }
	}
	console.groupEnd();

	let res;
	try {
		res = await fetch(url, { cache: "no-store", signal: ctrl.signal, ...init });
	} finally {
		clearTimeout(t);
	}

	// DEBUG: response
	const ct = (res.headers.get("content-type") || "").toLowerCase();
	let rawText = "";
	try { rawText = await res.clone().text(); } catch {}
	console.groupCollapsed("[httpJSON] ←", res.status, url);
	console.debug("ok:", res.ok, "status:", res.status, "content-type:", ct);
	if (rawText) console.debug("raw:", rawText);
	console.groupEnd();

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}${rawText ? ` — ${rawText}` : ""}`);
	}
	return ct.includes("application/json") ? JSON.parse(rawText || "{}") : {};
}

function esc(s) {
	if (!s) return "";
	const d = document.createElement("div");
	d.textContent = s;
	return d.innerHTML;
}

function when(iso) {
	return iso ? new Date(iso).toLocaleString() : "—";
}

// --- Routes for entry view/edit
const ROUTES = {
	viewEntry: (id) => `/pages/journal/entry?id=${encodeURIComponent(id)}`,
	editEntry: (id) => `/pages/journal/edit?id=${encodeURIComponent(id)}`
};

// Truncate without cutting a word; adds “…” only if text was shortened
function truncateWords(s, limit = 200) {
	const text = String(s || "").trim();
	if (text.length <= limit) return text;
	const cut = text.slice(0, limit + 1);
	const lastSpace = cut.lastIndexOf(" ");
	return (lastSpace > 0 ? cut.slice(0, lastSpace) : text.slice(0, limit)) + "…";
}

/* ---------------------------
 * App state
 * --------------------------- */
const state = {
	projectId: null,
	entries: [],
	codes: [],
	memos: [],
	entryFilter: "all",
	memoFilter: "all"
};

/* ---------------------------
 * Journal
 * --------------------------- */
async function loadEntries() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/journal-entries?project=${encodeURIComponent(state.projectId)}`);
		const arr = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data) ? data : []);
		state.entries = arr.map(e => ({
			id: e.id,
			category: (e.category || "—").toString(),
			content: e.content ?? e.body ?? "",
			tags: Array.isArray(e.tags) ? e.tags : String(e.tags || "").split(",").map(s => s.trim()).filter(Boolean),
			createdAt: e.createdAt || e.created_at || ""
		}));
		renderEntries();
	} catch (err) {
		console.error(err);
		state.entries = [];
		renderEntries();
		flash(`Could not load journal entries. ${err?.message || ""}`.trim());
	}
}

function filteredEntries() {
	const f = (state.entryFilter || "all").toLowerCase();
	if (f === "all") return state.entries;
	return state.entries.filter(en => (en.category || "").toLowerCase() === f);
}

function renderEntries() {
	const wrap = document.getElementById("entries-container");
	const empty = document.getElementById("empty-journal");
	if (!wrap) return;

	const items = filteredEntries();

	if (!items.length) {
		wrap.innerHTML = "";
		if (empty) empty.hidden = false;
		return;
	}
	if (empty) empty.hidden = true;

	wrap.innerHTML = items.map(en => {
		const snippet = truncateWords(en.content || "", 200);
		const isTruncated = (snippet.length < (en.content || "").trim().length);
		const tagsHTML = (en.tags || []).map(t => `<span class="tag" aria-label="Tag: ${esc(t)}">${esc(t)}</span>`).join("");

		return `
      <article class="entry-card" data-id="${en.id}" data-category="${esc(en.category)}">
        <header class="entry-header">
          <div class="entry-meta">
            <span class="entry-category-badge" data-category="${esc(en.category)}">${esc(en.category)}</span>
            <span class="entry-timestamp">${when(en.createdAt)}</span>
          </div>
          <div class="entry-actions" role="group" aria-label="Entry actions">
            <a class="btn-quiet" href="${ROUTES.editEntry(en.id)}" aria-label="Edit entry">Edit</a>
            <button class="btn-quiet danger" data-act="delete" data-id="${en.id}" aria-label="Delete entry">Delete</button>
          </div>
        </header>

        <div class="entry-content">
          ${esc(snippet)}${isTruncated ? ` <a class="read-more" href="${ROUTES.viewEntry(en.id)}" aria-label="Read full entry">Read full entry</a>` : ""}
        </div>

        <div class="entry-tags" aria-label="Tags">${tagsHTML}</div>
      </article>
    `;
	}).join("");

	// Hook delete handlers
	wrap.querySelectorAll('[data-act="delete"]').forEach(btn => {
		btn.addEventListener("click", onDeleteEntry);
	});
}

async function onDeleteEntry(e) {
	const id = e.currentTarget?.dataset.id;
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

function setupNewEntryWiring() {
	const section = $("#entry-form");
	const form = $("#add-entry-form");
	const toggleBtn = $("#new-entry-btn");
	const cancelBtn = $("#cancel-form-btn");

	function toggleForm(force) {
		if (!section) return;
		const show = typeof force === "boolean" ? force : section.hidden;
		section.hidden = !show;
		if (show) {
			($("#entry-content") || section.querySelector("textarea"))?.focus();
		}
	}

	toggleBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		toggleForm();
	});
	cancelBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		toggleForm(false);
	});

	form?.addEventListener("submit", async (e) => {
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
			await httpJSON("/api/journal-entries", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			form.reset();
			toggleForm(false);
			flash("Entry saved.");
			await loadEntries();
		} catch (err) {
			console.error(err);
			flash(`Could not save entry. ${err?.message || ""}`.trim());
		}
	});
}

/* ---------------------------
 * Journal: filter chips (event delegation, keyboard accessible)
 * --------------------------- */
function setupEntryFilters() {
	const container = document.querySelector('#journal-entries-panel .filter-chips');
	if (!container) return;

	// initialise from current active chip
	const initial = container.querySelector('.filter-chip--active')?.dataset.filter || 'all';
	state.entryFilter = (initial || 'all').toLowerCase();

	// make chips accessible
	container.querySelectorAll('.filter-chip').forEach(b => {
		b.setAttribute('role', 'button');
		b.setAttribute('aria-pressed', b.classList.contains('filter-chip--active') ? 'true' : 'false');
		if (!b.hasAttribute('tabindex')) b.tabIndex = 0;
	});

	// click handler
	container.addEventListener('click', (e) => {
		const btn = e.target && typeof e.target.closest === "function" ? e.target.closest('.filter-chip') : null;
		if (!btn) return;
		e.preventDefault();

		container.querySelectorAll('.filter-chip').forEach(b => {
			b.classList.remove('filter-chip--active');
			b.setAttribute('aria-pressed', 'false');
		});

		btn.classList.add('filter-chip--active');
		btn.setAttribute('aria-pressed', 'true');

		state.entryFilter = (btn.dataset.filter || 'all').toLowerCase();
		renderEntries();
	});

	// keyboard (Enter/Space)
	container.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		const btn = e.target && typeof e.target.closest === "function" ? e.target.closest('.filter-chip') : null;
		if (!btn) return;
		e.preventDefault();
		btn.click();
	});
}

/* ---------------------------
 * Codes (Coloris + parent select)
 * --------------------------- */
function toHex8(input) {
	if (!input) return "#1d70b8ff";
	let v = String(input).trim().toLowerCase();
	if (/^#[0-9a-f]{8}$/.test(v)) return v;           // #rrggbbaa
	if (/^#[0-9a-f]{6}$/.test(v)) return v + "ff";    // #rrggbb → +ff
	if (/^#[0-9a-f]{3}$/.test(v)) {                   // #rgb → #rrggbbff
		return "#" + v.slice(1).split("").map(ch => ch + ch).join("") + "ff";
	}
	const ctx = document.createElement("canvas").getContext("2d");
	try { ctx.fillStyle = v; } catch { return "#1d70b8ff"; }
	const hex6 = ctx.fillStyle; // browser → #rrggbb
	return /^#[0-9a-f]{6}$/i.test(hex6) ? hex6 + "ff" : "#1d70b8ff";
}

function ensureCodeForm() {
	let form = $("#code-form");
	if (form) return form;
	const host = $("#codes-panel") || $("#codes");
	if (!host) return null;

	form = document.createElement("form");
	form.id = "code-form";
	form.hidden = true;
	form.noValidate = true;
	form.innerHTML = `
    <div class="govuk-form-group">
      <label class="govuk-label" for="code-name">Code name</label>
      <input class="govuk-input" id="code-name" name="name" required />
    </div>

    <div class="govuk-form-group">
      <label class="govuk-label" for="code-colour">Colour</label>
      <input class="govuk-input" id="code-colour" name="colour" data-coloris value="#1d70b8ff" />
    </div>

    <div class="govuk-form-group" id="code-parent-wrap" hidden>
      <label class="govuk-label" for="code-parent">Parent code (optional)</label>
      <select class="govuk-select" id="code-parent" name="parent">
        <option value="">— None —</option>
      </select>
    </div>

    <div class="govuk-form-group">
      <label class="govuk-label" for="code-description">Description</label>
      <textarea class="govuk-textarea" id="code-description" name="description" rows="3"></textarea>
    </div>

    <div class="govuk-button-group">
      <button id="save-code-btn" class="govuk-button" type="submit">Save</button>
      <button id="cancel-code-btn" class="govuk-button govuk-button--secondary" type="button">Cancel</button>
    </div>
  `;
	host.appendChild(form);

	// Coloris initialisation (guarantee hex8)
	if (window.Coloris) {
		window.Coloris({
			el: "#code-colour",
			alpha: true,
			forceAlpha: true,
			format: "hex",
			themeMode: "light",
			wrap: true
		});
	}
	return form;
}

function refreshParentSelector() {
	const wrap = $("#code-parent-wrap");
	const sel = $("#code-parent");
	if (!wrap || !sel) return;
	const hasCodes = (state.codes || []).length > 0;
	wrap.hidden = !hasCodes;

	let html = `<option value="">— None —</option>`;
	for (let i = 0; i < state.codes.length; i++) {
		const c = state.codes[i];
		html += `<option value="${esc(c.id)}">${esc(c.name || c.id)}</option>`;
	}
	sel.innerHTML = html;
}

async function loadCodes() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/codes?project=${encodeURIComponent(state.projectId)}`);
		state.codes = Array.isArray(data?.codes) ? data.codes : [];
		renderCodes();
		refreshParentSelector();
	} catch (e) {
		console.error(e);
		renderCodes(true);
		flash(`Could not load codes. ${e?.message || ""}`.trim());
	}
}

function renderCodes(error = false) {
	const wrap = $("#codes-container");
	if (!wrap) return;
	if (error) {
		wrap.innerHTML = "<p>Could not load codes.</p>";
		return;
	}
	if (!state.codes.length) {
		wrap.innerHTML = "<p>No codes yet.</p>";
		return;
	}
	let html = "";
	for (let i = 0; i < state.codes.length; i++) {
		const c = state.codes[i];
		const colour = toHex8(c.colour || c.color || "#1d70b8ff");
		html += `
      <article class="code-card" data-id="${c.id}">
        <header>
          <span class="code-swatch" style="background-color:${colour};"></span>
          <strong>${esc(c.name || "—")}</strong>
        </header>
        ${c.description ? `<p>${esc(c.description)}</p>` : ""}
      </article>
    `;
	}
	wrap.innerHTML = html;
}

function setupAddCodeWiring() {
	const btn = $("#new-code-btn");
	const form = ensureCodeForm();
	const nameEl = $("#code-name");
	const colourEl = $("#code-colour");
	const descEl = $("#code-description");
	const parentSel = $("#code-parent");
	const cancelBtn = $("#cancel-code-btn");

	function showForm(show) {
		if (!form) return;
		form.hidden = !show;
		if (show) {
			refreshParentSelector();
			if (nameEl) nameEl.focus();
		}
	}

	btn?.addEventListener("click", (e) => {
		e.preventDefault();
		showForm(form?.hidden ?? true);
	});
	cancelBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		showForm(false);
	});

	form?.addEventListener("submit", async (e) => {
		e.preventDefault();

		const name = (nameEl?.value || "").trim();
		if (!name) {
			flash("Please enter a code name.");
			return;
		}

		const hex8 = toHex8(colourEl?.value || "#1d70b8ff");
		const parentRaw = (parentSel?.value || "").trim();
		const parentId = parentRaw || null;

		const payloadForLog = {
			name: name,
			projectId: state.projectId,
			colour: hex8,
			description: (descEl?.value || "").trim(),
			parentId: parentId
		};
		console.groupCollapsed("[codes] POST payload");
		console.debug(payloadForLog);
		console.groupEnd();

		try {
			const res = await httpJSON("/api/codes?diag=1", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payloadForLog)
			});
			console.debug("[codes] POST ok:", res);

			if (nameEl) nameEl.value = "";
			if (colourEl) colourEl.value = "#1d70b8ff";
			if (descEl) descEl.value = "";
			if (parentSel) parentSel.value = "";

			showForm(false);
			flash(`Code “${name}” created.`);
			await loadCodes();
			refreshParentSelector();
		} catch (err) {
			console.error("[codes] POST failed:", err);
			flash("Could not create code (see console for diagnostics).");
		}
	});
}

/* ---------------------------
 * Memos
 * --------------------------- */
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

function renderMemos(error = false) {
	const wrap = document.getElementById("memos-container");
	if (!wrap) return;
	if (error) {
		wrap.innerHTML = "<p>Could not load memos.</p>";
		return;
	}

	const filter = (state.memoFilter || "all").toLowerCase();
	const items = (state.memos || []).filter(m => {
		if (filter === "all") return true;
		const t = (m.memoType || m.type || "").toLowerCase();
		return t === filter;
	});

	if (!items.length) {
		wrap.innerHTML = "<p>No memos yet.</p>";
		return;
	}

	let html = "";
	for (let i = 0; i < items.length; i++) {
		const m = items[i];
		html += `
      <article class="memo-card" data-id="${m.id || ""}">
        <header class="memo-header">
          <strong>${esc(m.title || m.memoType || "Memo")}</strong>
          <time>${when(m.createdAt)}</time>
        </header>
        ${m.title ? `<p class="memo-title">${esc(m.title)}</p>` : ""}
        <p>${esc(m.content || "")}</p>
      </article>
    `;
	}
	wrap.innerHTML = html;
}

function setupNewMemoWiring() {
	let form = $("#memo-form");
	if (!form) {
		form = document.createElement("form");
		form.id = "memo-form";
		form.hidden = true;
		form.noValidate = true;
		form.innerHTML = `
      <div class="govuk-form-group">
        <label class="govuk-label" for="memo-type">Memo type</label>
        <select class="govuk-select" id="memo-type" name="memo_type">
          <option value="analytical">Analytical</option>
          <option value="methodological">Methodological</option>
          <option value="theoretical">Theoretical</option>
          <option value="reflexive">Reflexive</option>
        </select>
      </div>
      <div class="govuk-form-group">
        <label class="govuk-label" for="memo-title">Title (optional)</label>
        <input class="govuk-input" id="memo-title" name="title" />
      </div>
      <div class="govuk-form-group">
        <label class="govuk-label" for="memo-content">Content</label>
        <textarea class="govuk-textarea" id="memo-content" name="content" rows="4" required></textarea>
      </div>
      <div class="govuk-button-group">
        <button id="save-memo-btn" class="govuk-button" type="submit">Save</button>
        <button id="cancel-memo-btn" class="govuk-button govuk-button--secondary" type="button">Cancel</button>
      </div>
    `;
		$("#memos-panel")?.appendChild(form);
	}

	const newBtn = $("#new-memo-btn");
	const cancelBtn = $("#cancel-memo-btn");

	function toggleForm(show) {
		if (!form) return;
		const s = typeof show === "boolean" ? show : form.hidden;
		form.hidden = !s ? true : false;
		if (s) form.querySelector("#memo-content")?.focus();
	}

	newBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		toggleForm(true);
	});
	cancelBtn?.addEventListener("click", (e) => {
		e.preventDefault();
		toggleForm(false);
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const fd = new FormData(form);
		const payload = {
			project_id: state.projectId,
			memo_type: (fd.get("memo_type") || "analytical").toString(),
			title: (fd.get("title") || "").toString(),
			content: (fd.get("content") || "").toString()
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

function setupMemoFilters() {
	const container = document.querySelector('#memos-panel .filter-chips');
	if (!container) return;

	// initialise from current active chip
	const initial = container.querySelector('.filter-chip--active')?.dataset.memoFilter || 'all';
	state.memoFilter = (initial || 'all').toLowerCase();

	// make chips accessible
	container.querySelectorAll('.filter-chip').forEach(b => {
		b.setAttribute('role', 'button');
		b.setAttribute('aria-pressed', b.classList.contains('filter-chip--active') ? 'true' : 'false');
		if (!b.hasAttribute('tabindex')) b.tabIndex = 0;
	});

	// click handler
	container.addEventListener('click', (e) => {
		const btn = e.target && typeof e.target.closest === "function" ? e.target.closest('.filter-chip') : null;
		if (!btn) return;
		e.preventDefault();

		container.querySelectorAll('.filter-chip').forEach(b => {
			b.classList.remove('filter-chip--active');
			b.setAttribute('aria-pressed', 'false');
		});

		btn.classList.add('filter-chip--active');
		btn.setAttribute('aria-pressed', 'true');

		state.memoFilter = (btn.dataset.memoFilter || 'all').toLowerCase();
		renderMemos();
	});

	// keyboard (Enter/Space)
	container.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		const btn = e.target && typeof e.target.closest === "function" ? e.target.closest('.filter-chip') : null;
		if (!btn) return;
		e.preventDefault();
		btn.click();
	});
}

/* ---------------------------
 * Analysis
 * --------------------------- */
function ensureSection(id, headingText) {
	let sec = document.getElementById(id);
	if (sec) return sec;
	sec = document.createElement("section");
	sec.id = id;
	sec.setAttribute("aria-live", "polite");
	sec.className = "analysis-section";
	if (headingText) {
		const h = document.createElement("h3");
		h.className = "analysis-section__heading";
		h.textContent = headingText;
		sec.appendChild(h);
	}
	($("#analysis-container") || document.body).appendChild(sec);
	return sec;
}

function jsonSyntaxHighlight(obj) {
	const json = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
	const escP = json.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
	return escP
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"(?=\s*:)/g, m => `<span class="k">${m}</span>`)
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"/g, m => `<span class="s">${m}</span>`)
		.replace(/\b-?(0x[\da-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, m => `<span class="n">${m}</span>`)
		.replace(/\b(true|false|null)\b/g, m => `<span class="b">${m}</span>`);
}

function updateJsonPanel(data, filename = "analysis.json") {
	let code = $("#json-code");
	if (!code) {
		const details = $("#json-viewer") || (() => {
			const d = document.createElement("details");
			d.id = "json-viewer";
			d.innerHTML = `
        <summary><span>View raw JSON</span></summary>
        <div class="govuk-!-margin-top-2">
          <div class="govuk-button-group">
            <button type="button" class="govuk-button govuk-button--secondary" id="json-copy">Copy JSON</button>
            <button type="button" class="govuk-button govuk-button--secondary" id="json-download">Download JSON</button>
          </div>
          <pre class="app-codeblock" tabindex="0" aria-label="Raw JSON"><code id="json-code"></code></pre>
        </div>`;
			$("#analysis-container")?.appendChild(d);
			return d;
		})();
		code = $("#json-code");
		$("#json-copy")?.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(code?.textContent || "");
				flash("JSON copied.");
			} catch {
				flash("Copy failed.");
			}
		});
		$("#json-download")?.addEventListener("click", () => {
			const raw = code?.textContent || "{}";
			const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = filename;
			a.click();
			setTimeout(() => URL.revokeObjectURL(a.href), 0);
		});
	}
	code.innerHTML = jsonSyntaxHighlight(data);
	code.dataset.filename = filename;
}

function nodeLabel(nodes, id) {
	const n = nodes.find(n => n.id === id);
	return n?.label || n?.name || String(id);
}

async function runTimeline() {
	const wrap = ensureSection("analysis-timeline", "Timeline");
	wrap.innerHTML = "<p>Loading timeline…</p>";
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
              <h4 class="summary-card__title">${when(en.createdAt)}</h4>
              ${en.category ? `<span class="tag">${esc(en.category)}</span>` : ""}
            </div>
            <div class="summary-card__content">
              <dl class="summary">
                <div class="summary__row">
                  <dt class="summary__key">Entry</dt>
                  <dd class="summary__value">${esc(en.body || en.content || "")}</dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      `).join("")}
    </ul>`;
}

async function runCooccurrence() {
	const wrap = ensureSection("analysis-cooccurrence", "Code co-occurrence");
	wrap.innerHTML = "<p>Loading co-occurrence…</p>";
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
      <thead><tr><th>Source</th><th>Target</th><th>Weight</th></tr></thead>
      <tbody>
        ${links.map(l => `
          <tr>
            <td><span class="tag">${esc(nodeLabel(nodes, l.source))}</span></td>
            <td><span class="tag">${esc(nodeLabel(nodes, l.target))}</span></td>
            <td>${esc(String(l.weight ?? 1))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function setupRetrievalUI() {
	const form = $("#retrieval-form");
	const results = $("#retrieval-results");
	if (!form || !results) return;

	form.replaceWith(form.cloneNode(true));
	const f = $("#retrieval-form");
	const q = $("#retrieval-q");

	f.addEventListener("submit", async (e) => {
		e.preventDefault();
		const term = (q?.value || "").trim();
		if (!term) {
			results.innerHTML = '<p class="hint">Enter a term to search.</p>';
		 return;
		}
		results.innerHTML = "<p>Searching…</p>";
		const res = await httpJSON(`/api/analysis/retrieval?project=${encodeURIComponent(state.projectId)}&q=${encodeURIComponent(term)}`);
		const out = Array.isArray(res?.results) ? res.results : [];
		updateJsonPanel({ query: term, results: out }, `retrieval-${state.projectId}.json`);
		if (!out.length) {
			results.innerHTML = '<p class="hint">No matches found.</p>';
			return;
		}
		const termRx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
		let html = '<ul class="analysis-list analysis-list--spaced" aria-live="polite">';
		for (let i = 0; i < out.length; i++) {
			const r = out[i];
			const codesHTML = (r.codes || []).map(c => `<span class="tag">${esc(c.name)}</span>`).join(" ");
			const snippet = esc(r.snippet).replace(termRx, m => `<mark>${m}</mark>`);
			html += `
        <li>
          <h5 class="analysis-subheading">${codesHTML}</h5>
          <p>${snippet}</p>
        </li>`;
		}
		html += "</ul>";
		results.innerHTML = html;
	});
}

function setupAnalysisButtons() {
	(document.getElementById("analysis-panel") || document).addEventListener("click", (e) => {
		const t = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-analysis]") : null;
		if (!t) return;
		e.preventDefault();
		const mode = t.dataset.analysis;
		if (mode === "timeline") { void runTimeline(); return; }
		if (mode === "co-occurrence") { void runCooccurrence(); return; }
		if (mode === "retrieval") { void setupRetrievalUI(); return; }
		if (mode === "export") { void runExport(); return; }
	});
}

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

/* ---------------------------
 * Load-on-tab logic (no visibility changes here)
 * --------------------------- */
function activeTabId() {
	if (location.hash) return location.hash.replace(/^#/, "");
	const sel = $(".govuk-tabs__list-item--selected .govuk-tabs__tab");
	return sel?.getAttribute("href")?.slice(1) || "journal-entries";
}

function loadForTab(id) {
	if (id === "journal-entries") loadEntries();
	if (id === "codes") loadCodes();
	if (id === "memos") loadMemos();
	// analysis tab only wires UI on demand; data loads via its buttons
}

/* ---------------------------
 * Bootstrap
 * --------------------------- */
async function init() {
	const url = new URL(location.href);
	state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	setupNewEntryWiring();
	setupEntryFilters();
	setupAddCodeWiring();
	setupNewMemoWiring();
	setupMemoFilters();
	setupAnalysisButtons();
	setupRetrievalUI();

	// Preload codes/memos early (for parent dropdown + memos tab)
	await Promise.allSettled([loadCodes(), loadMemos()]);

	// Initial tab data load (visibility is handled by tabs.js)
	loadForTab(activeTabId());

	// tabs.js should emit 'tab:shown' with {id}
	document.addEventListener("tab:shown", (e) => {
		const id = e?.detail?.id;
		if (id) loadForTab(id);
	});

	// Deep links/back/forward
	window.addEventListener("hashchange", () => loadForTab(activeTabId()));
}

document.addEventListener("DOMContentLoaded", init);
