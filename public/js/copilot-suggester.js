/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Client-only rule/bias suggestions for Step 1 (Description) and reusable renderer.
 * @description
 * Provides a zero-network suggester that analyzes free text and renders:
 * - Core suggestions (structure, scope, outcomes, ethics, etc.)
 * - Bias & inclusion checks (language, sampling, framing)
 * The UI uses an accessible, two-column layout (Core | Bias) under a single container.
 *
 * Conventions:
 * - GOV.UK style copy; plain English.
 * - No side effects until initialised via {@link initCopilotSuggester}.
 * - Safe to call multiple times; container is guarded with a dataset flag.
 *
 * @requires globalThis.document
 * @requires globalThis.CustomEvent
 *
 * @typedef {Object} SuggesterOptions
 * @property {string|HTMLTextAreaElement} textarea  CSS selector or element for the textarea
 * @property {string|HTMLElement} container         CSS selector or element for the suggestions host
 * @property {string|HTMLButtonElement} [button]    Optional selector/element for the âGet suggestionsâ button
 * @property {number} [threshold=400]               Character threshold before auto-suggest kicks in
 * @property {boolean} [twoColumn=true]             Render Core | Bias as 2 columns
 */

/* =========================
 * @section Helpers
 * ========================= */

/**
 * Resolve a selector or element to an element.
 * @function $(elOrSel)
 * @param {string|Element|null} elOrSel
 * @returns {Element|null}
 */
function $(elOrSel) {
	if (!elOrSel) return null;
	return (typeof elOrSel === 'string') ? document.querySelector(elOrSel) : elOrSel;
}

/**
 * Escape text for safe HTML interpolation.
 * @function esc
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [m]));
}

/* =========================
 * @section Suggestion engine
 * ========================= */

/**
 * Build core (rule-based) suggestions from the Description text.
 * @function buildCoreSuggestions
 * @param {string} text
 * @returns {Array<{category:string, tip:string, why:string, severity:'high'|'medium'|'low'}>}
 */
export function buildCoreSuggestions(text) {
	const t = (text || '').toLowerCase();

	/** @type {Array<{category:string, tip:string, why:string, severity:'high'|'medium'|'low'}>} */
	const list = [];

	// Structure & scope
	if (!/problem|need|issue/.test(t)) {
		list.push({ category: 'Scope', tip: 'State the problem as a user need.', why: 'Keeps the work focused.', severity: 'high' });
	}
	if (!/scope|out of scope/.test(t)) {
		list.push({ category: 'Scope', tip: 'Add In scope and Out of scope lines.', why: 'Prevents drift.', severity: 'high' });
	}
	// Outcomes & measures
	if (!/success|measure|metric|reduce|increase|target|%|percent/.test(t)) {
		list.push({ category: 'Outcomes & measures', tip: 'Define what success looks like.', why: 'Enables tracking.', severity: 'high' });
	}
	// Ethics & data
	if (/email|@|nhs|\bni\b|national insurance|postcode|date of birth/.test(t)) {
		list.push({ category: 'Ethics', tip: 'Remove personal data (emails, NI, NHS numbers).', why: 'Protects privacy.', severity: 'high' });
	} else {
		list.push({ category: 'Ethics', tip: 'State consent and data handling briefly.', why: 'Sets expectations.', severity: 'medium' });
	}
	// Method maturity
	if (/alpha|beta|discovery|live/.test(t) && !/method|interview|test|survey|analysis/.test(t)) {
		list.push({ category: 'Method', tip: 'Align method to the service phase (e.g., interviews in discovery).', why: 'Fits maturity.', severity: 'medium' });
	}
	// Research questions
	if (!/research question|we want to find out|we want to learn/.test(t)) {
		list.push({ category: 'Research questions', tip: 'List 2â4 questions the study will answer.', why: 'Focuses analysis.', severity: 'medium' });
	}
	// Stakeholders
	if (!/stakeholder|policy|ops|design|engineering/.test(t)) {
		list.push({ category: 'Stakeholders', tip: 'Identify teams/people to involve.', why: 'Improves alignment.', severity: 'low' });
	}

	return list;
}

/**
 * Build bias & inclusion suggestions from the Description text.
 * @function buildBiasSuggestions
 * @param {string} text
 * @returns {Array<{category:string, tip:string, why:string, severity:'high'|'medium'|'low'}>}
 */
export function buildBiasSuggestions(text) {
	const t = (text || '').toLowerCase();

	/** @type {Array<{category:string, tip:string, why:string, severity:'high'|'medium'|'low'}>} */
	const items = [];

	// Sampling bias
	if (!/welsh|bilingual|screen reader|assistive|low bandwidth|older|age|rural|mobile only/.test(t)) {
		items.push({ category: 'Bias â Sampling', tip: 'Broaden recruitment (e.g., screen reader users, Welsh speakers).', why: 'Reduces sampling bias.', severity: 'high' });
	}
	// Device/browser bias
	if (/chrome only|chrome-only|works on chrome/.test(t)) {
		items.push({ category: 'Bias â Device', tip: 'Avoid single-browser constraints where possible.', why: 'Prevents device bias.', severity: 'medium' });
	} else if (!/safari|firefox|edge|mobile|android|ios/.test(t)) {
		items.push({ category: 'Bias â Device', tip: 'Include a range of browsers and devices.', why: 'Improves representativeness.', severity: 'medium' });
	}
	// Framing bias
	if (/prove|confirm|validate our/.test(t)) {
		items.push({ category: 'Bias â Framing', tip: 'Use neutral questions; avoid âprove our hypothesisâ.', why: 'Prevents confirmation bias.', severity: 'high' });
	}
	// Language & tone
	if (/simple|obvious|just|clearly/.test(t)) {
		items.push({ category: 'Bias â Language', tip: 'Avoid judgemental adjectives (e.g., âobviousâ).', why: 'Keeps copy inclusive.', severity: 'low' });
	}
	// Cultural/temporal bias
	if (!/language|culture|translation|time|season/.test(t)) {
		items.push({ category: 'Bias â Context', tip: 'Check for cultural/language/time-of-day effects.', why: 'Improves validity.', severity: 'low' });
	}

	return items;
}

