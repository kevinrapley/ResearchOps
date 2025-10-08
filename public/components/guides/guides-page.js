/**
 * @file guides-page.js
 * @module GuidesPage
 * @summary Discussion Guides hub (list + editor bootstrap).
 *
 * @description
 * - Wires header actions (+ New, Import, Export) with delegated fallbacks.
 * - Loads project/study context for breadcrumbs & editor rendering.
 * - Opens a robust editor panel that shows even if optional imports fail.
 * - Provides Mustache syntax highlighting in the source editor.
 *
 * @requires /lib/mustache.min.js
 * @requires /lib/marked.min.js
 * @requires /lib/purify.min.js
 */

import Mustache from "/lib/mustache.min.js";
import { marked } from "/lib/marked.min.js";
import DOMPurify from "/lib/purify.min.js";

import { buildContext } from "/components/guides/context.js";
import { renderGuide, buildPartials, DEFAULT_SOURCE } from "/components/guides/guide-editor.js";
import { searchPatterns, listStarterPatterns } from "/components/guides/patterns.js";

/** qS helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* -------------------- boot -------------------- */
window.addEventListener("DOMContentLoaded", () => {
	wireGlobalActions();
	wireEditor();

	const url = new URL(location.href);
	const pid = url.searchParams.get("pid");
	const sid = url.searchParams.get("sid");

	hydrateCrumbs({ pid, sid }).catch(console.warn);
	loadGuides(sid, { autoOpen: true }).catch(console.warn);
	refreshPatternList().catch(console.warn);
});

/**
 * Load all studies for a project (mirrors Study page behaviour).
 * @param {string} projectId Airtable project record id
 * @returns {Promise<Array<Object>>} studies
 * @throws {Error} when API contract fails
 */
async function loadStudies(projectId) {
	const url = "/api/studies?project=" + encodeURIComponent(projectId);
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js == null || js.ok !== true || !Array.isArray(js.studies)) {
		throw new Error((js && js.error) || ("Studies fetch failed (" + res.status + ")"));
	}
	return js.studies;
}

/**
 * Prefer a real title; otherwise compute "Method — YYYY-MM-DD".
 * @param {{ title?:string, Title?:string, method?:string, createdAt?:string }} s
 */
function pickTitle(s) {
	s = s || {};
	var t = (s.title || s.Title || "").trim();
	if (t) return t;
	var method = (s.method || "Study").trim();
	var d = s.createdAt ? new Date(s.createdAt) : new Date();
	var yyyy = d.getUTCFullYear();
	var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	var dd = String(d.getUTCDate()).padStart(2, "0");
	return method + " — " + yyyy + "-" + mm + "-" + dd;
}

/**
 * Hydrate breadcrumbs, header subtitle, and guide context.
 * @param {{ pid: string, sid: string }} params
 */
async function hydrateCrumbs({ pid, sid }) {
	try {
		const [projectsRes, studiesRes] = await Promise.all([
			fetch(`/api/projects`, { cache: "no-store" }),
			loadStudies(pid)
		]);

		const projects = projectsRes.ok ? (await projectsRes.json()).projects || [] : [];
		const project = projects.find(p => p.id === pid) || { name: "(Unnamed project)" };

		const studyRaw = Array.isArray(studiesRes) ?
			(studiesRes.find(s => s.id === sid) || {}) : {};

		const study = ensureStudyTitle(studyRaw);

		const bcProj = document.getElementById("breadcrumb-project");
		if (bcProj) {
			bcProj.href = `/pages/project-dashboard/?id=${encodeURIComponent(pid)}`;
			bcProj.textContent = project.name || "Project";
		}

		const bcStudy = document.getElementById("breadcrumb-study");
		if (bcStudy) {
			bcStudy.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
			bcStudy.textContent = study.title;
		}

		const sub = document.querySelector('[data-bind="study.title"]');
		if (sub) sub.textContent = study.title;

		const back = document.getElementById("back-to-study");
		if (back) back.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;

		document.title = `Discussion Guides — ${study.title}`;

		window.__guideCtx = {
			project: {
				id: project.id,
				name: project.name || "(Unnamed project)"
			},
			study
		};
	} catch (err) {
		console.warn("Crumb hydrate failed", err);
		window.__guideCtx = { project: { name: "(Unnamed project)" }, study: {} };
	}
}

/**
 * Render list of guides for a study. Optionally auto-open newest once.
 * @param {string} studyId
 * @param {{autoOpen?: boolean}} [opts]
 */
