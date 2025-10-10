/**
 * @file components/layout.js
 * @summary Defines <x-include> for HTML partials with Mustache-style rendering and debug gating.
 *
 * Usage:
 *   <x-include src="/partials/header.html" vars='{"active":"Projects","subtitle":"Project Dashboard"}'></x-include>
 *   <x-include src="/partials/debug.html" debug-only></x-include>  // only renders if ?debug=true is in URL
 */

class XInclude extends HTMLElement {
	static get observedAttributes() { return ["src", "vars", "debug-only"]; }

	constructor() {
		super();
		this.attachShadow({ mode: "open" });
	}

	connectedCallback() { this.render(); }
	attributeChangedCallback() { this.render(); }

	get src() { return this.getAttribute("src") || ""; }
	get varsAttr() { return this.getAttribute("vars") || ""; }
	get debugOnly() { return this.hasAttribute("debug-only"); }

	/**
	 * Tiny Mustache-ish renderer (supports: {{key}}, {{{key}}}, sections {{#key}}...{{/key}} for truthy/arrays).
	 * This is intentionally minimal to avoid external deps. If you prefer full Mustache, swap this out.
	 */
	renderTemplate(tpl, data = {}) {
		if (!tpl) return "";

		// Sections (truthy or arrays)
		tpl = tpl.replace(/\{\{#([\w.[\]-]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
			const val = this.lookup(data, key);
			if (Array.isArray(val)) {
				return val.map(item => this.renderTemplate(inner, { ...data, ".": item })).join("");
			}
			if (val) {
				// For truthy non-array, render once with same data
				return this.renderTemplate(inner, data);
			}
			return "";
		});

		// Triple stash (no escape)
		tpl = tpl.replace(/\{\{\{\s*([\w.[\]-]+)\s*\}\}\}/g, (_, key) => {
			const v = this.lookup(data, key);
			return v == null ? "" : String(v);
		});

		// Double stash (escaped)
		tpl = tpl.replace(/\{\{\s*([\w.[\]-]+)\s*\}\}/g, (_, key) => {
			const v = this.lookup(data, key);
			return this.escapeHtml(v == null ? "" : String(v));
		});

		return tpl;
	}

	lookup(obj, path) {
		if (path === "." || path === "this") return obj;
		return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
	}

	escapeHtml(str) {
		const div = document.createElement("div");
		div.textContent = str;
		return div.innerHTML;
	}

	parseVars() {
		const raw = this.varsAttr.trim();
		if (!raw) return {};
		try {
			// Allow JSON in single-quoted attribute
			return JSON.parse(raw);
		} catch {
			console.warn("[x-include] vars is not valid JSON; ignoring:", raw);
			return {};
		}
	}

	async fetchText(url) {
		const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
		if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
		return res.text();
	}

	async render() {
		const url = new URL(location.href);
		if (this.debugOnly && url.searchParams.get("debug") !== "true") {
			this.shadowRoot.innerHTML = ""; // don’t render when debug-only and ?debug=true not set
			return;
		}

		const src = this.src;
		if (!src) {
			this.shadowRoot.innerHTML = "<!-- x-include: missing src -->";
			return;
		}

		// Enforce root-absolute to avoid nested path issues
		const path = src.startsWith("/") ? src : `/${src.replace(/^\/+/, "")}`;

		try {
			const tpl = await this.fetchText(path);
			const data = this.parseVars();
			const html = this.renderTemplate(tpl, data);
			// Adopt styles from the page, so we don’t isolate content
			this.shadowRoot.innerHTML = `<div part="content">${html}</div>`;
			// Re-upgrade any nested custom elements
			await Promise.resolve();
		} catch (err) {
			console.error("[x-include] render error", { src: path, err });
			this.shadowRoot.innerHTML = `<!-- x-include error: ${this.escapeHtml(String(err?.message || err))} -->`;
		}
	}
}

customElements.define("x-include", XInclude);
