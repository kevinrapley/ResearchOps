/**
 * @file components/layout.js
 * @summary <x-include> for HTML partials with Mustache-style rendering and debug gating.
 *
 * Usage:
 *   <x-include src="/partials/header.html" vars='{"active":"Projects","subtitle":"Project Dashboard"}'></x-include>
 *   <x-include src="/partials/debug.html" debug-only></x-include>  // renders only if ?debug=true
 */

class XInclude extends HTMLElement {
	static get observedAttributes() { return ["src", "vars", "debug-only"]; }

	connectedCallback() { this.render(); }
	attributeChangedCallback() { this.render(); }

	get src() { return this.getAttribute("src") || ""; }
	get varsAttr() { return this.getAttribute("vars") || ""; }
	get debugOnly() { return this.hasAttribute("debug-only"); }

	// --- Tiny Mustache-ish renderer -----------------------------------------
	renderTemplate(tpl, data = {}) {
		if (!tpl) return "";

		// Sections: {{#key}}...{{/key}} (arrays or truthy values)
		tpl = tpl.replace(/\{\{#([\w.[\]-]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
			const val = this.lookup(data, key);
			if (Array.isArray(val)) {
				return val.map(item => this.renderTemplate(inner, { ...data, ".": item })).join("");
			}
			return val ? this.renderTemplate(inner, data) : "";
		});

		// Triple-stash {{{key}}} (unescaped)
		tpl = tpl.replace(/\{\{\{\s*([\w.[\]-]+)\s*\}\}\}/g, (_, key) => {
			const v = this.lookup(data, key);
			return v == null ? "" : String(v);
		});

		// Double-stash {{key}} (escaped)
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
		try { return JSON.parse(raw); } catch { console.warn("[x-include] vars JSON invalid; ignoring:", raw); return {}; }
	}

	async fetchText(url) {
		const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
		if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
		return res.text();
	}

	// Ensure any <script> inside the included HTML actually runs
	activateScripts(root) {
		const scripts = Array.from(root.querySelectorAll("script"));
		for (const old of scripts) {
			const s = document.createElement("script");
			// Copy attributes (type, src, async, defer, etc.)
			for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
			if (!old.src) s.textContent = old.textContent;
			old.replaceWith(s);
		}
	}

	async render() {
		try {
			// Debug gating
			if (this.debugOnly) {
				const isDebug = new URL(location.href).searchParams.get("debug") === "true";
				if (!isDebug) { this.innerHTML = ""; return; }
			}

			// Normalize to root-absolute
			if (!this.src) { this.innerHTML = "<!-- x-include: missing src -->"; return; }
			const path = this.src.startsWith("/") ? this.src : `/${this.src.replace(/^\/+/, "")}`;

			const tpl = await this.fetchText(path);
			const html = this.renderTemplate(tpl, this.parseVars());

			// LIGHT DOM render so page CSS applies
			this.innerHTML = html;

			// Make any scripts inside the partial execute
			this.activateScripts(this);

		} catch (err) {
			console.error("[x-include] render error", { src: this.src, err });
			this.innerHTML = `<!-- x-include error: ${this.escapeHtml(String(err?.message || err))} -->`;
		}
	}
}

customElements.define("x-include", XInclude);
