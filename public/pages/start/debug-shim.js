/**
 * @file debug-shim.js (inline)
 * @summary On-screen network logger + helpers for iPad (no DevTools).
 * @description
 * - Wraps window.fetch to log method/url/status/time.
 * - Adds a small floating “Network debug” toggle.
 * - Exposes window.__ropsDebug.log() and .panel() for manual notes.
 */

/* ===== tiny UI panel ===== */
(function setupRopsDebugPanel() {
	if (window.__ropsDebug) return; // idempotent

	const panel = document.createElement('div');
	panel.id = 'rops-debug';
	panel.style.cssText = [
		'position:fixed', 'right:12px', 'bottom:12px', 'z-index:99999',
		'width: min(90vw, 540px)', 'max-height: 50vh', 'overflow:auto',
		'background:#fff', 'border:2px solid #b1b4b6', 'border-radius:8px',
		'box-shadow:0 6px 16px rgba(0,0,0,.15)', 'font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
		'display:none'
	].join(';');

	panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #b1b4b6;background:#f3f2f1;">
      <strong>Network debug</strong>
      <div>
        <button id="rops-debug-clear" style="margin-right:6px">Clear</button>
        <button id="rops-debug-close">Close</button>
      </div>
    </div>
    <div id="rops-debug-body" style="padding:8px 10px; white-space:pre-wrap;"></div>
  `;
	document.body.appendChild(panel);

	const fab = document.createElement('button');
	fab.type = 'button';
	fab.id = 'rops-debug-toggle';
	fab.textContent = 'Network debug';
	fab.style.cssText = [
		'position:fixed', 'right:12px', 'bottom:12px', 'z-index:99998',
		'padding:8px 12px', 'background:#1d70b8', 'color:#fff', 'border:none',
		'border-radius:6px', 'font-weight:700', 'box-shadow:0 4px 12px rgba(0,0,0,.15)'
	].join(';');
	document.body.appendChild(fab);

	const body = panel.querySelector('#rops-debug-body');
	const btnClose = panel.querySelector('#rops-debug-close');
	const btnClear = panel.querySelector('#rops-debug-clear');

	const show = () => { panel.style.display = 'block';
		fab.style.display = 'none'; };
	const hide = () => { panel.style.display = 'none';
		fab.style.display = 'inline-block'; };
	fab.addEventListener('click', show);
	btnClose.addEventListener('click', hide);
	btnClear.addEventListener('click', () => { body.textContent = ''; });

	function write(line) {
		const t = new Date().toLocaleTimeString();
		body.textContent += `[${t}] ${line}\n`;
	}

	// fetch wrapper
	const _fetch = window.fetch.bind(window);
	window.fetch = async function wrappedFetch(input, init) {
		const url = (typeof input === 'string') ? input : (input && input.url) || '';
		const method = (init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET';
		const started = performance.now();
		write(`→ ${method} ${url}`);
		try {
			const res = await _fetch(input, init);
			const ms = Math.round(performance.now() - started);
			write(`← ${res.status} ${res.statusText} (${ms}ms)`);
			return res;
		} catch (e) {
			const ms = Math.round(performance.now() - started);
			write(`← NETWORK ERROR (${ms}ms): ${String(e && e.message || e)}`);
			throw e;
		}
	};

	window.__ropsDebug = {
		log: write,
		panel: { show, hide }
	};
})();