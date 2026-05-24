/**
 * @file components/layout.js
 * @module layout
 * @summary Enhanced <x-include> custom element with Mustache-style rendering,
 * root-absolute URL normalisation, optional debug gating and active navigation.
 */

class XInclude extends HTMLElement {
	static get observedAttributes() {
		return ["src", "vars", "debug-only"];
	}

	constructor() {
		super();
		this._abort = null;
		this._hasConnected = false;
		this._needsRerender = false;
		this._renderId = 0;
		this._renderQueued = false;
	}

	connectedCallback() {
		this._hasConnected = true;
		this._maybeApplyFooterDefaults();
		this._queueRender();
	}

	attributeChangedCallback() {
		if (!this._hasConnected) return;
		this._maybeApplyFooterDefaults();
		this._queueRender();
	}

	disconnectedCallback() {
		this._hasConnected = false;
		this._renderId += 1;
		if (this._abort) this._abort.abort();
	}

	normalizeUrl(value) {
		const url = String(value || "").trim();
		if (!url) return "";
		if (/^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(url)) return url;
		return `/${url.replace(/^\.?\//, "")}`;
	}

	parseVars() {
		const raw = (this.getAttribute("vars") || "").trim();
		if (!raw) return {};
		try {
			return JSON.parse(raw);
		} catch {
			console.warn("[x-include] Invalid JSON in vars:", raw);
			return {};
		}
	}

	escapeHtml(value) {
		const div = document.createElement("div");
		div.textContent = String(value ?? "");
		return div.innerHTML;
	}