/* =========================
 * @section Rendering
 * ========================= */

/**
 * Render suggestions into a 2-column layout with headings.
 * Left = Core suggestions; Right = Bias suggestions.
 * @function renderTwoColumn
 * @param {HTMLElement} container
 * @param {Array<Object>} core
 * @param {Array<Object>} bias
 * @returns {void}
 */
export function renderTwoColumn(container, core, bias) {
	if (!container) return;

	const renderList = (arr) => arr.map(s => `
		<li class="sugg-item">
			<strong class="sugg-cat">${esc(s.category)}</strong> â ${esc(s.tip)}
			<div class="sugg-why">Why: ${esc(s.why)}${s.severity ? ` (${esc(s.severity)})` : ''}</div>
		</li>
	`).join('');

	container.innerHTML = `
		<div class="sugg-grid" role="region" aria-label="Description suggestions">
			<div class="sugg-col">
				<h3 class="sugg-h">Suggestions</h3>
				<ul class="sugg-list">${renderList(core)}</ul>
			</div>
			<div class="sugg-col">
				<h3 class="sugg-h">Bias checks</h3>
				<ul class="sugg-list">${renderList(bias)}</ul>
			</div>
		</div>
	`;

	// Lightweight styles (scoped via class names; rely on global CSS where present)
	if (!document.getElementById('sugg-grid-inline-css')) {
		const style = document.createElement('style');
		style.id = 'sugg-grid-inline-css';
		style.textContent = `
			.sugg-grid { display:grid; grid-template-columns:1fr; gap:1rem; border:1px solid var(--govuk-border-colour,#b1b4b6); padding:1rem; border-radius:.25rem; }
			@media (min-width: 48rem) { .sugg-grid { grid-template-columns:1fr 1fr; } }
			.sugg-h { margin:.25rem 0 .5rem; font-weight:600; }
			.sugg-list { margin:0; padding-left:1rem; }
			.sugg-item { margin:.25rem 0; }
			.sugg-cat { font-weight:600; }
			.sugg-why { font-size:.9em; color: var(--muted,#505a5f); }
		`;
		document.head.appendChild(style);
	}
}

/* =========================
 * @section Initialiser
 * ========================= */

/**
 * Initialise a suggester instance on a textarea and container.
 * - Auto-triggers when text length >= threshold (default 400).
 * - Button click (if provided) reuses the same 2-column rendering.
 *
 * @function initCopilotSuggester
 * @public
 * @param {SuggesterOptions} options
 * @returns {{destroy:()=>void, forceSuggest:(opts?:{auto?:boolean})=>void}} handle
 */
export function initCopilotSuggester(options) {
	const textarea = /** @type {HTMLTextAreaElement|null} */ ($((options || {}).textarea));
	const container = /** @type {HTMLElement|null} */ ($((options || {}).container));
	const button = /** @type {HTMLButtonElement|null} */ ($((options || {}).button));
	const threshold = Math.max(0, Number((options || {}).threshold ?? 400));
	const twoColumn = (options || {}).twoColumn !== false;

	if (!textarea || !container) return { destroy: () => {}, forceSuggest: () => {} };
	if (container.dataset.suggBound === '1') {
		// Already bound
		return {
			destroy: () => {},
			forceSuggest: (opts) => {
				const core = buildCoreSuggestions(textarea.value);
				const bias = buildBiasSuggestions(textarea.value);
				if (twoColumn) renderTwoColumn(container, core, bias);
				container.classList.remove('hidden');
				container.setAttribute('data-view', opts?.auto ? 'auto' : 'manual');
			}
		};
	}
	container.dataset.suggBound = '1';
	container.setAttribute('data-view', 'idle');

	/**
	 * Compute and render suggestions.
	 * @function doSuggest
	 * @param {boolean} [auto]
	 * @returns {void}
	 */
	const doSuggest = (auto = false) => {
		const core = buildCoreSuggestions(textarea.value);
		const bias = buildBiasSuggestions(textarea.value);
		if (twoColumn) renderTwoColumn(container, core, bias);
		container.classList.remove('hidden');
		container.setAttribute('data-view', auto ? 'auto' : 'manual');
		container.dispatchEvent(new CustomEvent('copilot:suggested', { detail: { auto, coreCount: core.length, biasCount: bias.length } }));
	};

	// Auto suggest @ threshold
	const onInput = () => {
		const val = textarea.value || '';
		if (val.trim().length >= threshold) {
			doSuggest(true);
		} else if (container.getAttribute('data-view') !== 'idle') {
			container.innerHTML = '';
			container.classList.add('hidden');
			container.setAttribute('data-view', 'idle');
		}
	};

	// Manual button
	const onClick = () => doSuggest(false);

	textarea.addEventListener('input', onInput);
	button?.addEventListener('click', onClick);

	// Prime once in case of prefilled text
	onInput();

	return {
		destroy() {
			textarea.removeEventListener('input', onInput);
			button?.removeEventListener('click', onClick);
			try { delete container.dataset.suggBound; } catch {}
		},
		forceSuggest(opts) { doSu
