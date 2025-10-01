/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Client-only rule suggestions + bias checks for Step 1 (Description).
 *
 * @description
 * - No network calls.
 * - Auto-runs when the textarea reaches the minimum length (default 400).
 * - Renders a 2-column panel: Original suggestions (left) and Bias checks (right).
 * - “Get suggestions” button triggers the same rendering on demand.
 *
 * Accessibility:
 * - Results container uses aria-live="polite".
 * - Headings and lists are semantic; columns remain linear in narrow viewports.
 *
 * Custom instructions applied:
 * - JSDoc everywhere,
 * - GOV.UK style: plain English; short sentences,
 * - No personal data handling; show hints if detected.
 *
 * @requires globalThis.document
 * @requires globalThis.CustomEvent
 */

/**
 * Public initialiser.
 * @function initCopilotSuggester
 * @param {Object} cfg
 * @param {string} cfg.textarea      - CSS selector or HTMLElement for the Step 1 textarea.
 * @param {string} cfg.container     - CSS selector or HTMLElement for the suggestions container (left/right columns host).
 * @param {string} [cfg.button]      - Optional selector/HTMLElement for “Get suggestions” button.
 * @param {number} [cfg.minChars=400]- Minimum chars before auto-suggest.
 * @returns {{forceSuggest:()=>void, destroy:()=>void}} small API
 */
