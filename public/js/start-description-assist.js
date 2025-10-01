/**
 * @file start-description-assist.js
 * @module StartDescriptionAssist
 * @summary Owner of Step 1 Description assistance (rule suggestions + AI preview).
 */

import { initCopilotSuggester } from './copilot-suggester.js';

/**
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

const DEFAULTS = Object.freeze({
	textareaSelector: '#p_desc', // ✅ match your page
	manualBtnSelector: '#btn-get-suggestions',
	aiBtnSelector: '#btn-ai-rewrite',
	suggContainerSelector: '#description-suggestions',
	aiContainerSelector: '#ai-rewrite-output',
	aiStatusSelector: '#ai-rewrite-status',
	aiEndpoint: '/api/ai-rewrite?mode=description',
	minCharsForAI: 400,
	requestTimeoutMs: 10_000
});

function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } [m]));
}

function fetchWithTimeout(resource, init, timeoutMs) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
	const safe = Object.assign({}, init || {}, { signal: controller.signal });
	return fetch(resource, safe).finally(() => clearTimeout(id));
}

function renderAiPanel(data) {
	const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
	return `
    <div class="sugg-region">
      <div class="sugg-summary"><strong>AI summary:</strong> ${esc(data?.summary || '')}</div>

      <div class="two-cols">
        <div class="col">
          <h3 class="govuk-heading-s" style="margin:0 0 .5rem 0">Suggestions</h3>
          <ul class="sugg-list">
            ${list.map(s => `
              <li class="sugg-item">
                <strong class="sugg-cat">${esc(s?.category || 'General')}</strong> — ${esc(s?.tip || '')}
                <div class="sugg-why">Why: ${esc(s?.why || '')}${s?.severity ? ` (${esc(s.severity)})` : ''}</div>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="col">
          <h3 class="govuk-heading-s" style="margin:0 0 .5rem 0">Bias checks</h3>
          <div id="ai-bias-slot"><em class="muted">No bias findings.</em></div>
        </div>
      </div>

      <hr/>
      <div><strong>Concise rewrite (optional):</strong></div>
      <pre class="prewrap">${esc(data?.rewrite || '')}</pre>
      <button type="button" id="apply-ai-rewrite" class="btn">Replace Description with rewrite</button>
    </div>
  `;
}

function bindApplyRewrite(container, textarea, suggInstance) {
	const btn = container.querySelector('#apply-ai-rewrite');
	const pre = container.querySelector('.prewrap');
	if (!btn || !pre) return;
	btn.addEventListener('click', () => {
		textarea.value = pre.textContent || '';
		textarea.focus();
		try { typeof suggInstance?.forceSuggest === 'function' && suggInstance.forceSuggest(); } catch {}
	});
}

/**
 * Initialise Description assistance (idempotent).
 * @param {Partial<AssistConfig>} cfg
 * @returns {{destroy:()=>void}|null}
 */
export function initStartDescriptionAssist(cfg = {}) {
	if (window.__descAssistActive) return null; // prevent double-wiring
	/** @type {AssistConfig} */
	const opts = Object.freeze({ ...DEFAULTS, ...cfg });

	const textarea = document.querySelector(opts.textareaSelector);
	const manualBtn = document.querySelector(opts.manualBtnSelector);
	const aiBtn = document.querySelector(opts.aiBtnSelector);
	const suggContainer = document.querySelector(opts.suggContainerSelector);
	const aiContainer = document.querySelector(opts.aiContainerSelector);
	const aiStatus = document.querySelector(opts.aiStatusSelector);
	const toolsBar = document.querySelector('#ai-tools');

	if (!textarea || !suggContainer) return null;

	// Init local suggester (handles 2-column Suggestions | Bias and auto/ manual flows)
	const sugg = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		manualButton: opts.manualBtnSelector,
		biasColumn: true, // ✅ render bias alongside suggestions
		autoThreshold: 400, // ✅ auto when ≥400 chars
	});

	// Reveal the toolbar when threshold is reached
	const updateToolsVisibility = () => {
		const show = (textarea.value.trim().length >= opts.minCharsForAI);
		toolsBar?.classList.toggle('hidden', !show);
	};

	// Paste-safe: run on `input` + do an initial pass on load
	const onInput = () => {
		updateToolsVisibility();
		sugg?.maybeAutoSuggest?.(); // auto suggest when past threshold
	};
	textarea.addEventListener('input', onInput);
	// initial (for paste or autofill before JS)
	queueMicrotask(() => { onInput(); });

	// AI rewrite
	const onAiClick = async () => {
		const text = textarea.value.trim();
		if (text.length < opts.minCharsForAI) {
			aiStatus && (aiStatus.textContent = `Enter at least ${opts.minCharsForAI} characters to try AI.`);
			textarea.focus();
			return;
		}
		aiStatus && (aiStatus.textContent = 'Thinking…');
		aiContainer && (aiContainer.textContent = '');

		try {
			const res = await fetchWithTimeout(opts.aiEndpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text })
			}, opts.requestTimeoutMs);

			if (!res.ok) {
				aiStatus && (aiStatus.textContent = 'Suggestions are temporarily unavailable.');
				return;
			}
			const data = await res.json();
			if (aiContainer) {
				aiContainer.innerHTML = renderAiPanel(data);
				bindApplyRewrite(aiContainer, textarea, sugg);
				// inject bias suggestions (reuse the same bias engine for step 1)
				const biasSlot = aiContainer.querySelector('#ai-bias-slot');
				if (biasSlot && typeof sugg?.renderBiasFor === 'function') {
					biasSlot.innerHTML = sugg.renderBiasFor(text);
				}
			}
			aiStatus && (aiStatus.textContent = data?.flags?.possible_personal_data ?
				'⚠️ Possible personal data detected in your original text.' :
				'Done.');
		} catch {
			aiStatus && (aiStatus.textContent = 'Network error.');
		}
	};
	aiBtn?.addEventListener('click', onAiClick);
	manualBtn?.addEventListener('click', () => sugg?.forceSuggest?.()); // keep manual trigger

	window.__descAssistActive = true;
	window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

	return {
		destroy() {
			try {
				textarea.removeEventListener('input', onInput);
				aiBtn?.removeEventListener('click', onAiClick);
			} catch {}
			window.__descAssistActive = false;
		}
	};
}

// auto-init
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => initStartDescriptionAssist());
} else {
	initStartDescriptionAssist();
}
ptionAssist();
});
