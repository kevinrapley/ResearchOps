/**
 * @file components/journal-excerpts.js
 * @summary Fetch + render Reflexive Journal entries.
 * @description
 * - Renders immediately if the "Journal entries" tab is the active tab on load.
 * - Also listens for `tab:shown` and renders when the journal tab is shown.
 * - Safe on Safari/iPad (no CSS.escape).
 */

const state = {
	hasRendered: false,
	projectId: null,
	entries: [],
};

/* -------------------- small helpers -------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function getParam(name) {
	const u = new URL(location.href);
	return u.searchParams.get(name) || u.searchParams.get("project") || "";
}

function formatDate(iso) {
	try {
		const d = new Date(iso);
		// UK-ish, keep short but readable
		return d.toLocaleString(undefined, {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return iso || "";
	}
}

function activeTabId(tabsEl) {
	// Prefer the selected <li>, fall back to #hash or first link
	const sel = tabsEl?.querySelector(".govuk-tabs__list-item--selected .govuk-tabs__tab");
	if (sel) return (sel.getAttribute("href") || "#").slice(1);
	if (location.hash) return location.hash.slice(1);
	const first = tabsEl?.querySelector(".govuk-tabs__tab");
	return first ? (first.getAttribute("href") || "#").slice(1) : "";
}

/* -------------------- rendering -------------------- */
function renderEntries(entries) {
	const container = $("#entries-container");
	if (!container) return;

	container.innerHTML = "";

	if (!entries || !entries.length) {
		const empty = $("#empty-journal");
		if (empty) empty.hidden = false;
		return;
	}

	for (const e of entries) {
		const card = document.createElement("article");
		card.className = "entry-card";
		card.dataset.category = e.category || "uncategorised";

		// header
		const header = document.createElement("div");
		header.className = "entry-header";

		const meta = document.createElement("div");
		meta.className = "entry-meta";

		const cat = document.createElement("span");
		cat.className = "entry-category-badge";
		cat.dataset.category = e.category || "uncategorised";
		cat.textContent = (e.category || "").toLowerCase();

		const ts = document.createElement("span");
		ts.className = "entry-timestamp";
		ts.textContent = formatDate(e.createdAt);

		meta.appendChild(cat);
		meta.appendChild(ts);

		const actions = document.createElement("div");
		actions.className = "entry-actions";
		// Add buttons only if you wire them later
		const del = document.createElement("button");
		del.type = "button";
		del.className = "govuk-button govuk-button--warning govuk-button--secondary";
		del.textContent = "Delete";
		del.addEventListener("click", () => {
			document.dispatchEvent(new CustomEvent("journal:entry:delete", { detail: { id: e.id } }));
		});
		actions.appendChild(del);

		header.appendChild(meta);
		header.appendChild(actions);

		// content
		const content = document.createElement("div");
		content.className = "entry-content";
		content.textContent = e.content || "";

		// tags
		const tags = document.createElement("div");
		tags.className = "entry-tags";
		if (Array.isArray(e.tags) && e.tags.length) {
			for (const t of e.tags) {
				const chip = document.createElement("span");
				chip.className = "filter-chip";
				chip.textContent = t;
				tags.appendChild(chip);
			}
		}

		card.appendChild(header);
		card.appendChild(content);
		card.appendChild(tags);

		container.appendChild(card);
	}

	const empty = $("#empty-journal");
	if (empty) empty.hidden = true;
}

/* -------------------- data -------------------- */
async function loadEntries(projectId) {
	const url = `/api/journal-entries?project=${encodeURIComponent(projectId)}`;
	console.debug("[journal] fetch", url);
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!js || js.ok !== true || !Array.isArray(js.entries)) {
		console.warn("[journal] bad response", js);
		return [];
	}
	return js.entries;
}

/* -------------------- activation logic -------------------- */
async function ensureRendered() {
	if (state.hasRendered) return;

	// guard: ensure the panel is visible; unhide defensively
	const panel = document.getElementById("journal-entries");
	if (panel) {
		panel.classList.remove("govuk-tabs__panel--hidden");
		panel.removeAttribute("hidden");
	}

	try {
		state.entries = await loadEntries(state.projectId);
		renderEntries(state.entries);
		state.hasRendered = true;
		console.debug("[journal] rendered", state.entries.length);
	} catch (err) {
		console.error("[journal] failed to render", err);
	}
}

function setup() {
	state.projectId = getParam("id") || getParam("project") || "";
	if (!state.projectId) {
		console.warn("[journal] no project id");
	}

	const tabs = document.getElementById("journals-tabs");

	// Render immediately if the Journal tab is the current tab on load
	const current = activeTabId(tabs);
	if (current === "journal-entries") {
		// Run after current tick to let tabs.js finish toggling
		setTimeout(ensureRendered, 0);
	}

	// Also render on first time the journal tab becomes visible
	document.addEventListener("tab:shown", (e) => {
		if (e?.detail?.id === "journal-entries") ensureRendered();
	});
}

/* -------------------- bootstrap -------------------- */
document.addEventListener("DOMContentLoaded", setup);
