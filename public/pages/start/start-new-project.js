/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Page controller for “Start a New Research Project”.
 * @description
 * Orchestrates multi-step navigation and validation for the Start flow.
 * Respects Step 1 ownership by {@link StartDescriptionAssist}: does NOT wire suggestions or AI for Step 1.
 *
 * A11y:
 * - Error summary region with aria-live.
 * - Buttons manage focus across steps.
 *
 * @requires globalThis.document
 * @requires globalThis.CustomEvent
 */

/* =========================
 * @section Helpers
 * ========================= */

/**
 * Get element by id.
 * @function $id
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function $id(id) { return document.getElementById(id); }

/**
 * Show a section and hide the others.
 * @function showStep
 * @param {'step1'|'step2'|'step3'} which
 * @returns {void}
 */
function showStep(which) {
	['step1', 'step2', 'step3'].forEach(id => {
		const el = $id(id);
		if (el) el.style.display = (id === which) ? '' : 'none';
	});
}

/**
 * Basic field validation for Step 1.
 * @function validateStep1
 * @returns {boolean}
 */
function validateStep1() {
	const name = /** @type {HTMLInputElement|null} */ ($id('p_name'));
	const desc = /** @type {HTMLTextAreaElement|null} */ ($id('p_desc'));
	const errSummary = $id('error-summary');
	const errs = [];

	if (!name?.value.trim()) {
		errs.push('Enter a project name.');
	}
	if (!desc?.value.trim()) {
		errs.push('Enter a project description.');
	}

	if (errSummary) {
		if (errs.length) {
			errSummary.style.display = '';
			errSummary.innerHTML = `<ul>${errs.map(e => `<li>${e}</li>`).join('')}</ul>`;
			errSummary.focus();
			return false;
		}
		errSummary.style.display = 'none';
		errSummary.textContent = '';
	}
	return true;
}

/* =========================
 * @section Initialiser
 * ========================= */

/**
 * Initialise page wiring for Start flow.
 * @function initStartNewProject
 * @public
 * @returns {{destroy:()=>void}}
 */
export function initStartNewProject() {
	const next2 = /** @type {HTMLButtonElement|null} */ ($id('next2'));
	const prev1 = /** @type {HTMLButtonElement|null} */ ($id('prev1'));
	const next3 = /** @type {HTMLButtonElement|null} */ ($id('next3'));
	const prev2 = /** @type {HTMLButtonElement|null} */ ($id('prev2'));
	const finish = /** @type {HTMLButtonElement|null} */ ($id('finish'));

	// Step navigation
	const goNext2 = () => { if (validateStep1()) showStep('step2'); };
	const goPrev1 = () => showStep('step1');
	const goNext3 = () => showStep('step3');
	const goPrev2 = () => showStep('step2');
	const doFinish = () => {
		// Placeholder for submit or navigation
		window.dispatchEvent(new CustomEvent('start:submit', { detail: { ts: Date.now() } }));
		alert('Project created (demo).');
	};

	next2?.addEventListener('click', goNext2);
	prev1?.addEventListener('click', goPrev1);
	next3?.addEventListener('click', goNext3);
	prev2?.addEventListener('click', goPrev2);
	finish?.addEventListener('click', doFinish);

	// Honour Step 1 ownership flag (no-op here, just documented)
	if (window.__descAssistActive) {
		// Another script owns Step 1 assistance; we do not attach any listeners there.
	}

	return {
		destroy() {
			next2?.removeEventListener('click', goNext2);
			prev1?.removeEventListener('click', goPrev1);
			next3?.removeEventListener('click', goNext3);
			prev2?.removeEventListener('click', goPrev2);
			finish?.removeEventListener('click', doFinish);
		}
	};
}

/* =========================
 * @section Auto-init
 * ========================= */

document.addEventListener('DOMContentLoaded', () => {
	initStartNewProject();
});
