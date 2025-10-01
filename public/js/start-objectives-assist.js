/**
 * @file start-objective-assist.js
 * @module StartObjectiveAssist
 * @summary Step 2 (Objectives) enhancements: local suggestions + AI rewrite.
 *
 * @description
 * - Mirrors Step 1 behaviour, with a lower threshold (≥ 60 chars).
 * - Uses the same 2-column suggestion presentation (general vs bias).
 * - Calls /api/ai-rewrite?mode=objectives for AI (only on explicit click).
 *
 * @typedef {Object} AssistConfig
 * @property {string} textareaSelector
 * @property {string} manualBtnSelector
 * @property {string} aiBtnSelector
 * @property {string} suggContainerSelector
 * @property {string} aiContainerSelector
 * @property {string} aiStatusSelector
 * @property {string} aiEndpoint
 * @property {number} minCharsForAI
 * @property {number} requestTimeoutMs
 */

import { initCopilotSuggester } from './copilot-suggester.js';

/* =========================
 * Helpers
 * ========================= */

/**
 * HTML-escape a string for safe interpolation.
 * @param {unknown} s
 * @returns {string}
 */
const esc = (s) =>
	String(s ?? '').replace(/[&<>"']/g, c => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	} [c]));

/**
 * Classify suggestions into "general" vs "bias & inclusion".
 * @param {Array<{category?:string, tip?:string, why?:string, severity?:string}>} [items=[]]
 * @returns {{left:Array, right:Array}} left=general, right=bias
 */
function splitSuggestionsByBias(items = []) {
	const biasKeywords = [
		'bias', 'inclusion', 'inclusive', 'accessibility', 'accessible',
		'assistive', 'screen reader', 'screen-reader', 'contrast', 'language',
		'bilingual', 'welsh', 'device coverage', 'browser coverage', 'diversity',
		'equality', 'users with disabilities', 'disability', 'low vision', 'motor', 'hearing'
	];
	const hasBiasSignal = (text = '') =>
		biasKeywords.some(k => text.toLowerCase().includes(k));

	/** @type {Array} */
	const left = [];
	/** @type {Array} */
	const right = [];

	for (const s of items) {
		const cat = String(s?.category ?? '');
		const tip = String(s?.tip ?? '');
		const why = String(s?.why ?? '');
		const blob = `${cat} ${tip} ${why}`.toLowerCase();
		(hasBiasSignal(blob) ? right : left).push(s);
	}
	return { left, right };
}

/**
 * Render two columns: "Suggestions" (left) and "Bias & Inclusion" (right).
 * @param {Array} left
 * @param {Array} right
 * @param {string} [idPrefix='sugg']
 * @returns {string}
 */
function renderTwoColumnSuggestions(left = [], right = [], idPrefix = 'sugg') {
	const renderList = (items, emptyText) => {
		if (!items?.length) return `<p class="muted">${esc(emptyText)}</p>`;
		return `<ul class="${idPrefix}-list">
      ${items.map(s => `
        <li class="${idPrefix}-item">
          <div class="${idPrefix}-row">
            <strong class="${idPrefix}-cat">${esc(s?.category || 'General')}</strong>
            <span class="${idPrefix}-sev ${esc(s?.severity || 'medium')}">${esc(s?.severity || 'medium')}</span>
          </div>
          <div class="${idPrefix}-tip">${esc(s?.tip || '')}</div>
          <div class="${idPrefix}-why"><span class="mono muted">Why:</span> ${esc(s?.why || '')}</div>
        </li>
      `).join('')}
    </ul>`;
	};

	return `
  <section class="${idPrefix}-grid" aria-label="Suggestions grid">
    <div class="${idPrefix}-col" aria-label="Suggestions">
      <h3 class="govuk-heading-s">Suggestions</h3>
      ${renderList(left, 'No general suggestions.')}
    </div>
    <div class="${idPrefix}-col" aria-label="Bias &amp; Inclusion">
      <h3 class="govuk-heading-s">Bias &amp; Inclusion</h3>
      ${renderList(right, 'No bias findings.')}
    </div>
  </section>`;
}

/**
 * Render AI panel using two-column layout + rewrite block.
 * @param {{summary?:string, suggestions?:Array, rewrite?:string}} data
 * @param {string} [idPrefix='ai']
 * @returns {string}
 */
function renderAiPanelTwoCol(data, idPrefix = 'ai') {
	const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
	const { left, right } = splitSuggestionsByBias(list);
	return `
    <div class="${idPrefix}-region">
      <div class="${idPrefix}-summary"><strong>AI summary:</strong> ${esc(data?.summary || '')}</div>
      ${renderTwoColumnSuggestions(left, right, `${idPrefix}-sugg`)}
      <hr />
      <div><strong>Concise rewrite (optional):</strong></div>
      <pre class="rewrite-block" aria-label="AI rewrite">${esc(data?.rewrite || '')}</pre>
      <button type="button" id="apply-ai-obj-rewrite" class="btn">Replace Objectives with rewrite</button>
    </div>
  `;
}

/**
 * Fetch with a hard timeout.
 * @param {RequestInfo|URL} resource
 * @param {RequestInit} [init]
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(resource, init, timeoutMs) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
	try {
		return await fetch(resource, { ...(init || {}), signal: controller.signal });
	} finally { clearTimeout(t); }
}

/* =========================
 * Config
 * ========================= */

const DEFAULTS = Object.freeze({
	MIN_CHARS_FOR_AI: 60,
	TIMEOUT_MS: 10_000,
	ENDPOINT: '/api/ai-rewrite'
});

/* =========================
 * Entrypoint
 * ========================= */

/**
 * Initialise Step 2 assistance (Objectives).
 * @param {Partial<AssistConfig>} [cfg]
 * @returns {{destroy:()=>void}|null}
 */
export function initStartObjectiveAssist(cfg = {}) {
	/** @type {AssistConfig} */
	const opts = {
		textareaSelector: '#p_objectives',
		manualBtnSelector: '#btn-obj-suggestions',
		aiBtnSelector: '#btn-obj-ai-rewrite',
		suggContainerSelector: '#objectives-suggestions',
		aiContainerSelector: '#ai-objectives-output',
		aiStatusSelector: '#ai-obj-status',
		aiEndpoint: DEFAULTS.ENDPOINT,
		minCharsForAI: DEFAULTS.MIN_CHARS_FOR_AI,
		requestTimeoutMs: DEFAULTS.TIMEOUT_MS,
		...cfg
	};

	const ta = /** @type {HTMLTextAreaElement|null} */ (document.querySelector(opts.textareaSelector));
	const manualBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector(opts.manualBtnSelector));
	const aiBtn = /** @type {HTMLButtonElement|null} */ (document.querySelector(opts.aiBtnSelector));
	const suggMount = /** @type {HTMLElement|null} */ (document.querySelector(opts.suggContainerSelector));
	const aiMount = /** @type {HTMLElement|null} */ (document.querySelector(opts.aiContainerSelector));
	const aiStatus = /** @type {HTMLElement|null} */ (document.querySelector(opts.aiStatusSelector));
	const toolbar = /** @type {HTMLElement|null} */ (document.querySelector('#ai-objectives-tools'));

	if (!ta || !suggMount) return null;

	// Local suggester (threshold 60) with 2-column renderer
	const sugg = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector,
		minChars: opts.minCharsForAI,
		renderTwoColumn: (list) => {
			const { left, right } = splitSuggestionsByBias(list);
			return renderTwoColumnSuggestions(left, right, 'sugg');
		}
	});

	/**
	 * Show toolbar and auto-render suggestions once threshold reached.
	 */
	const onInput = () => {
		const v = (ta.value || '').trim();
		if (v.length >= opts.minCharsForAI) {
			toolbar && toolbar.classList.remove('hidden');
			try { sugg.forceSuggest(); } catch {}
		}
	};

	/**
	 * Trigger AI rewrite (objectives mode).
	 */
	const onAiClick = async () => {
		const text = (ta.value || '').trim();
		if (text.length < opts.minCharsForAI) {
			aiStatus && (aiStatus.textContent = `Enter at least ${opts.minCharsForAI} characters to try AI.`);
			ta.focus();
			return;
		}
		aiStatus && (aiStatus.textContent = 'Thinking…');
		aiMount && (aiMount.innerHTML = '');

		try {
			const res = await fetchWithTimeout(`${opts.aiEndpoint}?mode=objectives`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text })
			}, opts.requestTimeoutMs);

			if (!res.ok) {
				aiStatus && (aiStatus.textContent = 'Suggestions are temporarily unavailable.');
				return;
			}

			const data = await res.json();
			if (aiMount) {
				aiMount.innerHTML = renderAiPanelTwoCol(data, 'ai');
				const apply = aiMount.querySelector('#apply-ai-obj-rewrite');
				const pre = aiMount.querySelector('.rewrite-block');
				apply?.addEventListener('click', () => {
					ta.value = pre?.textContent || '';
					ta.focus();
					try { sugg.forceSuggest(); } catch {}
				});
			}

			aiStatus && (aiStatus.textContent =
				data?.flags?.possible_personal_data ?
				'⚠️ Possible personal data detected in your original text.' :
				'Done.');
		} catch {
			aiStatus && (aiStatus.textContent = 'Network error.');
		}
	};

	// Wire up
	ta.addEventListener('input', onInput);
	manualBtn?.addEventListener('click', () => { try { sugg.forceSuggest(); } catch {} });
	aiBtn?.addEventListener('click', onAiClick);

	// Initial (paste) check
	onInput();

	// Announce ready (optional hooks)
	window.dispatchEvent(new CustomEvent('start-objective-assist:ready'));

	return {
		destroy() {
			try {
				ta.removeEventListener('input', onInput);
				aiBtn?.removeEventListener('click', onAiClick);
				if (typeof sugg?.destroy === 'function') sugg.destroy();
			} catch {}
		}
	};
}

/* =========================
 * Auto-init (progressive enhancement)
 * ========================= */

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initStartObjectiveAssist());
} else {
	initStartObjectiveAssist();
}
