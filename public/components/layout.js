/**
 * @file components/layout.js
 * @module layout
 * @summary Single-file, enhanced <x-include> custom element with Mustache-style rendering,
 *          root-absolute URL normalisation, optional debug gating, and auto-nav activation.
 *
 * Usage in HTML:
 *   <script type="module" src="/components/layout.js"></script>
 *
 *   <!-- Basic include -->
 *   <x-include src="/partials/header.html" vars='{"title":"Projects"}'></x-include>
 *
 *   <!-- With sections and arrays in your partial -->
 *   <!-- In the partial: {{#subtitle}}<h2>{{subtitle}}</h2>{{/subtitle}} -->
 *   <!-- Arrays example: {{#include_css}}<link rel="stylesheet" href="{{.}}">{{/include_css}} -->
 *
 *   <!-- Only render when ?debug=true is present in the URL -->
 *   <x-include src="/partials/debug.html" debug-only></x-include>
 *
 * Notes:
 * - Supported tags: {{key}}, {{{key}}}, {{& key}}, {{#section}}...{{/section}}, {{^section}}...{{/section}}
 * - Dot notation paths are supported (e.g., {{project.name}}). Array item scope is available as {{.}}.
 * - The element injects content directly into itself (no Shadow DOM) so page CSS applies normally.
 * - After render, if a container has [data-active="Name"], any descendant with [data-nav="Name"] gets .active.
 *
 * optional debug gating, auto-nav activation, queued re-renders, and footer defaults.
 */

class XInclude extends HTMLElement {
	static get observedAttributes() { return ["src", "vars", "debug-only"]; }

	constructor() {
		super();
		this._loading = false;
		this._abort = null;
		this._needsRerender = false; // NEW: queue flag
	}

	connectedCallback() {
		this._maybeApplyFooterDefaults(); // NEW: ensure footer vars before first render
		this._render();
	}

	attributeChangedCallback() {
		// If a change happens during a fetch, queue one more render
		if (this._loading) {
			this._needsRerender = true;
			return;
		}
		this._render();
	}

	disconnectedCallback() { if (this._abort) this._abort.abort(); }

