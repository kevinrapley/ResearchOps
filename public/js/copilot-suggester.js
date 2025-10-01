/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Local, client-only rule/bias suggestions for textareas (no network).
 *
 * @description
 * - Watches a textarea and renders two-column suggestions:
 *   Left: "original" content design suggestions
 *   Right: bias/inclusion checks
 * - Exposes a small API: { destroy(), forceSuggest() }.
 * - No globals; no side-effects until init is called by your assistants.
 *
 * Accessibility:
 * - Results go into a container with aria-live="polite".
 * - Uses semantic <ul>/<li> lists with clear labels.
 *
 * @typedef {Object} SuggesterOptions
 * @property {string} textarea  CSS selector of the textarea to watch
 * @property {string} container CSS selector where suggestions should render
 * @property {string} [button]  Optional selector for a “Get suggestions” button
 * @property {number} [minChars=400] Minimum characters to auto-suggest (Step 1) or 60 (Step 2)
 * @property {function(string):Array} [rules] Function to generate “original” suggestions from text
 * @property {function(string):Array} [biasRules] Function to generate “bias” suggestions from text
 * @property {function():void} [onShown] Callback when suggestions are rendered
 */

/**
 * Escape text for safe HTML interpolation.
 * @param {unknown} s
 * @returns {string}
 */
function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, c => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	} [c]));
}

/**
 * Render two-column suggestions (original vs bias).
 * @param {Array<{category:string, tip:string, why:string, severity:string}>} left
 * @param {Array<{category:string, tip:string, why:string, severity:string}>} right
 * @returns {string}
 */
function renderTwoColumns(left, right) {
	const col = (items, heading) => `
    <section class="sugg-col" aria-label="${esc(heading)}">
      <h3 class="sugg-heading">${esc(heading)}</h3>
      <ul class="sugg-list">
        ${items.length ? items.map(s => `
          <li class="sugg-item">
            <div class="sugg-row">
              <strong class="sugg-cat">${esc(s.category || 'General')}</strong>
              <span class="sugg-sev ${esc(s.severity || 'medium')}">${esc(s.severity || 'medium')}</span>
            </div>
            <div class="sugg-tip">${esc(s.tip || '')}</div>
            <div class="sugg-why"><span class="mono muted">Why:</span> ${esc(s.why || '')}</div>
          </li>`).join('') 
        : `<li class="sugg-item"><em>No ${heading.toLowerCase()} found.</em></li>`}
      </ul>
    </section>`;

	return `
    <div class="sugg-grid" role="group" aria-label="Suggestions split view">
      ${col(left, 'Suggestions')}
      ${col(right, 'Bias & Inclusion')}
    </div>
  `;
}

/**
 * Default content design rules (Step 1 / Step 2 usable).
 * @param {string} t
 */
function defaultRules(t) {
	const tips = [];
	const txt = (t || '').toLowerCase();

	// Very lightweight heuristics — safe client-side guardrails.
	if (txt.includes('test everything')) {
		tips.push({
			category: 'Scope',
			tip: 'Replace “test everything” with 2–3 focused areas.',
			why: 'Focus enables targeted research and clearer outcomes.',
			severity: 'high'
		});
	}
	if (t.length > 0 && !/[.!?]\s/.test(t)) {
		tips.push({
			category: 'Clarity',
			tip: 'Use short sentences and paragraph breaks.',
			why: 'Improves readability for everyone.',
			severity: 'medium'
		});
	}
	if (!/(\d{1,3}%|\bQ[1-4]\b|\bby end\b|\bwithin\b)/i.test(t)) {
		tips.push({
			category: 'Outcomes & measures',
			tip: 'Add a measurable outcome and timeframe (suggest only; do not include PII).',
			why: 'Enables tracking of success.',
			severity: 'high'
		});
	}
	return tips.slice(0, 6);
}

/**
 * Default bias rules (applies to all steps).
 * @param {string} t
 */
function defaultBiasRules(t) {
	const tips = [];
	const txt = (t || '').toLowerCase();

	if (!/(screen reader|accessibil|wcag|voiceover|talkback)/i.test(t)) {
		tips.push({
			category: 'Accessibility',
			tip: 'Consider users with assistive tech (e.g. screen readers).',
			why: 'Prevents disability exclusion.',
			severity: 'high'
		});
	}
	if (!/(mobile|phone|android|ios)/i.test(t)) {
		tips.push({
			category: 'Device coverage',
			tip: 'Include mobile users where relevant.',
			why: 'Avoids desktop-only bias.',
			severity: 'medium'
		});
	}
	if (/stakeholder|policy/.test(txt) && !/users?/.test(txt)) {
		tips.push({
			category: 'User focus',
			tip: 'Re-balance towards user needs, not only stakeholder expectations.',
			why: 'Reduces organisational bias.',
			severity: 'medium'
		});
	}
	if (!/(welsh|bilingual|translation|language)/i.test(t)) {
		tips.push({
			category: 'Language inclusion',
			tip: 'Consider bilingual users (e.g. Welsh/English) if service area suggests it.',
			why: 'Prevents language bias.',
			severity: 'low'
		});
	}
	return tips.slice(0, 6);
}

/**
 * Initialise a suggester instance.
 * @param {SuggesterOptions} opts
 * @returns {{destroy:()=>void, forceSuggest:()=>void}}
 */
export function initCopilotSuggester(opts) {
	const {
		textarea,
		container,
		button,
		minChars = 400,
		rules = defaultRules,
		biasRules = defaultBiasRules,
		onShown
	} = opts || {};

	/** @type {HTMLTextAreaElement|null} */
	const ta = document.querySelector(textarea);
	/** @type {HTMLElement|null} */
	const mount = document.querySelector(container);
	/** @type {HTMLButtonElement|null} */
	const btn = button ? document.querySelector(button) : null;

	if (!ta || !mount) return { destroy() {}, forceSuggest() {} };

	const render = () => {
		const value = (ta.value || '').trim();
		const base = rules(value) || [];
		const bias = biasRules(value) || [];

		// Always render two-column grid, even if one side empty
		mount.innerHTML = renderTwoColumns(base, bias);
		mount.classList.add('sugg-visible');
		if (typeof onShown === 'function') onShown();
	};

	const maybeAuto = () => {
		const len = (ta.value || '').trim().length;
		if (len >= minChars) render();
	};

	const onInput = () => maybeAuto();
	const onClick = () => render();

	ta.addEventListener('input', onInput);
	btn?.addEventListener('click', onClick);

	// Expose controls
	return {
		destroy() {
			try {
				ta.removeEventListener('input', onInput);
				btn?.removeEventListener('click', onClick);
			} catch {}
		},
		forceSuggest() { render(); }
	};
}

/* ---- Lightweight styles (scoped by class names used above) ---- */
/* You can keep these in screen.css; added here for clarity.
   .sugg-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
   .sugg-heading { margin:0 0 .25rem 0; font-weight:700; }
   .sugg-list { margin:0; padding-left:1rem; }
   .sugg-item { margin:.5rem 0; }
   .sugg-row { display:flex; gap:.5rem; align-items:center; }
   .sugg-cat { }
   .sugg-sev { font-size:.85em; padding:.1rem .4rem; border-radius:.25rem; border:1px solid currentColor; }
   .sugg-sev.high { color:#7a1212; }
   .sugg-sev.medium { color:#6b4e00; }
   .sugg-sev.low { color:#2a5b2b; }
*/
