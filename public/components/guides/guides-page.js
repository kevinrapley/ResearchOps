/**
 * @file guides-page.js
 * @module GuidesPage
 * @summary Discussion Guides hub (list + editor bootstrap).
 *
 * @description
 * - Wires header actions (+ New, Import, Export) with delegated fallbacks.
 * - Loads project/study context for breadcrumbs & editor rendering.
 * - Opens a robust editor panel that shows even if optional imports fail.
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
window.addEventListener("DOMContentLoaded", async () => {
	const url = new URL(location.href);
	const pid = url.searchParams.get("pid");
	const sid = url.searchParams.get("sid");

	try { await hydrateCrumbs({ pid, sid }); } catch (e) { console.warn(e); }
	try { await loadGuides(sid); } catch (e) { console.warn(e); }

	wireGlobalActions();
	wireEditor();
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
 * Prefer a real title; otherwise compute “Method — YYYY-MM-DD”.
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
 * Ensures {{study.title}} is safe and never falls back to description.
 */
async function hydrateCrumbs(params) {
	var pid = params && params.pid;
	var sid = params && params.sid;
	try {
		// Studies for locating the current study record
		var studies = await loadStudies(pid);

		// Resolve project.name robustly across shapes
		var project = await resolveProject(pid, sid);

		// Study + title
		var studyRaw = Array.isArray(studies) ? (studies.find(function(s) { return s.id === sid; }) || {}) : {};
		var study = ensureStudyTitle(studyRaw);

		// ── Breadcrumbs
		var bcProj = document.getElementById("breadcrumb-project");
		if (bcProj) {
			bcProj.href = "/pages/project-dashboard/?id=" + encodeURIComponent(pid);
			bcProj.textContent = project.name || "Project";
		}

		var bcStudy = document.getElementById("breadcrumb-study");
		if (bcStudy) {
			bcStudy.href = "/pages/study/?pid=" + encodeURIComponent(pid) + "&sid=" + encodeURIComponent(sid);
			bcStudy.textContent = study.title;
		}

		// Header subtitle + back link
		var sub = document.querySelector('[data-bind="study.title"]');
		if (sub) sub.textContent = study.title;

		var back = document.getElementById("back-to-study");
		if (back) back.href = "/pages/study/?pid=" + encodeURIComponent(pid) + "&sid=" + encodeURIComponent(sid);

		try { document.title = "Discussion Guides — " + study.title; } catch (e) {}

		// Store *normalised* context for the preview
		window.__guideCtx = { project: project, study: study };

	} catch (e) {
		console.warn("Crumb hydrate failed", e);
		window.__guideCtx = { project: { name: "(Unnamed project)" }, study: {} };
	}
}

/**
 * Render list of guides for a study.
 * @param {string} studyId
 */
async function loadGuides(studyId) {
	var tbody = $("#guides-tbody");
	if (!tbody) return;
	try {
		const res = await fetch("/api/guides?study=" + encodeURIComponent(studyId), { cache: "no-store" });
		const list = res.ok ? await res.json() : [];
		if (!Array.isArray(list) || !list.length) {
			tbody.innerHTML = '<tr><td colspan="6" class="muted">No guides yet. Create one to get started.</td></tr>';
			return;
		}
		tbody.innerHTML = "";
		for (var i = 0; i < list.length; i++) {
			var g = list[i];
			var tr = document.createElement("tr");
			tr.innerHTML =
				'<td>' + escapeHtml(g.title || "Untitled") + "</td>" +
				'<td>' + escapeHtml(g.status || "draft") + "</td>" +
				"<td>v" + (g.version || 0) + "</td>" +
				"<td>" + new Date(g.updatedAt || g.createdAt).toLocaleString() + "</td>" +
				'<td>' + escapeHtml((g.createdBy && g.createdBy.name) || "—") + "</td>" +
				'<td><button class="link-like" data-open="' + g.id + '">Open</button></td>';
			tbody.appendChild(tr);
		}
		var openBtns = $$('button[data-open]');
		for (var j = 0; j < openBtns.length; j++) {
			(function(btn) {
				btn.addEventListener("click", function() { openGuide(btn.getAttribute("data-open")); });
			})(openBtns[j]);
		}
	} catch (e) {
		console.warn(e);
		tbody.innerHTML = '<tr><td colspan="6">Failed to load guides.</td></tr>';
	}
}

