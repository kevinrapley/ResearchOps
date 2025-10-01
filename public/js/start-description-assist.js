// /js/start-description-assist.js
/**
 * Start Description Assist (auto-booting)
 * - Imports Copilot Suggester internally.
 * - Sets window.__descAssistActive once bound.
 * - Auto-updates suggestions on input.
 * - Optional auto-run of AI on paste via <meta name="sda-auto" content="true">.
 */

import { initCopilotSuggester } from '/js/copilot-suggester.js';

const _BOUND_FLAG = Symbol('sda_bound');
const _CONTROLLER = Symbol('sda_abort_controller');

function $(sel, root = document) { return root.querySelector(sel); }
function assertEl(el, label) { if (!el) throw new Error(`[start-description-assist] Missing element: ${label}`); return el; }
function exists(sel) { return !!document.querySelector(sel); }
function readMeta(name) { return document.querySelector(`meta[name="${name}"]`)?.content; }
function readAiEndpoint() { return (window.__AI_ENDPOINT || readMeta('ai-endpoint') || 'https://rops-api.digikev-kevin-rapley.workers.dev/api/ai-rewrite'); }
function readAutoFlag() { return String(readMeta('sda-auto') || '').toLowerCase() === 'true'; }

function setStatus(el, msg, busy = false) {
	if (!el) return;
	el.textContent = msg || '';
	if (busy) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
}

