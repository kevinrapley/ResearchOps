// /js/start-description-assist.js
/**
 * Start Description Assist
 * Binds suggestion + AI rewrite helpers to a project description textarea.
 * Idempotent: safe to call multiple times; will only bind once per textarea.
 *
 * Exports:
 *   - initStartDescriptionAssist(config)
 *
 * Config:
 *   - textareaSelector: CSS selector for the target <textarea>
 *   - manualBtnSelector: button to generate lightweight suggestions client-side
 *   - aiBtnSelector: button to call AI endpoint for rewrite
 *   - suggContainerSelector: container to render suggestion chips/list
 *   - aiContainerSelector: container to render AI rewrite output
 *   - aiStatusSelector: element for status messages (aria-live preferred)
 *   - aiEndpoint: absolute URL of the AI rewrite API
 */

const _BOUND_FLAG = Symbol('sda_bound');
const _CONTROLLER = Symbol('sda_abort_controller');

function $(sel, root = document) { return root.querySelector(sel); }
function assertEl(el, label) {
	if (!el) throw new Error(`[start-description-assist] Missing element: ${label}`);
	return el;
}

function setStatus(el, msg, busy = false) {
	if (!el) return;
	el.textContent = msg || '';
	if (busy) { el.setAttribute('aria-busy', 'true'); }
	else { el.removeAttribute('aria-busy'); }
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
	// Very lightweight transformations. Deterministic. No network.
	const t = (text || '').trim();
	if (!t) return [
		'Explain the user need in one sentence.',
		'Add scope boundaries (what is and isnât included).',
		'List known constraints (policy, security, data, time).',
		'Write acceptance criteria as âGiven/When/Thenâ.'
	];
	const bullets = [];
	if (t.length > 280) bullets.push('Open with a 1â2 sentence summary.');
	if (!/[.!?]\s*$/.test(t)) bullets.push('Finish with a clear outcome statement.');
	if (!/user|citizen|research/i.test(t)) bullets.push('Name the primary user and their goal.');
	if (!/measure|metric|kpi|success/i.test(t)) bullets.push('State how success will be measured.');
	if (!/risk|assumption|unknown/i.test(t)) bullets.push('Call out top risks and assumptions.');
	return bullets.length ? bullets : ['Tighten language. Prefer short sentences and plain English.'];
}

export function initStartDescriptionAssist(cfg) {
	if (!cfg) throw new Error('[start-description-assist] Missing config');

	const root = document;
	const textarea = assertEl($(cfg.textareaSelector, root), 'textareaSelector');
	if (textarea[_BOUND_FLAG]) return; // idempotent per textarea

	const btnManual = assertEl($(cfg.manualBtnSelector, root), 'manualBtnSelector');
	const btnAI = assertEl($(cfg.aiBtnSelector, root), 'aiBtnSelector');
	const suggContainer = assertEl($(cfg.suggContainerSelector, root), 'suggContainerSelector');
	const aiContainer = assertEl($(cfg.aiContainerSelector, root), 'aiContainerSelector');
	const statusEl = assertEl($(cfg.aiStatusSelector, root), 'aiStatusSelector');
	const endpoint = String(cfg.aiEndpoint || '').trim();
	if (!/^https?:\/\//.test(endpoint)) throw new Error('[start-description-assist] aiEndpoint must be an absolute URL');

	// mark bound + create a per-instance abort controller
	textarea[_BOUND_FLAG] = true;
	textarea[_CONTROLLER] = null;

	// --- render helpers ---
	const renderSuggestions = (items) => {
		suggContainer.innerHTML = '';
		const ul = h('ul', { class: 'sda-suggestions', role: 'list' });
		(items || []).forEach((txt) => {
			const li = h('li', { class: 'sda-suggestion' }, [
				 h('button', { type: 'button', class: 'sda-chip', onClick: () => insertSuggestion(txt) }, [txt])
			]);
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

	// --- events ---
	btnManual.addEventListener('click', (e) => {
		e?.preventDefault?.();
		const items = simpleClientSuggestions(textarea.value);
		renderSuggestions(items);
		setStatus(statusEl, 'Generated local suggestions.', false);
	});

	btnAI.addEventListener('click', async (e) => {
		e?.preventDefault?.();
		if (textarea[_CONTROLLER]) { try { textarea[_CONTROLLER].abort(); } catch {} }
		const controller = new AbortController();
		textarea[_CONTROLLER] = controller;

		btnAI.disabled = true;
		setStatus(statusEl, 'Rewritingâ¦', true);

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: textarea.value || '' }),
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json().catch(() => ({}));
			// Flexible shape support
			const out = data.output || data.text || data.result || (typeof data === 'string' ? data : '');
			renderAI(out);
			setStatus(statusEl, 'Rewrite complete.', false);
		} catch (err) {
			if (err.name === 'AbortError') { setStatus(statusEl, 'Cancelled.', false); return; }
			console.error('[start-description-assist] AI rewrite failed:', err);
			setStatus(statusEl, 'Rewrite failed. Try again.', false);
		} finally {
			btnAI.disabled = false;
			textarea[_CONTROLLER] = null;
		}
	});

	// initial passive suggestions
	if ((textarea.value || '').trim()) {
		renderSuggestions(simpleClientSuggestions(textarea.value));
	}

	return {
		destroy() {
			btnManual.replaceWith(btnManual.cloneNode(true));
			btnAI.replaceWith(btnAI.cloneNode(true));
			textarea[_BOUND_FLAG] = false;
			textarea[_CONTROLLER]?.abort?.();
			textarea[_CONTROLLER] = null;
		}
	};
}
