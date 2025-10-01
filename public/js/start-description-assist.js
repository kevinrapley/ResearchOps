/**
 * @file start-description-assist.js
 * @module StartDescriptionAssist
 * @summary Step 1 (Description) enhancements: local suggestions + AI rewrite.
 *
 * @description
 * - Shows toolbar when description length ≥ minChars (default 400).
 * - Renders two-column suggestions (original vs bias) automatically AND on click.
 * - Calls /api/ai-rewrite?mode=description for summary/suggestions/rewrite.
 * - Never sends network requests until user clicks “Try AI rewrite”.
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

const DEFAULTS = Object.freeze({
	MIN_CHARS_FOR_AI: 400,
	TIMEOUT_MS: 10_000,
	ENDPOINT: '/api/ai-rewrite'
});

/** @param {unknown} s */
const esc = s => String(s ?? '')
	.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [c]));

/**
 * Two-column AI panel (AI suggestions left; AI bias notes right if present).
 * We expect the backend to include any bias findings in `suggestions` (category contains “Bias”/“Accessibility”/“Inclusion”).
 * @param {{summary?:string, suggestions?:Array, rewrite?:string}} data
 */
function renderAiPanelTwoCol(data) {
	const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
	const left = list.filter(s => !/bias|inclusion|accessibility/i.test(s?.category || ''));
	const right = list.filter(s => /bias|inclusion|accessibility/i.test(s?.category || ''));

	const col = (items, heading) => `
    <section class="sugg-col">
      <h3 class="sugg-heading">${esc(heading)}</h3>
      <ul class="sugg-list">
        ${items.map(s => `
          <li class="sugg-item">
            <div class="sugg-row">
              <strong class="sugg-cat">${esc(s?.category || 'General')}</strong>
              <span class="sugg-sev ${esc(s?.severity || 'medium')}">${esc(s?.severity || 'medium')}</span>
            </div>
            <div class="sugg-tip">${esc(s?.tip || '')}</div>
            <div class="sugg-why"><span class="mono muted">Why:</span> ${esc(s?.why || '')}</div>
          </li>`).join('')}
      </ul>
    </section>`.trim();

	return `
    <div class="sugg-summary"><strong>AI summary:</strong> ${esc(data?.summary || '')}</div>
    <div class="sugg-grid" role="group" aria-label="AI suggestions split view">
      ${col(left, 'AI Suggestions')}
      ${col(right.length ? right : [{category:'Bias', tip:'No bias findings.', why:'', severity:'low'}], 'AI Bias & Inclusion')}
    </div>
    <hr/>
    <div><strong>Concise rewrite (optional):</strong></div>
    <pre class="rewrite-block" aria-label="AI rewrite">${esc(data?.rewrite || '')}</pre>
    <button type="button" id="apply-ai-rewrite" class="btn">Replace Description with rewrite</button>
  `.trim();
}

/**
 * Fetch with timeout helper.
 * @param {RequestInfo|URL} resource
 * @param {RequestInit} init
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

/**
 * Initialise Step 1 assistance.
 * @param {Partial<AssistConfig>} cfg
 */
export function initStartDescriptionAssist(cfg = {}) {
	const opts = {
		textareaSelector: '#p_desc',
		manualBtnSelector: '#btn-get-suggestions',
		aiBtnSelector: '#btn-ai-rewrite',
		suggContainerSelector: '#description-suggestions',
		aiContainerSelector: '#ai-rewrite-output',
		aiStatusSelector: '#ai-rewrite-status',
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
	const toolbar = /** @type {HTMLElement|null} */ (document.querySelector('#ai-tools'));

	if (!ta || !suggMount) return null;

	// Local suggester: 2-column automatic + manual — Step 1 uses 400 chars threshold
	const sugg = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector,
		minChars: opts.minCharsForAI
	});

	const showToolbarIfReady = () => {
		if (!toolbar) return;
		const v = (ta.value || '').trim();
		if (v.length >= opts.minCharsForAI) toolbar.classList.remove('hidden');
	};

	// AI click -> /api/ai-rewrite?mode=description
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
			const res = await fetchWithTimeout(`${opts.aiEndpoint}?mode=description`, {
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
				aiMount.innerHTML = renderAiPanelTwoCol(data);
				const apply = aiMount.querySelector('#apply-ai-rewrite');
				const pre = aiMount.querySelector('.rewrite-block');
				apply?.addEventListener('click', () => {
					ta.value = pre?.textContent || '';
					ta.focus();
					try { sugg.forceSuggest(); } catch {}
				});
			}
			aiStatus && (aiStatus.textContent = data?.flags?.possible_personal_data ?
				'⚠️ Possible personal data detected in your original text.' :
				'Done.');
		} catch {
			aiStatus && (aiStatus.textContent = 'Network error.');
		}
	};

	// Events
	ta.addEventListener('input', showToolbarIfReady);
	manualBtn?.addEventListener('click', () => { /* render handled by suggester */ });
	aiBtn?.addEventListener('click', onAiClick);

	// Initial check (paste)
	showToolbarIfReady();

	// Expose a tiny teardown (optional)
	return {
		destroy() {
			try {
				ta.removeEventListener('input', showToolbarIfReady);
				aiBtn?.removeEventListener('click', onAiClick);
				sugg?.destroy?.();
			} catch {}
		}
	};
}

// Auto-init (progressive enhancement)
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initStartDescriptionAssist());
} else {
	initStartDescriptionAssist();
}
