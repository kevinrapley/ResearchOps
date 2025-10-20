/**
 * ResearchOps Tabs (GOV.UK-style behaviour) — no CSS.escape dependency
 * Version:  v1.0.1
 * Purpose:  Enhance .govuk-tabs markup with ARIA, keyboard, hash sync, and events.
 * License:  All rights reserved
 */

// Convert ?tab= to hash before initialization
const params = new URLSearchParams(location.search);
const qtab = params.get('tab');
if (qtab && !location.hash) {
	history.replaceState(null, '', location.pathname + location.search + '#' + qtab);
}

(function() {
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

	function ensureVisible(el) {
		el.classList.remove('govuk-tabs__panel--hidden');
		el.removeAttribute('hidden');
	}

	function initContainer(container) {
		if (!container) return;

		const list = $('.govuk-tabs__list', container);
		const items = $$('.govuk-tabs__list > li', container);
		const panels = $$('.govuk-tabs__panel', container);
		if (!list || !items.length || !panels.length) return;

		list.setAttribute('role', 'tablist');

		items.forEach((li, idx) => {
			const a = $('.govuk-tabs__tab', li);
			if (!a) return;
			if (!a.id) a.id = `tab_${container.id || 'tabs'}_${idx}`;

			let targetId = (a.getAttribute('href') || '').replace(/^#/, '');
			if (!targetId) {
				const p = panels[idx];
				if (p?.id) {
					targetId = p.id;
					a.setAttribute('href', `#${targetId}`);
				}
			}

			a.setAttribute('role', 'tab');
			a.setAttribute('aria-controls', targetId);
			a.setAttribute('aria-selected', 'false');
			a.setAttribute('tabindex', '-1');
		});

		panels.forEach((p) => {
			const tab = $(`.govuk-tabs__tab[aria-controls="${p.id}"]`, container);
			if (tab) p.setAttribute('aria-labelledby', tab.id);
			p.setAttribute('role', 'tabpanel');
		});

		function selectById(id, { updateHash = true, focusTab = false } = {}) {
			if (!id) return;

			const targetPanel = document.getElementById(id);
			const targetTab = $(`.govuk-tabs__tab[aria-controls="${id}"]`, container);
			if (!targetPanel || !container.contains(targetPanel) || !targetTab) return;

			ensureVisible(targetPanel);

			items.forEach((li) => li.classList.remove('govuk-tabs__list-item--selected'));
			targetTab.closest('li')?.classList.add('govuk-tabs__list-item--selected');

			$$('.govuk-tabs__tab', container).forEach((t) => {
				const active = t === targetTab;
				t.setAttribute('aria-selected', active ? 'true' : 'false');
				t.setAttribute('tabindex', active ? '0' : '-1');
			});

			panels.forEach((p) => {
				const show = p === targetPanel;
				p.classList.toggle('govuk-tabs__panel--hidden', !show);
				if (show) p.removeAttribute('hidden');
				else p.setAttribute('hidden', '');
			});

			if (focusTab) targetTab.focus({ preventScroll: true });
			if (updateHash) {
				const newHash = `#${id}`;
				if (location.hash !== newHash) history.pushState(null, '', newHash);
			}

			// Fire event for observers
			targetPanel.dispatchEvent(new CustomEvent('tab:shown', {
				bubbles: true,
				detail: { id, container }
			}));
		}

		list.addEventListener('click', (e) => {
			const a = e.target.closest('.govuk-tabs__tab');
			if (!a) return;
			const id = (a.getAttribute('href') || '').slice(1);
			if (!id) return;
			e.preventDefault();
			selectById(id, { updateHash: true, focusTab: true });
		});

		list.addEventListener('keydown', (e) => {
			const tabs = $$('.govuk-tabs__tab', list);
			const i = tabs.findIndex((t) => t.getAttribute('tabindex') === '0');
			if (i < 0) return;

			let next = null;
			if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
			if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
			if (e.key === 'Home') next = tabs[0];
			if (e.key === 'End') next = tabs[tabs.length - 1];

			if (next) {
				e.preventDefault();
				const id = (next.getAttribute('href') || '').slice(1);
				selectById(id, { updateHash: true, focusTab: true });
			}
		});

		function applyHash() {
			const id = (location.hash || '').slice(1);
			if (!id) return false;
			if (!$(`.govuk-tabs__tab[aria-controls="${id}"]`, container)) return false;
			selectById(id, { updateHash: false, focusTab: false });
			return true;
		}
		window.addEventListener('hashchange', applyHash);

		// Initial selection: hash or first tab
		let initialId = null;
		if (!applyHash()) {
			const first = $('.govuk-tabs__tab', container);
			if (first) {
				initialId = (first.getAttribute('href') || '').slice(1);
				selectById(initialId, { updateHash: false, focusTab: false });
			}
		} else {
			initialId = (location.hash || '').slice(1);
		}

		// Mark ready (stops pre-init CSS) and re-emit initial event on next tick
		container.classList.add('is-ready');
		if (initialId) {
			setTimeout(() => {
				const panel = document.getElementById(initialId);
				if (panel) {
					panel.dispatchEvent(new CustomEvent('tab:shown', {
						bubbles: true,
						detail: { id: initialId, container }
					}));
				}
			}, 0);
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		Array.from(document.querySelectorAll('.govuk-tabs')).forEach(initContainer);
	});
})();
