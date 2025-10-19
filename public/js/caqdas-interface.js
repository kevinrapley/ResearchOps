/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: entries, codes, memos, analysis (works with your HTML).
 *
 * This version:
 *  - Buttons work for: Add journal entry, Add code, Add memo, Timeline, Co-occurrence, Retrieval, Export.
 *  - Codebook management: uses a colour-wheel picker (<input type="color">) and
 *    sends a hex code (e.g. "#ff0000") to Airtable in `colour`.
 *  - Parent code is a dropdown of existing codes, and is only shown when the project already has codes.
 */

/* =========================
 * DOM helpers
 * ========================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* =========================
 * Config + HTTP helpers
 * ========================= */
const CONFIG = Object.freeze({
	API_BASE: window.location.origin,
	TIMEOUT_MS: 15000
});

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
	const res = await fetchWithTimeout(url, init, timeoutMs);
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
	}
	const ct = (res.headers.get("content-type") || "").toLowerCase();
	return ct.includes("application/json") ? res.json() : {};
}

function escapeHtml(s) {
	if (!s) return "";
	const d = document.createElement("div");
	d.textContent = s;
	return d.innerHTML;
}

function formatWhen(iso) {
	if (!iso) return "—";
	const d = new Date(iso);
	return d.toLocaleString();
}

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
const state = {
	projectId: null,
	entries: [],
	codes: [], // <- used to populate Parent dropdown
	memos: []
};

/* =========================
 * Journal: load + render + add
 * ========================= */
async function loadEntries() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/journal-entries?project=${encodeURIComponent(state.projectId)}`);
		const entries = Array.isArray(data?.entries) ? data.entries : (Array.isArray(data) ? data : []);
		state.entries = entries.map(e => ({
			id: e.id,
			category: e.category || "—",
			content: e.content ?? e.body ?? "",
			tags: Array.isArray(e.tags) ? e.tags : String(e.tags || "").split(",").map(s => s.trim()).filter(Boolean),
			createdAt: e.createdAt || e.created_at || ""
		}));
		renderEntries();
	} catch (err) {
		console.error("loadEntries error:", err);
		state.entries = [];
		renderEntries();
		flash(`Could not load journal entries. ${err?.message || ""}`.trim());
	}
}

function renderEntries() {
	const wrap = $("#entries-container");
	const empty = $("#empty-journal");
	if (!wrap) return;

	if (!state.entries.length) {
		wrap.innerHTML = "";
		if (empty) empty.hidden = false;
		return;
	}
	if (empty) empty.hidden = true;

	wrap.innerHTML = state.entries.map(en => `
    <article class="entry-card" data-id="${en.id}" data-category="${en.category}">
      <div class="entry-header">
        <div class="entry-meta">
          <span class="entry-category-badge" data-category="${en.category}">${escapeHtml(en.category)}</span>
          <span class="entry-timestamp">${formatWhen(en.createdAt)}</span>
        </div>
        <div class="entry-actions">
          <button class="govuk-button govuk-button--secondary govuk-button--small" data-act="delete" data-id="${en.id}">Delete</button>
        </div>
      </div>
      <div class="entry-content">${escapeHtml(en.content || "")}</div>
      <div class="entry-tags">
        ${(en.tags || []).map(t => `<span class="filter-chip">${escapeHtml(t)}</span>`).join("")}
      </div>
    </article>
  `).join("");

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
		if (show)($("#entry-content") || section.querySelector("textarea, [contenteditable]"))?.focus();
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
			project_airtable_id: state.projectId, // backwards compatibility
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
			console.error("add-entry submit error:", err);
			flash(`Could not save entry. ${err?.message || ""}`.trim());
		}
	});
}

/* =========================
 * Codes: ensure form + load + render + add
 *  - Colour field uses <input type="color">, value is hex (e.g. "#ff0000")
 *  - Parent dropdown shows only when codes exist, populated from state.codes
 * ========================= */

/** Build/ensure the Add Code form exists (hidden by default). */
/** Build/ensure the Add Code form exists (hidden by default). */
/** Build/ensure the Add Code form exists (hidden by default). */
function ensureCodeForm() {
	let form = document.getElementById("code-form");
	if (form) return form;

	const host = document.getElementById("codes-panel") || document.getElementById("codes");
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
      <label class="govuk-label" id="code-colour-label" for="code-colour-hex">Colour</label>
      <div class="color-field">
        <input
		  class="color-field"
          id="code-colour"
          name="color_swatch"
          type="color"
          value="#505a5f"
          aria-labelledby="code-colour-label code-colour-hex"
        >
        <input
          class="govuk-input color-field__hex"
          id="code-colour-hex"
          name="color"
          inputmode="text"
          autocomplete="off"
          spellcheck="false"
          pattern="^#([0-9A-Fa-f]{6})$"
          value="#505a5f"
        >
      </div>
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
      <button id="cancel-memo-btn" class="govuk-button govuk-button--secondary" type="button">Cancel</button>
    </div>
  `;

	host.appendChild(form);

	// Keep swatch and hex input in sync
	wireColourSync(form);

	return form;
}

