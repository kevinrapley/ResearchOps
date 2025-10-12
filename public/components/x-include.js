/**
 * @file components/x-include.js
 * @module XInclude
 * @summary HTML partial include with root-absolute URL normalization and Mustache-ish templating.
 *
 * Usage:
 *   <x-include src="/partials/header.html" vars='{"active":"Home","subtitle":"Hello"}'></x-include>
 *   <x-include src="/partials/debug.html" debug-only></x-include>  <!-- only when ?debug=true -->
 */

class XInclude extends HTMLElement {
	static get observedAttributes() { return ["src", "vars", "debug-only"]; }

	connectedCallback() { this.render(); }
	attributeChangedCallback() { this.render(); }

	/* ── Attributes helpers ─────────────────────────────────────────────── */
	get src() { return this.getAttribute("src") || ""; }
	set src(v) { v == null ? this.removeAttribute("src") : this.setAttribute("src", v); }

	get vars() { return this.getAttribute("vars") || ""; }
	set vars(v) { v == null ? this.removeAttribute("vars") : this.setAttribute("vars", v); }

	get debugOnly() { return this.hasAttribute("debug-only"); }

	/* ── URL + vars ─────────────────────────────────────────────────────── */
	normalizeUrl(u) {
		const s = (u || "").trim();
		if (!s) return "";
		// allow: /, http(s), data, mailto, tel, anchor, javascript:
		if (/^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(s)) return s;
		return "/" + s.replace(/^\.?\//, "");
	}

	parseVars() {
		const raw = this.vars.trim();
		if (!raw) return {};
		try { return JSON.parse(raw); } catch { console.warn("[x-include] vars JSON invalid:", raw); return {}; }
	}

	/* ── Minimal Mustache-ish renderer ──────────────────────────────────── */
	lookup(obj, path) {
		if (path === "." || path === "this") return obj;
		return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
	}

	escapeHtml(str) {
		const div = document.createElement("div");
		div.textContent = String(str ?? "");
		return div.innerHTML;
	}

	renderTemplate(tpl, data = {}) {
		if (!tpl) return "";

		// Sections {{#key}}...{{/key}} (arrays -> repeat; truthy -> once)
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

	/* ── Fetch + render into light DOM; activate scripts ────────────────── */
	async fetchText(url) {
		const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return res.text();
	}

	activateScripts(root) {
		const scripts = Array.from(root.querySelectorAll("script"));
		for (const old of scripts) {
			const s = document.createElement("script");
			for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
			if (!old.src) s.textContent = old.textContent;
			old.replaceWith(s);
		}
	}

	async render() {
		try {
			// Debug gate
			if (this.debugOnly) {
				const isDebug = new URL(location.href).searchParams.get("debug") === "true";
				if (!isDebug) { this.innerHTML = ""; return; }
			}

			const src = this.normalizeUrl(this.src);
			if (!src) { this.innerHTML = "<!-- x-include: missing src -->"; return; }

			const tpl = await this.fetchText(src);
			const html = this.renderTemplate(tpl, this.parseVars());

			// Light DOM (so global styles apply)
			this.innerHTML = html;

			// Ensure any inline scripts run
			this.activateScripts(this);

			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src, ok: true } }));
		} catch (err) {
			console.error("[x-include] render error", { src: this.src, err });
			this.innerHTML = `<!-- x-include error: ${this.escapeHtml(String(err?.message || err))} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src: this.src, error: String(err) } }));
		}
	}
}

if (!customElements.get("x-include")) {
	customElements.define("x-include", XInclude);
}
export { XInclude };
