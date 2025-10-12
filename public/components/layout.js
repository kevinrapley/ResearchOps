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
 */

class XInclude extends HTMLElement {
	static get observedAttributes() { return ["src", "vars", "debug-only"]; }

	constructor() {
		super();
		/** @private */
		this._loading = false;
		/** @private */
		this._abort = null;
	}

	connectedCallback() { this._render(); }
	attributeChangedCallback() { this._render(); }
	disconnectedCallback() { if (this._abort) this._abort.abort(); }

	// ───────────────────────────── Utilities ─────────────────────────────

	/**
	 * Normalize a URL to root-absolute unless already absolute/allowed scheme.
	 * @param {string} u
	 * @returns {string}
	 */
	normalizeUrl(u) {
		const s = String(u || "").trim();
		if (!s) return "";
		if (/^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(s)) return s;
		return "/" + s.replace(/^\.?\//, "");
	}

	/**
	 * Parse JSON in the 'vars' attribute.
	 * @returns {Record<string, any>}
	 */
	parseVars() {
		const raw = (this.getAttribute("vars") || "").trim();
		if (!raw) return {};
		try { return JSON.parse(raw); } catch {
			console.warn("[x-include] Invalid JSON in vars:", raw);
			return {};
		}
	}

	/** HTML escape */
	esc(str) {
		const d = document.createElement("div");
		d.textContent = String(str ?? "");
		return d.innerHTML;
	}

	/**
	 * Resolve a dotted path against an object.
	 * @param {any} obj
	 * @param {string} path
	 * @returns {any}
	 */
	lookup(obj, path) {
		if (path === "." || path === "this") return obj;
		return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
	}

	// ────────────────────────── Mini Mustache ───────────────────────────
	/**
	 * Render Mustache-like template:
	 * - Sections: {{#k}}...{{/k}} (arrays iterate; truthy renders once)
	 * - Inverted: {{^k}}...{{/k}} (falsy/empty arrays)
	 * - Triple:   {{{k}}} or {{& k}} (unescaped)
	 * - Vars:     {{k}} (escaped), supports dot paths, {{.}} in array items
	 * @param {string} tpl
	 * @param {Record<string, any>} data
	 * @returns {string}
	 */
	renderTemplate(tpl, data) {
		if (!tpl) return "";

		// Sections (arrays/truthy)
		tpl = tpl.replace(/\{\{#\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_m, key, inner) => {
			const val = this.lookup(data, key);
			if (Array.isArray(val)) {
				return val.map(item => this.renderTemplate(inner, { ...data, ".": item })).join("");
			}
			if (val) return this.renderTemplate(inner, data);
			return "";
		});

		// Inverted sections (falsy or empty array)
		tpl = tpl.replace(/\{\{\^\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_m, key, inner) => {
			const val = this.lookup(data, key);
			const show = Array.isArray(val) ? val.length === 0 : !val;
			return show ? this.renderTemplate(inner, data) : "";
		});

		// Triple-stache & {{& key}} (no escape)
		tpl = tpl.replace(/\{\{\{\s*([\w.[\]-]+)\s*\}\}\}|\{\{&\s*([\w.[\]-]+)\s*\}\}/g, (_m, k1, k2) => {
			const key = k1 || k2;
			const v = this.lookup(data, key);
			return v == null ? "" : String(v);
		});

		// Double-stache (escaped)
		tpl = tpl.replace(/\{\{\s*([\w.[\]-]+)\s*\}\}/g, (_m, key) => {
			const v = this.lookup(data, key);
			return this.esc(v == null ? "" : String(v));
		});

		return tpl;
	}

	// ───────────────────────────── Rendering ─────────────────────────────

	async _render() {
		if (this._loading) return;

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
		if (!src) {
			this.innerHTML = "<!-- x-include: missing src -->";
			return;
		}

		const data = this.parseVars();

		this._loading = true;
		this._abort = new AbortController();

		try {
			const res = await fetch(src, { cache: "no-store", credentials: "same-origin", signal: this._abort.signal });
			const text = await res.text();
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

			const html = this.renderTemplate(text, data);
			this.innerHTML = html;

			// Auto-activate nav links: container with data-active="Name" → descendant [data-nav="Name"] gets .active
			this.applyActiveNav();

			// Re-upgrade any custom elements inserted by the template (allow event microtask to flush)
			await Promise.resolve();

			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src, ok: true } }));
		} catch (err) {
			console.error("[x-include] render error:", src, err);
			this.innerHTML = `<!-- x-include error: ${this.esc(String(err?.message || err))} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src, error: String(err) } }));
		} finally {
			this._loading = false;
			this._abort = null;
		}
	}

	/**
	 * Find any element within this include that sets data-active, and mark matching links active.
	 * Example in partial:
	 *   <nav class="nav" data-active="{{active}}">
	 *     <a data-nav="Home" href="/">Home</a>
	 *     <a data-nav="Projects" href="/pages/projects/">Projects</a>
	 *   </nav>
	 */
	applyActiveNav() {
		const containers = this.querySelectorAll("[data-active]");
		containers.forEach(el => {
			const target = (el.getAttribute("data-active") || "").trim();
			if (!target) return;
			// Remove previous .active in this container
			el.querySelectorAll(".active").forEach(a => a.classList.remove("active"));
			// Add to matching link(s)
			el.querySelectorAll(`[data-nav="${CSS.escape(target)}"]`).forEach(a => a.classList.add("active"));
		});
	}
}

// Define the element once (safe to include layout.js multiple times across pages).
if (!customElements.get("x-include")) {
	customElements.define("x-include", XInclude);
}

// (Optional) tiny helper to expose a promise when all x-includes on a page are loaded.
export function whenIncludesReady(root = document) {
	const nodes = Array.from(root.querySelectorAll("x-include"));
	if (nodes.length === 0) return Promise.resolve();
	return Promise.all(nodes.map(n => new Promise(resolve => {
		const done = () => resolve();
		n.addEventListener("x-include:loaded", done, { once: true });
		n.addEventListener("x-include:error", done, { once: true });
	})));
}