/** Keep the <input type="color"> and the hex text field in sync (accessible). */
function wireColourSync(scope = document) {
	const swatch = scope.querySelector('#code-colour');
	const hex = scope.querySelector('#code-colour-hex');
	if (!swatch || !hex) return;

	// swatch → hex
	swatch.addEventListener('input', () => {
		const v = swatch.value || '';
		if (/^#[0-9a-f]{6}$/i.test(v)) {
			hex.value = v.toLowerCase();
			hex.setCustomValidity('');
		}
	});

	// hex → swatch (only update when valid)
	hex.addEventListener('input', () => {
		const v = (hex.value || '').trim();
		if (/^#[0-9a-f]{6}$/i.test(v)) {
			swatch.value = v;
			hex.setCustomValidity('');
		} else {
			hex.setCustomValidity('Enter a 6-digit hexadecimal colour, like #ff0000.');
		}
	});
}

/** Populate the Parent dropdown and show/hide wrapper depending on code count. */
function refreshParentSelector() {
	const wrap = document.getElementById("code-parent-wrap");
	const select = /** @type {HTMLSelectElement|null} */ (document.getElementById("code-parent"));
	if (!wrap || !select) return;

	const hasCodes = (state.codes || []).length > 0;
	wrap.hidden = !hasCodes;
	if (!hasCodes) {
		select.innerHTML = `<option value="">— None —</option>`;
		return;
	}

	const current = select.value;
	const options = [
		`<option value="">— None —</option>`,
		...state.codes.map(c =>
			`<option value="${escapeHtml(c.id)}"${c.id === current ? " selected" : ""}>${escapeHtml(c.name || c.id)}</option>`
		)
	];
	select.innerHTML = options.join("");
}

