/**
 * @file api.js
 * @module GuidesApi
 * @summary JSON fetch helpers for discussion guide browser modules.
 */

export async function safeJson(res, opts = {}) {
	const { allowHeuristics = true, emptyAs = null } = opts;

	const ct = res.headers.get('content-type') || '';
	const isJsonCT = /(\/|\+)json\b/i.test(ct);
	const text = await res.text();

	if (res.status === 204 || res.status === 205 || res.status === 304 || text.trim() === '') {
		return emptyAs;
	}

	if (isJsonCT) {
		try {
			return JSON.parse(text);
		} catch {
			const snippet = text.slice(0, 200);
			throw new SyntaxError(
				`Invalid JSON (${res.status}) from ${res.url || '<unknown>'}; snippet: ${snippet}`
			);
		}
	}

	if (allowHeuristics && /^[\s\uFEFF\u200B]*[{\[]/.test(text)) {
		try {
			return JSON.parse(text);
		} catch {
			const snippet = text.slice(0, 200);
			throw new SyntaxError(
				`Looks like JSON but failed to parse (${res.status}) from ${res.url || '<unknown>'}; snippet: ${snippet}`
			);
		}
	}

	const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
	throw new TypeError(
		`Non-JSON response (${res.status}) from ${res.url || '<unknown>'}; snippet: ${snippet}`
	);
}

export async function fetchJSON(url, options = {}, safeOpts = {}) {
	const res = await fetch(url, {
		cache: 'no-store',
		headers: { Accept: 'application/json', ...(options.headers || {}) },
		...options,
	});
	const data = await safeJson(res, safeOpts);
	if (!res.ok) {
		const err = new Error(`HTTP ${res.status} for ${url}`);
		err.status = res.status;
		err.data = data;
		throw err;
	}
	return data;
}

export async function loadStudies(projectId) {
	const url = `/api/studies?project=${encodeURIComponent(projectId)}`;
	const js = await fetchJSON(url).catch(() => ({}));
	if (js == null || js.ok !== true || !Array.isArray(js.studies)) {
		throw new Error((js && js.error) || 'Studies fetch failed');
	}
	return js.studies;
}