async function loadGuides(studyId, opts = {}) {
	const tbody = $("#guides-tbody");
	if (!tbody || !studyId) return;

	let newestId = null;

	try {
		const res = await fetch(`/api/guides?study=${encodeURIComponent(studyId)}`, { cache: "no-store" });
		const { guides = [] } = res.ok ? await res.json() : { guides: [] };

		guides.sort((a, b) => (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0));
		newestId = guides[0]?.id || null;

		if (!guides.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="muted">No guides yet. Create one to get started.</td></tr>`;
		} else {
			tbody.innerHTML = "";
			for (const g of guides) {
				const tr = document.createElement("tr");
				tr.innerHTML = `
          <td>${escapeHtml(g.title || "Untitled")}</td>
          <td>${escapeHtml(g.status || "draft")}</td>
          <td>v${g.version || 0}</td>
          <td>${new Date(g.updatedAt || g.createdAt).toLocaleString()}</td>
          <td>${escapeHtml(g.createdBy?.name || "—")}</td>
          <td><button class="link-like" data-open="${g.id}">Open</button></td>`;
				tbody.appendChild(tr);
			}
			$$('button[data-open]').forEach(b => b.addEventListener("click", () => {
				window.__hasAutoOpened = true;
				openGuide(b.dataset.open);
			}));
		}

		if (opts.autoOpen && !window.__hasAutoOpened && !window.__openGuideId && newestId) {
			window.__hasAutoOpened = true;
			await openGuide(newestId);
		}
	} catch (e) {
		console.warn(e);
		tbody.innerHTML = `<tr><td colspan="6">Failed to load guides.</td></tr>`;
	}
}

/* -------------------- global actions -------------------- */
function wireGlobalActions() {
	var newBtn = $("#btn-new");
	if (newBtn) newBtn.addEventListener("click", onNewClick);

	var importBtn = $("#btn-import");
	if (importBtn) importBtn.addEventListener("click", importMarkdownFlow);

	document.addEventListener("click", function(e) {
		var t = e.target;
		var hasClosest = t && typeof t.closest === "function";
		var newBtn2 = hasClosest ? t.closest("#btn-new") : null;
		if (newBtn2) {
			e.preventDefault();
			onNewClick(e);
			return;
		}

		var exportMenu = $("#export-menu");
		var menu = exportMenu ? exportMenu.closest(".menu") : null;
		if (menu && (!hasClosest || !menu.contains(t))) {
			menu.removeAttribute("aria-expanded");
		}
	});

	var exportBtn = $("#btn-export");
	if (exportBtn) {
		exportBtn.addEventListener("click", function() {
			var exportMenu = $("#export-menu");
			var menu = exportMenu ? exportMenu.closest(".menu") : null;
			if (!menu) return;
			var expanded = menu.getAttribute("aria-expanded") === "true";
			menu.setAttribute("aria-expanded", expanded ? "false" : "true");
		});
	}

	var exportMenuEl = $("#export-menu");
	if (exportMenuEl) {
		exportMenuEl.addEventListener("click", function(e) {
			var t = e.target;
			var hasClosest = t && typeof t.closest === "function";
			var target = hasClosest ? t.closest("[data-export]") : null;
			if (target) doExport(target.getAttribute("data-export"));
		});
	}
}

function onNewClick(e) {
	if (e && typeof e.preventDefault === "function") e.preventDefault();
	startNewGuide();
}

async function refreshPatternList() {
	try {
		const res = await fetch("/api/partials", { cache: "no-store" });
		if (!res.ok) {
			console.warn("Failed to fetch partials:", res.status);
			populatePatternList([]);
			return;
		}

		const data = await res.json();
		const partials = data.partials || [];

		console.log("Loaded partials:", partials.length);
		populatePatternList(partials);
	} catch (err) {
		console.error("Error refreshing pattern list:", err);
		populatePatternList([]);
	}
}

/* -------------------- syntax highlighting -------------------- */

/**
 * Highlight Mustache and Markdown syntax in the source editor.
 * @param {string} source
 * @returns {string} Highlighted HTML
 */
function highlightMustache(source) {
	if (!source) return '';

	// Escape HTML first
	let highlighted = source
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// Track Mustache tag positions to avoid highlighting markdown inside them
	const mustacheTags = [];
	const tagPattern = /\{\{[^}]*\}\}/g;
	let match;
	while ((match = tagPattern.exec(source)) !== null) {
		mustacheTags.push({ start: match.index, end: match.index + match[0].length });
	}

	// Helper to check if position is inside a Mustache tag
	function isInsideMustache(pos) {
		return mustacheTags.some(tag => pos >= tag.start && pos < tag.end);
	}

	// Highlight Mustache tags FIRST (order matters!)
	highlighted = highlighted
		// Comments: {{! comment}}
		.replace(/(\{\{!)([^}]*?)(\}\})/g,
			'<span class="token comment">$1$2$3</span>')
		// Partials: {{> partial_name}}
		.replace(/(\{\{&gt;)\s*([^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">{{&gt;</span><span class="token keyword">$2</span><span class="token mustache-tag">}}</span></span>')
		// Section start: {{#section}}
		.replace(/(\{\{)(#[^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>')
		// Section end: {{/section}}
		.replace(/(\{\{)(\/[^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>')
		// Variables: {{variable}}
		.replace(/(\{\{)([^}#\/!&gt;]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1</span><span class="token mustache-variable">$2</span><span class="token mustache-tag">$3</span></span>');

	// Now apply Markdown highlighting OUTSIDE of Mustache tags
	// Use a more specific regex that avoids matching inside <span> tags
	highlighted = highlighted
		// Headers (only at line start)
		.replace(/^(#{1,6})\s+(.+)$/gm,
			'<span class="token title">$1 $2</span>')
		// Bold: **text** or __text__ (but not inside spans)
		.replace(/(\*\*|__)(?=\S)([^*_<]+?)(?<=\S)\1/g,
			'<span class="token bold">$1$2$1</span>')
		// Inline code: `code` (but not inside spans)
		.replace(/(`+)([^`<]+?)\1/g,
			'<span class="token code">$1$2$1</span>');

	return highlighted;
}

/**
 * Sync highlighting with textarea content.
 */
function syncHighlighting() {
	const textarea = document.getElementById('guide-source');
	const codeElement = document.getElementById('guide-source-code');

	if (!textarea || !codeElement) return;

	const source = textarea.value;
	codeElement.innerHTML = highlightMustache(source);

	// Sync scroll position
	const highlightContainer = document.getElementById('guide-source-highlight');
	if (highlightContainer) {
		highlightContainer.scrollTop = textarea.scrollTop;
		highlightContainer.scrollLeft = textarea.scrollLeft;
	}
}

/* -------------------- editor -------------------- */
function wireEditor() {
	var insertPat = $("#btn-insert-pattern");
	if (insertPat) insertPat.addEventListener("click", openPatternDrawer);

	var patClose = $("#drawer-patterns-close");
	if (patClose) patClose.addEventListener("click", closePatternDrawer);

	var patSearch = $("#pattern-search");
	if (patSearch) patSearch.addEventListener("input", onPatternSearch);

	var varsBtn = $("#btn-variables");
	if (varsBtn) varsBtn.addEventListener("click", openVariablesDrawer);

	var varsClose = $("#drawer-variables-close");
	if (varsClose) varsClose.addEventListener("click", closeVariablesDrawer);

	var src = $("#guide-source");
	if (src) {
		// Sync highlighting and preview on input
		src.addEventListener("input", debounce(function() {
			syncHighlighting();
			preview();
		}, 150));

		// CRITICAL: Sync scroll perfectly in both directions
		src.addEventListener("scroll", function(e) {
			const highlight = $("#guide-source-highlight");
			if (highlight) {
				// Force exact scroll position sync
				highlight.scrollTop = src.scrollTop;
				highlight.scrollLeft = src.scrollLeft;
			}
		}, { passive: true });

		// Initial highlighting
		setTimeout(syncHighlighting, 100);
	}

	var title = $("#guide-title");
	if (title) title.addEventListener("input", debounce(function() { announce("Title updated"); }, 400));

	var tagBtn = $("#btn-insert-tag");
	if (tagBtn) tagBtn.addEventListener("click", onInsertTag);

	var saveBtn = $("#btn-save");
	if (saveBtn) saveBtn.addEventListener("click", onSave);

	var pubBtn = $("#btn-publish");
	if (pubBtn) pubBtn.addEventListener("click", onPublish);

	document.addEventListener("keydown", function(e) {
		var k = e && e.key ? e.key.toLowerCase() : "";
		if ((e.metaKey || e.ctrlKey) && k === "s") {
			e.preventDefault();
			onSave();
		}
	});
}

async function startNewGuide() {
	try {
		var editor = $("#editor-section");
		if (editor) editor.classList.remove("is-hidden");

		window.__openGuideId = undefined;

		var titleEl = $("#guide-title");
		if (titleEl) titleEl.value = "Untitled guide";

		var statusEl = $("#guide-status");
		if (statusEl) statusEl.textContent = "draft";

		var defaultSrc = (typeof DEFAULT_SOURCE === "string" && DEFAULT_SOURCE.trim()) ?
			DEFAULT_SOURCE.trim() :
			"---\nversion: 1\n---\n# New guide\n\nWelcome. Start writing…";

		var srcEl = $("#guide-source");
		if (srcEl) srcEl.value = defaultSrc;

		// ✅ Trigger highlighting
		syncHighlighting();

		try {
			await refreshPatternList();
		} catch (err) {
			console.warn("Pattern list failed:", err);
		}

		try { populateVariablesForm({}); } catch (err) { console.warn("Variables form failed:", err); }
		try { await preview(); } catch (err) { console.warn("Preview failed:", err); }

		if (titleEl) titleEl.focus();
		announce("Started a new guide");
	} catch (err) {
		console.error("startNewGuide fatal:", err);
		announce("Could not start a new guide");
	}
}

async function openGuide(id) {
	try {
		let guide = null;

		const res = await fetch(`/api/guides/${encodeURIComponent(id)}`, { cache: "no-store" });
		if (res.ok) {
			const js = await res.json().catch(() => ({}));
			guide = js && (js.guide || js);
		} else if (res.status !== 404) {
			const txt = await res.text().catch(() => "");
			throw new Error(`GET /api/guides/${id} ${res.status}: ${txt}`);
		}

		if (!guide) {
			const sid = (window.__guideCtx && window.__guideCtx.study && window.__guideCtx.study.id) || "";
			if (!sid) throw new Error("No study id available in context for fallback.");
			const r2 = await fetch(`/api/guides?study=${encodeURIComponent(sid)}`, { cache: "no-store" });
			if (!r2.ok) {
				const t = await r2.text().catch(() => "");
				throw new Error(`GET /api/guides?study=… ${r2.status}: ${t}`);
			}
			const { guides = [] } = await r2.json().catch(() => ({}));
			guide = guides.find(g => g.id === id) || null;
		}

		if (!guide) throw new Error("Guide not found");

		window.__openGuideId = guide.id;
		$("#editor-section")?.classList.remove("is-hidden");
		$("#guide-title") && ($("#guide-title").value = guide.title || "Untitled");
		$("#guide-status") && ($("#guide-status").textContent = guide.status || "draft");
		$("#guide-source") && ($("#guide-source").value = guide.sourceMarkdown || "");

		// ✅ Trigger highlighting
		syncHighlighting();

		await refreshPatternList();

		populateVariablesForm(guide.variables || {});
		await preview();
		announce(`Opened guide "${guide.title || "Untitled"}"`);
	} catch (e) {
		console.warn(e);
		announce(`Failed to open guide: ${e && e.message ? e.message : "Unknown error"}`);
	}
}

async function preview() {
	var srcEl = $("#guide-source");
	if (!srcEl) return;

	var source = srcEl.value || "";
	var ctx = window.__guideCtx || {};
	var project = ensureProjectName(ctx.project || {});
	var study = ensureStudyTitle(ctx.study || {});

	var fm = readFrontMatter(source);
	var meta = clonePlainObject((fm && fm.meta) || {});
	delete meta.project;
	delete meta.study;
	delete meta.session;
	delete meta.participant;

	var context = { project: project, study: study, session: {}, participant: {}, meta: meta };

	var names = collectPartialNames(source);
	var partials = {};
	try { partials = await buildPartials(names); } catch (e) {}

	var out = await renderGuide({ source: source, context: context, partials: partials });

	var prev = $("#guide-preview");
	if (prev) prev.innerHTML = out.html;

	runLints({ source: source, context: context, partials: partials });
}

async function onSave() {
	const title = ($("#guide-title")?.value || "").trim() || "Untitled guide";
	const source = $("#guide-source")?.value || "";
	const fm = readFrontMatter(source);
	const variables = fm.meta || {};

	const studyId = (window.__guideCtx && window.__guideCtx.study && window.__guideCtx.study.id) || "";
	const id = window.__openGuideId;

	const body = id ? { title, sourceMarkdown: source, variables } : { study_airtable_id: studyId, title, sourceMarkdown: source, variables };

	const method = id ? "PATCH" : "POST";
	const url = id ? `/api/guides/${encodeURIComponent(id)}` : `/api/guides`;

	const res = await fetch(url, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body)
	});

	const js = await res.json().catch(() => ({}));

	if (res.ok) {
		if (!id && js && js.id) {
			window.__openGuideId = js.id;
		}
		announce("Guide saved");
		loadGuides(studyId);
	} else {
		announce(`Save failed: ${res.status} ${JSON.stringify(js)}`);
	}
}

async function onPublish() {
	const id = window.__openGuideId;
	const sid = window.__guideCtx?.study?.id;
	const title = ($("#guide-title")?.value || "").trim();
	if (!id || !sid) { announce("Save the guide before publishing."); return; }

	const url = `/api/guides/${encodeURIComponent(id)}/publish`;
	const res = await fetch(url, { method: "POST" });

	if (res.ok) {
		$("#guide-status").textContent = "published";
		announce(`Published "${title || "Untitled"}"`);
		loadGuides(sid);
	} else {
		const msg = await res.text().catch(() => "");
		announce(`Publish failed: ${res.status} ${msg || ""}`.trim());
	}
}

function importMarkdownFlow() {
	const inp = document.createElement("input");
	inp.type = "file";
	inp.accept = ".md,text/markdown";
	inp.addEventListener("change", async function() {
		const file = inp.files && inp.files[0];
		if (!file) return;
		const text = await file.text();
		await startNewGuide();
		var srcEl = $("#guide-source");
		if (srcEl) srcEl.value = text;
		syncHighlighting();
		await preview();
	});
	inp.click();
}

/* -------------------- drawers: patterns -------------------- */
function openPatternDrawer() {
	var d = $("#drawer-patterns");
	if (d) d.hidden = false;
	var s = $("#pattern-search");
	if (s) s.focus();
	announce("Pattern drawer opened");
}

function closePatternDrawer() {
	var d = $("#drawer-patterns");
	if (d) d.hidden = true;
	var b = $("#btn-insert-pattern");
	if (b) b.focus();
	announce("Pattern drawer closed");
}

function populatePatternList(items) {
	const ul = $("#pattern-list");
	if (!ul) return;
	ul.innerHTML = "";

	const arr = Array.isArray(items) ? items : [];

	const grouped = {};
	for (const p of arr) {
		const cat = p.category || "Uncategorised";
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(p);
	}

	for (const [cat, patterns] of Object.entries(grouped)) {
		const header = document.createElement("li");
		header.className = "pattern-category-header";
		header.innerHTML = `<strong>${escapeHtml(cat)}</strong>`;
		ul.appendChild(header);

		for (const p of patterns) {
			const li = document.createElement("li");
			li.className = "pattern-item";

			const insertName = `${p.name}_v${p.version}`;

			li.innerHTML = `
				<div class="pattern-item__content">
					<button class="btn btn--secondary btn--small" data-insert="${escapeHtml(insertName)}">
						Insert
					</button>
					<span class="pattern-item__title">${escapeHtml(p.title)}</span>
					<span class="pattern-item__meta muted">v${p.version}</span>
				</div>
				<div class="pattern-item__actions">
					<button class="link-like" data-view="${p.id}">View</button>
					<button class="link-like" data-edit="${p.id}">Edit</button>
					<button class="link-like" data-delete="${p.id}">Delete</button>
				</div>
			`;
			ul.appendChild(li);
		}
	}

	const addLi = document.createElement("li");
	addLi.innerHTML = `<button class="btn btn--primary" id="btn-new-pattern">+ New pattern</button>`;
	ul.appendChild(addLi);

	ul.addEventListener("click", handlePatternClick);
}

async function handlePatternClick(e) {
	const t = e.target;

	if (t.dataset.insert) {
		const name = t.dataset.insert;
		insertAtCursor($("#guide-source"), `\n{{> ${name}}}\n`);
		syncHighlighting();
		await preview();
		closePatternDrawer();
		announce(`Pattern ${name} inserted`);
		return;
	}

	if (t.dataset.view) {
		await viewPartial(t.dataset.view);
		return;
	}

	if (t.dataset.edit) {
		await editPartial(t.dataset.edit);
		return;
	}

	if (t.dataset.delete) {
		await deletePartial(t.dataset.delete);
		return;
	}

	if (t.id === "btn-new-pattern") {
		await createNewPartial();
		return;
	}
}

async function viewPartial(id) {
	try {
		const res = await fetch(`/api/partials/${encodeURIComponent(id)}`, {
			cache: "no-store"
		});

		if (!res.ok) {
			const error = await res.text();
			console.error("Failed to load partial:", res.status, error);
			announce(`Failed to load partial: ${res.status}`);
			return;
		}

		const data = await res.json();

		if (!data.ok || !data.partial) {
			console.error("Invalid response:", data);
			announce("Failed to load partial: Invalid response");
			return;
		}

		const { partial } = data;

		const modal = document.createElement("dialog");
		modal.className = "modal";
		modal.innerHTML = `
			<h2 class="govuk-heading-m">${escapeHtml(partial.title)}</h2>
			<dl class="govuk-summary-list">
				<div class="govuk-summary-list__row">
					<dt class="govuk-summary-list__key">Name:</dt>
					<dd class="govuk-summary-list__value"><code>${escapeHtml(partial.name)}_v${partial.version}</code></dd>
				</div>
				<div class="govuk-summary-list__row">
					<dt class="govuk-summary-list__key">Category:</dt>
					<dd class="govuk-summary-list__value">${escapeHtml(partial.category)}</dd>
				</div>
				<div class="govuk-summary-list__row">
					<dt class="govuk-summary-list__key">Status:</dt>
					<dd class="govuk-summary-list__value">${escapeHtml(partial.status)}</dd>
				</div>
			</dl>
			<h3 class="govuk-heading-s">Source</h3>
			<pre class="code code--readonly">${escapeHtml(partial.source)}</pre>
			${partial.description ? `<h3 class="govuk-heading-s">Description</h3><p>${escapeHtml(partial.description)}</p>` : ""}
			<div class="modal-actions">
				<button class="btn btn--secondary" data-close>Close</button>
				<button class="btn" data-edit="${escapeHtml(id)}">Edit</button>
			</div>
		`;

		document.body.appendChild(modal);
		modal.showModal();

		modal.addEventListener("click", async (e) => {
			if (e.target.dataset.close || e.target === modal) {
				modal.close();
				modal.remove();
			}
			if (e.target.dataset.edit) {
				modal.close();
				modal.remove();
				await editPartial(e.target.dataset.edit);
			}
		});
	} catch (err) {
		console.error("Error in viewPartial:", err);
		announce("Failed to load partial: " + err.message);
	}
}

async function editPartial(id) {
	try {
		const url = `/api/partials/${encodeURIComponent(id)}`;
		const res = await fetch(url, {
			cache: "no-store",
			headers: { "Accept": "application/json" }
		});

		const text = await res.text();

		if (!res.ok) {
			announce(`Failed to load partial: ${res.status}`);
			console.error("Error response:", text);
			return;
		}

		let data;
		try {
			data = JSON.parse(text);
		} catch (e) {
			announce("Failed to load partial: Invalid JSON");
			console.error("JSON parse error:", e);
			return;
		}

		if (!data.ok || !data.partial) {
			announce("Failed to load partial: Invalid response");
			console.error("Missing ok or partial:", data);
			return;
		}

		const { partial } = data;

		const modal = document.createElement("dialog");
		modal.className = "modal";
		modal.innerHTML = `
			<h2 class="govuk-heading-m">Edit: ${escapeHtml(partial.title)}</h2>
			<form id="partial-edit-form">
				<div class="govuk-form-group">
					<label class="govuk-label" for="partial-title">Title</label>
					<input class="govuk-input" id="partial-title" value="${escapeHtml(partial.title)}" required />
				</div>
				<div class="govuk-form-group">
					<label class="govuk-label" for="partial-category">Category</label>
					<input class="govuk-input" id="partial-category" value="${escapeHtml(partial.category)}" />
				</div>
				<div class="govuk-form-group">
					<label class="govuk-label" for="partial-source">Source (Mustache)</label>
					<textarea class="code" id="partial-source" rows="15" required>${escapeHtml(partial.source)}</textarea>
				</div>
				<div class="govuk-form-group">
					<label class="govuk-label" for="partial-description">Description</label>
					<textarea class="govuk-textarea" id="partial-description" rows="3">${escapeHtml(partial.description || '')}</textarea>
				</div>
				<div class="modal-actions">
					<button type="button" class="btn btn--secondary" data-cancel>Cancel</button>
					<button type="submit" class="btn">Save changes</button>
				</div>
			</form>
		`;

		document.body.appendChild(modal);
		modal.showModal();

		const form = modal.querySelector("#partial-edit-form");
		form.addEventListener("submit", async (e) => {
			e.preventDefault();

			const update = {
				title: document.getElementById("partial-title").value,
				category: document.getElementById("partial-category").value,
				source: document.getElementById("partial-source").value,
				description: document.getElementById("partial-description").value
			};

			const updateRes = await fetch(`/api/partials/${encodeURIComponent(id)}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				body: JSON.stringify(update)
			});

			if (updateRes.ok) {
				announce("Partial updated");
				modal.close();
				modal.remove();
				await refreshPatternList();
			} else {
				const errorText = await updateRes.text();
				console.error("Update failed:", errorText);
				announce(`Update failed: ${updateRes.status}`);
			}
		});

		modal.querySelector("[data-cancel]").addEventListener("click", () => {
			modal.close();
			modal.remove();
		});

		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				modal.close();
				modal.remove();
			}
		});

	} catch (err) {
		console.error("Error in editPartial:", err);
		announce("Failed to load partial: " + err.message);
	}
}