	// ── utils ───────────────────────────────────────────────────────────
	normalizeUrl(u) {
		const s = String(u || "").trim();
		if (!s) return "";
		if (/^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(s)) return s;
		return "/" + s.replace(/^\.?\//, "");
	}

	parseVars() {
		const raw = (this.getAttribute("vars") || "").trim();
		if (!raw) return {};
		try { return JSON.parse(raw); } catch {
			console.warn("[x-include] Invalid JSON in vars:", raw);
			return {};
		}
	}

	esc(str) {
		const d = document.createElement("div");
		d.textContent = String(str ?? "");
		return d.innerHTML;
	}

	lookup(obj, path) {
		if (path === "." || path === "this") return obj;
		return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
	}

	// ── mini mustache ───────────────────────────────────────────────────
	renderTemplate(tpl, data) {
		if (!tpl) return "";

		// Sections (arrays/truthy)
		tpl = tpl.replace(/\{\{#\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_m, key, inner) => {
			const val = this.lookup(data, key);
			if (Array.isArray(val)) return val.map(item => this.renderTemplate(inner, { ...data, ".": item })).join("");
			if (val) return this.renderTemplate(inner, data);
			return "";
		});

		// Inverted sections
		tpl = tpl.replace(/\{\{\^\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_m, key, inner) => {
			const val = this.lookup(data, key);
			const show = Array.isArray(val) ? val.length === 0 : !val;
			return show ? this.renderTemplate(inner, data) : "";
		});

		// Triple / unescaped
		tpl = tpl.replace(/\{\{\{\s*([\w.[\]-]+)\s*\}\}\}|\{\{&\s*([\w.[\]-]+)\s*\}\}/g, (_m, k1, k2) => {
			const key = k1 || k2;
			const v = this.lookup(data, key);
			return v == null ? "" : String(v);
		});

		// Escaped
		tpl = tpl.replace(/\{\{\s*([\w.[\]-]+)\s*\}\}/g, (_m, key) => {
			const v = this.lookup(data, key);
			return this.esc(v == null ? "" : String(v));
		});

		return tpl;
	}

	// ── footer defaults BEFORE first render ─────────────────────────────
	_maybeApplyFooterDefaults() {
		// Normalize for comparison: treat "partials/footer.html" and "/partials/footer.html" the same.
		const raw = this.getAttribute("src") || "";
		const norm = this.normalizeUrl(raw);
		if (norm !== "/partials/footer.html") return;
		if (this.hasAttribute("vars")) return;

		const nowYear = new Date().getFullYear();
		const defaults = {
			year: nowYear,
			org: "Home Office Biometrics",
			build: "ResearchOps v1.0.0",
		};
		this.setAttribute("vars", JSON.stringify(defaults));
	}

	// ── rendering ───────────────────────────────────────────────────────
	async _render() {
		// Debug gate
		if (this.hasAttribute("debug-only")) {
			const url = new URL(location.href);
			if (url.searchParams.get("debug") !== "true") {
				this.innerHTML = "";
				return;
			}
		}

		const rawSrc = this.getAttribute("src") || "";
		const src = this.normalizeUrl(rawSrc);
		if (!src) { this.innerHTML = "<!-- x-include: missing src -->"; return; }

		const data = this.parseVars();

		// Begin fetch
		this._loading = true;
		this._needsRerender = false; // clear any prior request (we're starting a fresh one)
		this._abort = new AbortController();

		try {
			const res = await fetch(src, { cache: "no-store", credentials: "same-origin", signal: this._abort.signal });
			const text = await res.text();
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

			const html = this.renderTemplate(text, data);
			this.innerHTML = html;
			this.executeScripts();

			this.applyActiveNav();
			await Promise.resolve(); // allow upgrades

			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src, ok: true } }));
		} catch (err) {
			console.error("[x-include] render error:", src, err);
			this.innerHTML = `<!-- x-include error: ${this.esc(String(err?.message || err))} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src, error: String(err) } }));
		} finally {
			this._loading = false;
			this._abort = null;

			// If attributes changed while we were fetching, do exactly one more render
			if (this._needsRerender) {
				this._needsRerender = false;
				// Important: avoid tight recursion; schedule microtask
				Promise.resolve().then(() => this._render());
			}
		}
	}

	applyActiveNav() {
		this.querySelectorAll("[data-active]").forEach(el => {
			const target = (el.getAttribute("data-active") || "").trim();
			if (!target) return;
			el.querySelectorAll("[data-nav]").forEach(link => {
				const isMatch = (link.getAttribute("data-nav") || "").trim() === target;
				link.classList.toggle("active", isMatch);
				if (isMatch) link.setAttribute("aria-current", "page");
				else link.removeAttribute("aria-current");
			});
		});
	}

	executeScripts() {
		// Re-execute any <script> tags that were inserted via innerHTML.
		const scripts = Array.from(this.querySelectorAll("script"));
		for (const old of scripts) {
			const s = document.createElement("script");
			// copy attributes (type, src, async, defer, crossorigin, etc.)
			for (const { name, value } of Array.from(old.attributes)) {
				s.setAttribute(name, value);
			}
			// copy inline code
			if (!s.src) s.textContent = old.textContent || "";
			// Replace in DOM → this triggers execution
			old.replaceWith(s);
		}
	}
}

if (!customElements.get("x-include")) customElements.define("x-include", XInclude);

// Optional helper
export function whenIncludesReady(root = document) {
	const nodes = Array.from(root.querySelectorAll("x-include"));
	if (nodes.length === 0) return Promise.resolve();
	return Promise.all(nodes.map(n => new Promise(resolve => {
		const done = () => resolve();
		n.addEventListener("x-include:loaded", done, { once: true });
		n.addEventListener("x-include:error", done, { once: true });
	})));
}

// ───────────────────────────────────────────────────────────────────────────
// Debug mode: URL-driven (no boot partial). Visible ?debug=true while active.
// - Active IFF current page has ?debug=true
// - Injects /partials/debug.html once when active
// - Appends ?debug=true to same-origin links while active
// - Removing the param and reloading disables debug
// ───────────────────────────────────────────────────────────────────────────
(() => {
	const DEBUG_PARAM = "debug";
	const DEBUG_VALUE = "true";
	const CONSOLE_ID = "debug-console"; // id inside /partials/debug.html

	const usp = new URLSearchParams(location.search);
	const isActive = usp.get(DEBUG_PARAM) === DEBUG_VALUE;

	// If active, ensure the current visible URL has ?debug=true (Safari needs string)
	if (isActive && !usp.has(DEBUG_PARAM)) {
		const u = new URL(location.href);
		u.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
		history.replaceState(history.state, "", u.href); // <— was `u`
	}

	// Inject console if active (and not already present)
	const injectDebug = () => {
		if (!isActive) return;
		if (document.getElementById(CONSOLE_ID) ||
			document.querySelector('x-include[src="/partials/debug.html"]')) {
			return;
		}
		const inc = document.createElement("x-include");
		inc.setAttribute("src", "/partials/debug.html");
		document.body.appendChild(inc);
	};

	function shouldDecorate(href) {
		if (!href) return false;
		// leave hashes, mailto, tel, javascript, data alone
		if (/^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return false;
		try {
			const u = new URL(href, location.href);
			if (u.origin !== location.origin) return false; // only same-origin
		} catch {
			return false; // malformed hrefs
		}
		return true;
	}

	// Batch pass: make sure existing anchors include ?debug=true in their hrefs
	function addDebugParamToLinks() {
		if (!isActive) return;
		document.querySelectorAll("a[href]").forEach(a => {
			const raw = a.getAttribute("href") || "";
			if (!shouldDecorate(raw)) return;
			try {
				const u = new URL(raw, location.href);
				if (u.searchParams.get(DEBUG_PARAM) !== DEBUG_VALUE) {
					u.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
					a.setAttribute("href", u.pathname + u.search + u.hash);
				}
			} catch {
				/* ignore bad hrefs */
			}
		});
	}

	// Click-time safeguard: ensure any same-origin nav keeps ?debug=true
	function decorateClicks() {
		if (!isActive) return;
		document.addEventListener("click", (e) => {
			const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
			if (!a) return;
			const raw = a.getAttribute("href") || "";
			if (!shouldDecorate(raw)) return;
			try {
				const u = new URL(a.href, location.href); // absolute at this point
				if (u.searchParams.get(DEBUG_PARAM) === DEBUG_VALUE) return;
				u.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
				a.href = u.pathname + u.search + u.hash; // visible URL will include it
			} catch { /* ignore */ }
		}, { capture: true });
	}

	const ready = (fn) =>
		(document.readyState === "loading") ?
		document.addEventListener("DOMContentLoaded", fn, { once: true }) :
		fn();

	ready(() => {
		// (Redundant safety for Safari: ensure ?debug=true is visible)
		if (isActive && !new URLSearchParams(location.search).has(DEBUG_PARAM)) {
			const u = new URL(location.href);
			u.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
			history.replaceState(history.state, "", u.href); // <— ensure string
		}

		injectDebug();
		addDebugParamToLinks(); // <— now called
		decorateClicks();
	});
})();
