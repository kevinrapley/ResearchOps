/**
 * @file start-description-assist.js
 * @module StartDescriptionAssist
 * @summary Page wiring for “Start → Step 1 of 3 — Description”.
 * @description
 * Enhances the Step 1 “Description” field with:
 * - Local, zero-cost rule suggestions (client-only; no network).
 * - Optional AI-powered concise rewrite via `POST /api/ai-rewrite`.
 *
 * Accessibility:
 * - Live regions for status + results (aria-live="polite").
 * - Keyboard reachable controls; focus returns to the textarea after apply.
 *
 * Privacy:
 * - No network calls until the user explicitly clicks “Try AI rewrite”.
 * - AI endpoint is hosted in your Worker; OFFICIAL-by-default handling.
 *
 * @requires globalThis.fetch
 * @requires globalThis.document
 * @requires globalThis.CustomEvent
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
 * @section Configuration
 * ========================= */

/**
 * Immutable configuration defaults.
 * @constant
 * @name DEFAULTS
 * @type {Readonly<{
 *   MIN_CHARS_FOR_AI:number,
 *   TIMEOUT_MS:number,
 *   ENDPOINT:string
 * }>}
 * @default
 * @inner
 */
const DEFAULTS = Object.freeze({
	MIN_CHARS_FOR_AI: 400,
	TIMEOUT_MS: 10_000,
	ENDPOINT: '/api/ai-rewrite'
});

/* =========================
 * @section Helpers
 * ========================= */

/**
 * Escape HTML.
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
 * Fetch with timeout.
 * @param {RequestInfo|URL} resource
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(resource, init, timeoutMs = DEFAULTS.TIMEOUT_MS) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
	try {
		const initSafe = Object.assign({}, init || {});
		initSafe.signal = controller.signal;
		return await fetch(resource, initSafe);
	} finally {
		clearTimeout(id);
	}
}

/**
 * Render the AI panel (summary, suggestions, rewrite).
 * @param {{summary?:string, suggestions?:Array<{category?:string, tip?:string, why?:string, severity?:string}>, rewrite?:string}} data
 * @returns {string}
 */
function renderAiPanel(data) {
	const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
	return `
    <div class="sugg-region">
      <div class="sugg-summary"><strong>AI summary:</strong> ${esc(data?.summary || '')}</div>
      <ul class="sugg-list">
        ${list.map(s => `
          <li class="sugg-item">
            <strong class="sugg-cat">${esc(s?.category || 'General')}</strong> — ${esc(s?.tip || '')}
            <div class="sugg-why">Why: ${esc(s?.why || '')}${s?.severity ? ` (${esc(s.severity)})` : ''}</div>
          </li>
        `).join('')}
      </ul>
      <hr/>
      <div><strong>Concise rewrite (optional):</strong></div>
      <p>${esc(data?.rewrite || '')}</p>
      <button type="button" id="apply-ai-rewrite" class="btn">Replace Description with rewrite</button>
    </div>
  `;
}

/**
 * Bind apply button to replace textarea content.
 * @param {HTMLElement} container
 * @param {HTMLTextAreaElement} textarea
 * @param {{forceSuggest?:Function}} suggInstance
 */
function bindApplyRewrite(container, textarea, suggInstance) {
	const btn = container.querySelector('#apply-ai-rewrite');
	const p = container.querySelector('p');
	if (!btn || !p) return;
	btn.addEventListener('click', () => {
		textarea.value = p.textContent || '';
		textarea.focus();
		try { typeof suggInstance?.forceSuggest === 'function' && suggInstance.forceSuggest(); } catch {}
	});
}

/* =========================
 * @section Core initialiser
 * ========================= */

/**
 * Initialise Description assistance on the Start page.
 * @param {Partial<AssistConfig>} [cfg]
 * @returns {{ destroy:()=>void }|null}
 */
export function initStartDescriptionAssist(cfg = {}) {
	/** @type {AssistConfig} */
	const opts = {
		// IMPORTANT: these match your HTML
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
	const aiToolbar = document.getElementById('ai-tools');

	if (!textarea || !suggContainer) return null;

	// 1) Initialise local rule-based suggester
	const suggInstance = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector
	});

	// Helper: run local suggestions safely
	const runLocalSuggestions = () => {
		try {
			if (typeof suggInstance?.forceSuggest === 'function') {
				suggInstance.forceSuggest();
			}
		} catch { /* noop */ }
	};

	// 2) Auto-show toolbar + auto-suggest when threshold reached
	const showTools = () => {
		if (aiToolbar && aiToolbar.classList.contains('hidden')) {
			aiToolbar.classList.remove('hidden');
		}
	};

	const maybeAutoSuggest = () => {
		const len = (textarea.value || '').trim().length;
		if (len >= opts.minCharsForAI) {
			showTools();
			runLocalSuggestions(); // <-- THIS fixes (2)
		}
	};

	const onInput = () => { maybeAutoSuggest(); };
	const onChange = () => { maybeAutoSuggest(); };
	const onKeyup = () => { maybeAutoSuggest(); };
	const onPaste = () => { setTimeout(maybeAutoSuggest, 0); };

	textarea.addEventListener('input', onInput);
	textarea.addEventListener('keyup', onKeyup);
	textarea.addEventListener('change', onChange);
	textarea.addEventListener('paste', onPaste);

	// 3) Manual “Get suggestions” click -> run local suggester
	if (manualBtn) {
		manualBtn.type = 'button'; // belt & braces
		manualBtn.addEventListener('click', (e) => {
			e.preventDefault();
			showTools();
			runLocalSuggestions(); // <-- THIS fixes (3)
		});
	}

	// 4) AI rewrite button (unchanged)
	const onAiClick = async () => {
		const text = (textarea.value || '').trim();
		if (text.length < opts.minCharsForAI) {
			if (aiStatus) aiStatus.textContent = `Enter at least ${opts.minCharsForAI} characters to try AI.`;
			textarea.focus();
			return;
		}

		if (aiStatus) aiStatus.textContent = 'Thinking…';
		if (aiContainer) aiContainer.textContent = '';

		try {
			const res = await fetchWithTimeout(opts.aiEndpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text })
			}, opts.requestTimeoutMs);

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
			// Keep local suggestions fresh after AI runs
			runLocalSuggestions();
		} catch {
			if (aiStatus) aiStatus.textContent = 'Network error.';
		}
	};

	aiBtn?.addEventListener('click', onAiClick);

	// Event for analytics
	window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

	return {
		destroy() {
			try {
				textarea.removeEventListener('input', onInput);
				textarea.removeEventListener('keyup', onKeyup);
				textarea.removeEventListener('change', onChange);
				textarea.removeEventListener('paste', onPaste);
				manualBtn?.removeEventListener('click', runLocalSuggestions);
				aiBtn?.removeEventListener('click', onAiClick);
			} catch {}
		}
	};
}

/* =========================
 * @section Auto-init (progressive enhancement)
 * ========================= */

(() => {
	if (window.__descAssistActive === true) return;
	if (document.currentScript && document.currentScript.dataset.noauto === 'true') return;

	const start = () => {
		const handle = initStartDescriptionAssist();
		if (handle) {
			window.__descAssistActive = true;
			window.__descAssistHandle = handle;
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	} else {
		start();
	}
})();
