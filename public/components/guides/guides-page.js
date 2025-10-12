/**
 * @file guides-page.js
 * @module GuidesPage
 * @summary Discussion Guides hub (list + editor bootstrap) — JSON-only variables.
 *
 * @description
 * - Variables source of truth: Airtable “Variables (JSON)” column (guide.variables).
 * - Preview/render: Mustache uses ctx.meta from VariableManager JSON only.
 * - Save: PATCH/POST { title, sourceMarkdown, variables }
 * - Drawers are mutually exclusive: opening **Variables** closes **Pattern/Tag**; opening **Pattern** closes **Variables/Tag**; opening **Tag** closes **Variables/Pattern**.
 * - Variables drawer provides independent “Save variables” (PATCH variables only) and “Discard” to revert to last saved values.
 *
 * @requires /lib/mustache.min.js
 * @requires /lib/marked.min.js
 * @requires /lib/purify.min.js
 * @requires /components/guides/context.js
 * @requires /components/guides/guide-editor.js
 * @requires /components/guides/patterns.js
 * @requires /components/guides/variable-manager.js
 * @requires /components/guides/variable-utils.js (validateTemplate/formatValidationReport/suggestVariables only)
 */

import Mustache from "/lib/mustache.min.js";
import { marked } from "/lib/marked.min.js";
import DOMPurify from "/lib/purify.min.js";

import { buildContext } from "/components/guides/context.js";
import { renderGuide, buildPartials, DEFAULT_SOURCE } from "/components/guides/guide-editor.js";
import { searchPatterns, listStarterPatterns } from "/components/guides/patterns.js";

// Variable manager + validators (keep your existing utils for validation)
import { VariableManager } from "/components/guides/variable-manager.js";
import {
	validateTemplate,
	formatValidationReport,
	suggestVariables
} from "/components/guides/variable-utils.js";

/* ============================================================================
 * Local helpers for JSON-only mode (YAML stripping + legacy import)
 * ============================================================================ */

/** Strip a leading YAML front-matter block if present. Returns body only. */
function stripFrontMatter(src) {
	const fmRe = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
	return String(src || "").replace(fmRe, "");
}

/** Extract + strip front-matter (for one-time migration). */
function extractAndStripFrontMatter(src) {
	const fmRe = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
	const m = String(src || "").match(fmRe);
	if (!m) return { stripped: String(src || ""), yaml: null };
	return { stripped: String(src || "").replace(fmRe, ""), yaml: m[1] || "" };
}

/** Minimal defensive YAML-like parser for migration only (scalars + top-level arrays). */
function parseSimpleYaml(yaml) {
	const out = {};
	if (!yaml || !yaml.trim()) return out;
	const lines = yaml.split(/\r?\n/);
	let currentKey = null;

	for (let raw of lines) {
		const line = raw.replace(/\t/g, "  ");
		if (!line.trim()) continue;

		// Array item under currentKey
		if (/^\s*-\s+/.test(line) && currentKey) {
			out[currentKey] = out[currentKey] || [];
			out[currentKey].push(coerceScalar(line.replace(/^\s*-\s+/, "")));
			continue;
		}

		// key: value
		const kv = line.match(/^\s*([A-Za-z0-9_\-\.]+)\s*:\s*(.*)$/);
		if (kv) {
			const [, k, v] = kv;
			if (v === "" || v == null) {
				currentKey = k;
				out[k] = out[k] || [];
			} else {
				currentKey = k;
				out[k] = coerceScalar(v);
			}
		}
	}

	return out;

	function coerceScalar(v) {
		const s = String(v || "").trim();
		if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
		if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
		if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
			return s.slice(1, -1);
		}
		return s;
	}
}

/* ============================================================================
 * qS helpers / small utilities
 * ============================================================================ */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

let varManager = null; // VariableManager instance (JSON-only)
let __openGuideId = null; // currently open guide id
let __guideCtx = { project: {}, study: {} }; // page context

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