async function deletePartial(id) {
	if (!confirm("Are you sure you want to delete this pattern? This action cannot be undone.")) {
		return;
	}

	const res = await fetch(`/api/partials/${encodeURIComponent(id)}`, { method: "DELETE" });

	if (res.ok) {
		announce("Pattern deleted");
		await refreshPatternList();
	} else {
		announce("Delete failed");
	}
}

async function createNewPartial() {
	const modal = document.createElement("dialog");
	modal.className = "modal";
	modal.innerHTML = `
		<h2 class="govuk-heading-m">Create new pattern</h2>
		<form id="partial-create-form">
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-name">Name (no spaces)</label>
				<input class="govuk-input" id="new-partial-name" placeholder="task_consent" required />
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-title">Title</label>
				<input class="govuk-input" id="new-partial-title" placeholder="Consent task introduction" required />
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-category">Category</label>
				<select class="govuk-select" id="new-partial-category">
					<option>Consent</option>
					<option>Tasks</option>
					<option>Questions</option>
					<option>Debrief</option>
					<option>Notes</option>
					<option>Other</option>
				</select>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-source">Source (Mustache)</label>
				<textarea class="code" id="new-partial-source" rows="15" required>## {{title}}

Write your template here...</textarea>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-description">Description</label>
				<textarea class="govuk-textarea" id="new-partial-description" rows="3"></textarea>
			</div>
			<div class="modal-actions">
				<button type="button" class="btn btn--secondary" data-cancel>Cancel</button>
				<button type="submit" class="btn">Create pattern</button>
			</div>
		</form>
	`;

	document.body.appendChild(modal);
	modal.showModal();

	const form = modal.querySelector("#partial-create-form");
	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const newPartial = {
			name: document.getElementById("new-partial-name").value.replace(/\s+/g, "_").toLowerCase(),
			title: document.getElementById("new-partial-title").value,
			category: document.getElementById("new-partial-category").value,
			source: document.getElementById("new-partial-source").value,
			description: document.getElementById("new-partial-description").value,
			version: 1,
			status: "draft"
		};

		const res = await fetch("/api/partials", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(newPartial)
		});

		if (res.ok) {
			announce("Pattern created");
			modal.close();
			modal.remove();
			await refreshPatternList();
		} else {
			const err = await res.json().catch(() => ({}));
			announce(`Create failed: ${err.error || "Unknown error"}`);
		}
	});

	modal.querySelector("[data-cancel]").addEventListener("click", () => {
		modal.close();
		modal.remove();
	});

	modal.addEventListener("click", (e) => {
		if (e.target === modal) {
			modal.close();
			modal.remove();
		}
	});
}

