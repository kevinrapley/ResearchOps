// examples/components/layout.js
// Safari-safe <x-include> with variables, block conditionals, and guarded DOM ops (light DOM)

(function() {
	"use strict";

	// ---- Guarded DOM helpers -------------------------------------------------
	function qs(root, sel) {
		try { return (root || document).querySelector(sel) || null; } catch { return null; }
	}

	function qsa(root, sel) {
		try { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); } catch { return []; }
	}

	function setText(el, text) {
		if (el) el.textContent = text;
	}

	function setHTML(el, html) {
		if (el) el.innerHTML = html;
	}

	function toggleClass(el, cls, on) {
		if (el && el.classList) el.classList.toggle(cls, !!on);
	}

	// --- <x-include> with variables & dual active states (main + project) ---
	class XInclude extends HTMLElement {
		static get observedAttributes() { return ['src', 'vars', 'title', 'subtitle', 'active', 'active_project', 'org', 'build']; }
		connectedCallback() { this.load(); }
		attributeChangedCallback() { this.load(); }

		// Collect variables from attributes + optional JSON in `vars`
		getVars() {
			const base = {
				title: this.getAttribute('title') || 'Research Operations',
				subtitle: this.getAttribute('subtitle') || 'Internal Demo',
				active: this.getAttribute('active') || '', // header active
				active_project: this.getAttribute('active_project') || '', // project tabs active
				org: this.getAttribute('org') || 'Home Office Biometrics',
				build: this.getAttribute('build') || 'ResearchOps v1.0.0 (demo)',
				year: String(new Date().getFullYear())
			};
			const extras = this.getAttribute('vars');
			if (!extras) return base;
			try { return { ...base, ...JSON.parse(extras) }; } catch { return base; }
		}

		async load() {
			const src = this.getAttribute('src');
			if (!src) return;

			// fetch HTML first (keep variable in outer scope for Safari)
			let text = '';
			try {
				const resp = await fetch(src, { credentials: 'same-origin' });
				text = await resp.text();
			} catch (e) {
				this.innerHTML = `<div style="color:#d4351c">Include failed (fetch): ${e.message || e}</div>`;
				return;
			}

			// process template
			try {
				const vars = this.getVars();

				// --- block truthy: {{#var}}...{{/var}}
				text = text.replace(/{{#\s*([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g,
					function(_m, key, inner) {
						const v = vars[key];
						return (v !== undefined && v !== null && String(v).length > 0) ? inner : '';
					});

				// --- block falsy: {{^var}}...{{/var}}
				text = text.replace(/{{\^\s*([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\/\s*\1\s*}}/g,
					function(_m, key, inner) {
						const v = vars[key];
						return (v === undefined || v === null || String(v).length === 0) ? inner : '';
					});

				// --- simple replacements: {{var}}
				Object.keys(vars).forEach(function(k) {
					// global, case-sensitive
					const rx = new RegExp('{{\\s*' + k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*}}', 'g');
					text = text.replace(rx, String(vars[k]));
				});

				this.innerHTML = text; // light DOM — styles apply

				// highlight active main nav
				const activeMain = (vars.active || '').toLowerCase();
				if (activeMain) {
					Array.prototype.forEach.call(this.querySelectorAll('a[data-nav]'), function(a) {
						const key = (a.getAttribute('data-nav') || a.textContent || '').trim().toLowerCase();
						a.classList.toggle('active', key === activeMain);
					});
				}

				// highlight active project tab
				const activeProj = (vars.active_project || '').toLowerCase();
				if (activeProj) {
					Array.prototype.forEach.call(this.querySelectorAll('a[data-project-nav]'), function(a) {
						const key = (a.getAttribute('data-project-nav') || a.textContent || '').trim().toLowerCase();
						a.classList.toggle('active', key === activeProj);
					});
				}
			} catch (e) {
				this.innerHTML = `<div style="color:#d4351c">Include failed (template): ${e.message || e}</div>`;
			}
		}
	}
	// register component (guarded)
	try { customElements.define('x-include', XInclude); } catch { /* already defined */ }

})();
