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
 * @property {string} textareaSelector          CSS selector for the Step 1 textarea (default '#project-description')
 * @property {string} manualBtnSelector         Selector for “Get suggestions” button (default '#btn-get-suggestions')
 * @property {string} aiBtnSelector             Selector for “Try AI rewrite” button (default '#btn-ai-rewrite')
 * @property {string} suggContainerSelector     Selector for rule suggestions container (default '#description-suggestions')
 * @property {string} aiContainerSelector       Selector for AI output container (default '#ai-rewrite-output')
 * @property {string} aiStatusSelector          Selector for inline status element (default '#ai-rewrite-status')
 * @property {string} aiEndpoint                API path for AI rewrite (default '/api/ai-rewrite')
 * @property {number} minCharsForAI             Minimum chars before enabling AI (default 400)
 * @property {number} requestTimeoutMs          Network timeout for AI call (default 10000)
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
 * @section Helper functions
 * ========================= */

/**
 * Escape text for safe HTML interpolation.
 * @function esc
 * @inner
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
 * Fetch with a hard timeout.
 * @async
 * @function fetchWithTimeout
 * @inner
 * @param {RequestInfo | URL} resource
 * @param {RequestInit} [init]
 * @param {number} [timeoutMs=DEFAULTS.TIMEOUT_MS]
 * @returns {Promise<Response>}
 * @throws {Error} If aborted due to timeout.
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
 * @function renderAiPanel
 * @inner
 * @param {{summary?:string, suggestions?:Array<{category?:string, tip?:string, why?:string, severity?:string}>, rewrite?:string}} data
 * @returns {string} HTML string
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
 * Wire the “apply rewrite” button to replace textarea content.
 * @function bindApplyRewrite
 * @inner
 * @param {HTMLElement} container
 * @param {HTMLTextAreaElement} textarea
 * @param {{forceSuggest?:Function}} suggInstance
 * @returns {void}
 */
function bindApplyRewrite(container, textarea, suggInstance) {
	const btn = container.querySelector('#apply-ai-rewrite');
	const p = container.querySelector('p');
	if (!btn || !p) return;
	btn.addEventListener('click', () => {
		textarea.value = p.textContent || '';
		textarea.focus();
		// Re-run local suggestions on the new text (best-effort)
		try { typeof suggInstance?.forceSuggest === 'function' && suggInstance.forceSuggest(); } catch {}
	});
}

/* =========================
 * @section Core initialiser
 * ========================= */

/**
 * Initialise Description assistance on the Start page.
 * Safe to call multiple times; no-op if selectors don’t match.
 *
 * @function initStartDescriptionAssist
 * @public
 * @param {Partial<AssistConfig>} [cfg]
 * @returns {{ destroy:()=>void }|null} A small handle with `destroy()`, or null if not initialised.
 *
 * @example
 * import { initStartDescriptionAssist } from '/js/start-description-assist.js';
 * initStartDescriptionAssist();
 */
export function initStartDescriptionAssist(cfg = {}) {
	/** @type {AssistConfig} */
	const opts = {
		textareaSelector: '#project-description',
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

	// If the page doesn’t have the expected elements, do nothing.
	if (!textarea || !suggContainer) return null;

	// 1) Initialise the local rule-based suggester (client-only)
	const suggInstance = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector
	});

	// 2) Wire the AI rewrite button (explicit action by user)
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
		} catch {
			if (aiStatus) aiStatus.textContent = 'Network error.';
		}
	};

	aiBtn?.addEventListener('click', onAiClick);

	// Emit a small event so analytics (if any) can hook in without coupling
	window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

	// Return a small handle for teardown (useful in PJAX/SPA navigations)
	return {
		destroy() {
			try { aiBtn?.removeEventListener('click', onAiClick); } catch {}
		}
	};
}

/* =========================
 * @section Auto-init (progressive enhancement)
 * ========================= */

/**
 * Auto-initialise if the expected elements are present.
 * Safe to include on every page; does nothing when selectors don’t match.
 */
document.addEventListener('DOMContentLoaded', () => {
	initStartDescriptionAssist();
});
