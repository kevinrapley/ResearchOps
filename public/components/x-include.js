/**
 * @file components/x-include.js
 * @module XInclude
 * @summary Lightweight HTML include with root-absolute URL normalization and simple {{var}} substitution.
 *
 * Usage:
 *   <x-include src="/partials/header.html"></x-include>
 *   <x-include src="partials/footer.html" vars='{"active":"Projects"}'></x-include>
 *
 * Notes:
 * - Any `src` that doesn't start with "/", "http(s):", "data:", "mailto:", "tel:", "#", or "javascript:" will be
 *   rewritten to start with "/".
 * - Variables are optional; if present, they should be a JSON object (string) and will be interpolated
 *   into the fetched HTML using a simple {{key}} matcher (shallow; dot-notation is not supported here).
 */

export class XInclude extends HTMLElement {
	/** @returns {string[]} */
	static get observedAttributes() { return ["src", "vars"]; }

	constructor() {
		super();
		/** @private */
		this._loading = false;
		/** @private */
		this._controller = null;
	}

	/** Upgrade pre-defined properties set before the element definition was registered. */
	upgradeProperty(prop) {
		if (this.hasOwnProperty(prop)) {
			const value = this[prop];
			delete this[prop];
			this[prop] = value;
		}
	}

	connectedCallback() {
		this.upgradeProperty("src");
		this.upgradeProperty("vars");
		// Render immediately (attributeChangedCallback will also re-render on change)
		this._render();
	}

	disconnectedCallback() {
		if (this._controller) this._controller.abort();
		this._controller = null;
	}

	/**
	 * Normalize to a root-absolute URL unless the string already uses an allowed scheme.
	 * @param {string} u
	 * @returns {string}
	 */
	normalizeUrl(u) {
		const s = (u || "").trim();
		if (!s) return "";
		if (/^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(s)) return s;
		return "/" + s.replace(/^\.?\//, "");
	}

	/**
	 * Parse `vars` attribute JSON (if any).
	 * @returns {Record<string, any>}
	 */
	getVars() {
		const raw = this.getAttribute("vars");
		if (!raw) return {};
		try { return JSON.parse(raw); } catch { return {}; }
	}

	/**
	 * Shallow Mustache-style replacement: {{key}}
	 * @param {string} html
	 * @param {Record<string, any>} vars
	 * @returns {string}
	 */
	applyVars(html, vars) {
		if (!vars || typeof vars !== "object") return html;
		return String(html).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
			const v = vars[k];
			if (v === undefined || v === null) return "";
			return String(v);
		});
	}

	/**
	 * Fetch and render the include.
	 * @private
	 */
	async _render() {
		if (this._loading) return;
		const src = this.normalizeUrl(this.getAttribute("src"));
		if (!src) return;

		this._loading = true;
		this._controller = new AbortController();
		const signal = this._controller.signal;

		try {
			const res = await fetch(src, { cache: "no-store", signal });
			const text = await res.text();
			const html = res.ok ? text : `<!-- x-include: ${src} ${res.status} -->`;
			const rendered = this.applyVars(html, this.getVars());
			this.innerHTML = rendered;
			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src, ok: res.ok, status: res.status } }));
		} catch (err) {
			this.innerHTML = `<!-- x-include: ${src} FAILED: ${String(err)} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src, error: String(err) } }));
		} finally {
			this._loading = false;
			this._controller = null;
		}
	}

	/** @param {string} name @param {string|null} _old @param {string|null} _new */
	attributeChangedCallback(name, _old, _new) {
		if (name === "src" || name === "vars") {
			// Re-render when src or vars changes
			this._render();
		}
	}

	/** Getter/Setter passthroughs (nice DX) */
	get src() { return this.getAttribute("src"); }
	set src(v) { if (v == null) this.removeAttribute("src");
		else this.setAttribute("src", v); }

	get vars() { return this.getAttribute("vars"); }
	set vars(v) { if (v == null) this.removeAttribute("vars");
		else this.setAttribute("vars", v); }
}

// Define the element once.
if (!customElements.get("x-include")) {
	customElements.define("x-include", XInclude);
}