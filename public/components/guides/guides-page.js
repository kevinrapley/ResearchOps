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

	await hydrateCrumbs({ pid, sid }).catch(console.warn);
	await loadGuides(sid).catch(console.warn);

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
	const url = `/api/studies?project=${encodeURIComponent(projectId)}`;
	const res = await fetch(url, { cache: "no-store" });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js?.ok !== true || !Array.isArray(js.studies)) {
		throw new Error(js?.error || `Studies fetch failed (${res.status})`);
	}
	return js.studies;
}

/**
 * Prefer a real title; otherwise compute “Method — YYYY-MM-DD”.
 * @param {{ title?:string, Title?:string, method?:string, createdAt?:string }} s
 */
function pickTitle(s = {}) {
	const t = (s.title || s.Title || "").trim();
	if (t) return t;
	const method = (s.method || "Study").trim();
	const d = s.createdAt ? new Date(s.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

/**
 * Hydrate breadcrumbs, header subtitle, and guide context.
 *
 * Resolves a safe study title via `ensureStudyTitle` so `{{study.title}}`
 * never falls back to description.
 *
 * @param {{ pid: string, sid: string }} params
 * @returns {Promise<void>}
 */
/** Hydrate breadcrumbs, header subtitle, and guide context. */
async function hydrateCrumbs({ pid, sid }) {
	try {
		// Fetch project + studies in parallel
		const [projRes, studies] = await Promise.all([
			fetch(`/api/projects/${encodeURIComponent(pid)}`, { cache: "no-store" }),
			loadStudies(pid)
		]);

		// ✅ Normalise project so project.name always exists
		let project = {};
		if (projRes.ok) {
			const pj = await projRes.json();
			project = pj.project || pj; // handles both {project:{…}} and plain object
		}

		// ✅ Resolve study title
		const studyRaw = Array.isArray(studies) ? (studies.find(s => s.id === sid) || {}) : {};
		const study = ensureStudyTitle(studyRaw);

		// ── Breadcrumbs ──────────────────────────────────────────────
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

		// ── Header subtitle + back link ─────────────────────────────
		const sub = document.querySelector('[data-bind="study.title"]');
		if (sub) sub.textContent = study.title;
		const back = document.getElementById("back-to-study");
		if (back) back.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;

		// ── Update tab title + context ──────────────────────────────
		document.title = `Discussion Guides — ${study.title}`;
		window.__guideCtx = { project, study };

	} catch (e) {
		console.warn("Crumb hydrate failed", e);
		window.__guideCtx = { project: {}, study: {} };
	}
}

/**
 * Render list of guides for a study.
 * @param {string} studyId
 */
async function loadGuides(studyId) {
	const tbody = $("#guides-tbody");
	try {
		const res = await fetch(`/api/guides?study=${encodeURIComponent(studyId)}`, { cache: "no-store" });
		const list = res.ok ? await res.json() : [];
		if (!Array.isArray(list) || !list.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="muted">No guides yet. Create one to get started.</td></tr>`;
			return;
		}
		tbody.innerHTML = "";
		for (const g of list) {
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
		$$('button[data-open]').forEach(b => b.addEventListener("click", () => openGuide(b.dataset.open)));
	} catch (e) {
		console.warn(e);
		tbody.innerHTML = `<tr><td colspan="6">Failed to load guides.</td></tr>`;
	}
}

/* -------------------- global actions -------------------- */
/**
 * Attach top-level UI handlers with null-guards & delegation.
 */
function wireGlobalActions() {
	// Direct bindings
	$("#btn-new")?.addEventListener("click", onNewClick);
	$("#btn-import")?.addEventListener("click", importMarkdownFlow);

	// Delegated fallback (works if DOM changes later)
	document.addEventListener("click", (e) => {
		const newBtn = e.target.closest?.("#btn-new");
		if (newBtn) {
			e.preventDefault();
			onNewClick(e);
			return;
		}

		const menu = $("#export-menu")?.closest(".menu");
		if (menu && !menu.contains(e.target)) menu.removeAttribute("aria-expanded");
	});

	$("#btn-export")?.addEventListener("click", () => {
		const menu = $("#export-menu")?.closest(".menu");
		if (!menu) return;
		menu.setAttribute("aria-expanded", menu.getAttribute("aria-expanded") === "true" ? "false" : "true");
	});

	$("#export-menu")?.addEventListener("click", (e) => {
		const target = e.target.closest?.("[data-export]");
		if (target) doExport(target.dataset.export);
	});
}

function onNewClick(e) {
	e?.preventDefault?.();
	startNewGuide();
}

/* -------------------- editor -------------------- */
function wireEditor() {
	$("#btn-insert-pattern")?.addEventListener("click", openPatternDrawer);
	$("#drawer-patterns-close")?.addEventListener("click", closePatternDrawer);
	$("#pattern-search")?.addEventListener("input", onPatternSearch);

	$("#btn-variables")?.addEventListener("click", openVariablesDrawer);
	$("#drawer-variables-close")?.addEventListener("click", closeVariablesDrawer);

	$("#guide-source")?.addEventListener("input", debounce(preview, 150));
	$("#guide-title")?.addEventListener("input", debounce(() => announce("Title updated"), 400));

	$("#btn-insert-tag")?.addEventListener("click", onInsertTag);
	$("#btn-save")?.addEventListener("click", onSave);
	$("#btn-publish")?.addEventListener("click", onPublish);

	document.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
			e.preventDefault();
			onSave();
		}
	});
}

/**
 * Open a new guide in the editor — always reveals the panel, even if optional imports fail.
 */
async function startNewGuide() {
	try {
		$("#editor-section")?.classList.remove("is-hidden");

		// Basic safe defaults first (no external deps)
		window.__openGuideId = undefined;
		$("#guide-title") && ($("#guide-title").value = "Untitled guide");
		$("#guide-status") && ($("#guide-status").textContent = "draft");

		// Use imported DEFAULT_SOURCE if present, otherwise a tiny inline fallback
		const defaultSrc =
			(typeof DEFAULT_SOURCE === "string" && DEFAULT_SOURCE.trim()) ||
			`---\nversion: 1\n---\n# New guide\n\nWelcome. Start writing…`;

		$("#guide-source") && ($("#guide-source").value = defaultSrc);

		// These are best-effort; failures shouldn't block the editor opening
		try { populatePatternList(typeof listStarterPatterns === "function" ? listStarterPatterns() : []); } catch (err) { console.warn("Pattern list failed:", err); }

		try { populateVariablesForm({}); } catch (err) { console.warn("Variables form failed:", err); }

		try { await preview(); } catch (err) { console.warn("Preview failed:", err); }

		$("#guide-title")?.focus();
		announce("Started a new guide");
	} catch (err) {
		console.error("startNewGuide fatal:", err);
		announce("Could not start a new guide");
	}
}

async function openGuide(id) {
	try {
		const res = await fetch(`/api/guides/${encodeURIComponent(id)}`);
		const g = res.ok ? await res.json() : null;
		if (!g) throw new Error("Not found");

		window.__openGuideId = g.id;
		$("#editor-section")?.classList.remove("is-hidden");
		$("#guide-title") && ($("#guide-title").value = g.title || "Untitled");
		$("#guide-status") && ($("#guide-status").textContent = g.status || "draft");
		$("#guide-source") && ($("#guide-source").value = g.sourceMarkdown || "");
		populatePatternList(typeof listStarterPatterns === "function" ? listStarterPatterns() : []);
		populateVariablesForm(g.variables || {});
		await preview();
		announce(`Opened guide “${g.title || "Untitled"}”`);
	} catch (e) {
		console.warn(e);
		announce("Failed to open guide");
	}
}

async function preview() {
	const source = $("#guide-source")?.value ?? "";

	// Pull raw study from context, then normalise
	const { project, study: rawStudy } = window.__guideCtx || {};
	const normalisedStudy = ensureStudyTitle(rawStudy || {});

	const meta = readFrontMatter(source).meta;
	const context = buildContext({
		project,
		study: normalisedStudy,
		session: {},
		participant: {},
		meta
	});

	const partialNames = collectPartialNames(source);
	const partials = await buildPartials(partialNames).catch(() => ({}));
	const out = await renderGuide({ source, context, partials });

	$("#guide-preview").innerHTML = out.html;
	runLints({ source, context, partials });
}

async function onSave() {
	const title = ($("#guide-title")?.value || "").trim() || "Untitled guide";
	const source = $("#guide-source")?.value || "";
	const body = { title, sourceMarkdown: source, variables: readFrontMatter(source).meta || {} };
	const id = window.__openGuideId;
	const method = id ? "PATCH" : "POST";
	const url = id ? `/api/guides/${encodeURIComponent(id)}` : `/api/guides`;
	const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
	if (res.ok) {
		announce("Guide saved");
		loadGuides((window.__guideCtx?.study || {}).id);
	} else {
		announce("Save failed");
	}
}

async function onPublish() {
	const id = window.__openGuideId;
	const title = ($("#guide-title")?.value || "").trim();
	if (!id) { announce("Save the guide before publishing."); return; }
	const res = await fetch(`/api/guides/${encodeURIComponent(id)}/publish`, { method: "POST" });
	if (res.ok) {
		$("#guide-status").textContent = "published";
		announce(`Published “${title || "Untitled"}”`);
		loadGuides((window.__guideCtx?.study || {}).id);
	} else {
		announce("Publish failed");
	}
}

function importMarkdownFlow() {
	const inp = document.createElement("input");
	inp.type = "file";
	inp.accept = ".md,text/markdown";
	inp.addEventListener("change", async () => {
		const file = inp.files?.[0];
		if (!file) return;
		const text = await file.text();
		await startNewGuide();
		$("#guide-source").value = text;
		await preview();
	});
	inp.click();
}

/* -------------------- drawers: patterns -------------------- */
function openPatternDrawer() {
	$("#drawer-patterns").hidden = false;
	$("#pattern-search").focus();
	announce("Pattern drawer opened");
}

function closePatternDrawer() {
	$("#drawer-patterns").hidden = true;
	$("#btn-insert-pattern").focus();
	announce("Pattern drawer closed");
}

function populatePatternList(items) {
	const ul = $("#pattern-list");
	if (!ul) return;
	ul.innerHTML = "";
	for (const p of items || []) {
		const li = document.createElement("li");
		li.innerHTML = `
			<button class="btn btn--secondary" data-pattern="${p.name}_v${p.version}">
				${escapeHtml(p.title)} <span class="muted">(${p.category} · v${p.version})</span>
			</button>`;
		ul.appendChild(li);
	}
	ul.addEventListener("click", (e) => {
		const b = e.target.closest("button[data-pattern]");
		if (!b) return;
		insertAtCursor($("#guide-source"), `\n{{> ${b.dataset.pattern}}}\n`);
		preview();
		closePatternDrawer();
	});
}

function onPatternSearch(e) {
	const q = e.target.value.trim().toLowerCase();
	populatePatternList(typeof searchPatterns === "function" ? searchPatterns(q) : []);
}

/* -------------------- drawers: variables -------------------- */
function openVariablesDrawer() {
	const src = $("#guide-source")?.value || "";
	const { meta } = readFrontMatter(src);
	populateVariablesForm(meta || {});
	$("#drawer-variables").hidden = false;
	$("#drawer-variables").focus();
}

function closeVariablesDrawer() {
	$("#drawer-variables").hidden = true;
	$("#btn-variables").focus();
}

function populateVariablesForm(meta) {
	const form = $("#variables-form");
	if (!form) return;
	form.innerHTML = "";
	const fields = Object.entries(meta || {}).slice(0, 40);
	for (const [k, v] of fields) {
		const id = `var-${k}`;
		const row = document.createElement("div");
		row.innerHTML = `
			<label for="${id}">${escapeHtml(k)}</label>
			<input id="${id}" class="input" value="${escapeHtml(String(v))}" />`;
		form.appendChild(row);
	}
	form.addEventListener("input", debounce(onVarsEdit, 200));
}

function onVarsEdit() {
	const src = $("#guide-source")?.value || "";
	const fm = readFrontMatter(src);
	const formVals = {};
	$$("#variables-form input").forEach(i => formVals[i.id.replace(/^var-/, "")] = i.value);
	const rebuilt = writeFrontMatter(src, { ...fm.meta, ...formVals });
	$("#guide-source").value = rebuilt;
	preview();
}

/* -------------------- export -------------------- */
async function doExport(kind) {
	const source = $("#guide-source")?.value || "";
	const { project, study } = window.__guideCtx || {};
	const meta = readFrontMatter(source).meta;
	const context = buildContext({ project, study, session: {}, participant: {}, meta });
	const partials = await buildPartials(collectPartialNames(source)).catch(() => ({}));
	const payload = { source, context, partials, kind };
	const res = await fetch("/api/render", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload)
	});
	if (!res.ok) { announce("Export failed"); return; }
	const { filename, blobBase64 } = await res.json();
	const a = document.createElement("a");
	a.href = `data:application/octet-stream;base64,${blobBase64}`;
	a.download = filename || `guide.${kind}`;
	a.click();
	announce(`Exported ${filename || kind}`);
}

/* -------------------- helpers -------------------- */

function fallbackTitle(s = {}) {
	const method = (s.method || "Study").trim();
	const d = s.createdAt ? new Date(s.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${method} — ${yyyy}-${mm}-${dd}`;
}

function ensureStudyTitle(s = {}) {
	const explicit = (s.title || s.Title || "").toString().trim();
	if (explicit) return { ...s, title: explicit };
	const method = (s.method || "Study").trim();
	const d = s.createdAt ? new Date(s.createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return { ...s, title: `${method} — ${yyyy}-${mm}-${dd}` };
}

function runLints({ source, context, partials }) {
	const out = $("#lint-output");
	if (!out) return;
	const warnings = [];

	// Undeclared partials
	for (const p of collectPartialNames(source)) {
		if (!(p in partials)) warnings.push(`Unknown partial: {{> ${p}}}`);
	}

	// Simple tag existence check ({{study.something}})
	const tagRegex = /{{\s*([a-z0-9_.]+)\s*}}/gi;
	let m;
	while ((m = tagRegex.exec(source))) {
		const path = m[1].split(".");
		if (!getPath(context, path)) warnings.push(`Missing value for {{${m[1]}}}`);
	}

	out.textContent = warnings[0] || "No issues";
}

function collectPartialNames(src) {
	const re = /{{>\s*([a-zA-Z0-9_\-]+)\s*}}/g;
	const names = new Set();
	let m;
	while ((m = re.exec(src))) names.add(m[1]);
	return Array.from(names);
}

function readFrontMatter(src) {
	if (!src.startsWith("---")) return { meta: {}, body: src };
	const end = src.indexOf("\n---", 3);
	if (end === -1) return { meta: {}, body: src };
	const yaml = src.slice(3, end).trim();
	const body = src.slice(end + 4);
	const meta = parseYamlLite(yaml);
	return { meta, body };
}

function writeFrontMatter(src, meta) {
	const { body } = readFrontMatter(src);
	const yaml = emitYamlLite(meta);
	return `---\n${yaml}\n---\n${body.replace(/^\n*/, "")}`;
}

function parseYamlLite(y) {
	const obj = {};
	y.split("\n").forEach(line => {
		const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!m) return;
		let val = m[2];
		if (/^\d+$/.test(val)) val = Number(val);
		if (val === "true") val = true;
		if (val === "false") val = false;
		obj[m[1]] = val;
	});
	return obj;
}

function emitYamlLite(o) {
	return Object.entries(o || {})
		.map(([k, v]) => `${k}: ${String(v)}`)
		.join("\n");
}

function insertAtCursor(textarea, snippet) {
	if (!textarea) return;
	const { selectionStart: s = textarea.value.length, selectionEnd: e = textarea.value.length, value } = textarea;
	textarea.value = value.slice(0, s) + snippet + value.slice(e);
	textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function onInsertTag() {
	const tags = [
		"{{study.title}}", "{{project.name}}", "{{participant.id}}",
		"{{#tasks}}…{{/tasks}}", "{{#study.remote}}…{{/study.remote}}"
	];
	const pick = prompt("Insert tag (example):\n" + tags.join("\n"));
	if (pick) {
		insertAtCursor($("#guide-source"), pick);
		preview();
	}
}

function debounce(fn, ms = 200) {
	let t;
	return (...a) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...a), ms);
	};
}

function getPath(obj, pathArr) {
	return pathArr.reduce((acc, k) => {
		if (acc == null) return undefined;
		if (typeof acc !== "object") return undefined;
		return (k in acc) ? acc[k] : undefined;
	}, obj);
}

function escapeHtml(s) {
	return (s ?? "").toString()
		.replace(/&/g, "&amp;").replace(/</g, "&lt;")
		.replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function announce(msg) { $("#sr-live") && ($("#sr-live").textContent = msg); }