async function onPatternSearch(e) {
	const q = (e?.target?.value || "").trim().toLowerCase();

	if (!q) {
		await refreshPatternList();
		return;
	}

	try {
		const res = await fetch("/api/partials", { cache: "no-store" });
		if (!res.ok) return;

		const { partials = [] } = await res.json();
		const filtered = partials.filter(p => {
			const searchText = `${p.name} ${p.title} ${p.category}`.toLowerCase();
			return searchText.includes(q);
		});

		populatePatternList(filtered);
	} catch (err) {
		console.error("Pattern search error:", err);
	}
}

/* -------------------- drawers: variables -------------------- */
function openVariablesDrawer() {
	var src = $("#guide-source");
	var text = src ? src.value : "";
	var fm = readFrontMatter(text);
	populateVariablesForm((fm && fm.meta) || {});
	var d = $("#drawer-variables");
	if (d) {
		d.hidden = false;
		d.focus();
	}
}

function closeVariablesDrawer() {
	var d = $("#drawer-variables");
	if (d) d.hidden = true;
	var b = $("#btn-variables");
	if (b) b.focus();
}

function populateVariablesForm(meta) {
	var form = $("#variables-form");
	if (!form) return;
	form.innerHTML = "";
	var entries = Object.entries(meta || {}).slice(0, 40);
	for (var i = 0; i < entries.length; i++) {
		var kv = entries[i];
		var k = kv[0],
			v = kv[1];
		var id = "var-" + k;
		var row = document.createElement("div");
		row.innerHTML =
			'<label for="' + id + '">' + escapeHtml(k) + "</label>" +
			'<input id="' + id + '" class="input" value="' + escapeHtml(String(v)) + '" />';
		form.appendChild(row);
	}
	form.addEventListener("input", debounce(onVarsEdit, 200));
}

