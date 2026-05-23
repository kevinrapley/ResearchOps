class XInclude extends HTMLElement {
	static get observedAttributes() {
		return ["src", "vars"];
	}

	connectedCallback() {
		this.render();
	}

	attributeChangedCallback() {
		if (!this.isConnected) return;
		this.render();
	}

	normalizeUrl(value) {
		const source = String(value || "").trim();
		if (!source) return "";
		if (/^(?:\/|https?:|data:|mailto:|tel:|#)/i.test(source)) return source;
		return `/${source.replace(/^\.?\//, "")}`;
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
		const node = document.createElement("div");
		node.textContent = String(value ?? "");
		return node.innerHTML;
	}

	renderTemplate(template, data) {
		return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
			const value = data[key];
			return this.escapeHtml(value == null ? "" : value);
		});
	}

	applyActiveNavigation() {
		this.querySelectorAll("[data-active]").forEach((container) => {
			const active = (container.getAttribute("data-active") || "").trim();

			container.querySelectorAll("[data-nav]").forEach((link) => {
				const isActive = active && link.getAttribute("data-nav") === active;
				const item = link.closest(".govuk-service-navigation__item");

				if (item) {
					item.classList.toggle("govuk-service-navigation__item--active", Boolean(isActive));
				}

				if (isActive) {
					link.setAttribute("aria-current", "page");
					return;
				}

				link.removeAttribute("aria-current");
			});
		});
	}

	async render() {
		const source = this.normalizeUrl(this.getAttribute("src"));

		if (!source) {
			this.innerHTML = "<!-- x-include: missing src -->";
			return;
		}

		try {
			const response = await fetch(source, { cache: "force-cache", credentials: "same-origin" });
			const template = await response.text();

			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText}`);
			}

			this.innerHTML = this.renderTemplate(template, this.parseVars());
			this.applyActiveNavigation();
			this.dispatchEvent(new CustomEvent("x-include:loaded", { detail: { src: source, ok: true } }));
		} catch (error) {
			console.error("[x-include] render error:", source, error);
			this.innerHTML = `<!-- x-include error: ${this.escapeHtml(String(error?.message || error))} -->`;
			this.dispatchEvent(new CustomEvent("x-include:error", { detail: { src: source, error: String(error) } }));
		}
	}
}

if (!customElements.get("x-include")) {
	customElements.define("x-include", XInclude);
}

export function whenIncludesReady(root = document) {
	const includes = Array.from(root.querySelectorAll("x-include"));
	if (!includes.length) return Promise.resolve();

	return Promise.all(includes.map((include) => new Promise((resolve) => {
		include.addEventListener("x-include:loaded", resolve, { once: true });
		include.addEventListener("x-include:error", resolve, { once: true });
	})));
}