/* -------------------- global actions -------------------- */
/** Attach top-level UI handlers with null-guards & delegation. */
function wireGlobalActions() {
	var newBtn = $("#btn-new");
	if (newBtn) newBtn.addEventListener("click", onNewClick);

	var importBtn = $("#btn-import");
	if (importBtn) importBtn.addEventListener("click", importMarkdownFlow);

	// Delegated fallback (works if DOM changes later)
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
	if (src) src.addEventListener("input", debounce(preview, 150));

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

/** Open a new guide in the editor — always reveals the panel, even if optional imports fail. */
async function startNewGuide() {
	try {
		var editor = $("#editor-section");
		if (editor) editor.classList.remove("is-hidden");

		// Basic safe defaults first (no external deps)
		window.__openGuideId = undefined;

		var titleEl = $("#guide-title");
		if (titleEl) titleEl.value = "Untitled guide";

		var statusEl = $("#guide-status");
		if (statusEl) statusEl.textContent = "draft";

		// Use imported DEFAULT_SOURCE if present, otherwise a tiny inline fallback
		var defaultSrc = (typeof DEFAULT_SOURCE === "string" && DEFAULT_SOURCE.trim()) ?
			DEFAULT_SOURCE.trim() :
			"---\nversion: 1\n---\n# New guide\n\nWelcome. Start writing…";

		var srcEl = $("#guide-source");
		if (srcEl) srcEl.value = defaultSrc;

		// These are best-effort; failures shouldn't block the editor opening
		try { populatePatternList(typeof listStarterPatterns === "function" ? listStarterPatterns() : []); } catch (err) { console.warn("Pattern list failed:", err); }
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
		const res = await fetch("/api/guides/" + encodeURIComponent(id));
		const g = res.ok ? await res.json() : null;
		if (!g) throw new Error("Not found");

		window.__openGuideId = g.id;

		var editor = $("#editor-section");
		if (editor) editor.classList.remove("is-hidden");

		var titleEl = $("#guide-title");
		if (titleEl) titleEl.value = g.title || "Untitled";

		var statusEl = $("#guide-status");
		if (statusEl) statusEl.textContent = g.status || "draft";

		var srcEl = $("#guide-source");
		if (srcEl) srcEl.value = g.sourceMarkdown || "";

		populatePatternList(typeof listStarterPatterns === "function" ? listStarterPatterns() : []);
		populateVariablesForm(g.variables || {});
		await preview();
		announce('Opened guide “' + (g.title || "Untitled") + '”');
	} catch (e) {
		console.warn(e);
		announce("Failed to open guide");
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
	var titleEl = $("#guide-title");
	var title = (titleEl && titleEl.value ? titleEl.value.trim() : "") || "Untitled guide";
	var srcEl = $("#guide-source");
	var source = (srcEl && srcEl.value) || "";
	var fm = readFrontMatter(source);
	var body = { title: title, sourceMarkdown: source, variables: (fm && fm.meta) || {} };
	var id = window.__openGuideId;
	var method = id ? "PATCH" : "POST";
	var url = id ? ("/api/guides/" + encodeURIComponent(id)) : "/api/guides";
	const res = await fetch(url, { method: method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	if (res.ok) {
		announce("Guide saved");
		var study = (window.__guideCtx && window.__guideCtx.study) || {};
		loadGuides(study.id);
	} else {
		announce("Save failed");
	}
}

async function onPublish() {
	var id = window.__openGuideId;
	var titleEl = $("#guide-title");
	var title = titleEl && titleEl.value ? titleEl.value.trim() : "";
	if (!id) { announce("Save the guide before publishing."); return; }
	const res = await fetch("/api/guides/" + encodeURIComponent(id) + "/publish", { method: "POST" });
	if (res.ok) {
		var statusEl = $("#guide-status");
		if (statusEl) statusEl.textContent = "published";
		announce('Published “' + (title || "Untitled") + '”');
		var study = (window.__guideCtx && window.__guideCtx.study) || {};
		loadGuides(study.id);
	} else {
		announce("Publish failed");
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
	var ul = $("#pattern-list");
	if (!ul) return;
	ul.innerHTML = "";
	var arr = Array.isArray(items) ? items : [];
	for (var i = 0; i < arr.length; i++) {
		var p = arr[i];
		var li = document.createElement("li");
		li.innerHTML =
			'<button class="btn btn--secondary" data-pattern="' + p.name + "_v" + p.version + '">' +
			escapeHtml(p.title) + ' <span class="muted">(' + p.category + " · v" + p.version + ")</span>" +
			"</button>";
		ul.appendChild(li);
	}
	ul.addEventListener("click", function(e) {
		var t = e.target;
		var hasClosest = t && typeof t.closest === "function";
		var b = hasClosest ? t.closest("button[data-pattern]") : null;
		if (!b) return;
		insertAtCursor($("#guide-source"), "\n{{> " + b.getAttribute("data-pattern") + "}}\n");
		preview();
		closePatternDrawer();
	});
}

function onPatternSearch(e) {
	var q = (e && e.target && e.target.value ? e.target.value : "").trim().toLowerCase();
	var list = (typeof searchPatterns === "function") ? searchPatterns(q) : [];
	populatePatternList(list);
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
	var srcEl = $("#guide-source");
	var source = (srcEl && srcEl.value) || "";
	var ctx = window.__guideCtx || {};
	var project = ctx.project || {};
	var study = ctx.study || {};
	var fm = readFrontMatter(source);
	var meta = (fm && fm.meta) || {};
	var context = buildContext({ project: project, study: study, session: {}, participant: {}, meta: meta });
	var partials = await buildPartials(collectPartialNames(source)).catch(function() { return {}; });
	var payload = { source: source, context: context, partials: partials, kind: kind };
	var res = await fetch("/api/render", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload)
	});
	if (!res.ok) { announce("Export failed"); return; }
	var js = await res.json();
	var a = document.createElement("a");
	a.href = "data:application/octet-stream;base64," + js.blobBase64;
	a.download = js.filename || ("guide." + kind);
	a.click();
	announce("Exported " + (js.filename || kind));
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

/** Get the first non-empty string from a list of candidates. */
function firstText() {
	for (var i = 0; i < arguments.length; i++) {
		var v = arguments[i];
		if (typeof v === "string" && v.trim()) return v.trim();
		if (Array.isArray(v) && v.length && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
	}
	return "";
}

/** Return a readable label from a variety of shapes (string | array | object). */
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
		// Common object-y shapes: {name}, {Name}, {label}, {value}, Airtable cell objects
		return toLabel(v.name || v.Name || v.label || v.Label || v.value || v.Value || v.text || v.Text);
	}
	return "";
}

/** Normalise an Airtable-ish record (various wrappers/casings) to expose .name. */
function ensureProjectName(p) {
	if (!p) p = {};
	// Unwrap common “{ project: {…} }” envelope
	var base = (p && p.project) ? p.project : p;
	// Airtable “fields” (some APIs use Fields)
	var f = (base && (base.fields || base.Fields)) ? (base.fields || base.Fields) : null;

	// Try the most likely candidates in a broad sweep.
	var name =
		// direct on record
		toLabel(base.name) || toLabel(base.Name) || toLabel(base.Project) || toLabel(base.ProjectName) || toLabel(base.project_name) ||
		// inside fields
		toLabel(f && (f.name)) || toLabel(f && (f.Name)) || toLabel(f && (f.Project)) || toLabel(f && (f.ProjectName)) ||
		// plural/collection fallbacks sometimes used by “Projects” table exports
		toLabel(base.Projects) || toLabel(f && (f.Projects)) ||
		// super broad last-ditch: any “Project” property if present
		toLabel(base["Project"]) || toLabel(f && f["Project"]);

	if (!name) name = "(Unnamed project)";
	base.name = name;
	return base;
}

/**
 * Try multiple API sources to resolve a project record that has a usable .name.
 * Order:
 *   1) /api/projects/:pid                (object or {ok,project})
 *   2) /api/projects?id=:pid             (list filter – if your API supports it)
 *   3) /api/project-details?project=:pid (optional endpoint)
 *   4) /api/studies/:sid                 (study might carry a project label)
 */
async function resolveProject(pid, sid) {
	// 1) projects/:pid
	try {
		var r1 = await fetch("/api/projects/" + encodeURIComponent(pid), { cache: "no-store" });
		if (r1.ok) {
			var pj = await r1.json();
			var rec = (pj && (pj.project || pj)); // accept {project:{...}} or {...}
			var p1 = ensureProjectName(rec);
			if (p1 && p1.name && p1.name !== "(Unnamed project)") return p1;
		}
	} catch (e) {}

	// 2) projects?id=:pid (list filter fallback)
	try {
		var rL = await fetch("/api/projects?id=" + encodeURIComponent(pid), { cache: "no-store" });
		if (rL.ok) {
			var list = await rL.json();
			if (Array.isArray(list) && list.length) {
				// pick exact id match if present
				var match = list.find(function(row) { return row && (row.id === pid || row.localId === pid || (row.fields && row.fields.id === pid)); }) || list[0];
				var pL = ensureProjectName(match);
				if (pL && pL.name && pL.name !== "(Unnamed project)") return pL;
			}
		}
	} catch (e) {}

	// 3) project-details?project=:pid (optional)
	try {
		var r2 = await fetch("/api/project-details?project=" + encodeURIComponent(pid), { cache: "no-store" });
		if (r2.ok) {
			var list2 = await r2.json();
			if (Array.isArray(list2) && list2.length) {
				var p2 = ensureProjectName(list2[0]);
				if (p2 && p2.name && p2.name !== "(Unnamed project)") return p2;
			}
		}
	} catch (e) {}

	// 4) studies/:sid (many APIs include a readable linked label on the study)
	try {
		var r3 = await fetch("/api/studies/" + encodeURIComponent(sid), { cache: "no-store" });
		if (r3.ok) {
			var s = await r3.json();
			// Common shapes on the study record
			var via =
				ensureProjectName(
					// nested object
					(s && s.project) ? s.project :
					// direct “Project” (string/array/object)
					(s && (s.Project != null)) ? { Project: s.Project } :
					// sometimes lives on fields
					(s && s.fields) ? s : {}
				);
			if (via && via.name && via.name !== "(Unnamed project)") return via;
		}
	} catch (e) {}

	// Final fallback
	return { id: pid, name: "(Unnamed project)" };
}

/* ──────────────────────────────────────────────────────────────
 * UI DEBUG PANEL (no console needed)
 * - Renders /api/projects/:pid and /api/studies/:sid payloads
 * - Toggle visibility and download the combined JSON
 * - Auto-opens if you add ?debug=1 to the URL
 * ────────────────────────────────────────────────────────────── */

(function initApiDebugPanel() {
  try {
    const params = new URLSearchParams(location.search);
    const pid = params.get("pid");
    const sid = params.get("sid");
    if (!pid || !sid) return;

    // Host container (try to place under main actions or fall back to body)
    const host =
      document.querySelector(".actions-bar") ||
      document.querySelector("main") ||
      document.body;

    // Panel skeleton
    const wrap = document.createElement("section");
    wrap.setAttribute("id", "api-debug-panel");
    wrap.style.margin = "16px 0";
    wrap.innerHTML = `
      <details id="api-debug-details" style="border:1px solid #ddd; border-radius:6px; padding:8px; background:#fafafa;">
        <summary style="cursor:pointer; font-weight:600;">API Debug (projects + study)</summary>
        <div style="margin-top:8px; display:flex; gap:12px; flex-wrap:wrap;">
          <button id="api-debug-refresh" class="btn btn--outline" type="button">Refresh</button>
          <a id="api-debug-download" class="btn btn--secondary" href="#" download="debug-api.json">Download JSON</a>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
          <div>
            <h4 style="margin:4px 0;">/api/projects/<span id="dbg-proj-id"></span></h4>
            <pre id="dbg-proj" style="white-space:pre-wrap; font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding:8px; background:#fff; border:1px solid #eee; border-radius:4px; max-height:40vh; overflow:auto;">(loading…)</pre>
          </div>
          <div>
            <h4 style="margin:4px 0;">/api/studies/<span id="dbg-study-id"></span></h4>
            <pre id="dbg-study" style="white-space:pre-wrap; font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding:8px; background:#fff; border:1px solid #eee; border-radius:4px; max-height:40vh; overflow:auto;">(loading…)</pre>
          </div>
        </div>
      </details>
    `;
    host.prepend(wrap);

    // Fill IDs in headings
    document.getElementById("dbg-proj-id").textContent = pid;
    document.getElementById("dbg-study-id").textContent = sid;

    // Fetch + render + wire download
    async function refreshDebug() {
      const [projRes, studyRes] = await Promise.allSettled([
        fetch("/api/projects/" + encodeURIComponent(pid), { cache: "no-store" }).then(r => r.json()),
        fetch("/api/studies/" + encodeURIComponent(sid), { cache: "no-store" }).then(r => r.json())
      ]);

      const proj = projRes.status === "fulfilled" ? projRes.value : { error: String(projRes.reason || "fetch failed") };
      const study = studyRes.status === "fulfilled" ? studyRes.value : { error: String(studyRes.reason || "fetch failed") };

      // Render safely (textContent to avoid HTML injection)
      const projPre = document.getElementById("dbg-proj");
      const studyPre = document.getElementById("dbg-study");
      if (projPre) projPre.textContent = JSON.stringify(proj, null, 2);
      if (studyPre) studyPre.textContent = JSON.stringify(study, null, 2);

      // Build a downloadable JSON blob
      const payload = { project: proj, study: study };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dl = document.getElementById("api-debug-download");
      if (dl) {
        dl.href = url;
        dl.setAttribute("download", `debug-api-${pid}-${sid}.json`);
      }
    }

    // Buttons
    document.getElementById("api-debug-refresh").addEventListener("click", refreshDebug);

    // Auto-open panel if debug=1
    const details = document.getElementById("api-debug-details");
    if (params.get("debug") === "1" && details) details.setAttribute("open", "true");

    // First load
    refreshDebug();
  } catch (e) {
    // Non-fatal: if this fails, the rest of the page must still work
    console && console.warn && console.warn("api debug panel failed", e);
  }
})();

function runLints(args) {
	var source = args.source,
		context = args.context,
		partials = args.partials;
	var out = $("#lint-output");
	if (!out) return;
	var warnings = [];

	// Undeclared partials
	var parts = collectPartialNames(source);
	for (var i = 0; i < parts.length; i++) {
		var p = parts[i];
		if (!(p in partials)) warnings.push("Unknown partial: {{> " + p + "}}");
	}

	// Simple tag existence check ({{study.something}})
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

/** Create a plain shallow clone of an object without using spread literals. */
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
