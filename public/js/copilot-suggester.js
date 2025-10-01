/**
 * @file copilot-suggester.js
 * @module CopilotSuggester
 * @summary Local, zero-cost suggestions + bias checks for Description/Objectives.
 * @description
 * Client-only suggester that renders two columns:
 * - Left: actionable suggestions (clarity, scope, measurability, etc.)
 * - Right: bias checks (language, inclusion, device/browsers, sampling)
 *
 * Usage:
 *  import { initCopilotSuggester } from '/js/copilot-suggester.js';
 *  const handle = initCopilotSuggester({
 *    mode: 'description' | 'objectives',
 *    textarea: '#p_desc',
 *    container: '#description-suggestions',
 *    button: '#btn-get-suggestions'
 *  });
 *
 * Accessibility:
 * - `container` should be aria-live="polite".
 *
 * Custom project rules:
 * - GOV.UK style, plain English. No invented data.
 * - Do not log raw user content. No network calls.
 */

/* =========================
 * Types
 * ========================= */

/**
 * @typedef {'description'|'objectives'} SuggesterMode
 */

/**
 * @typedef {Object} Suggestion
 * @property {string} category - Category label (e.g., "Measurability", "Scope").
 * @property {string} tip      - Concrete, concise recommendation.
 * @property {string} why      - Rationale for the recommendation.
 * @property {'high'|'medium'|'low'} severity
 */

/**
 * @typedef {Object} InitOptions
 * @property {SuggesterMode} mode
 * @property {string|HTMLElement} textarea
 * @property {string|HTMLElement} container
 * @property {string|HTMLElement} [button]
 * @property {number} [minCharsAuto]      - Override auto-trigger threshold (defaults per mode).
 * @property {boolean} [showWhenEmpty]    - If true, renders an empty “no suggestions yet” scaffold.
 */

/* =========================
 * Constants
 * ========================= */

const THRESHOLDS = Object.freeze({
	description: 400,
	objectives: 60
});

const MAX_SUGGESTIONS = 8; // cap total on left column
const MAX_BIAS_SUGGESTIONS = 8; // cap total on right column
const MAX_TIP_LEN = 160;
const GOVUK_BADGE = {
	high: 'badge--high',
	medium: 'badge--medium',
	low: 'badge--low'
};

/* =========================
 * Utilities
 * ========================= */

/**
 * Resolve a selector or return the element itself.
 * @param {string|HTMLElement|null|undefined} elOrSel
 * @returns {HTMLElement|null}
 */
function $(elOrSel) {
	if (!elOrSel) return null;
	if (typeof elOrSel === 'string') return document.querySelector(elOrSel);
	if (elOrSel instanceof HTMLElement) return elOrSel;
	return null;
}

/**
 * Escape text for safe HTML.
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
 * Clamp string length.
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
function clamp(s, n) {
	const t = String(s || '');
	return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/* =========================
 * Heuristics — main suggestions (left column)
 * ========================= */

/**
 * Build main (non-bias) suggestions from text and mode.
 * GOV.UK tone, concise, concrete, never invents data.
 * @param {string} text
 * @param {SuggesterMode} mode
 * @returns {Suggestion[]}
 */
function buildMainSuggestions(text, mode) {
	const t = String(text || '').trim();
	const lc = t.toLowerCase();
	/** @type {Suggestion[]} */
	const out = [];

	// Shared heuristics
	if (/^we\s+want\s+to\s+test\s+everything\b/i.test(t) || lc.includes('test everything')) {
		out.push({
			category: 'Scope',
			tip: 'Replace “test everything” with 2–4 specific aspects.',
			why: 'Focus enables a clear plan and right methods.',
			severity: 'high'
		});
	}
	if (/(maybe|perhaps|might)\s+look|unsure|not\s+sure/i.test(lc)) {
		out.push({
			category: 'Clarity',
			tip: 'Replace vague terms like “maybe” with an action verb.',
			why: 'Clear intent improves planning and analysis.',
			severity: 'medium'
		});
	}

	// Description-specific
	if (mode === 'description') {
		if (!/problem:|user need|users?:|outcomes?:|scope:|assumptions|risks?|ethics|method|timeline|recruitment|success criteria/i.test(t)) {
			out.push({
				category: 'Structure',
				tip: 'Add labelled sections you already mention (e.g., Problem, Users, Outcomes).',
				why: 'Clear headings make it easier to read and review.',
				severity: 'medium'
			});
		}
		if (/email|@|nhs\s*\d|\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i.test(t)) {
			out.push({
				category: 'Privacy',
				tip: 'Remove personal data (emails, NI, NHS numbers) from the description.',
				why: 'Avoids accidental sharing of personal information.',
				severity: 'high'
			});
		}
	}

	// Objectives-specific
	if (mode === 'objectives') {
		if (!/\d+%|\b(top\s+\d+)\b/i.test(t) && !/\bby\s+end\s+of\s+q[1-4]\b/i.test(t)) {
			out.push({
				category: 'Measurability',
				tip: 'Add a measurable target to 1–2 objectives.',
				why: 'Helps you track progress and success.',
				severity: 'high'
			});
		}
		if (!/^\s*\d\)/m.test(t) && !/^\s*-\s+/m.test(t)) {
			out.push({
				category: 'Clarity',
				tip: 'Start each objective with a verb and list them clearly.',
				why: 'Makes intent obvious and actionable.',
				severity: 'medium'
			});
		}
	}

	// General duplicates/overlap
	if ((t.match(/login|log-in|sign[- ]?in/gi) || []).length > 4) {
		out.push({
			category: 'Clarity',
			tip: 'Remove repetition and merge overlapping points.',
			why: 'Keeps the text concise and readable.',
			severity: 'low'
		});
	}

	return out.slice(0, MAX_SUGGESTIONS).map(s => ({
		...s,
		tip: clamp(s.tip, MAX_TIP_LEN),
		why: clamp(s.why, MAX_TIP_LEN)
	}));
}