function onVarsEdit() {
	var srcEl = $("#guide-source");
	var src = srcEl ? srcEl.value : "";
	var fm = readFrontMatter(src);
	var formVals = {};
	var inputs = $$("#variables-form input");
	for (var i = 0; i < inputs.length; i++) {
		var id = inputs[i].id || "";
		var key = id.replace(/^var-/, "");
		formVals[key] = inputs[i].value;
	}
	var merged = clonePlainObject((fm && fm.meta) || {});
	for (var k in formVals)
		if (Object.prototype.hasOwnProperty.call(formVals, k)) merged[k] = formVals[k];
	var rebuilt = writeFrontMatter(src, merged);
	if (srcEl) srcEl.value = rebuilt;
	preview();
}

/* -------------------- export -------------------- */
async function doExport(kind) {
	const srcEl = $("#guide-source");
	const source = srcEl?.value || "";
	const title = $("#guide-title")?.value || "guide";
	const sanitized = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

	try {
		switch (kind) {
			case "md":
				downloadText(source, `${sanitized}.md`, "text/markdown");
				announce(`Exported ${title}.md`);
				break;

			case "html":
				const preview = $("#guide-preview");
				if (!preview) { announce("Preview not available"); return; }
				const html = buildStandaloneHtml(preview.innerHTML, title);
				downloadText(html, `${sanitized}.html`, "text/html");
				announce(`Exported ${title}.html`);
				break;

			case "pdf":
				if (typeof window.jspdf === "undefined") {
					announce("PDF export not available (library missing)");
					return;
				}
				await exportPdf(title);
				break;

			case "docx":
				if (typeof window.docx === "undefined") {
					announce("DOCX export not available (library missing)");
					return;
				}
				await exportDocx(source, title);
				break;

			default:
				announce("Unknown export format");
		}
	} catch (err) {
		console.error("Export error:", err);
		announce(`Export failed: ${err.message || "Unknown error"}`);
	}
}

