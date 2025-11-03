/**
 * @file /partials/debug.js
 * @summary In-page debug console + console interception + fetch/xhr taps.
 *          Idempotent, with smart classification so failure-looking "logs"
 *          get styled as warn/error (not green).
 */

/** Guard against double-wiring */
if (!window.__DEBUG_CONSOLE_WIRED__) {
	window.__DEBUG_CONSOLE_WIRED__ = true;

	const logs = [];
	const maxLogs = 200;

	const $ = (s, r = document) => r.querySelector(s);
	// Removed unused $$ helper to satisfy no-unused-vars

	function escapeHtml(str) {
		const div = document.createElement('div');
		div.textContent = String(str);
		return div.innerHTML;
	}

	/** Heuristics to reclassify misleading "log" lines */
	function classify(type, message) {
		if (type !== 'log') return type;

		const msg = message.toLowerCase();

		// Strong error signals → "error"
		if (
			/\b(http\s*5\d\d|500|502|503|504|uncaught|exception|token\s*error|failed|denied|forbidden)\b/.test(
				msg,
			) ||
			/\b(error|fatal|unavailable|not\s*authenticated|not\s*authorised|unauthori[sz]ed)\b/.test(msg)
		)
			return 'error';

		// Weaker / degraded signals → "warn"
		if (
			/\b(false|timeout|retry|degraded|not\s*in\s*home\s*office|not\s*found|no\s*active\s*workspace)\b/.test(
				msg,
			)
		)
			return 'warn';

		return type;
	}

	function addLog(type, args) {
		const timestamp = new Date().toLocaleTimeString();

		const message = Array.from(args)
			.map((arg) => {
				if (arg instanceof Error) {
					const name = arg.name || 'Error';
					const msg = arg.message || String(arg);
					const stk = arg.stack ? `\n${arg.stack}` : '';
					return `${name}: ${msg}${stk}`;
				}
				if (typeof arg === 'object' && arg !== null) {
					try {
						return JSON.stringify(arg, null, 2);
					} catch {
						return String(arg);
					}
				}
				return String(arg);
			})
			.join(' ');

		const visualType = classify(type, message);

		logs.push({ type: visualType, timestamp, message });
		if (logs.length > maxLogs) logs.shift();

		const output = $('#debug-output');
		if (output) {
			const entry = document.createElement('div');
			entry.className = `debug-${visualType}`;
			entry.innerHTML = `<span class="debug-timestamp">${timestamp}</span>${escapeHtml(message)}`;
			output.appendChild(entry);
			output.scrollTop = output.scrollHeight;
		}
	}

	// Intercept console methods
	const original = {
		log: console.log,
		error: console.error,
		warn: console.warn,
		info: console.info,
	};
	console.log = function () {
		try {
			original.log.apply(console, arguments);
		} finally {
			addLog('log', arguments);
		}
	};
	console.error = function () {
		try {
			original.error.apply(console, arguments);
		} finally {
			addLog('error', arguments);
		}
	};
	console.warn = function () {
		try {
			original.warn.apply(console, arguments);
		} finally {
			addLog('warn', arguments);
		}
	};
	console.info = function () {
		try {
			original.info.apply(console, arguments);
		} finally {
			addLog('info', arguments);
		}
	};

	// Global error taps
	window.addEventListener('error', (e) =>
		addLog('error', [`💥 ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]),
	);
	window.addEventListener('unhandledrejection', (e) =>
		addLog('error', [`⚠️ Unhandled Promise: ${e.reason}`]),
	);

	// fetch tap (non-destructive)
	const _fetch = window.fetch.bind(window);
	window.fetch = async function (input, init) {
		const url = typeof input === 'string' ? input : (input && input.url) || String(input);
		const method = (init && init.method) || (input && input.method) || 'GET';
		const started = performance.now();
		console.info(`[net] ${method} ${url}`);
		try {
			const res = await _fetch(input, init);
			const ms = Math.round(performance.now() - started);
			let bodyText = '';
			try {
				bodyText = await res.clone().text();
			} catch (/** ignore */) {
				/* intentional: some bodies can't be cloned/read */
			}

			// Reclassify based on HTTP status
			const label = `[net] ← ${method} ${url} ${res.status} (${ms}ms)`;
			if (res.status >= 500) console.error(label, bodyText.slice(0, 400) || '(empty)');
			else if (res.status >= 400) console.warn(label, bodyText.slice(0, 400) || '(empty)');
			else console.info(label, bodyText.slice(0, 400) || '(empty)');

			return res;
		} catch (err) {
			const ms = Math.round(performance.now() - started);
			console.error(`[net] ✖ ${method} ${url} failed after ${ms}ms`, err);
			return Promise.reject(err);
		}
	};

	// XHR tap (legacy)
	(function () {
		const XHR = window.XMLHttpRequest;
		if (!XHR) return;
		const open = XHR.prototype.open;
		const send = XHR.prototype.send;

		XHR.prototype.open = function (method, url) {
			this.__debug = { method, url, start: 0 };
			return open.apply(this, arguments);
		};
		XHR.prototype.send = function (body) {
			if (this.__debug) this.__debug.start = performance.now();
			this.addEventListener('loadend', () => {
				const d = this.__debug || {};
				const ms = d.start ? Math.round(performance.now() - d.start) : 0;
				const status = this.status;
				const label = status
					? `[xhr] ← ${d.method} ${d.url} ${status} (${ms}ms)`
					: `[xhr] ← ${d.method} ${d.url} (${ms}ms)`;

				const snippet = (() => {
					try {
						return (this.responseText || '').slice(0, 400);
					} catch {
						return '';
					}
				})();

				if (status >= 500) console.error(label, snippet);
				else if (status >= 400) console.warn(label, snippet);
				else console.info(label, snippet);
			});
			return send.apply(this, arguments);
		};
	})();

	// UI wiring
	(function ready(fn) {
		document.readyState === 'loading'
			? document.addEventListener('DOMContentLoaded', fn, { once: true })
			: fn();
	})(() => {
		const toggle = $('#debug-toggle');
		const consoleEl = $('#debug-console');
		const closeBtn = $('#debug-close');
		const clearBtn = $('#debug-clear');
		const exportBtn = $('#debug-export');

		toggle?.addEventListener('click', () => {
			if (consoleEl) consoleEl.hidden = !consoleEl.hidden;
		});
		closeBtn?.addEventListener('click', () => {
			if (consoleEl) consoleEl.hidden = true;
		});
		clearBtn?.addEventListener('click', () => {
			logs.length = 0;
			const output = $('#debug-output');
			if (output) output.innerHTML = '';
		});
		exportBtn?.addEventListener('click', () => {
			const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.download = `debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
			a.href = url;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		});

		console.log('🐛 Debug console initialized');
	});
}
