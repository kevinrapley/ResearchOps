/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Journals/CAQDAS UI: tabs, entries, codes, memos, analysis, export.
 */

/* =========================
 * Config + tiny helpers
 * ========================= */
const CONFIG = Object.freeze({
	API_BASE: window.location.origin,
	TIMEOUT_MS: 15000
});

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

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
	currentTab: "journal",
	entries: [],
	codes: [],
	memos: [],
	analysis: { timeline: [], graph: { nodes: [], links: [] }, results: [] }
};

/* =========================
 * Tabs (1) currentTarget fix
 * ========================= */
function setupTabs() {
	$$('[role="tab"]').forEach(tab => {
		tab.addEventListener("click", (e) => {
			const id = e.currentTarget.id || ""; // ← important
			const tabName = id.replace("-tab", "");
			switchTab(tabName);
		});
	});
}

function switchTab(name) {
	state.currentTab = name;

	$$('[role="tab"]').forEach(tab => {
		tab.setAttribute("aria-selected", tab.id === `${name}-tab`);
	});
	$$('[role="tabpanel"]').forEach(panel => {
		panel.hidden = panel.id !== `${name}-panel`;
	});

	// load per tab
	if (name === "journal") loadEntries();
	if (name === "codes") loadCodes();
	if (name === "memos") loadMemos();
	if (name === "analysis") loadAnalysis();
}

/* =========================
 * Journal (+ New entry) (2)
 * ========================= */
async function loadEntries() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/journal-entries?project=${encodeURIComponent(state.projectId)}`);
		state.entries = Array.isArray(data?.entries) ? data.entries : [];
		renderEntries();
	} catch (e) {
		console.error(e);
		flash("Could not load journal entries.");
	}
}

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

	// delete handlers
	$$('[data-act="delete"]', wrap).forEach(btn => {
		btn.addEventListener("click", onDeleteEntry);
	});
}

async function onDeleteEntry(e) {
	const id = e.currentTarget.dataset.id;
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
	const form = $("#add-entry-form");
	const toggleBtn = $("#toggle-form-btn");
	const cancelBtn = $("#cancel-form-btn");
	const section = $("#add-entry-section");

	function toggleForm(force) {
		const show = typeof force === "boolean" ? force : section.hidden;
		section.hidden = !show;
		if (show) $("#entry-content")?.focus();
	}

	if (toggleBtn) {
		toggleBtn.addEventListener("click", () => toggleForm());
	}
	if (cancelBtn) {
		cancelBtn.addEventListener("click", () => toggleForm(false));
	}
	if (form) {
		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const fd = new FormData(form);
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
				form.reset();
				toggleForm(false);
				flash("Entry saved.");
				await loadEntries();
			} catch (err) {
				console.error(err);
				flash("Could not save entry.");
			}
		});
	}
}

/* =========================
 * Codes (+ Add Code) (3)
 * ========================= */
async function loadCodes() {
	if (!state.projectId) return;
	try {
		const data = await httpJSON(`/api/codes?project=${encodeURIComponent(state.projectId)}`);
		state.codes = Array.isArray(data?.codes) ? data.codes : [];
		renderCodes();
	} catch (e) {
		console.error(e);
		flash("Could not load codes.");
	}
}

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

function setupAddCodeWiring() {
	const btn = $("#new-code-btn"); // trigger button
	const form = $("#code-form"); // small inline form container
	const nameInput = $("#code-name");
	const colorInput = $("#code-color");
	const descInput = $("#code-description");
	const parentInput = $("#code-parent"); // optional
	const saveBtn = $("#save-code-btn");
	const cancelBtn = $("#cancel-code-btn");

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
			const name = (nameInput?.value || "").trim();
			if (!name) { flash("Please enter a code name."); return; }

			const payload = {
				name,
				projectId: state.projectId,
				color: (colorInput?.value || "").trim(),
				description: (descInput?.value || "").trim(),
				parentId: (parentInput?.value || "").trim()
			};

			try {
				await httpJSON("/api/codes", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload)
				});
				nameInput && (nameInput.value = "");
				colorInput && (colorInput.value = "");
				descInput && (descInput.value = "");
				parentInput && (parentInput.value = "");
				showForm(false);
				flash(`Code “${payload.name}” created.`);
				await loadCodes();
			} catch (err) {
				console.error(err);
				flash("Could not create code.");
			}
		});
	}
}

/* =========================
 * Memos (4) load immediately
 * ========================= */
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
 * Analysis (4) load immediately
 * ========================= */
async function loadAnalysis() {
	if (!state.projectId) return;

	const timelineSel = $("#analysis-timeline");
	const coocSel = $("#analysis-cooccurrence");
	const retrievalSel = $("#analysis-retrieval");

	// set placeholders so UI "feels alive"
	timelineSel && (timelineSel.innerHTML = "<p>Loading timeline…</p>");
	coocSel && (coocSel.innerHTML = "<p>Loading co-occurrence…</p>");
	retrievalSel && (retrievalSel.innerHTML = "<p>Ready for search.</p>");

	try {
		// timeline
		const t = await httpJSON(`/api/analysis/timeline?project=${encodeURIComponent(state.projectId)}`);
		state.analysis.timeline = Array.isArray(t?.timeline) ? t.timeline : [];
		renderTimeline(state.analysis.timeline);

		// co-occurrence
		const g = await httpJSON(`/api/analysis/cooccurrence?project=${encodeURIComponent(state.projectId)}`);
		state.analysis.graph = { nodes: g.nodes || [], links: g.links || [] };
		renderCooccurrence(state.analysis.graph);
	} catch (e) {
		console.error(e);
		timelineSel && (timelineSel.innerHTML = "<p>Timeline unavailable.</p>");
		coocSel && (coocSel.innerHTML = "<p>Co-occurrence unavailable.</p>");
	}
}

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

function renderCooccurrence(graph) {
	const wrap = $("#analysis-cooccurrence");
	if (!wrap) return;

	const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
	const links = Array.isArray(graph.links) ? graph.links : [];

	if (!links.length) {
		wrap.innerHTML = "<p>No co-occurrences yet.</p>";
		return;
	}

	const map = new Map(nodes.map(n => [n.id, n.label || n.name || n.id]));
	const rows = links.map(l => `
		<tr>
			<td>${escapeHtml(map.get(l.source) || String(l.source))}</td>
			<td>${escapeHtml(map.get(l.target) || String(l.target))}</td>
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
async function init() {
	const url = new URL(location.href);
	state.projectId = url.searchParams.get("project") || url.searchParams.get("id") || "";

	if (!state.projectId) {
		flash("No project id in URL. Some features disabled.");
		return;
	}

	// Tabs (1)
	setupTabs();

	// New entry wiring (2)
	setupNewEntryWiring();

	// Add Code wiring (3)
	setupAddCodeWiring();

	// Load everything once (4 ensures memos/analysis feel alive on page load)
	await Promise.allSettled([
		loadEntries(),
		loadCodes(),
		loadMemos(),
		loadAnalysis()
	]);

	// Set default visible tab content
	switchTab("journal");
}

document.addEventListener("DOMContentLoaded", init);
