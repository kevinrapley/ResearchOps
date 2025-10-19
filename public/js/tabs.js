/**
 * ResearchOps Tabs (GOV.UK-style behaviour) — no CSS.escape dependency
 * Version:  v1.0.1
 * Purpose:  Enhance .govuk-tabs markup with ARIA, keyboard, hash sync, and events.
 * License:  All rights reserved
 */

(function() {
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

	function initContainer(container) {
		if (!container) return;

		const list = $('.govuk-tabs__list', container);
		const items = $$('.govuk-tabs__list > li', container);
		const panels = $$('.govuk-tabs__panel', container);
		if (!list || !items.length || !panels.length) return;

		// ARIA wiring
		list.setAttribute('role', 'tablist');

		items.forEach((li, idx) => {
			const a = $('.govuk-tabs__tab', li);
			if (!a) return;

			if (!a.id) a.id = `tab_${container.id || 'tabs'}_${idx}`;

			// target id
			let targetId = (a.getAttribute('href') || '').replace(/^#/, '');
			if (!targetId) {
				const p = panels[idx];
				if (p && p.id) {
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

			// Resolve elements without CSS.escape
			const targetPanel = document.getElementById(id);
			const targetTab = $(`.govuk-tabs__tab[aria-controls="${id}"]`, container);

			// Ensure they belong to this container
			if (!targetPanel || !container.contains(targetPanel) || !targetTab) return;

			// Toggle selected class on <li>
			items.forEach((li) => li.classList.remove('govuk-tabs__list-item--selected'));
			const li = targetTab.closest('li');
			if (li) li.classList.add('govuk-tabs__list-item--selected');

			// Tabs state
			$$('.govuk-tabs__tab', container).forEach((t) => {
				const isActive = t === targetTab;
				t.setAttribute('aria-selected', isActive ? 'true' : 'false');
				t.setAttribute('tabindex', isActive ? '0' : '-1');
			});

			// Panels visibility (class + hidden attr for robustness)
			panels.forEach((p) => {
				const show = p === targetPanel;
				p.classList.toggle('govuk-tabs__panel--hidden', !show);
				if (show) {
					p.removeAttribute('hidden');
				} else {
					p.setAttribute('hidden', '');
				}
			});

			if (focusTab) targetTab.focus({ preventScroll: true });

			if (updateHash) {
				const newHash = `#${id}`;
				if (location.hash !== newHash) history.pushState(null, '', newHash);
			}

			targetPanel.dispatchEvent(new CustomEvent('tab:shown', {
				bubbles: true,
				detail: { id, container }
			}));
		}

		// Clicks
		list.addEventListener('click', (e) => {
			const a = e.target.closest('.govuk-tabs__tab');
			if (!a) return;
			const id = (a.getAttribute('href') || '').slice(1);
			if (!id) return;
			e.preventDefault();
			selectById(id, { updateHash: true, focusTab: true });
		});

		// Keyboard
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

		// Hash / back-forward
		function applyHash() {
			const id = (location.hash || '').slice(1);
			if (!id) return false;
			const tab = $(`.govuk-tabs__tab[aria-controls="${id}"]`, container);
			if (!tab) return false;
			selectById(id, { updateHash: false, focusTab: false });
			return true;
		}
		window.addEventListener('hashchange', applyHash);

		// Initial selection: hash or first tab
		if (!applyHash()) {
			const first = $('.govuk-tabs__tab', container);
			if (first) {
				selectById((first.getAttribute('href') || '').slice(1), {
					updateHash: false,
					focusTab: false
				});
			}
		}
		
		// Initial selection: hash or first tab
		if (!applyHash()) {
			const first = $('.govuk-tabs__tab', container);
			if (first) {
				selectById((first.getAttribute('href') || '').slice(1), {
					updateHash: false,
					focusTab: false
				});
			}
		}

		// Done: prevent pre-init CSS from hiding anything now
		container.classList.add('is-ready');
	}

	document.addEventListener('DOMContentLoaded', function() {
		$$('.govuk-tabs').forEach(initContainer);
	});
})();