	lookup(data, path) {
		if (path === "." || path === "this") return data;
		return path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), data);
	}

	renderTemplate(template, data) {
		if (!template) return "";

		let output = template.replace(/\{\{#\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_match, key, inner) => {
			const value = this.lookup(data, key);
			if (Array.isArray(value)) {
				return value.map((item) => this.renderTemplate(inner, { ...data, ".": item })).join("");
			}
			return value ? this.renderTemplate(inner, data) : "";
		});

		output = output.replace(/\{\{\^\s*([\w.[\]-]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g, (_match, key, inner) => {
			const value = this.lookup(data, key);
			const shouldRender = Array.isArray(value) ? value.length === 0 : !value;
			return shouldRender ? this.renderTemplate(inner, data) : "";
		});

		output = output.replace(/\{\{\{\s*([\w.[\]-]+)\s*\}\}\}|\{\{&\s*([\w.[\]-]+)\s*\}\}/g, (_match, rawKey, ampKey) => {
			const value = this.lookup(data, rawKey || ampKey);
			return value == null ? "" : String(value);
		});

		return output.replace(/\{\{\s*([\w.[\]-]+)\s*\}\}/g, (_match, key) => {
			const value = this.lookup(data, key);
			return this.escapeHtml(value == null ? "" : String(value));
		});
	}

	_maybeApplyFooterDefaults() {
		const src = this.normalizeUrl(this.getAttribute("src") || "");
		if (src !== "/partials/footer.html") return;
		if (this.hasAttribute("vars")) return;
		this.setAttribute(
			"vars",
			JSON.stringify({
				year: new Date().getFullYear(),
				org: "Home Office Biometrics",
				build: "ResearchOps v1.0.0",
			}),
		);
	}

	fetchCacheMode(src) {
		return src.includes("/partials/debug") ? "no-store" : "force-cache";
	}

	_queueRender() {
		if (this._renderQueued) return;
		this._renderQueued = true;
		Promise.resolve().then(() => {
			this._renderQueued = false;
			this._render();
		});
	}

	async _render() {
		const renderId = this._renderId + 1;
		this._renderId = renderId;
		if (this._abort) this._abort.abort();

		if (this.hasAttribute("debug-only")) {
			const url = new URL(location.href);
			if (url.searchParams.get("debug") !== "true") {
				this.innerHTML = "";
				return;
			}
		}

		const src = this.normalizeUrl(this.getAttribute("src") || "");
		if (!src) {
			this.innerHTML = "<!-- x-include: missing src -->";
			return;
		}

		this._needsRerender = false;
		this._abort = new AbortController();

		try {
			const response = await fetch(src, {
				cache: this.fetchCacheMode(src),
				credentials: "same-origin",
				signal: this._abort.signal,
			});
			const text = await response.text();
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			if (renderId !== this._renderId) return;

			const html = this.renderTemplate(text, this.parseVars());
			this.innerHTML = html;
			if (html.includes("<script")) this.executeScripts();
			this.applyActiveNav();
			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src, ok: true } }));
		} catch (error) {
			if (renderId !== this._renderId || error?.name === "AbortError") return;
			console.error("[x-include] render error:", src, error);
			this.innerHTML = `<!-- x-include error: ${this.escapeHtml(String(error?.message || error))} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src, error: String(error) } }));
		} finally {
			if (renderId !== this._renderId) return;
			this._abort = null;
			if (this._needsRerender) {
				this._needsRerender = false;
				this._queueRender();
			}
		}
	}

	applyActiveNav() {
		this.querySelectorAll("[data-active]").forEach((container) => {
			const active = (container.getAttribute("data-active") || "").trim();
			if (!active) return;
			container.querySelectorAll("[data-nav]").forEach((link) => {
				const isActive = (link.getAttribute("data-nav") || "").trim() === active;
				const item = link.closest(".govuk-service-navigation__item");
				if (item) item.classList.toggle("govuk-service-navigation__item--active", isActive);
				link.classList.toggle("active", isActive);
				if (isActive) link.setAttribute("aria-current", "page");
				else link.removeAttribute("aria-current");
			});
		});
	}

	executeScripts() {
		Array.from(this.querySelectorAll("script")).forEach((oldScript) => {
			const script = document.createElement("script");
			Array.from(oldScript.attributes).forEach(({ name, value }) => script.setAttribute(name, value));
			if (!script.src) script.textContent = oldScript.textContent || "";
			oldScript.replaceWith(script);
		});
	}
}

if (!customElements.get("x-include")) customElements.define("x-include", XInclude);

export function whenIncludesReady(root = document) {
	const nodes = Array.from(root.querySelectorAll("x-include"));
	if (nodes.length === 0) return Promise.resolve();
	return Promise.all(
		nodes.map(
			(node) =>
				new Promise((resolve) => {
					const done = () => resolve();
					node.addEventListener("x-include:loaded", done, { once: true });
					node.addEventListener("x-include:error", done, { once: true });
				}),
		),
	);
}

(() => {
	const DEBUG_PARAM = "debug";
	const DEBUG_VALUE = "true";
	const CONSOLE_ID = "debug-console";

	const isActive = new URLSearchParams(location.search).get(DEBUG_PARAM) === DEBUG_VALUE;
	if (!isActive) return;

	function shouldDecorate(href) {
		if (!href) return false;
		if (/^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return false;
		try {
			return new URL(href, location.href).origin === location.origin;
		} catch {
			return false;
		}
	}

	function injectDebug() {
		if (document.getElementById(CONSOLE_ID)) return;
		if (document.querySelector('x-include[src="/partials/debug.html"]')) return;
		const include = document.createElement("x-include");
		include.setAttribute("src", "/partials/debug.html");
		document.body.appendChild(include);
	}

	function decorateLinks() {
		document.querySelectorAll("a[href]").forEach((link) => {
			const raw = link.getAttribute("href") || "";
			if (!shouldDecorate(raw)) return;
			const url = new URL(raw, location.href);
			url.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
			link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
		});
	}

	function ready(callback) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", callback, { once: true });
			return;
		}
		callback();
	}

	ready(() => {
		injectDebug();
		decorateLinks();
		document.addEventListener(
			"click",
			(event) => {
				const link = event.target?.closest?.("a[href]");
				if (!link || !shouldDecorate(link.getAttribute("href") || "")) return;
				const url = new URL(link.href, location.href);
				url.searchParams.set(DEBUG_PARAM, DEBUG_VALUE);
				link.href = `${url.pathname}${url.search}${url.hash}`;
			},
			{ capture: true },
		);
	});
})();