function h(tag, props = {}, children = []) {
	const el = document.createElement(tag);
	Object.entries(props || {}).forEach(([k, v]) => {
		if (v === undefined || v === null) return;
		if (k === 'class') el.className = v;
		else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
		else el.setAttribute(k, String(v));
	});
	(children || []).forEach(c => { if (c !== undefined && c !== null) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
	return el;
}

function simpleClientSuggestions(text) {
	const t = (text || '').trim();
	if (!t) return [
		'Explain the user need in one sentence.',
		'Add scope boundaries (what is and isn\'t included).',
		'List known constraints (policy, security, data, time).',
		'Write acceptance criteria as "Given/When/Then".'
	];
	const bullets = [];
	if (t.length > 280) bullets.push('Open with a 1-2 sentence summary.');
	if (!/[.!?]\s*$/.test(t)) bullets.push('Finish with a clear outcome statement.');
	if (!/user|citizen|research/i.test(t)) bullets.push('Name the primary user and their goal.');
	if (!/measure|metric|kpi|success/i.test(t)) bullets.push('State how success will be measured.');
	if (!/risk|assumption|unknown/i.test(t)) bullets.push('Call out top risks and assumptions.');
	return bullets.length ? bullets : ['Tighten language. Prefer short sentences and plain English.'];
}

export function initStartDescriptionAssist(cfg) {
	if (!cfg) throw new Error('[start-description-assist] Missing config');

	const textarea = assertEl($(cfg.textareaSelector), 'textareaSelector');
	if (textarea[_BOUND_FLAG]) return;
	const btnManual = assertEl($(cfg.manualBtnSelector), 'manualBtnSelector');
	const btnAI = assertEl($(cfg.aiBtnSelector), 'aiBtnSelector');
	const suggContainer = assertEl($(cfg.suggContainerSelector), 'suggContainerSelector');
	const aiContainer = assertEl($(cfg.aiContainerSelector), 'aiContainerSelector');
	const statusEl = assertEl($(cfg.aiStatusSelector), 'aiStatusSelector');
	const endpoint = String(cfg.aiEndpoint || '').trim();
	if (!/^https?:\/\//.test(endpoint)) throw new Error('[start-description-assist] aiEndpoint must be an absolute URL');

	textarea[_BOUND_FLAG] = true;
	textarea[_CONTROLLER] = null;

	const renderSuggestions = (items) => {
		suggContainer.innerHTML = '';
		const ul = h('ul', { class: 'sda-suggestions', role: 'list' });
		(items || []).forEach((txt) => {
			const li = h('li', { class: 'sda-suggestion' }, [ h('button', { type: 'button', class: 'sda-chip', onClick: () => insertSuggestion(txt) }, [txt]) ]);
			ul.appendChild(li);
		});
		suggContainer.appendChild(ul);
	};

	function insertSuggestion(s) {
		if (!s) return;
		const cur = textarea.value || '';
		const glue = cur && !/\n$/.test(cur) ? '\n' : '';
		textarea.value = cur + glue + s;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		textarea.focus();
	}

	const renderAI = (text) => {
		aiContainer.innerHTML = '';
		if (!text) return;
		const pre = h('pre', { class: 'sda-ai-output', tabindex: '0' }, [text]);
		aiContainer.appendChild(pre);
	};

	async function runAI() {
		if (!textarea.value.trim()) { setStatus(statusEl, 'Add a description first.'); return; }
		// abort any in-flight request
		if (textarea[_CONTROLLER]) { try { textarea[_CONTROLLER].abort(); } catch {} }
		const controller = new AbortController();
		textarea[_CONTROLLER] = controller;

		btnAI.disabled = true;
		setStatus(statusEl, 'Rewriting...', true);

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: textarea.value || '' }),
				signal: controller.signal,
				mode: 'cors',
				credentials: 'omit'
			});
			if (!res.ok) {
				const hint = res.status === 404 ? ' (endpoint path?)' : (res.status === 401 || res.status === 403 ? ' (auth/CORS?)' : '');
				throw new Error(`HTTP ${res.status}${hint}`);
			}
			const data = await res.json().catch(() => ({}));
			const out = data.output || data.text || data.result || (typeof data === 'string' ? data : '');
			renderAI(out);
			setStatus(statusEl, 'Rewrite complete.', false);
		} catch (err) {
			console.error('[start-description-assist] AI rewrite failed:', err);
			setStatus(statusEl, 'Rewrite failed. Check console.'); // non-verbose UI
		} finally {
			btnAI.disabled = false;
			textarea[_CONTROLLER] = null;
		}
	}

	// --- events ---
	btnManual.addEventListener('click', (e) => {
		e?.preventDefault?.();
		renderSuggestions(simpleClientSuggestions(textarea.value));
		setStatus(statusEl, 'Generated local suggestions.', false);
	});
	btnAI.addEventListener('click', (e) => { e?.preventDefault?.(); runAI(); });

	// live enable/disable + live suggestions
	const syncUi = () => {
		const hasText = !!textarea.value.trim();
		btnAI.disabled = !hasText;
		renderSuggestions(simpleClientSuggestions(textarea.value));
		setStatus(statusEl, hasText ? 'Ready.' : 'Type or paste a description.');
	};
	textarea.addEventListener('input', syncUi);
	textarea.addEventListener('paste', () => { setTimeout(() => { syncUi(); if (readAutoFlag()) runAI(); }, 0); });

	// initial UI
	syncUi();

	// mark global flag so other initialisers can skip
	window.__descAssistActive = true;

	return {
		destroy() {
			btnManual.replaceWith(btnManual.cloneNode(true));
			btnAI.replaceWith(btnAI.cloneNode(true));
			textarea[_BOUND_FLAG] = false;
			textarea[_CONTROLLER]?.abort?.();
			textarea[_CONTROLLER] = null;
			window.__descAssistActive = false;
		}
	};
}

// ---------------- Auto-boot ----------------
function bootIfPossible() {
	if (window.__descAssistActive) return;
	const haveAssistUI = ['#p_desc','#btn-get-suggestions','#btn-ai-rewrite','#description-suggestions','#ai-rewrite-output','#ai-rewrite-status'].every(exists);
	if (!haveAssistUI) return;

	try {
		initStartDescriptionAssist({
			textareaSelector: '#p_desc',
			manualBtnSelector: '#btn-get-suggestions',
			aiBtnSelector: '#btn-ai-rewrite',
			suggContainerSelector: '#description-suggestions',
			aiContainerSelector: '#ai-rewrite-output',
			aiStatusSelector: '#ai-rewrite-status',
			aiEndpoint: readAiEndpoint()
		});
	} catch (e) {
		console.error('[start-description-assist] Auto-boot failed:', e);
		return;
	}

	// Kick off Copilot if present
	try {
		const ok = ['#p_desc','#copilot-output','#btn-copilot'].every(exists);
		if (ok) initCopilotSuggester({ sourceSelector: '#p_desc', outputSelector: '#copilot-output', triggerSelector: '#btn-copilot' });
	} catch (e) { console.warn('[start-description-assist] Copilot init skipped/failed:', e); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootIfPossible, { once: true });
else bootIfPossible();