async function safeJson(res) {
	const ctype = (res.headers.get("content-type") || "").toLowerCase();
	const text = await res.text(); // read once
	if (ctype.includes("application/json")) {
		try { return JSON.parse(text); } catch (e) {
			const snippet = text.slice(0, 200);
			throw new SyntaxError(`Invalid JSON (${res.status}). Snippet: ${snippet}`);
		}
	}
	// Non-JSON response (likely HTML error page / proxy)
	const snippet = text.slice(0, 200);
	throw new SyntaxError(`Non-JSON response (${res.status}). Snippet: ${snippet}`);
}

/* -------------------- breadcrumbs / context -------------------- */

async function loadStudies(projectId) {
	const url = "/api/studies?project=" + encodeURIComponent(projectId);
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js == null || js.ok !== true || !Array.isArray(js.studies)) {
		throw new Error((js && js.error) || ("Studies fetch failed (" + res.status + ")"));
	}
	return js.studies;
}

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

		__guideCtx = {
			project: { id: project.id, name: project.name || "(Unnamed project)" },
			study
		};
	} catch (err) {
		console.warn("Crumb hydrate failed", err);
		__guideCtx = { project: { name: "(Unnamed project)" }, study: {} };
	}
}

/* -------------------- list + open -------------------- */

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

		if (opts.autoOpen && !window.__hasAutoOpened && !__openGuideId && newestId) {
			window.__hasAutoOpened = true;
			await openGuide(newestId);
		}
	} catch (e) {
		console.warn(e);
		tbody.innerHTML = `<tr><td colspan="6">Failed to load guides.</td></tr>`;
	}
}

function onNewClick(e) {
	if (e && typeof e.preventDefault === "function") e.preventDefault();
	startNewGuide();
}

/* -------------------- patterns -------------------- */

async function refreshPatternList() {
	// Try /api/partials first; fall back to /api/patterns
	const urls = ["/api/partials", "/api/patterns"];

	for (const url of urls) {
		try {
			const res = await fetch(url, {
				cache: "no-store",
				headers: { "Accept": "application/json" }
			});

			if (!res.ok) {
				console.warn(`refreshPatternList: ${url} -> ${res.status}`);
				continue; // try next url
			}

			const ct = (res.headers.get("content-type") || "").toLowerCase();
			if (!ct.includes("application/json")) {
				// It’s HTML (likely an SPA fallback). Don’t .json() this.
				const snippet = (await res.text()).slice(0, 300).replace(/\s+/g, " ").trim();
				console.warn(`refreshPatternList: Non-JSON from ${url}`, snippet);
				continue; // try next url
			}

			const data = await res.json();
			const partials = Array.isArray(data?.partials) ? data.partials :
				Array.isArray(data) ? data :
				[];

			populatePatternList(partials);
			return; // success
		} catch (err) {
			console.warn(`refreshPatternList: ${url} error`, err);
			// try next url
		}
	}

	// If we get here, all endpoints failed — render an empty list gracefully.
	populatePatternList([]);
}

/* -------------------- syntax highlighting (unchanged) -------------------- */

