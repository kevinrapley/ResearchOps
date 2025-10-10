/**
 * @file components/layout.js
 * @module layout
 * @summary Site-wide layout helpers loaded on every page.
 *
 * Adds a root-absolute path normalizer so relative href/src (like "components/foo.js")
 * are rewritten to "/components/foo.js" before the browser tries to fetch them.
 * Also touches <x-include> elements (if present) before they load.
 */

import "./x-include.js";

/**
 * Return true if a URL string already has a safe/absolute scheme we should not modify.
 * @param {string} s
 */
function hasAllowedScheme(s) {
	return /^(?:\/|https?:|data:|mailto:|tel:|#|javascript:)/i.test(s);
}

/**
 * Convert a possibly-relative local URL to a root-absolute one.
 * @param {string} u
 * @returns {string}
 */
function toRootAbsolute(u) {
	const s = (u || "").trim();
	if (!s || hasAllowedScheme(s)) return s;
	return "/" + s.replace(/^\.?\//, "");
}

/**
 * Normalize attributes on a Node in-place.
 * @param {Element} el
 */
function normalizeEl(el) {
	// Generic href/src attributes
	if (el.hasAttribute && el.hasAttribute("href")) {
		const v = el.getAttribute("href");
		el.setAttribute("href", toRootAbsolute(v));
	}
	if (el.hasAttribute && el.hasAttribute("src")) {
		const v = el.getAttribute("src");
		el.setAttribute("src", toRootAbsolute(v));
	}

	// <x-include src="...">
	if (el.tagName && el.tagName.toLowerCase() === "x-include" && el.hasAttribute("src")) {
		const v = el.getAttribute("src");
		el.setAttribute("src", toRootAbsolute(v));
	}
}

/**
 * Normalize all elements currently in the DOM.
 */
function normalizeDocument() {
	// Anything with href or src
	document.querySelectorAll("[href], [src]").forEach(normalizeEl);
	// Explicitly include <x-include> even if it had neither attr at query time
	document.querySelectorAll("x-include").forEach(normalizeEl);
}

/**
 * Mutation observer to normalize dynamic inserts early.
 */
function startObserver() {
	const mo = new MutationObserver((muts) => {
		for (const m of muts) {
			m.addedNodes && m.addedNodes.forEach((n) => {
				if (n.nodeType === Node.ELEMENT_NODE) {
					normalizeEl( /** @type {Element} */ (n));
					// Also walk children, in case a subtree was appended
					n.querySelectorAll && n.querySelectorAll("[href], [src], x-include").forEach(normalizeEl);
				}
			});
		}
	});
	mo.observe(document.documentElement, { childList: true, subtree: true });
}

(function boot() {
	// Run ASAP; if DOM is ready, do it now. Otherwise, on DOMContentLoaded.
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			normalizeDocument();
			startObserver();
		}, { once: true });
	} else {
		normalizeDocument();
		startObserver();
	}
})();