export function initCopilotSuggester(cfg = {}) {
	/** @type {HTMLTextAreaElement|null} */
	const textarea = typeof cfg.textarea === 'string' ? document.querySelector(cfg.textarea) : cfg.textarea;
	/** @type {HTMLElement|null} */
	const container = typeof cfg.container === 'string' ? document.querySelector(cfg.container) : cfg.container;
	/** @type {HTMLButtonElement|null} */
	const button = cfg.button ? (typeof cfg.button === 'string' ? document.querySelector(cfg.button) : cfg.button) : null;

	const MIN = typeof cfg.minChars === 'number' ? cfg.minChars : 400;

	if (!textarea || !container) {
		return {
			forceSuggest() {},
			destroy() {}
		};
	}

	/* =========================
	 * Helpers
	 * ========================= */

	/**
	 * Escape a string for safe HTML.
	 * @param {unknown} s
	 * @returns {string}
	 */
	function esc(s) {
		return String(s ?? '').replace(/[&<>"']/g, m => ({
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;'
		} [m]));
	}

	/**
	 * Lightweight debounce.
	 * @param {Function} fn
	 * @param {number} wait
	 * @returns {Function}
	 */
	function debounce(fn, wait) {
		let t;
		return (...args) => {
			clearTimeout(t);
			t = setTimeout(() => fn.apply(null, args), wait);
		};
	}

	/**
	 * Detect very obvious PII patterns (email, NI, NHS).
	 * @param {string} text
	 * @returns {boolean}
	 */
	function containsPII(text) {
		const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
		const NI = /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i;
		const NHS = /\b\d{3}\s?\d{3}\s?\d{4}\b/;
		return EMAIL.test(text) || NI.test(text) || NHS.test(text);
	}

	/* =========================
	 * Rules: Original suggestions (left column)
	 * ========================= */

	/**
	 * Generate rule-based suggestions from the Description text.
	 * @param {string} text
	 * @returns {Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>}
	 */
	function buildOriginalSuggestions(text) {
		const out = [];
		const t = text.toLowerCase();

		// Scope too broad
		if (/\btest everything\b/.test(t) || /\beverything\b/.test(t)) {
			out.push({
				category: 'Scope',
				tip: "Replace 'test everything' with 2–3 focus areas.",
				why: 'Keeps research targeted and feasible.',
				severity: 'high'
			});
		}

		// Measurability hints
		if (!/\b\d{1,3}%\b/.test(t) && !/\b(?:by|within)\s+\d+/.test(t)) {
			out.push({
				category: 'Measurability',
				tip: 'Add a numeric target or timeframe for 1–2 outcomes.',
				why: 'Enables progress tracking.',
				severity: 'high'
			});
		}

		// Research questions not present
		if (!/\bresearch question/.test(t) && !/\bwe (need|want) to (learn|understand)/.test(t)) {
			out.push({
				category: 'Research questions',
				tip: 'List 2–4 key research questions.',
				why: 'Focuses the method and analysis.',
				severity: 'medium'
			});
		}

		// Users & inclusion
		if (!/\baccessib|screen reader|assistive|wcag|disab/i.test(text)) {
			out.push({
				category: 'Users & inclusion',
				tip: 'Note accessibility needs (e.g., screen reader users, low vision).',
				why: 'Ensures people with disabilities are included.',
				severity: 'medium'
			});
		}

		// Ethics & data handling
		if (containsPII(text)) {
			out.push({
				category: 'Ethics',
				tip: 'Remove personal data (emails, NI, NHS).',
				why: 'Protects participants and meets policy.',
				severity: 'high'
			});
		} else if (!/\bconsent|retention|privacy|dpo|dpia|data\b/i.test(text)) {
			out.push({
				category: 'Data handling',
				tip: 'Add a line on consent and retention.',
				why: 'Clarifies how you will handle data.',
				severity: 'low'
			});
		}

		// Stakeholders
		if (!/\bstakeholder|policy|ops|engineering|design\b/i.test(text)) {
			out.push({
				category: 'Stakeholders',
				tip: 'Name the teams you will involve.',
				why: 'Prevents surprises and speeds delivery.',
				severity: 'low'
			});
		}

		// Success criteria
		if (!/\bsuccess|measure of success|good looks like\b/i.test(text)) {
			out.push({
				category: 'Success criteria',
				tip: "State what 'good' looks like in one line.",
				why: 'Aligns expectations.',
				severity: 'medium'
			});
		}

		return out;
	}

	/* =========================
	 * Rules: Bias checks (right column)
	 * ========================= */

	/**
	 * Bias findings engine (lightweight heuristics).
	 * @param {string} text
	 * @returns {Array<{category:string, tip:string, why:string, severity:"high"|"medium"|"low"}>}
	 */
	function buildBiasFindings(text) {
		const out = [];
		const t = text.toLowerCase();

		// Exclusionary language or assumptions
		if (/\ball\b.+(users|people)\s+(have|use)\s+(smartphones|laptops|internet)/i.test(text)) {
			out.push({
				category: 'Assumptions',
				tip: 'Avoid assuming all users have the same devices or connectivity.',
				why: 'Prevents sampling bias.',
				severity: 'high'
			});
		}

		// Device / browser narrowness
		if (/\bchrome only|chrome\-only|works on chrome\b/i.test(text)) {
			out.push({
				category: 'Constraints',
				tip: 'Avoid Chrome-only testing; include Safari and Firefox where possible.',
				why: 'Prevents platform bias.',
				severity: 'medium'
			});
		}

		// Sampling bias: “staff only” or “friends & family”
		if (/\bstaff only|friends and family|internal only\b/i.test(text)) {
			out.push({
				category: 'Sampling',
				tip: 'Recruit beyond internal staff and friends/family.',
				why: 'Improves representativeness.',
				severity: 'high'
			});
		}

		// Language / bilingual
		if (/\bwelsh|bilingual|english only\b/i.test(text) || !/\blanguage|translation|bilingual|welsh\b/i.test(text)) {
			out.push({
				category: 'Language inclusion',
				tip: 'Consider translation needs and bilingual participants where relevant.',
				why: 'Prevents language bias.',
				severity: 'medium'
			});
		}

		// Accessibility bias
		if (!/\baccessib|screen reader|assistive|wcag|disab/i.test(text)) {
			out.push({
				category: 'Accessibility',
				tip: 'Include participants using assistive tech (e.g., screen readers).',
				why: 'Reduces accessibility bias.',
				severity: 'high'
			});
		}

		// Socio-economic / geography signals (only prompt if nothing is mentioned)
		if (!/\brural|remote|low bandwidth|offline|public computers|libraries\b/i.test(text)) {
			out.push({
				category: 'Context diversity',
				tip: 'Include contexts like low bandwidth or shared/public devices if relevant.',
				why: 'Avoids context bias.',
				severity: 'low'
			});
		}

		return out;
	}

	/* =========================
	 * Rendering
	 * ========================= */

	/**
	 * Render two columns: Original suggestions (left) & Bias suggestions (right).
	 * @param {Array} original
	 * @param {Array} bias
	 */
	function renderColumns(original, bias) {
		const leftList = original.length ?
			original.map(s => `<li><strong class="sugg-cat">${esc(s.category)}</strong> — ${esc(s.tip)}<div class="sugg-why">Why: ${esc(s.why)} (${esc(s.severity)})</div></li>`).join('') :
			`<li>No suggestions found.</li>`;

		const rightList = bias.length ?
			bias.map(s => `<li><strong class="sugg-cat">${esc(s.category)}</strong> — ${esc(s.tip)}<div class="sugg-why">Why: ${esc(s.why)} (${esc(s.severity)})</div></li>`).join('') :
			`<li>No bias findings.</li>`;

		container.innerHTML = `
      <section class="sugg-grid" aria-label="Suggestions">
        <div class="sugg-col">
          <h3 class="govuk-heading-s" id="sugg-heading">Suggestions</h3>
          <ul class="sugg-list" aria-labelledby="sugg-heading">
            ${leftList}
          </ul>
        </div>
        <div class="sugg-col">
          <h3 class="govuk-heading-s" id="bias-heading">Bias checks</h3>
          <ul class="sugg-list" aria-labelledby="bias-heading">
            ${rightList}
          </ul>
        </div>
      </section>
    `;

		// Lightweight inline styles to ensure two columns, but degrade gracefully.
		ensureOnceStyles();
	}

	let stylesInjected = false;

	function ensureOnceStyles() {
		if (stylesInjected) return;
		const style = document.createElement('style');
		style.setAttribute('data-copilot-suggester', 'true');
		style.textContent = `
      .sugg-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
      .sugg-col { border: 1px solid var(--govuk-border-colour, #b1b4b6); padding: .75rem; border-radius: .25rem; background: #fff; }
      .sugg-list { margin: .5rem 0 0; padding-left: 1.2rem; }
      .sugg-cat { display: inline-block; }
      @media (min-width: 800px) {
        .sugg-grid { grid-template-columns: 1fr 1fr; }
      }
    `;
		document.head.appendChild(style);
		stylesInjected = true;
	}

	/* =========================
	 * Core logic
	 * ========================= */

	/**
	 * Compute and render suggestions.
	 * @function run
	 * @returns {void}
	 */
	function run() {
		const text = (textarea.value || '').trim();
		if (!text || text.length < MIN) {
			// Clear only if there was content; keep container stable otherwise.
			container.innerHTML = '';
			return;
		}
		const original = buildOriginalSuggestions(text);
		const bias = buildBiasFindings(text);
		renderColumns(original, bias);

		// Fire a custom event for analytics/telemetry if needed.
		window.dispatchEvent(new CustomEvent('copilot-suggester:rendered', {
			detail: { length: text.length, originalCount: original.length, biasCount: bias.length }
		}));
	}

	// Debounced runners for heavy inputs/paste
	const debouncedRun = debounce(run, 120);

	/**
	 * Force an immediate recompute/render (public API).
	 * @function forceSuggest
	 */
	function forceSuggest() {
		run();
	}

	// Auto-trigger on input, paste, keyup, and change.
	const onInput = () => debouncedRun();
	const onKeyup = () => debouncedRun();
	const onChange = () => debouncedRun();
	const onPaste = () => setTimeout(run, 0); // run after paste content lands

	textarea.addEventListener('input', onInput);
	textarea.addEventListener('keyup', onKeyup);
	textarea.addEventListener('change', onChange);
	textarea.addEventListener('paste', onPaste);

	// Manual button triggers the same render
	if (button) {
		button.addEventListener('click', (e) => {
			e.preventDefault();
			forceSuggest();
		});
	}

	// If there is already content at load (e.g., back nav), evaluate once.
	if ((textarea.value || '').trim().length >= MIN) {
		run();
	}

	// Public API (for start-description-assist.js)
	return {
		forceSuggest,
		destroy() {
			try {
				textarea.removeEventListener('input', onInput);
				textarea.removeEventListener('keyup', onKeyup);
				textarea.removeEventListener('change', onChange);
				textarea.removeEventListener('paste', onPaste);
				if (button) button.removeEventListener('click', forceSuggest);
			} catch {}
		}
	};
}