function downloadText(content, filename, mimeType) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function buildStandaloneHtml(bodyHtml, title) {
	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(title)}</title>
	<style>
		body { 
			font-family: "GDS Transport", Arial, sans-serif; 
			line-height: 1.5; 
			max-width: 38em; 
			margin: 2em auto; 
			padding: 0 1em;
			color: #0b0c0c;
			}
			
		h1 { font-size: 2em; margin: 1em 0 0.5em; }
		h2 { font-size: 1.5em; margin: 1em 0 0.5em; }
		h3 { font-size: 1.25em; margin: 1em 0 0.5em; }
		p { margin: 0 0 1em; }
		
		code { 
			background: #f3f2f1; 
			padding: 0.125em 0.25em; 
			font-family: monospace; 
			}
			
		pre { 
			background: #f3f2f1; 
			padding: 1em; 
			overflow-x: auto; 
			}
	</style>
</head>
<body>
	<h1>${escapeHtml(title)}</h1>
	${bodyHtml}
</body>
</html>`;
}

async function exportPdf(title) {
	const { jsPDF } = window.jspdf;
	const doc = new jsPDF();

	const preview = $("#guide-preview");
	if (!preview) throw new Error("Preview not available");

	const text = preview.textContent || "";
	doc.text(text, 10, 10);
	doc.save(`${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
	announce(`Exported ${title}.pdf`);
}