function highlightMustache(source) {
	if (!source) return '';

	let highlighted = source
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	const mustacheTags = [];
	const tagPattern = /\{\{[^}]*\}\}/g;
	let match;
	while ((match = tagPattern.exec(source)) !== null) {
		mustacheTags.push({ start: match.index, end: match.index + match[0].length });
	}

	function isInsideMustache(pos) {
		return mustacheTags.some(tag => pos >= tag.start && pos < tag.end);
	}

	highlighted = highlighted
		.replace(/(\{\{!)([^}]*?)(\}\})/g, '<span class="token comment">$1$2$3</span>')
		.replace(/(\{\{&gt;)\s*([^}]+?)(\}\})/g, '<span class="token mustache"><span class="token mustache-tag">{{&gt;</span><span class="token keyword">$2</span><span class="token mustache-tag">}}</span></span>')
		.replace(/(\{\{)(#[^}]+?)(\}\})/g, '<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>')
		.replace(/(\{\{)(\/[^}]+?)(\}\})/g, '<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>')
		.replace(/(\{\{)([^}#\/!&gt;]+?)(\}\})/g, '<span class="token mustache"><span class="token mustache-tag">$1</span><span class="token mustache-variable">$2</span><span class="token mustache-tag">$3</span></span>');

	highlighted = highlighted
		.replace(/^(#{1,6})\s+(.+)$/gm, '<span class="token title">$1 $2</span>')
		.replace(/(\*\*|__)(?=\S)([^*_<]+?)(?<=\S)\1/g, '<span class="token bold">$1$2$1</span>')
		.replace(/(`+)([^`<]+?)\1/g, '<span class="token code">$1$2$1</span>');

	return highlighted;
}

function syncHighlighting() {
	const textarea = document.getElementById('guide-source');
	const codeElement = document.getElementById('guide-source-code');
	if (!textarea || !codeElement) return;

	const source = textarea.value;
	codeElement.innerHTML = highlightMustache(source);

	const highlightContainer = document.getElementById('guide-source-highlight');
	if (highlightContainer) {
		highlightContainer.scrollTop = textarea.scrollTop;
		highlightContainer.scrollLeft = textarea.scrollLeft;
	}
}

/* -------------------- editor wiring -------------------- */

function wireEditor() {
	const saveVarsBtn = document.getElementById("btn-save-vars");
	if (saveVarsBtn) saveVarsBtn.addEventListener("click", onSaveVariablesOnly);

	const resetVarsBtn = document.getElementById("btn-reset-vars");
	if (resetVarsBtn) resetVarsBtn.addEventListener("click", onResetVariables);

	// Pattern drawer
	const insertPat = $("#btn-insert-pattern");
	if (insertPat) insertPat.addEventListener("click", openPatternDrawer);
	const patClose = $("#drawer-patterns-close");
	if (patClose) patClose.addEventListener("click", closePatternDrawer);
	const patSearch = $("#pattern-search");
	if (patSearch) patSearch.addEventListener("input", onPatternSearch);

	// Variables drawer
	const varsBtn = $("#btn-variables");
	if (varsBtn) varsBtn.addEventListener("click", openVariablesDrawer);
	const varsClose = $("#drawer-variables-close");
	if (varsClose) varsClose.addEventListener("click", closeVariablesDrawer);

	// Tag dialog (mutual exclusivity with drawers)
	const tagBtn = $("#btn-insert-tag");
	if (tagBtn) tagBtn.addEventListener("click", openTagDialog);

	// Source editor
	const src = $("#guide-source");
	if (src) {
		src.addEventListener("input", debounce(function() {
			syncHighlighting();
			preview();
			validateGuide();
		}, 150));

		src.addEventListener("scroll", function() {
			const highlight = $("#guide-source-highlight");
			if (highlight) {
				highlight.scrollTop = src.scrollTop;
				highlight.scrollLeft = src.scrollLeft;
			}
		}, { passive: true });

		setTimeout(syncHighlighting, 100);
	}

	// Title
	const title = $("#guide-title");
	if (title) title.addEventListener("input", debounce(function() {
		announce("Title updated");
		validateGuide();
	}, 400));

	// Save/Publish
	const saveBtn = $("#btn-save");
	if (saveBtn) saveBtn.addEventListener("click", onSave);
	const pubBtn = $("#btn-publish");
	if (pubBtn) pubBtn.addEventListener("click", onPublish);

	// Cmd/Ctrl+S
	document.addEventListener("keydown", function(e) {
		var k = e && e.key ? e.key.toLowerCase() : "";
		if ((e.metaKey || e.ctrlKey) && k === "s") {
			e.preventDefault();
			onSave();
		}
	});
}

/* -------------------- new / open / preview -------------------- */

async function startNewGuide() {
	try {
		$("#editor-section")?.classList.remove("is-hidden");

		__openGuideId = null;

		const titleEl = $("#guide-title");
		if (titleEl) titleEl.value = "Untitled guide";

		const statusEl = $("#guide-status");
		if (statusEl) statusEl.textContent = "draft";

		const defaultSrc = (typeof DEFAULT_SOURCE === "string" && DEFAULT_SOURCE.trim()) ?
			DEFAULT_SOURCE.trim() :
			"# New guide\n\nWelcome. Start writing…";

		const srcEl = $("#guide-source");
		if (srcEl) srcEl.value = defaultSrc;

		syncHighlighting();

		try { await refreshPatternList(); } catch (err) { console.warn("Pattern list failed:", err); }

		// JSON-only: clear variables drawer
		populateVariablesFormEnhanced({});

		await preview();
		validateGuide();
		titleEl && titleEl.focus();
		announce("Started a new guide");
	} catch (err) {
		console.error("startNewGuide fatal:", err);
		announce("Could not start a new guide");
	}
}

/**
 * Open a guide and normalise for JSON-only mode.
 * API expected shape: { id, title, sourceMarkdown, variables }
 */
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
			const sid = __guideCtx?.study?.id || "";
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

		__openGuideId = guide.id;
		$("#editor-section")?.classList.remove("is-hidden");
		$("#guide-title") && ($("#guide-title").value = guide.title || "Untitled");
		$("#guide-status") && ($("#guide-status").textContent = guide.status || "draft");

		// JSON-only migration rules
		let source = String(guide.sourceMarkdown || "");
		let jsonVars = (guide && typeof guide.variables === "object" && guide.variables) ? guide.variables : {};

		if (!jsonVars || Object.keys(jsonVars).length === 0) {
			// One-time import from YAML if present
			const { stripped, yaml } = extractAndStripFrontMatter(source);
			if (yaml) {
				try {
					const imported = parseSimpleYaml(yaml);
					if (imported && Object.keys(imported).length) {
						jsonVars = imported;
					}
				} catch {}
				source = stripped;
			} else {
				source = stripFrontMatter(source);
			}
		} else {
			source = stripFrontMatter(source);
		}

		$("#guide-source") && ($("#guide-source").value = source);
		syncHighlighting();

		await refreshPatternList();

		// Variables drawer now seeded from JSON only
		populateVariablesFormEnhanced(jsonVars || {});

		await preview();
		validateGuide();
		announce(`Opened guide "${guide.title || "Untitled"}"`);
	} catch (e) {
		console.warn(e);
		announce(`Failed to open guide: ${e && e.message ? e.message : "Unknown error"}`);
	}
}

/**
 * Preview uses JSON variables
 */
async function preview() {
	const srcEl = document.getElementById("guide-source");
	if (!srcEl) return;

	const source = stripFrontMatter(srcEl.value || "");
	const ctx = __guideCtx || {};
	const project = ensureProjectName(ctx.project || {});
	const study = ensureStudyTitle(ctx.study || {});

	// Variables from manager
	const vars = (varManager && typeof varManager.getVariables === "function") ?
		varManager.getVariables() : {};

	// Expose variables at root *and* under meta
	const context = {
		project,
		study,
		session: {},
		participant: {},
		...vars, // ← enables {{version}}
		meta: vars // ← keeps {{meta.version}} working
	};

	const names = collectPartialNames(source);
	let partials = {};
	try { partials = await buildPartials(names); } catch {}

	const out = await renderGuide({ source, context, partials });
	const prev = document.getElementById("guide-preview");
	if (prev) prev.innerHTML = out.html;

	runLints({ source, context, partials });
}

/* -------------------- save / publish -------------------- */

async function onSave() {
	const title = ($("#guide-title")?.value || "").trim() || "Untitled guide";
	const source = stripFrontMatter($("#guide-source")?.value || "");
	const variables = (varManager && typeof varManager.getVariables === "function") ?
		varManager.getVariables() : {};

	const studyId = __guideCtx?.study?.id || "";
	const id = __openGuideId;

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
			__openGuideId = js.id;
		}
		announce("Guide saved");
		if (studyId) loadGuides(studyId);
	} else {
		announce(`Save failed: ${res.status} ${JSON.stringify(js)}`);
	}
}

async function onPublish() {
	const id = __openGuideId;
	const sid = __guideCtx?.study?.id;
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

async function onSaveVariablesOnly() {
	try {
		const id = window.__openGuideId;
		const statusEl = document.getElementById("variables-status");

		// If the guide hasn't been created yet, create it first via your normal save path
		if (!id) {
			statusEl && (statusEl.textContent = "Creating guide and saving variables…");
			await onSave(); // creates draft + sets __openGuideId
		}

		const guideId = window.__openGuideId;
		if (!guideId) {
			throw new Error("No guide id available to save variables");
		}

		const variables = window.guidesPage?.varManager?.().getVariables?.() || {};
		statusEl && (statusEl.textContent = "Saving variables…");

		const res = await fetch(`/api/guides/${encodeURIComponent(guideId)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ variables })
		});

		if (!res.ok) {
			const txt = await res.text().catch(() => "");
			throw new Error(`Save failed (${res.status}): ${txt}`);
		}

		statusEl && (statusEl.textContent = "Variables saved to Airtable.");
		announce("Variables saved");
	} catch (err) {
		console.error("[guides] save variables:", err);
		const statusEl = document.getElementById("variables-status");
		statusEl && (statusEl.textContent = `Error: ${err.message || "Failed to save variables"}`);
		announce("Failed to save variables");
	}
}

async function onResetVariables() {
	try {
		const id = window.__openGuideId;
		const statusEl = document.getElementById("variables-status");
		if (!id) {
			// No guide yet → just clear editor state
			window.guidesPage?.varManager?.().setVariables?.({});
			statusEl && (statusEl.textContent = "Variables cleared.");
			preview();
			return;
		}
		statusEl && (statusEl.textContent = "Reverting to last saved variables…");
		await openGuide(id); // re-fetches and repopulates from API/Airtable
		statusEl && (statusEl.textContent = "Variables reverted to last saved.");
		announce("Variables reverted");
	} catch (err) {
		console.error("[guides] reset variables:", err);
		const statusEl = document.getElementById("variables-status");
		statusEl && (statusEl.textContent = `Error: ${err.message || "Failed to reset variables"}`);
	}
}

/* -------------------- import (unchanged, but preview strips YAML) -------------------- */

function importMarkdownFlow() {
	const inp = document.createElement("input");
	inp.type = "file";
	inp.accept = ".md,text/markdown";
	inp.addEventListener("change", async function() {
		const file = inp.files && inp.files[0];
		if (!file) return;
		const text = await file.text();
		await startNewGuide();
		const srcEl = $("#guide-source");
		if (srcEl) srcEl.value = text;
		syncHighlighting();
		await preview(); // will render with stripFrontMatter()
	});
	inp.click();
}

/* -------------------- drawers: patterns -------------------- */

function openPatternDrawer() {
	// Mutual exclusivity
	closeVariablesDrawer();
	closeTagDialog();

	$("#drawer-patterns")?.removeAttribute("hidden");
	$("#pattern-search")?.focus();
	announce("Pattern drawer opened");
}

function closePatternDrawer() {
	$("#drawer-patterns")?.setAttribute("hidden", "true");
	$("#btn-insert-pattern")?.focus();
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

	if (t.dataset.view) { await viewPartial(t.dataset.view); return; }
	if (t.dataset.edit) { await editPartial(t.dataset.edit); return; }
	if (t.dataset.delete) { await deletePartial(t.dataset.delete); return; }

	if (t.id === "btn-new-pattern") { await createNewPartial(); return; }
}

/* -------------------- partials view/edit/create/delete (unchanged) -------------------- */

async function viewPartial(id) {
	try {
		const res = await fetch(`/api/partials/${encodeURIComponent(id)}`, { cache: "no-store" });
		if (!res.ok) { announce(`Failed to load partial: ${res.status}`); return; }
		const data = await res.json();
		if (!data.ok || !data.partial) { announce("Failed to load partial: Invalid response"); return; }
		const { partial } = data;

		const modal = document.createElement("dialog");
		modal.className = "modal";
		modal.innerHTML = `
			<h2 class="govuk-heading-m">${escapeHtml(partial.title)}</h2>
			<dl class="govuk-summary-list">
				<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Name:</dt><dd class="govuk-summary-list__value"><code>${escapeHtml(partial.name)}_v${partial.version}</code></dd></div>
				<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Category:</dt><dd class="govuk-summary-list__value">${escapeHtml(partial.category)}</dd></div>
				<div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Status:</dt><dd class="govuk-summary-list__value">${escapeHtml(partial.status)}</dd></div>
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
		const res = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" } });
		const text = await res.text();
		if (!res.ok) { announce(`Failed to load partial: ${res.status}`); return; }

		let data;
		try { data = JSON.parse(text); } catch { announce("Failed to load partial: Invalid JSON"); return; }
		if (!data.ok || !data.partial) { announce("Failed to load partial: Invalid response"); return; }

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
				headers: { "Content-Type": "application/json", "Accept": "application/json" },
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
	if (!confirm("Are you sure you want to delete this pattern? This action cannot be undone.")) return;
	const res = await fetch(`/api/partials/${encodeURIComponent(id)}`, { method: "DELETE" });
	if (res.ok) {
		announce("Pattern deleted");
		await refreshPatternList();
	} else { announce("Delete failed"); }
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

/* -------------------- variables drawer (JSON-only) -------------------- */

/** Open Variables drawer; ensure Pattern/Tag are closed first (mutual exclusivity). */
function openVariablesDrawer() {
	closePatternDrawer();
	closeTagDialog();

	const d = $("#drawer-variables");
	if (d) {
		d.hidden = false;
		d.focus();
	}
	// Ensure actions exist if someone navigates here very early
	if (!document.getElementById("btn-save-vars")) {
		populateVariablesFormEnhanced(varManager?.getVariables?.() || {});
	}
	announce("Variables drawer opened");
}

/** Close Variables drawer. */
function closeVariablesDrawer() {
	const d = $("#drawer-variables");
	if (d) d.hidden = true;
	const b = $("#btn-variables");
	if (b) b.focus();
	announce("Variables drawer closed");
}

/**
 * Tag dialog open/close shims for mutual exclusivity.
 * If you later replace the prompt-based flow with a real dialog,
 * wire its show/hide here.
 */
function openTagDialog() {
	// mutual exclusivity
	closeVariablesDrawer();
	closePatternDrawer();

	// Current implementation uses a simple prompt for demo/insert:
	onInsertTag();
}

function closeTagDialog() {
	// No-op placeholder (kept for symmetry/future dialog integration)
}

/**
 * Render the VariableManager UI with initial JSON variables.
 * @param {Record<string, any>} jsonVars
 */
function populateVariablesFormEnhanced(jsonVars) {
	const form = document.getElementById("variables-form");
	if (!form) return;

	// Build the form content fresh (container + actions + status)
	form.innerHTML = `
    <div id="variable-manager-container"></div>

    <div class="actions-row">
      <button id="btn-save-vars" class="btn" type="button">💾 Save variables</button>
      <button id="btn-reset-vars" class="btn btn--secondary" type="button">↺ Discard changes</button>
      <button id="drawer-variables-close" class="link-like" type="button">Close</button>
    </div>

    <p id="variables-status" class="muted" aria-live="polite"></p>
  `;

	// Prepare initial values (keep strings readable; non-strings shown as JSON)
	const initial = {};
	const src = jsonVars || {};
	for (const k in src) {
		if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
		initial[k] = typeof src[k] === "string" ? src[k] : JSON.stringify(src[k]);
	}

	// (Re)create manager
	varManager = new VariableManager({
		containerId: "variable-manager-container",
		initialVariables: initial,
		onChange: () => {
			preview();
			validateGuide();
		},
		onError: (msg) => {
			console.error("[guides] Variable error:", msg);
			const s = document.getElementById("variables-status");
			if (s) s.textContent = `Error: ${msg}`;
		}
	});

	// Bind buttons NOW (since we just injected them)
	document.getElementById("btn-save-vars")?.addEventListener("click", onSaveVariablesOnly);
	document.getElementById("btn-reset-vars")?.addEventListener("click", onResetVariables);
	document.getElementById("drawer-variables-close")?.addEventListener("click", closeVariablesDrawer);
}

/* -------------------- export / helpers / lints (mostly unchanged) -------------------- */

async function doExport(kind) {
	const srcEl = $("#guide-source");
	const source = srcEl?.value || "";
	const title = $("#guide-title")?.value || "guide";
	const sanitized = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

	try {
		switch (kind) {
			case "md":
				// Export the visible body
				downloadText(stripFrontMatter(source), `${sanitized}.md`, "text/markdown");
				announce(`Exported ${title}.md`);
				break;

			case "html":
				const previewEl = $("#guide-preview");
				if (!previewEl) { announce("Preview not available"); return; }
				const html = buildStandaloneHtml(previewEl.innerHTML, title);
				downloadText(html, `${sanitized}.html`, "text/html");
				announce(`Exported ${title}.html`);
				break;

			case "pdf":
				if (typeof window.jspdf === "undefined") { announce("PDF export not available (library missing)"); return; }
				await exportPdf(title);
				break;

			case "docx":
				if (typeof window.docx === "undefined") { announce("DOCX export not available (library missing)"); return; }
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
		body { font-family: "GDS Transport", Arial, sans-serif; line-height: 1.5; max-width: 38em; margin: 2em auto; padding: 0 1em; color: #0b0c0c; }
		h1 { font-size: 2em; margin: 1em 0 0.5em; }
		h2 { font-size: 1.5em; margin: 1em 0 0.5em; }
		h3 { font-size: 1.25em; margin: 1em 0 0.5em; }
		p { margin: 0 0 1em; }
		code { background: #f3f2f1; padding: 0.125em 0.25em; font-family: monospace; }
		pre { background: #f3f2f1; padding: 1em; overflow-x: auto; }
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

/* -------------------- misc helpers & lints -------------------- */

function ensureStudyTitle(s) {
	s = s || {};
	var explicit = (s.title || s.Title || "").toString().trim();
	var out = { ...s };
	if (explicit) { out.title = explicit; return out; }
	var method = (s.method || "Study").trim();
	var d = s.createdAt ? new Date(s.createdAt) : new Date();
	var yyyy = d.getUTCFullYear();
	var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	var dd = String(d.getUTCDate()).padStart(2, "0");
	out.title = method + " — " + yyyy + "-" + mm + "-" + dd;
	return out;
}

function ensureProjectName(p) {
	if (!p || typeof p !== "object") return { name: "(Unnamed project)" };
	const name = (p.name || p.Name || "").toString().trim();
	return { ...p, name: name || "(Unnamed project)" };
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
	// Mutual exclusivity: ensure Variables/Pattern are closed when opening Tag insert flow
	closeVariablesDrawer();
	closePatternDrawer();

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

function escapeHtml(s) {
	var str = (s == null ? "" : String(s));
	return str
		.replace(/&/g, "&amp;").replace(/</g, "&lt;")
		.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function announce(msg) {
	var sr = $("#sr-live");
	if (sr) sr.textContent = msg;
}

/**
 * Lint: missing partials + missing values for {{path}}.
 * Now checks against JSON-only context (no YAML).
 */
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

/**
 * Basic, robust form validation for the editor pane.
 * - Checks for required fields (title + body).
 * - Does not replace runLints(); preview() will still run Mustache checks.
 * - Updates #lint-output minimally if nothing else has populated it yet.
 */
function validateGuide() {
	const problems = [];
	const title = ($("#guide-title")?.value || "").trim();
	const body = ($("#guide-source")?.value || "").trim();
	if (!title) problems.push("Title is required.");
	if (!body) problems.push("Guide body is empty.");

	const el = $("#lint-output");
	if (el) {
		if (problems.length) {
			el.innerHTML = `<ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
		} else if (!el.textContent || el.textContent === "No issues") {
			// leave runLints() to populate more detailed info later
			el.textContent = "No issues";
		}
	}
	return problems;
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

/* -------------------- search in patterns (unchanged) -------------------- */

async function onPatternSearch(e) {
	const q = (e?.target?.value || "").trim().toLowerCase();
	if (!q) { await refreshPatternList(); return; }

	try {
		const res = await fetch("/api/partials", { cache: "no-store" });
		if (!res.ok) { populatePatternList([]); return; }
		const data = await safeJson(res);
		const partials = Array.isArray(data?.partials) ? data.partials : [];
		const filtered = partials.filter(p => {
			const s = `${p?.name ?? ""} ${p?.title ?? ""} ${p?.category ?? ""}`.toLowerCase();
			return s.includes(q);
		});
		populatePatternList(filtered);
	} catch (err) {
		console.error("Pattern search error:", err);
		populatePatternList([]);
	}
}

/* -------------------- expose for debugging -------------------- */
window.guidesPage = {
	varManager: () => varManager,
	openVariablesDrawer,
	closeVariablesDrawer
};
