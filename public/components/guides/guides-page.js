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

// Service health + in-memory cache for search/fallback
let __patternServiceAvailable = false;
let __patternCache = [];

// Helper to show service/fallback status in the Patterns drawer
/**
 * Show or update a muted status line inside the Patterns drawer.
 * Handles cases where the API returns HTML instead of JSON (SPA fallback).
 */
function setPatternStatus(msg) {
	const drawer = document.getElementById("drawer-patterns");
	const list = document.getElementById("pattern-list");
	if (!drawer || !list) {
		console.warn("[patterns] status:", msg);
		return;
	}

	// Create or reuse the message element
	let p = document.getElementById("pattern-status");
	if (!p) {
		p = document.createElement("p");
		p.id = "pattern-status";
		p.className = "muted";
		p.style.margin = "0 0 8px 0";
		// Insert above the list for clear visibility
		list.parentNode.insertBefore(p, list);
	}

	p.textContent = msg || "";
}

/* -------------------- boot -------------------- */
window.addEventListener("DOMContentLoaded", () => {
	(async function boot() {
		try {
			console.log("[guides] Boot starting...");

			installLoadingKiller();
			wireGlobalActions();
			wireEditor();

			const url = new URL(location.href);
			const pid = url.searchParams.get("pid");
			const sid = url.searchParams.get("sid");
			const gid = url.searchParams.get("gid"); // optional direct-open

			console.log("[guides] URL params - pid:", pid, "sid:", sid, "gid:", gid);

			if (!pid || !sid) {
				console.error("[guides] Missing required URL parameters");
				announce("Missing project or study ID in URL");
				const tbody = document.querySelector("#guides-tbody");
				if (tbody) {
					tbody.innerHTML = '<tr><td colspan="6" class="muted">Error: Missing project or study ID in URL</td></tr>';
				}
				return;
			}

			// Hydrate breadcrumbs/context first so __guideCtx.study.id is available
			await hydrateCrumbs({ pid, sid });
			console.log("[guides] Context hydrated:", __guideCtx);

			// Patterns don't block guides table; failure shouldn't stall the UI
			try {
				await refreshPatternList();
				console.log("[guides] Patterns loaded");
			} catch (e) {
				console.warn("[guides] Pattern load failed:", e);
			}

			// If gid provided, try to open it first (does not block loadGuides)
			if (gid) {
				try {
					await openGuide(gid);
					window.__hasAutoOpened = true;
					console.log("[guides] Opened guide from URL:", gid);
				} catch (err) {
					console.warn("[guides] Boot open gid failed:", err);
				}
			}

			// Always render the table; it manages its own loading/fallback UI
			console.log("[guides] Loading guides for study:", sid);
			await loadGuides(sid, { autoOpen: !window.__hasAutoOpened });

		} catch (err) {
			console.error("[guides] Boot fatal:", err);
			announce("Failed to initialise the page.");
			// As a last resort, unstick any "Loading…" spinners we know about
			const stuck = document.querySelector("#guides-loading, [data-role='guides-loading']");
			if (stuck) stuck.hidden = true;
			const tbody =
				document.querySelector("#guides-tbody") ||
				document.querySelector("#guides-table tbody") ||
				document.querySelector("[data-guides-tbody]");
			if (tbody) {
				tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to initialise guides: ${escapeHtml(err.message || "Unknown error")}</td></tr>`;
			}
		}
	})();
});

async function safeJson(res, opts = {}) {
	const {
		allowHeuristics = true, // try parse if body looks like JSON even w/o header
			emptyAs = null // what to return for empty bodies
	} = opts;

	const ct = res.headers.get("content-type") || "";
	const isJsonCT = /(\/|\+)json\b/i.test(ct); // matches application/json and application/*+json
	const text = await res.text(); // body can be read only once

	// Empty/No-Content cases
	if (res.status === 204 || res.status === 205 || res.status === 304 || text.trim() === "") {
		return emptyAs; // e.g., null
	}

	// Proper JSON content-type
	if (isJsonCT) {
		try { return JSON.parse(text); } catch (e) {
			const snippet = text.slice(0, 200);
			throw new SyntaxError(`Invalid JSON (${res.status}) from ${res.url || "<unknown>"}; snippet: ${snippet}`);
		}
	}

	// Heuristic: looks like JSON (server forgot the header)
	if (allowHeuristics && /^[\s\uFEFF\u200B]*[{\[]/.test(text)) {
		try { return JSON.parse(text); } catch (e) {
			const snippet = text.slice(0, 200);
			throw new SyntaxError(`Looks like JSON but failed to parse (${res.status}) from ${res.url || "<unknown>"}; snippet: ${snippet}`);
		}
	}

	// Not JSON
	const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
	throw new TypeError(`Non-JSON response (${res.status}) from ${res.url || "<unknown>"}; snippet: ${snippet}`);
}

async function fetchJSON(url, options = {}, safeOpts = {}) {
	const res = await fetch(url, {
		cache: "no-store",
		headers: { Accept: "application/json", ...(options.headers || {}) },
		...options
	});
	const data = await safeJson(res, safeOpts); // consumes the body safely
	if (!res.ok) {
		const err = new Error(`HTTP ${res.status} for ${url}`);
		err.status = res.status;
		err.data = data;
		throw err;
	}
	return data;
}

/* -------------------- breadcrumbs / context -------------------- */

async function loadStudies(projectId) {
	const url = `/api/studies?project=${encodeURIComponent(projectId)}`;
	const js = await fetchJSON(url).catch(() => ({}));
	if (js == null || js.ok !== true || !Array.isArray(js.studies)) {
		throw new Error((js && js.error) || "Studies fetch failed");
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
		const [projects, studies] = await Promise.all([
			fetchJSON(`/api/projects`).then(d => d.projects || []).catch(() => []),
			loadStudies(pid)
		]);

		const project = projects.find(p => p.id === pid) || { name: "(Unnamed project)" };
		const studyRaw = Array.isArray(studies) ? (studies.find(s => s.id === sid) || {}) : {};
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

/**
 * Aggressively hide/remove any "Loading…" UI that might linger.
 * - Hides known spinners
 * - Removes stray text nodes / wrappers containing only Loading…, Loading..., or Loading
 * - Works even if they were injected later by other scripts
 */
function nukeGuidesLoadingUI() {
	const KNOWN = [
		"#guides-loading",
		"[data-role='guides-loading']",
		"[data-guides-loading]",
		"#guides-spinner",
		".js-guides-loading",
		"[aria-busy='true']",
	];
	// Hide known elements
	for (const sel of KNOWN) {
		document.querySelectorAll(sel).forEach(el => {
			el.hidden = true;
			el.setAttribute("aria-hidden", "true");
		});
	}

	// Remove nodes whose *only* visible text is "Loading…/Loading..."
	const LOADING_RE = /^(loading…?|loading\.\.\.)$/i;
	const candidates = Array.from(document.querySelectorAll("div, span, p, td, li, h2, h3, h4"));
	for (const el of candidates) {
		const text = (el.textContent || "").replace(/\s+/g, " ").trim();
		if (LOADING_RE.test(text)) {
			// If this looks like a naked loader stub, remove it outright
			if (!el.querySelector("button,table,tbody,thead,tr,td")) {
				el.remove();
			} else {
				el.hidden = true;
				el.setAttribute("aria-hidden", "true");
			}
		}
	}
}

/**
 * Observe future DOM mutations for any newly inserted "Loading…" nodes
 * and squash them immediately. Call once on boot.
 */
function installLoadingKiller() {
	try {
		const obs = new MutationObserver(() => nukeGuidesLoadingUI());
		obs.observe(document.documentElement, { childList: true, subtree: true });
		// One immediate pass too
		nukeGuidesLoadingUI();
	} catch { /* no-op */ }
}

/**
 * Ensure a guides table skeleton exists and return its <tbody>.
 * This prevents "stuck on Loading…" when the original DOM isn't present
 * or when a loader placeholder never gets replaced.
 */
function ensureGuidesTableSkeleton() {
	// Try to find an existing tbody first
	let tbody =
		document.querySelector("#guides-tbody") ||
		document.querySelector("#guides-table tbody") ||
		document.querySelector("[data-guides-tbody]");

	if (tbody) return tbody;

	// Try to find a sensible container to mount into
	let host =
		document.querySelector("#guides-list-section") ||
		document.querySelector("#guides-section") ||
		document.querySelector("[data-guides-section]") ||
		document.querySelector("#editor-section") ||
		document.querySelector("main") ||
		document.body;

	// Create a minimal table structure
	const wrapper = document.createElement("div");
	wrapper.id = "guides-fallback-wrapper";
	wrapper.className = "table-wrap";
	wrapper.innerHTML = `
    <table class="table" role="table" id="guides-table">
      <thead>
        <tr>
          <th scope="col">Title</th>
          <th scope="col">Status</th>
          <th scope="col">Version</th>
          <th scope="col">Updated</th>
          <th scope="col">Owner</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody id="guides-tbody"></tbody>
    </table>
  `;
	host.appendChild(wrapper);
	return wrapper.querySelector("#guides-tbody");
}

/** Hide any visible "Loading…" elements we know about (be aggressive). */
function hideGuidesLoadingUI() {
	const candidates = [
		"#guides-loading",
		"[data-role='guides-loading']",
		"[data-guides-loading]",
		"#guides-spinner",
		".js-guides-loading"
	];
	for (const sel of candidates) {
		document.querySelectorAll(sel).forEach(el => { el.hidden = true; });
	}
	// Also hide blatant text-only loaders that were left in the DOM
	document.querySelectorAll("div, span, p, td").forEach(el => {
		const txt = (el.textContent || "").trim().toLowerCase();
		if (txt === "loading…" || txt === "loading..." || txt === "loading") {
			el.hidden = true;
		}
	});
}

async function loadGuides(studyId, opts = {}) {
	console.log("[guides] loadGuides called with studyId:", studyId);

	// Always prepare a tbody to paint into
	const tbody = ensureGuidesTableSkeleton();
	console.log("[guides] tbody element:", tbody);

	// Small helpers
	const paint = (html) => {
		if (tbody) {
			tbody.innerHTML = html;
			console.log("[guides] painted:", html.substring(0, 100));
		} else {
			console.error("[guides] tbody is null, cannot paint");
		}
	};
	const row = (msg) => `<tr><td colspan="6" class="muted">${escapeHtml(msg)}</td></tr>`;

	// Show loading row, then *immediately* kill any external loaders
	paint(row("Loading…"));
	nukeGuidesLoadingUI();

	// If no study id, finish now
	if (!studyId) {
		console.warn("[guides] loadGuides: no studyId");
		paint(row("No study selected."));
		nukeGuidesLoadingUI();
		return;
	}

	// Safety timeout: if the network hangs, we still unstick the UI
	const ac = new AbortController();
	const timer = setTimeout(() => {
		console.warn("[guides] Request timed out after 8s");
		try { ac.abort(); } catch {}
	}, 8000);

	try {
		console.log("[guides] Fetching from:", `/api/guides?study=${encodeURIComponent(studyId)}`);

		// Fetch with heuristics so HTML-with-JSON-body won't break us
		const data = await fetchJSON(
			`/api/guides?study=${encodeURIComponent(studyId)}`, { headers: { Accept: "application/json" }, signal: ac.signal }, { allowHeuristics: true, emptyAs: { ok: false, guides: [] } }
		);

		console.log("[guides] Received data:", data);

		// Defensive shape checks
		if (!data || typeof data !== "object") {
			console.warn("[guides] unexpected payload:", data);
			paint(row("Failed to load guides."));
			nukeGuidesLoadingUI();
			return;
		}

		const guides = Array.isArray(data.guides) ? data.guides : [];
		console.log("[guides] Parsed guides array:", guides.length, "items");

		guides.sort((a, b) =>
			(Date.parse(b.updatedAt || b.createdAt || 0) || 0) -
			(Date.parse(a.updatedAt || a.createdAt || 0) || 0)
		);

		if (!guides.length) {
			paint(row("No guides yet. Create one to get started."));
			nukeGuidesLoadingUI();
			return;
		}

		// Render rows
		const fr = document.createDocumentFragment();
		for (const g of guides) {
			const tr = document.createElement("tr");

			// Format the updated date
			let dateStr = "—";
			try {
				const date = new Date(g.updatedAt || g.createdAt || 0);
				if (!isNaN(date.getTime())) {
					dateStr = date.toLocaleString('en-GB', {
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});
				}
			} catch (e) {
				console.warn("[guides] Date parsing error:", e);
			}

			tr.innerHTML = `
        <td>${escapeHtml(g.title || "Untitled")}</td>
        <td>${escapeHtml(g.status || "draft")}</td>
        <td>v${Number.isFinite(g.version) ? g.version : (parseInt(g.version,10) || 0)}</td>
        <td>${dateStr}</td>
        <td>${escapeHtml(g.createdBy?.name || "—")}</td>
        <td><button class="link-like" data-open="${g.id}">Open</button></td>`;
			fr.appendChild(tr);
		}

		// Clear and append
		paint("");
		tbody.appendChild(fr);
		console.log("[guides] Table populated with", guides.length, "rows");

		// Wire open buttons
		tbody.querySelectorAll('button[data-open]').forEach(btn => {
			btn.addEventListener("click", () => {
				window.__hasAutoOpened = true;
				openGuide(btn.dataset.open);
			});
		});

		// Auto-open newest if requested
		if (opts.autoOpen && !window.__hasAutoOpened && !__openGuideId && guides[0]?.id) {
			window.__hasAutoOpened = true;
			console.log("[guides] Auto-opening first guide:", guides[0].id);
			try { await openGuide(guides[0].id); } catch (e) { console.warn("autoOpen failed:", e); }
		}

		// Success: nuke any external "Loading…" remnants
		nukeGuidesLoadingUI();
		console.log("[guides] Load complete, UI updated");

	} catch (err) {
		const aborted = err && (err.name === "AbortError");
		console.error("[guides] loadGuides error:", err);
		paint(row(aborted ? "Network is slow. Please try again." : "Failed to load guides."));
		nukeGuidesLoadingUI();
	} finally {
		clearTimeout(timer);
		// One more sweep in case anything re-inserted a loader
		setTimeout(nukeGuidesLoadingUI, 0);
		setTimeout(nukeGuidesLoadingUI, 300);
	}
}

/* -------------------- patterns -------------------- */

async function refreshPatternList() {
	// Try API endpoints first
	const urls = ["/api/partials", "/api/patterns"];

	for (const url of urls) {
		try {
			const data = await fetchJSON(
				url, { headers: { Accept: "application/json" } }, { allowHeuristics: false } // don't try to parse HTML SPA fallback
			);

			const partials = Array.isArray(data?.partials) ? data.partials :
				Array.isArray(data) ? data : [];

			if (partials.length) {
				populatePatternList(partials);
				setPatternStatus(""); // clear any prior warning
				return;
			}

			// If we got JSON but it's empty, just go to fallback below
			console.warn(`refreshPatternList: ${url} returned empty JSON array`);
		} catch (e) {
			console.warn(`refreshPatternList: ${url} failed`, e.message);
			// Continue to next url
		}
	}

	// If we reach here, both endpoints failed or returned empty — fall back to local starters
	try {
		let starters = [];
		const maybe = (typeof listStarterPatterns === "function") ? listStarterPatterns() : [];
		starters = (maybe && typeof maybe.then === "function") ? await maybe : maybe;

		if (Array.isArray(starters) && starters.length) {
			populatePatternList(starters);
			setPatternStatus("Pattern service unavailable — showing local starter patterns.");
			return;
		}
	} catch (e) {
		console.warn("refreshPatternList: starter fallback failed", e);
	}

	// Nothing available at all
	populatePatternList([]);
	setPatternStatus("No patterns available (API returned HTML).");
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
		if (srcEl) {
			// Force seed if empty
			srcEl.value = (srcEl.value && srcEl.value.trim()) ? srcEl.value : defaultSrc;
		}

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
		if (!id) throw new Error("No guide id provided to openGuide().");

		let guide = null;

		// 1) Preferred path: load by Airtable record id
		try {
			const js = await fetchJSON(`/api/guides/${encodeURIComponent(id)}`).catch((e) => {
				console.warn("openGuide: fetch by id failed", e);
				return null;
			});
			if (js && (js.guide || js.id || js.title)) {
				guide = js.guide || js; // tolerate both API response shapes
			}
		} catch (err) {
			console.warn("openGuide: fetch by id threw", err);
		}

		// 2) Optional fallback: list-by-study → find guide in list
		if (!guide) {
			const sid = __guideCtx?.study?.id || "";
			if (sid) {
				try {
					const list = await fetchJSON(`/api/guides?study=${encodeURIComponent(sid)}`, {}, { emptyAs: { guides: [] } });
					const arr = Array.isArray(list?.guides) ? list.guides : [];
					guide = arr.find(g => g.id === id) || null;
				} catch (err) {
					console.warn("openGuide: list fallback failed", err);
				}
			} else {
				// No study context yet → don't hard-fail; just announce and bail cleanly
				announce("Could not open guide (no study context available for fallback).");
				return;
			}
		}

		if (!guide) throw new Error("Guide not found");

		__openGuideId = guide.id;
		$("#editor-section")?.classList.remove("is-hidden");
		if ($("#guide-title")) $("#guide-title").value = guide.title || "Untitled";
		if ($("#guide-status")) $("#guide-status").textContent = guide.status || "draft";

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

		if ($("#guide-source")) $("#guide-source").value = source;
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
	const prev = document.getElementById("guide-preview");
	if (!srcEl || !prev) return;

	// Always read the current body (front-matter is stripped only for rendering)
	const sourceRaw = srcEl.value || "";
	const source = stripFrontMatter(sourceRaw);

	// If the editor is somehow empty, show a helpful placeholder in the preview
	if (!source.trim()) {
		prev.innerHTML = `<p class="muted">No content yet. Start typing in the editor…</p>`;
		return;
	}

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
		...vars,
		meta: vars
	};

	// Try building any referenced partials, but don't fail preview if they 404
	const names = collectPartialNames(source);
	let partials = {};
	try {
		partials = await buildPartials(names);
	} catch (e) {
		console.warn("buildPartials failed; rendering without partials", e);
		partials = {};
	}

	// Render. If for any reason html comes back falsy, fall back to raw markdown.
	let html = "";
	try {
		const out = await renderGuide({ source, context, partials });
		html = (out && typeof out.html === "string") ? out.html : "";
	} catch (e) {
		console.warn("renderGuide failed; falling back to raw markdown", e);
		html = ""; // will be replaced by fallback below
	}

	if (!html.trim()) {
		// Fallback: show the user's markdown as-is (sanitized), so the panel is never blank
		try {
			const md = marked.parse(source);
			prev.innerHTML = DOMPurify.sanitize(md);
		} catch {
			prev.textContent = source; // last-resort, plain text
		}
	} else {
		prev.innerHTML = html;
	}

	// Lints still run against the computed context/partials
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

	const url = id ? `/api/guides/${encodeURIComponent(id)}` : `/api/guides`;
	const method = id ? "PATCH" : "POST";

	try {
		const js = await fetchJSON(
			url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, { emptyAs: {} }
		);

		if (!id && js && js.id) {
			__openGuideId = js.id;
		}
		announce("Guide saved");
		if (studyId) loadGuides(studyId);
	} catch (err) {
		announce(`Save failed: ${err.status || "?"} ${JSON.stringify(err.data || {})}`);
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

	const drawer = $("#drawer-patterns");
	if (drawer) {
		drawer.removeAttribute("hidden");
		$("#pattern-search")?.focus();
	}

	// NEW: if list is empty or only has “No patterns found.”, (re)load now
	const ul = $("#pattern-list");
	const needsLoad = !ul || ul.children.length === 0 || (ul.children.length === 1 && ul.firstElementChild?.classList.contains("muted"));
	if (needsLoad) {
		refreshPatternList();
	}

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
	__patternCache = arr.slice(); // NEW: keep a copy for client-side search

	if (!arr.length) {
		const li = document.createElement("li");
		li.className = "muted";
		li.textContent = "No patterns found.";
		ul.appendChild(li);

		// Still offer “+ New pattern” if you want creation regardless of API
		const addLi = document.createElement("li");
		addLi.innerHTML = `<button class="btn btn--primary" id="btn-new-pattern">+ New pattern</button>`;
		ul.appendChild(addLi);

		ul.removeEventListener("click", handlePatternClick);
		ul.addEventListener("click", handlePatternClick);
		return;
	}

	// Group by category
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
          <button class="link-like" data-view="${p.id ?? ""}" ${p.id ? "" : "disabled"}>View</button>
          <button class="link-like" data-edit="${p.id ?? ""}" ${p.id ? "" : "disabled"}>Edit</button>
          <button class="link-like" data-delete="${p.id ?? ""}" ${p.id ? "" : "disabled"}>Delete</button>
        </div>
      `;
			ul.appendChild(li);
		}
	}

	const addLi = document.createElement("li");
	addLi.innerHTML = `<button class="btn btn--primary" id="btn-new-pattern">+ New pattern</button>`;
	ul.appendChild(addLi);

	ul.removeEventListener("click", handlePatternClick);
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
		const data = await fetchJSON(`/api/partials/${encodeURIComponent(id)}`).catch(() => null);
		if (!data?.ok || !data?.partial) { announce("Failed to load partial: Invalid response"); return; }
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
		const data = await fetchJSON(`/api/partials/${encodeURIComponent(id)}`).catch(() => null);
		if (!data?.ok || !data?.partial) { announce("Failed to load partial: Invalid response"); return; }

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
	const bodyEl = $("#guide-source");
	const body = (bodyEl?.value || "").trim();

	if (!title) problems.push("Title is required.");
	if (!body) problems.push("Guide body is empty.");

	const el = $("#lint-output");
	if (el) {
		if (problems.length) {
			// Only speak once the editor is visible and the textarea actually exists
			el.innerHTML = `<ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
		} else if (!el.textContent || el.textContent === "No issues") {
			el.textContent = "No issues";
		}
	}
	return problems;
}

/* -------------------- global actions -------------------- */

/**
 * Handle "New guide" button click
 */
async function onNewClick(e) {
	if (e) e.preventDefault();
	try {
		await startNewGuide();
		// Scroll editor into view
		const editor = document.getElementById("editor-section");
		if (editor) {
			editor.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	} catch (err) {
		console.error("[guides] Failed to start new guide:", err);
		announce("Failed to create new guide");
	}
}

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
	if (!q) {
		// Re-render from cache when query is cleared
		populatePatternList(__patternCache);
		return;
	}

	// If the service is up, we could re-query the API; however the cache provides a snappier UX.
	// Filter the in-memory cache (works for both API and fallback starters).
	try {
		const filtered = (__patternCache || []).filter(p => {
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