/* =========================
 * Heuristics — bias checks (right column)
 * ========================= */

/**
 * Build bias findings (right column).
 * @param {string} text
 * @param {SuggesterMode} mode
 * @returns {Suggestion[]}
 */
function buildBiasSuggestions(text, mode) {
	const t = String(text || '').trim();
	const lc = t.toLowerCase();
	/** @type {Suggestion[]} */
	const out = [];

	// Exclusionary browser/device focus
	if (/chrome(-only| only)|chrome\s+only/i.test(lc) || /\bonly\s+on\s+chrome\b/i.test(lc)) {
		out.push({
			category: 'Bias — Devices & Browsers',
			tip: 'Avoid a Chrome-only constraint unless it is essential.',
			why: 'Narrow constraints bias findings and exclude users.',
			severity: 'medium'
		});
	}

	// Ableism / accessibility omission
	if (!/screen reader|accessib|wcag|voiceover|talkback/i.test(lc)) {
		out.push({
			category: 'Bias — Accessibility',
			tip: 'Consider users who use assistive tech (e.g., screen readers).',
			why: 'Ensures the research includes disabled users.',
			severity: 'high'
		});
	}

	// Language bias / jargon
	if (/alpha\b|beta\b/i.test(lc) && !/explain|define|check understanding/i.test(lc)) {
		out.push({
			category: 'Bias — Language',
			tip: 'Check understanding of terms like “alpha”.',
			why: 'Jargon can confuse and exclude participants.',
			severity: 'medium'
		});
	}

	// Sampling breadth
	if (!/bilingual|welsh|language|interpreter|translation/i.test(lc) && /form|application|apply/i.test(lc)) {
		out.push({
			category: 'Bias — Sampling',
			tip: 'Consider bilingual users and translation needs if relevant.',
			why: 'Language differences can change comprehension.',
			severity: 'low'
		});
	}

	// Stakeholder centricity over user centricity
	if (/stakeholders?/i.test(lc) && !/users?/i.test(lc)) {
		out.push({
			category: 'Bias — Focus',
			tip: 'Balance stakeholder aims with user needs.',
			why: 'Keeps the study centred on user impact.',
			severity: 'low'
		});
	}

	// If nothing triggered, show a single neutral notice
	if (out.length === 0) {
		out.push({
			category: 'Bias checks',
			tip: 'No obvious bias risks detected.',
			why: 'Keep watching for accessibility and sampling issues.',
			severity: 'low'
		});
	}

	return out.slice(0, MAX_BIAS_SUGGESTIONS).map(s => ({
		...s,
		tip: clamp(s.tip, MAX_TIP_LEN),
		why: clamp(s.why, MAX_TIP_LEN)
	}));
}

/* =========================
 * Rendering
 * ========================= */

/**
 * Render the two-column suggestions block (left: main, right: bias).
 * @param {Suggestion[]} mainList
 * @param {Suggestion[]} biasList
 * @returns {string}
 */