/** Show/submit Code form (uses hex field value for POST). */
function setupAddCodeWiring() {
	const btn = document.getElementById("new-code-btn");
	const form = ensureCodeForm();
	const nameInput = /** @type {HTMLInputElement|null} */ (document.getElementById("code-name"));
	const hexInput = /** @type {HTMLInputElement|null} */ (document.getElementById("code-colour-hex")); // <- POST this
	const descInput = /** @type {HTMLTextAreaElement|null} */ (document.getElementById("code-description"));
	const parentSel = /** @type {HTMLSelectElement|null} */ (document.getElementById("code-parent"));
	const cancelBtn = document.getElementById("cancel-code-btn");

	function showForm(show) {
		if (!form) return;
		form.hidden = !show;
		if (show) {
			refreshParentSelector(); // populate parent list just-in-time
			nameInput?.focus();
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
		e.stopPropagation();

		const name = (nameInput?.value || "").trim();
		if (!name) { flash("Please enter a code name."); return; }

		// Normalise hex; prefer the hex text field (accessible + validated)
		let hex = (hexInput?.value || "").trim().toLowerCase();
		if (!/^#[0-9a-f]{6}$/i.test(hex)) {
			// Accept #rgb and expand; else default
			if (/^#[0-9a-f]{3}$/i.test(hex)) {
				hex = '#' + hex.slice(1).split('').map(ch => ch + ch).join('');
			} else {
				hex = '#505a5f';
			}
		}

		const payload = {
			name,
			projectId: state.projectId,
			colour: hex, // ← send to Airtable as hex
			description: (descInput?.value || "").trim(),
			parentId: (parentSel?.value || "").trim() || undefined
		};

		try {
			await httpJSON("/api/codes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});

			// Reset inputs
			if (nameInput) nameInput.value = "";
			if (hexInput) hexInput.value = "#505a5f";
			const swatch = document.getElementById('code-colour');
			if (swatch) swatch.value = "#505a5f";
			if (descInput) descInput.value = "";
			if (parentSel) parentSel.value = "";

			showForm(false);
			flash(`Code “${payload.name}” created.`);
			await loadCodes();
			refreshParentSelector();
		} catch (err) {
			console.error(err);
			flash("Could not create code.");
		}
	});
}

/* =========================
 * Memos: ensure form + load + render + add
 * ========================= */
function ensureMemoForm() {
	let form = $("#memo-form");
	if (form) return form;
	const host = $("#memos-panel") || $("#memos");
	if (!host) return null;

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
	host.appendChild(form);
	return form;
}

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
	const wrap = $("#memos-container");
	if (!wrap) return;
	if (error) { wrap.innerHTML = "<p>Could not load memos.</p>"; return; }

	// Current filter (supports either .filter-btn or .filter-chip classes)
	const active =
		document.querySelector('.filter-btn.active')?.dataset.memoFilter ||
		document.querySelector('.filter-chip.filter-chip--active')?.dataset.memoFilter ||
		"all";

	const items = (state.memos || []).filter(m => {
		if (active === "all") return true;
		const t = (m.memoType || m.type || "").toLowerCase();
		return t === active.toLowerCase();
	});

	if (!items.length) { wrap.innerHTML = "<p>No memos yet.</p>"; return; }

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

function setupNewMemoWiring() {
	const newBtn = $("#new-memo-btn");
	const form = ensureMemoForm();
	const cancelBtn = $("#cancel-memo-btn");

	function toggleForm(show) {
		if (!form) return;
		const shouldShow = typeof show === "boolean" ? show : form.hidden;
		form.hidden = !shouldShow;
		if (shouldShow) form?.querySelector("#memo-content, textarea, input, select")?.focus();
	}

	newBtn?.addEventListener("click", (e) => {
		e.preventDefault();
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
			project_id: state.projectId,
			memo_type: (fd.get("memo_type") || "analytical").toString(),
			title: (fd.get("title") || "").toString(),
			content: (fd.get("content") || "").toString()
		};
		if (!payload.content.trim()) { flash("Content is required."); return; }

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

	// Filter chips (both .filter-btn and .filter-chip variants)
	document.querySelectorAll('[data-memo-filter]').forEach(btn => {
		btn.addEventListener("click", (e) => {
			document.querySelectorAll('[data-memo-filter]').forEach(b => {
				b.classList.remove("active", "filter-chip--active");
			});
			const target = /** @type {HTMLElement} */ (e.currentTarget);
			target.classList.add(target.classList.contains("filter-chip") ? "filter-chip--active" : "active");
			renderMemos();
		});
	});
}

/* =========================
 * Analysis: sections + JSON viewer + actions
 * ========================= */
function getAnalysisContainer() {
	return document.querySelector('[data-role="analysis-container"]') || document.getElementById('analysis-container');
}

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

function elFromHTML(html) {
	const t = document.createElement('template');
	t.innerHTML = html.trim();
	return /** @type {HTMLElement} */ (t.content.firstChild);
}

/* JSON viewer helpers */
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

function jsonSyntaxHighlight(obj) {
	const json = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
	const esc = json.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } [c]));
	return esc
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"(?=\s*:)/g, m => `<span class="k">${m}</span>`)
		.replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"/g, m => `<span class="s">${m}</span>`)
		.replace(/\b-?(0x[\da-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?)\b/g, m => `<span class="n">${m}</span>`)
		.replace(/\b(true|false|null)\b/g, m => `<span class="b">${m}</span>`);
}

