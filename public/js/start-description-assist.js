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
 * Initialise Description assistance on the Start page.
 * Safe to call multiple times; no-op if selectors don’t match.
 *
 * @function initStartDescriptionAssist
 * @public
 * @param {Partial<AssistConfig>} [cfg]
 * @returns {{ destroy:()=>void }|null}
 */
export function initStartDescriptionAssist(cfg = {}) {
	/** @type {AssistConfig} */
	const opts = {
		textareaSelector: '#p_desc', // ✅ matches your HTML
		manualBtnSelector: '#btn-get-suggestions',
		aiBtnSelector: '#btn-ai-rewrite',
		suggContainerSelector: '#description-suggestions',
		aiContainerSelector: '#ai-rewrite-output',
		aiStatusSelector: '#ai-rewrite-status',
		aiEndpoint: '/api/ai-rewrite',
		minCharsForAI: 400,
		requestTimeoutMs: 10_000,
		...cfg
	};

	/** @type {HTMLTextAreaElement|null} */
	const textarea = document.querySelector(opts.textareaSelector);
	/** @type {HTMLButtonElement|null} */
	const manualBtn = document.querySelector(opts.manualBtnSelector);
	/** @type {HTMLButtonElement|null} */
	const aiBtn = document.querySelector(opts.aiBtnSelector);
	/** @type {HTMLElement|null} */
	const suggContainer = document.querySelector(opts.suggContainerSelector);
	/** @type {HTMLElement|null} */
	const aiContainer = document.querySelector(opts.aiContainerSelector);
	/** @type {HTMLElement|null} */
	const aiStatus = document.querySelector(opts.aiStatusSelector);
	/** @type {HTMLElement|null} */
	const aiTools = document.getElementById('ai-tools');

	if (!textarea || !suggContainer) return null;

	// Local rule-based suggester
	const suggInstance = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector
	});

	// --- Robust reveal logic for AI tools (input, paste, change, keyup) ---
	const min = opts.minCharsForAI;

	/** @returns {number} */
	const currentLen = () => (textarea.value || '').trim().length;

	/** @param {boolean} show */
	const setToolsVisible = (show) => {
		if (!aiTools) return;
		aiTools.classList.toggle('hidden', !show);
		// optional: aria
		aiTools.setAttribute('aria-hidden', show ? 'false' : 'true');
	};

	/** Run on every text change */
	const handleReveal = () => {
		const ok = currentLen() >= min;
		setToolsVisible(ok);
	};

	// Input covers typing and paste in modern browsers; still add paste fallback.
	const onInput = () => handleReveal();
	const onKeyup = () => handleReveal();
	const onChange = () => handleReveal();
	const onPaste = () => {
		// Defer so the value includes pasted text
		setTimeout(handleReveal, 0);
	};

	textarea.addEventListener('input', onInput);
	textarea.addEventListener('keyup', onKeyup);
	textarea.addEventListener('change', onChange);
	textarea.addEventListener('paste', onPaste);

	// Initial pass (handles prefilled/auto-fill content)
	handleReveal();

	// --- AI rewrite click handler (unchanged; shown here for completeness) ---
	const onAiClick = async () => {
		const text = (textarea.value || '').trim();
		if (text.length < min) {
			if (aiStatus) aiStatus.textContent = `Enter at least ${min} characters to try AI.`;
			textarea.focus();
			return;
		}

		if (aiStatus) aiStatus.textContent = 'Thinking…';
		if (aiContainer) aiContainer.textContent = '';

		try {
			const res = await fetch(opts.aiEndpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode: 'description', text }) // ✅ ensure mode=description
			});

			if (!res.ok) {
				if (aiStatus) aiStatus.textContent = 'Suggestions are temporarily unavailable.';
				return;
			}

			const data = await res.json();
			if (aiContainer) {
				aiContainer.innerHTML = renderAiPanel(data);
				bindApplyRewrite(aiContainer, textarea, suggInstance);
			}
			if (aiStatus) {
				aiStatus.textContent = data?.flags?.possible_personal_data ?
					'⚠️ Possible personal data detected in your original text.' :
					'Done.';
			}
		} catch {
			if (aiStatus) aiStatus.textContent = 'Network error.';
		}
	};

	aiBtn?.addEventListener('click', onAiClick);

	// Let the page know we’re wired up (analytics or other listeners can hook into this)
	window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

	return {
		destroy() {
			try {
				textarea.removeEventListener('input', onInput);
				textarea.removeEventListener('keyup', onKeyup);
				textarea.removeEventListener('change', onChange);
				textarea.removeEventListener('paste', onPaste);
				aiBtn?.removeEventListener('click', onAiClick);
			} catch {}
		}
	};
}

/* =========================
 * @section Auto-init (progressive enhancement)
 * ========================= */

/**
 * Auto-initialise once per page. Safe when the script is included multiple times.
 * Uses a global guard flag to avoid double-wiring.
 * If you ever need to disable auto-init for testing, add data-noauto="true" on the script tag.
 */
(() => {
	// Guard to avoid double init across partial reloads or multiple script tags
	if (window.__descAssistActive === true) return;
	if (document.currentScript && document.currentScript.dataset.noauto === 'true') return;

	const start = () => {
		const handle = initStartDescriptionAssist();
		if (handle) {
			// mark as active so other controllers (e.g., start-new-project.js) don't re-wire Step 1
			window.__descAssistActive = true;
			// Expose handle for optional teardown in SPA-style navigation
			window.__descAssistHandle = handle;
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	} else {
		start();
	}
})();