async function exportDocx(markdown, title) {
	announce("DOCX export coming soon");
}

/* -------------------- helpers -------------------- */

function ensureStudyTitle(s) {
	s = s || {};
	var explicit = (s.title || s.Title || "").toString().trim();
	var out = clonePlainObject(s);
	if (explicit) { out.title = explicit; return out; }
	var method = (s.method || "Study").trim();
	var d = s.createdAt ? new Date(s.createdAt) : new Date();
	var yyyy = d.getUTCFullYear();
	var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	var dd = String(d.getUTCDate()).padStart(2, "0");
	out.title = method + " — " + yyyy + "-" + mm + "-" + dd;
	return out;
}

function firstText() {
	for (var i = 0; i < arguments.length; i++) {
		var v = arguments[i];
		if (typeof v === "string" && v.trim()) return v.trim();
		if (Array.isArray(v) && v.length && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
	}
	return "";
}

function toLabel(v) {
	if (v == null) return "";
	if (typeof v === "string") return v.trim();
	if (Array.isArray(v)) {
		for (var i = 0; i < v.length; i++) {
			var t = toLabel(v[i]);
			if (t) return t;
		}
		return "";
	}
	if (typeof v === "object") {
		return toLabel(v.name || v.Name || v.label || v.Label || v.value || v.Value || v.text || v.Text);
	}
	return "";
}

function ensureProjectName(p) {
	if (!p || typeof p !== "object") return { name: "(Unnamed project)" };
	const name = (p.name || p.Name || "").toString().trim();
	return { ...p, name: name || "(Unnamed project)" };
}

async function resolveProject(pid, sid) {
	try {
		const r = await fetch("/api/projects", { cache: "no-store" });
		if (r.ok) {
			const js = await r.json().catch(() => ({}));
			const arr = Array.isArray(js) ? js : (Array.isArray(js?.projects) ? js.projects : []);
			if (Array.isArray(arr) && arr.length) {
				const found = arr.find(p => {
					const base = (p && p.project) ? p.project : p;
					const fields = base && base.fields ? base.fields : null;
					const ids = new Set([
						base && base.id, base && base.ID, base && base.Id,
						base && base.LocalId, base && base.localId,
						fields && fields.id, fields && fields.Id, fields && fields.record_id
					].filter(Boolean).map(String));
					return ids.has(String(pid));
				});
				if (found) return ensureProjectName(found);
			}
		}
	} catch (e) {}

	try {
		const r = await fetch("/api/studies?project=" + encodeURIComponent(pid), { cache: "no-store" });
		if (r.ok) {
			const js = await r.json().catch(() => ({}));
			const studies = Array.isArray(js) ? js : (Array.isArray(js?.studies) ? js.studies : []);
			let name = firstText(
				js?.project?.name, js?.project?.Name, js?.projectName
			);
			if (!name && studies.length) {
				const s0 = studies[0];
				name = firstText(
					s0?.project?.name, s0?.project?.Name, s0?.Project,
					(s0?.fields && (s0.fields.Project || s0.fields.ProjectName || s0.fields.Name))
				);
			}
			if (name) return { id: pid, name };
		}
	} catch (e) {}

	return { id: pid, name: "(Unnamed project)" };
}

(async () => {
	const params = new URLSearchParams(location.search);
	const isDebug = /^(1|true|yes)$/i.test(params.get("debug") || "");
	const panel = document.getElementById("debug-panel");
	const out = document.getElementById("debug-output");

	if (!isDebug) return;

	if (panel) panel.hidden = false;
	if (out) out.textContent = "Fetching API data…";

	try {
		const pid = params.get("pid");
		const sid = params.get("sid");

		const [projRes, studyRes] = await Promise.all([
			fetch("/api/projects?cache=no-store").then(r => r.json()).catch(() => ({})),
			fetch(`/api/studies?project=${encodeURIComponent(pid)}`).then(r => r.json()).catch(() => ({}))
		]);

		const payload = {
			params: { pid, sid },
			projectList: projRes,
			studyList: studyRes
		};

		if (out) out.textContent = JSON.stringify(payload, null, 2);
	} catch (err) {
		if (out) out.textContent = "Debug fetch failed:\n" + String(err);
	}
})();

function runLints(args) {
	var source = args.source,
		context = args.context,
		partials = args.partials;
	var out = $("#lint-output");
	if (!out) return;
	var warnings = [];

	var parts = collectPartialNames(source);
	for (var i = 0; i < parts.length; i++) {
		var p = parts[i];
		if (!(p in partials)) warnings.push("Unknown partial: {{> " + p + "}}");
	}

	var tagRegex = /{{\s*([a-z0-9_.]+)\s*}}/gi;
	var m;
	for (;;) {
		m = tagRegex.exec(source);
		if (!m) break;
		var path = m[1].split(".");
		var v = getPath(context, path);
		if (v === undefined || v === null) warnings.push("Missing value for {{" + m[1] + "}}");
	}

	out.textContent = warnings[0] || "No issues";
}

function collectPartialNames(src) {
	var re = /{{>\s*([a-zA-Z0-9_\-]+)\s*}}/g;
	var names = new Set();
	var m;
	for (;;) {
		m = re.exec(src);
		if (!m) break;
		names.add(m[1]);
	}
	return Array.from(names);
}

function readFrontMatter(src) {
	if (!src || src.indexOf("---") !== 0) return { meta: {}, body: src };
	var end = src.indexOf("\n---", 3);
	if (end === -1) return { meta: {}, body: src };
	var yaml = src.slice(3, end).trim();
	var body = src.slice(end + 4);
	var meta = parseYamlLite(yaml);
	return { meta: meta, body: body };
}

function writeFrontMatter(src, meta) {
	var parsed = readFrontMatter(src);
	var body = parsed.body;
	var yaml = emitYamlLite(meta);
	return "---\n" + yaml + "\n---\n" + body.replace(/^\n*/, "");
}

function parseYamlLite(y) {
	var obj = {};
	var lines = (y || "").split("\n");
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!m) continue;
		var val = m[2];
		if (/^\d+$/.test(val)) val = Number(val);
		if (val === "true") val = true;
		if (val === "false") val = false;
		obj[m[1]] = val;
	}
	return obj;
}

