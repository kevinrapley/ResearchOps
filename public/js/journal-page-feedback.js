/**
 * @file /js/journal-page-feedback.js
 * @summary Keeps journal page feedback messages inside the GOV.UK content container after the page lead.
 */

function findFeedbackAnchor() {
	return document.querySelector('.journal-header') || document.querySelector('#main-content .govuk-width-container');
}

function normaliseFlashElement(flash) {
	if (!flash) return;
	flash.classList.add('govuk-notification-banner', 'govuk-!-margin-bottom-6');
	flash.removeAttribute('style');
	flash.setAttribute('role', flash.getAttribute('role') || 'status');
	flash.setAttribute('aria-live', flash.getAttribute('aria-live') || 'polite');
}

function placeFlashElement(flash) {
	if (!flash) return;
	const anchor = findFeedbackAnchor();
	if (!anchor || anchor.nextElementSibling === flash) return;
	normaliseFlashElement(flash);
	anchor.insertAdjacentElement('afterend', flash);
}

function placeExistingFlash() {
	placeFlashElement(document.getElementById('flash'));
}

const observer = new MutationObserver((mutations) => {
	for (const mutation of mutations) {
		for (const node of mutation.addedNodes) {
			if (node instanceof HTMLElement && node.id === 'flash') {
				placeFlashElement(node);
			}
		}
	}
});

document.addEventListener('DOMContentLoaded', () => {
	placeExistingFlash();
	observer.observe(document.body, { childList: true, subtree: true });
});
