/**
 * @file start-objective-assist.js
 * @module StartObjectiveAssist
 * @summary Step 2 (Objectives) enhancements: local suggestions + AI rewrite.
 *
 * @description
 * - Mirrors Step 1 behaviour, with a lower threshold (≥ 60 chars).
 * - Uses the same 2-column suggestion presentation.
 * - Calls /api/ai-rewrite?mode=objectives for AI.
 */

import { initCopilotSuggester } from './copilot-suggester.js';

const DEFAULTS = Object.freeze({
	MIN_CHARS_FOR_AI: 60,
	TIMEOUT_MS: 10_000,
	ENDPOINT: '/api/ai-rewrite'
});

/** @param {unknown} s */
const esc = s => String(s ?? '')
	.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [c]));

/**
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
    <button type="button" id="apply-ai-obj-rewrite" class="btn">Replace Objectives with rewrite</button>
  `.trim();
}

/**
 * Fetch with timeout
 * @param {RequestInfo|URL} resource
 * @param {RequestInit} init
 * @param {number} timeoutMs
 */
async function fetchWithTimeout(resource, init, timeoutMs) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
	try {
		return await fetch(resource, { ...(init || {}), signal: controller.signal });
	} finally { clearTimeout(t); }
}

/**
 * Initialise Step 2 assistance.
 * @param {Partial<{
 *  textareaSelector:string,
 *  manualBtnSelector:string,
 *  aiBtnSelector:string,
 *  suggContainerSelector:string,
 *  aiContainerSelector:string,
 *  aiStatusSelector:string,
 *  aiEndpoint:string,
 *  minCharsForAI:number,
 *  requestTimeoutMs:number
 * }>} cfg
 */
export function initStartObjectiveAssist(cfg = {}) {
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

	// Local suggester (threshold 60)
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
				aiMount.innerHTML = renderAiPanelTwoCol(data);
				const apply = aiMount.querySelector('#apply-ai-obj-rewrite');
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

	ta.addEventListener('input', showToolbarIfReady);
	manualBtn?.addEventListener('click', () => { /* rendered by suggester */ });
	aiBtn?.addEventListener('click', onAiClick);

	showToolbarIfReady();

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

// Auto-init
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initStartObjectiveAssist());
} else {
	initStartObjectiveAssist();
}
