/**
 * ResearchOps Tabs (GOV.UK-style behaviour)
 * Version:  v1.0.0
 * Purpose:  Enhance .govuk-tabs markup with ARIA, keyboard, hash sync, and events.
 * License:  All rights reserved
 */

(function() {
	/** qS helpers */
	const $ = (s, r = document) => r.querySelector(s);
	const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

	function initContainer(container) {
		if (!container) return;

		const list = $('.govuk-tabs__list', container);
		const items = $$('.govuk-tabs__list > li', container);
		const panels = $$('.govuk-tabs__panel', container);

		if (!list || !items.length || !panels.length) return;

		// Apply ARIA roles and relationships
		list.setAttribute('role', 'tablist');

		items.forEach((li, idx) => {
			const a = $('.govuk-tabs__tab', li);
			if (!a) return;

			// Ensure link has an id
			if (!a.id) {
				a.id = `tab_${container.id || 'tabs'}_${idx}`;
			}

			// Ensure href points to a panel id
			let targetId = (a.getAttribute('href') || '').replace(/^#/, '');
			if (!targetId) {
				// Fallback: pair by index
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
			const labelledBy = findTabForPanel(container, p)?.id || '';
			p.setAttribute('role', 'tabpanel');
			if (labelledBy) p.setAttribute('aria-labelledby', labelledBy);
		});

		// State
		function findTabForPanel(root, panelEl) {
			const id = panelEl.id;
			return $(`.govuk-tabs__tab[href="#${CSS.escape(id)}"]`, root);
		}

		function selectById(id, { updateHash = true, focusTab = false } = {}) {
			// Resolve tab/panel
			const targetPanel = $(`#${CSS.escape(id)}`, container);
			const targetTab = $(`.govuk-tabs__tab[href="#${CSS.escape(id)}"]`, container);
			if (!targetPanel || !targetTab) return;

			// Toggle selected class on LI wrappers
			items.forEach((li) => li.classList.remove('govuk-tabs__list-item--selected'));
			const li = targetTab.closest('li');
			if (li) li.classList.add('govuk-tabs__list-item--selected');

			// Tabs ARIA and focus order
			$$('.govuk-tabs__tab', container).forEach((t) => {
				t.setAttribute('aria-selected', t === targetTab ? 'true' : 'false');
				t.setAttribute('tabindex', t === targetTab ? '0' : '-1');
			});

			// Panels visibility
			panels.forEach((p) => {
				if (p === targetPanel) {
					p.classList.remove('govuk-tabs__panel--hidden');
				} else {
					p.classList.add('govuk-tabs__panel--hidden');
				}
			});

			// Optional focus
			if (focusTab) targetTab.focus({ preventScroll: true });

			// Update URL hash (enables back/forward)
			if (updateHash) {
				const newHash = `#${id}`;
				if (location.hash !== newHash) {
					// Use pushState to keep back-stack entries like the DS behaviour
					history.pushState(null, '', newHash);
				}
			}

			// Notify listeners once the panel is shown
			targetPanel.dispatchEvent(new CustomEvent('tab:shown', {
				bubbles: true,
				detail: { id, container }
			}));
		}

		// Click handling (use event delegation)
		list.addEventListener('click', (e) => {
			const a = e.target.closest('.govuk-tabs__tab');
			if (!a) return;
			const id = (a.getAttribute('href') || '').replace(/^#/, '');
			if (!id) return;
			e.preventDefault();
			selectById(id, { updateHash: true, focusTab: true });
		});

		// Keyboard navigation on the tablist
		list.addEventListener('keydown', (e) => {
			const tabs = $$('.govuk-tabs__tab', list);
			const currentIndex = tabs.findIndex((t) => t.getAttribute('tabindex') === '0');
			if (currentIndex < 0) return;

			let next = null;
			if (e.key === 'ArrowRight') next = tabs[(currentIndex + 1) % tabs.length];
			if (e.key === 'ArrowLeft') next = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
			if (e.key === 'Home') next = tabs[0];
			if (e.key === 'End') next = tabs[tabs.length - 1];

			if (next) {
				e.preventDefault();
				const id = (next.getAttribute('href') || '').replace(/^#/, '');
				selectById(id, { updateHash: true, focusTab: true });
			}
		});

		// Hash navigation (back/forward / deep links)
		function applyHash() {
			const id = (location.hash || '').replace(/^#/, '');
			if (!id) return false;
			const tab = $(`.govuk-tabs__tab[href="#${CSS.escape(id)}"]`, container);
			if (!tab) return false;
			selectById(id, { updateHash: false, focusTab: false });
			return true;
		}

		window.addEventListener('hashchange', applyHash);

		// Initial selection: hash or first tab
		if (!applyHash()) {
			const first = $('.govuk-tabs__tab', container);
			if (first) {
				const id = (first.getAttribute('href') || '').replace(/^#/, '');
				selectById(id, { updateHash: false, focusTab: false });
			}
		}
	}

	// Boot all tab containers on DOM ready
	document.addEventListener('DOMContentLoaded', function() {
		$$('.govuk-tabs').forEach(initContainer);
	});

})();