function emitYamlLite(o) {
	var out = [];
	for (var k in (o || {})) {
		if (Object.prototype.hasOwnProperty.call(o, k)) {
			out.push(k + ": " + String(o[k]));
		}
	}
	return out.join("\n");
}

function insertAtCursor(textarea, snippet) {
	if (!textarea) return;
	var s = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
	var e = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
	var v = textarea.value;
	textarea.value = v.slice(0, s) + snippet + v.slice(e);
	textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function onInsertTag() {
	var tags = [
		"{{study.title}}", "{{project.name}}", "{{participant.id}}",
		"{{#tasks}}…{{/tasks}}", "{{#study.remote}}…{{/study.remote}}"
	];
	var pick = prompt("Insert tag (example):\n" + tags.join("\n"));
	if (pick) {
		insertAtCursor($("#guide-source"), pick);
		syncHighlighting();
		preview();
	}
}

function debounce(fn, ms) {
	ms = (typeof ms === "number") ? ms : 200;
	var t;
	return function() {
		var args = arguments;
		clearTimeout(t);
		t = setTimeout(function() { fn.apply(null, args); }, ms);
	};
}

function getPath(obj, pathArr) {
	var acc = obj;
	for (var i = 0; i < pathArr.length; i++) {
		var k = pathArr[i];
		if (acc == null) return undefined;
		if (typeof acc !== "object") return undefined;
		if (!(k in acc)) return undefined;
		acc = acc[k];
	}
	return acc;
}

function escapeHtml(s) {
	var str = (s == null ? "" : String(s));
	return str
		.replace(/&/g, "&amp;").replace(/</g, "&lt;")
		.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function clonePlainObject(obj) {
	var out = {};
	if (!obj || typeof obj !== "object") return out;
	for (var key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			out[key] = obj[key];
		}
	}
	return out;
}

function announce(msg) {
	var sr = $("#sr-live");
	if (sr) sr.textContent = msg;
}
