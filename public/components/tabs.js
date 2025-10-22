/**
 * @file /components/tabs.js
 * @description Generic controller for GOV.UK Tabs.
 * Owns visibility only (show/hide panels and selected state).
 * Emits a DOM event when a tab becomes visible so page-specific code can react.
 *
 * Event:
 *  - tab:shown  (bubbles: true)
 *      detail: { id: string, container: HTMLElement }
 *
 * Usage:
 *  Include this script on any page that uses the GOV.UK tabs markup pattern.
 *  It will:
 *   - Read the URL hash to select an initial tab (fallback: first tab).
 *   - Update the hash on click.
 *   - Respond to back/forward (hashchange).
 *   - Emit `tab:shown` whenever a panel is shown.
 *
 * Accessibility:
 *  This script preserves the GOV.UK Frontend semantics; it just toggles panel visibility
 *  and selected classes to match the current tab.
 */

/* eslint-env browser */
/* eslint no-var: 0, prefer-arrow-callback: 0, prefer-template: 0 */
(function() {
	'use strict';

	/**
	 * Query helper.
	 * @param {string} s - Selector.
	 * @param {Document|HTMLElement} [r=document] - Root element.
	 * @returns {HTMLElement|null}
	 */
	function $(s, r) {
		if (!r) r = document;
		return r.querySelector(s);
	}

	/**
	 * Query-all helper (returns array).
	 * @param {string} s - Selector.
	 * @param {Document|HTMLElement} [r=document] - Root element.
	 * @returns {HTMLElement[]}
	 */
	function $all(s, r) {
		if (!r) r = document;
		return Array.from(r.querySelectorAll(s));
	}

	/**
	 * Extracts the panel id from a tab link's href (#panel-id).
	 * @param {HTMLAnchorElement} a - Anchor element with href="#id".
	 * @returns {string} - The id without '#', or empty string if not a hash link.
	 */
	function getTabIdFromLink(a) {
		var href = a.getAttribute('href') || '';
		if (href.indexOf('#') !== 0) return '';
		return href.slice(1);
	}

	/**
	 * Shows the panel with the given id inside the supplied GOV.UK tabs container.
	 * Also updates the selected state on the tab list item.
	 * Dispatches a bubbling `tab:shown` event on document.
	 * @param {HTMLElement} container - The .govuk-tabs root element.
	 * @param {string} id - Panel id to show.
	 * @returns {void}
	 */
	function showTabById(container, id) {
		var panels = $all('.govuk-tabs__panel', container);
		for (var i = 0; i < panels.length; i += 1) {
			var p = panels[i];
			var isTarget = p.id === id;
			if (isTarget) {
				p.classList.remove('govuk-tabs__panel--hidden');
				p.removeAttribute('hidden');
			} else {
				p.classList.add('govuk-tabs__panel--hidden');
				p.setAttribute('hidden', 'hidden');
			}
		}

		var items = $all('.govuk-tabs__list-item', container);
		for (var j = 0; j < items.length; j += 1) {
			var a = items[j].querySelector('.govuk-tabs__tab');
			var tabId = a ? getTabIdFromLink(a) : '';
			if (tabId === id) {
				items[j].classList.add('govuk-tabs__list-item--selected');
			} else {
				items[j].classList.remove('govuk-tabs__list-item--selected');
			}
		}

		var ev = new CustomEvent('tab:shown', { bubbles: true, detail: { id: id, container: container } });
		document.dispatchEvent(ev);
	}

	/**
	 * Finds the closest GOV.UK tabs container for an element, or falls back.
	 * @param {HTMLElement} el - Element inside or near a tabs container.
	 * @returns {HTMLElement|Document} - The .govuk-tabs element or document as fallback.
	 */
	function nearestTabs(el) {
		return el.closest('.govuk-tabs') || document;
	}

	/**
	 * Wires a single GOV.UK tabs instance:
	 *  - Handles click on tab links to show the target panel and update the hash.
	 *  - On load, shows the hash panel or the first tab if no hash.
	 *  - Listens to hashchange to sync back/forward navigation.
	 * @param {HTMLElement} container - The .govuk-tabs root element to initialize.
	 * @returns {void}
	 */
	function initOne(container) {
		var list = container.querySelector('.govuk-tabs__list');
		if (!list) return;

		list.addEventListener('click', function(e) {
			var a = e.target && e.target.closest ? e.target.closest('.govuk-tabs__tab') : null;
			if (!a) return;
			var id = getTabIdFromLink(a);
			if (!id) return;
			e.preventDefault();
			if (location.hash !== '#' + id) {
				history.replaceState(null, '', location.pathname + location.search + '#' + id);
			}
			showTabById(container, id);
		});

		// Initial show (hash or first tab)
		var initial = (location.hash || '').replace(/^#/, '');
		if (!initial) {
			var first = container.querySelector('.govuk-tabs__tab');
			initial = first ? getTabIdFromLink(first) : '';
		}
		if (initial) showTabById(container, initial);

		// Hash changes (back/forward)
		window.addEventListener('hashchange', function() {
			var current = (location.hash || '').replace(/^#/, '');
			if (current) showTabById(container, current);
		});
	}

	/**
	 * Auto-initialize all GOV.UK tab groups on DOM ready.
	 * @returns {void}
	 */
	document.addEventListener('DOMContentLoaded', function() {
		$all('.govuk-tabs').forEach(initOne);
	});

	/**
	 * Public helper: programmatically request a tab be shown.
	 * Dispatch a `tabs:show` CustomEvent with detail { id, container? }.
	 * This listener will locate the nearest tabs container for the target panel if not provided.
	 *
	 * @event tabs:show
	 * @type {CustomEvent<{id: string, container?: HTMLElement}>}
	 */
	document.addEventListener('tabs:show', function(e) {
		var id = e.detail && e.detail.id ? String(e.detail.id) : '';
		if (!id) return;
		var container = e.detail && e.detail.container ? e.detail.container : nearestTabs(document.getElementById(id));
		if (!container) container = nearestTabs(document.body);
		showTabById(container, id);
	});
})();