function updateJsonPanel(data, filename = "analysis.json") {
	const { codeEl } = ensureJsonViewer();
	if (!codeEl) return;
	codeEl.innerHTML = jsonSyntaxHighlight(data);
	codeEl.dataset.filename = filename;
}

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

/* Analysis modes */
function nodeLabel(nodes, id) {
	const n = nodes.find(n => n.id === id);
	return n?.label || n?.name || String(id);
}

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

function setupRetrievalUI() {
	const wrap = ensureSection("analysis-retrieval", "Code/text retrieval");
	if (!wrap) return;

	// Build only once
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

	// Prevent duplicate listeners
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

function highlightSnippet(text, term) {
	if (!text || !term) return escapeHtml(text || "");
	const escTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return escapeHtml(text).replace(new RegExp(escTerm, "ig"), m => `<mark>${m}</mark>`);
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

/**
 * Robust wiring for Analysis buttons.
 * Delegates on #analysis-panel and (fallback) on document.
 */
function setupAnalysisTools() {
	const handler = (e) => {
		const target = e.target && typeof e.target.closest === 'function' ?
			/** @type {HTMLElement|null} */
			(e.target.closest('[data-analysis]')) :
			null;
		if (!target) return;
		e.preventDefault();
		const mode = target.dataset.analysis;
		if (mode === 'timeline') return void runTimeline();
		if (mode === 'co-occurrence') return void runCooccurrence();
		if (mode === 'retrieval') return void setupRetrievalUI();
		if (mode === 'export') return void runExport();
	};

	(document.getElementById('analysis-panel') || document).addEventListener('click', handler);
	document.addEventListener('click', handler); // belt-and-braces

	// Friendly placeholders on first load
	ensureSection("analysis-timeline", "Timeline")
		?.replaceChildren(elFromHTML('<p class="hint">Timeline not loaded yet.</p>'));
	ensureSection("analysis-cooccurrence", "Code co-occurrence")
		?.replaceChildren(elFromHTML('<p class="hint">Co-occurrence not loaded yet.</p>'));
	setupRetrievalUI(); // create retrieval form once
}

/* =========================
 * Tabs integration helpers
 * ========================= */
function isJournalActiveOnLoad() {
	const selected = document.querySelector(".govuk-tabs__list-item--selected .govuk-tabs__tab");
	if (selected) return (selected.getAttribute("href") || "").replace(/^#/, "") === "journal-entries";
	if (location.hash) return location.hash.replace(/^#/, "") === "journal-entries";
	return true; // first tab in your markup is Journal
}

/* =========================
 * Boot
 * ========================= */
async function init() {
	const url = new URL(location.href);
	state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	if (!state.projectId) {
		flash("No project id in URL. Some features disabled.");
		return;
	}

	// Wire buttons/forms
	setupNewEntryWiring();
	setupAddCodeWiring();
	setupNewMemoWiring();
	setupAnalysisTools();

	// Load codes/memos early (codes used to populate Parent dropdown)
	await Promise.allSettled([loadCodes(), loadMemos()]);

	// If Journal is the active tab at first paint, ensure visible and load
	if (isJournalActiveOnLoad()) {
		const p = document.getElementById("journal-entries");
		if (p) {
			p.classList.remove("govuk-tabs__panel--hidden");
			p.removeAttribute("hidden");
		}
		await loadEntries();
	}

	// Also reload entries when Journal tab becomes visible later
	document.addEventListener("tab:shown", (e) => {
		if (e?.detail?.id === "journal-entries") loadEntries();
	});
}

document.addEventListener("DOMContentLoaded", init);
