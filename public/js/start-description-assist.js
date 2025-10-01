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
 */

import { initCopilotSuggester } from './copilot-suggester.js';

const DEFAULTS = Object.freeze({
	MIN_CHARS_FOR_AI: 400,
	TIMEOUT_MS: 10_000,
	ENDPOINT: '/api/ai-rewrite'
});

function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, m => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		'\'': '&#39;'
	} [m]));
}

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

export function initStartDescriptionAssist(cfg = {}) {
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

	const textarea = document.querySelector(opts.textareaSelector);
	const manualBtn = document.querySelector(opts.manualBtnSelector);
	const aiBtn = document.querySelector(opts.aiBtnSelector);
	const suggContainer = document.querySelector(opts.suggContainerSelector);
	const aiContainer = document.querySelector(opts.aiContainerSelector);
	const aiStatus = document.querySelector(opts.aiStatusSelector);

	if (!textarea || !suggContainer) return null;

	const suggInstance = initCopilotSuggester({
		textarea: opts.textareaSelector,
		container: opts.suggContainerSelector,
		button: opts.manualBtnSelector
	});

	// Mark Step 1 as handled so other scripts can stand down
	window.__descAssistActive = true;
	try { if (suggContainer) suggContainer.dataset.owner = 'start-description-assist'; } catch {}

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

	window.dispatchEvent(new CustomEvent('start-description-assist:ready'));

	return { destroy() { try { aiBtn?.removeEventListener('click', onAiClick); } catch {} } };
}

document.addEventListener('DOMContentLoaded', () => { initStartDescriptionAssist(); });