function renderTwoColumn(mainList, biasList) {
	const left = Array.isArray(mainList) ? mainList : [];
	const right = Array.isArray(biasList) ? biasList : [];

	const li = (s) => `
    <li class="sugg-item">
      <span class="sugg-cat">${esc(s.category)}</span>
      <span class="sugg-sev ${GOVUK_BADGE[s.severity] || ''}">${esc(s.severity)}</span>
      <div class="sugg-tip">${esc(s.tip)}</div>
      <div class="sugg-why">Why: ${esc(s.why)}</div>
    </li>
  `;

	return `
    <div class="sugg-grid" role="group" aria-label="Suggestions and bias checks">
      <section class="sugg-col" aria-label="Suggestions">
        <h3 class="sugg-col__title">Suggestions</h3>
        <ul class="sugg-list">
          ${left.map(li).join('') || '<li class="sugg-item muted">No suggestions yet.</li>'}
        </ul>
      </section>
      <section class="sugg-col" aria-label="Bias checks">
        <h3 class="sugg-col__title">Bias checks</h3>
        <ul class="sugg-list">
          ${right.map(li).join('') || '<li class="sugg-item muted">No bias findings.</li>'}
        </ul>
      </section>
    </div>
  `;
}

/* =========================
 * Main initialiser
 * ========================= */

/**
 * Initialise the suggester. Safe to call multiple times; returns a handle.
 * @param {InitOptions} options
 * @returns {{ forceSuggest: ()=>void, destroy: ()=>void }|null}
 */
export function initCopilotSuggester(options) {
	const mode = (options?.mode === 'objectives') ? 'objectives' : 'description';
	const textarea = $(options?.textarea);
	const container = $(options?.container);
	const button = $(options?.button);
	const minCharsAuto = Number.isFinite(options?.minCharsAuto) ?
		Number(options.minCharsAuto) :
		THRESHOLDS[mode];

	if (!textarea || !container) return null;

	// one-time CSS hook (lightweight)
	container.classList.add('sugg-container');

	/** @type {() => void} */
	const render = () => {
		const text = (textarea.value || '').trim();
		const main = buildMainSuggestions(text, mode);
		const bias = buildBiasSuggestions(text, mode);
		container.innerHTML = renderTwoColumn(main, bias);
		container.dataset.populated = 'true';
		window.dispatchEvent(new CustomEvent('copilot-suggester:updated', {
			detail: { mode, count: main.length, biasCount: bias.length }
		}));
	};

	/** @type {() => void} */
	const maybeAutoSuggest = () => {
		const text = (textarea.value || '').trim();
		const eligible = text.length >= minCharsAuto;
		const already = container.dataset.populated === 'true';
		if (eligible && !already) render();
	};

	/** @type {(ev: Event) => void} */
	const onInput = () => {
		// keep lightweight on every keystroke; only auto-render once when threshold first crossed
		maybeAutoSuggest();
	};
	/** @type {(ev: KeyboardEvent) => void} */
	const onKeyup = () => maybeAutoSuggest();
	/** @type {(ev: Event) => void} */
	const onChange = () => maybeAutoSuggest();
	/** @type {(ev: ClipboardEvent) => void} */
	const onPaste = () => {
		// after paste, defer a tick to read updated value
		setTimeout(maybeAutoSuggest, 0);
	};

	/** @type {() => void} */
	const onManualClick = () => {
		render();
	};

	textarea.addEventListener('input', onInput);
	textarea.addEventListener('keyup', onKeyup);
	textarea.addEventListener('change', onChange);
	textarea.addEventListener('paste', onPaste);
	button?.addEventListener('click', onManualClick);

	// Optional empty scaffold (keeps layout steady)
	if (options?.showWhenEmpty) {
		container.innerHTML = renderTwoColumn([], []);
		container.dataset.populated = 'false';
	}

	return {
		/**
		 * Force re-run suggestions now.
		 * @returns {void}
		 */
		forceSuggest() { render(); },

		/**
		 * Tear down listeners and clear container.
		 * @returns {void}
		 */
		destroy() {
			try {
				textarea.removeEventListener('input', onInput);
				textarea.removeEventListener('keyup', onKeyup);
				textarea.removeEventListener('change', onChange);
				textarea.removeEventListener('paste', onPaste);
				button?.removeEventListener('click', onManualClick);
			} catch {}
		}
	};
}

/* =========================
 * Minimal styles (optional)
 * =========================
 * Add to your CSS bundle if you want quick badges/columns:
 *
 * .sugg-grid { display:grid; gap:1rem; grid-template-columns:1fr 1fr; }
 * .sugg-col__title { margin:0 0 .5rem 0; font-weight:600; }
 * .sugg-list { list-style: none; padding:0; margin:0; }
 * .sugg-item { padding:.5rem .75rem; border:1px solid var(--govuk-border, #b1b4b6); border-radius:.25rem; margin-bottom:.5rem; }
 * .sugg-item .sugg-cat { font-weight:600; margin-right:.5rem; }
 * .sugg-item .sugg-sev { float:right; text-transform:uppercase; font-size:.75rem; padding:.125rem .375rem; border-radius:.25rem; }
 * .badge--high { background:#d4351c; color:#fff; }
 * .badge--medium { background:#f47738; color:#000; }
 * .badge--low { background:#b1b4b6; color:#000; }
 * .muted { color:#505a5f; }
 */
