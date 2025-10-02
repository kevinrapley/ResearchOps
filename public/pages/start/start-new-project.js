/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Multi-step controller. On Step 3 submit, POST to /api/projects → Airtable, then route to /pages/projects/?created=<id>.
 *
 * @requires globalThis.fetch
 * @requires globalThis.document
 */

/** Escape for text nodes. */
function esc(s) { return String(s ?? ''); }

/** Read value by element id. */
function v(id) {
	const el = /** @type {HTMLInputElement|HTMLTextAreaElement|null} */ (document.getElementById(id));
	return el ? el.value.trim() : '';
}

/** Show error summary panel (and log to console for debugging). */
function showError(msg, extra) {
	const panel = /** @type {HTMLElement|null} */ (document.getElementById('error-summary'));
	const text = esc(msg);
	if (panel) {
		panel.textContent = text;
		panel.style.display = 'block';
		panel.setAttribute('role', 'alert');
		panel.setAttribute('aria-live', 'polite');
		panel.focus?.();
	}
	// Dev visibility
	if (extra) console.error('[StartNewProject] Error:', msg, extra);
	else console.error('[StartNewProject] Error:', msg);
}

/** Hide error summary panel. */
function hideError() {
	const panel = /** @type {HTMLElement|null} */ (document.getElementById('error-summary'));
	if (!panel) return;
	panel.style.display = 'none';
}

/** POST JSON with timeout. Returns {ok:boolean, status:number, json?:any, text?:string}. */
async function postJson(url, body, timeoutMs = 10000) {
	const controller = new AbortController();
	const to = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});
		const ct = res.headers.get('content-type') || '';
		let payload;
		try {
			payload = ct.includes('application/json') ? await res.json() : await res.text();
		} catch {
			payload = null;
		}
		return { ok: res.ok, status: res.status, ...(typeof payload === 'string' ? { text: payload } : { json: payload }) };
	} finally {
		clearTimeout(to);
	}
}

/**
 * Parse stakeholders textarea lines:
 * "name | role | email" -> { name, role, email }
 */
function parseStakeholders(raw) {
	return (raw || '')
		.split(/\r?\n/)
		.map(l => l.trim())
		.filter(Boolean)
		.map(line => {
			const [name = '', role = '', email = ''] = line.split('|').map(s => s.trim());
			return { name, role, email };
		});
}

/** Split comma/pipe separated user groups -> array of strings. */
function parseUserGroups(raw) {
	return (raw || '')
		.split(/[,|]/)
		.map(s => s.trim())
		.filter(Boolean);
}

/** Split objectives textarea into array (one objective per line). */
function parseObjectives(raw) {
	return (raw || '')
		.split(/\r?\n/)
		.map(s => s.trim())
		.filter(Boolean);
}

/** Wire steps & final submit. */
(function init() {
	const step1 = /** @type {HTMLElement|null} */ (document.getElementById('step1'));
	const step2 = /** @type {HTMLElement|null} */ (document.getElementById('step2'));
	const step3 = /** @type {HTMLElement|null} */ (document.getElementById('step3'));

	const next2 = /** @type {HTMLButtonElement|null} */ (document.getElementById('next2'));
	const prev1 = /** @type {HTMLButtonElement|null} */ (document.getElementById('prev1'));
	const next3 = /** @type {HTMLButtonElement|null} */ (document.getElementById('next3'));
	const prev2 = /** @type {HTMLButtonElement|null} */ (document.getElementById('prev2'));
	const finish = /** @type {HTMLButtonElement|null} */ (document.getElementById('finish'));

	if (!step1 || !step2 || !step3) {
		console.warn('[StartNewProject] Steps not found; aborting init.');
		return;
	}

	const show = (el) => {
		step1.style.display = 'none';
		step2.style.display = 'none';
		step3.style.display = 'none';
		el.style.display = 'block';
		hideError();
	};

	// Step navigation
	next2?.addEventListener('click', () => {
		const name = v('p_name');
		const desc = v('p_desc');
		if (!name) { showError('Enter a project name.'); return; }
		if (!desc) { showError('Enter a project description.'); return; }
		show(step2);
	});

	prev1?.addEventListener('click', () => show(step1));
	next3?.addEventListener('click', () => show(step3));
	prev2?.addEventListener('click', () => show(step2));

	// Final submit → /api/projects → redirect with ?created=<id>
	finish?.addEventListener('click', async () => {
		hideError();
		if (!finish) return;

		// Guard double submit
		if (finish.dataset.busy === '1') return;
		finish.dataset.busy = '1';
		const originalLabel = finish.textContent || 'Create project';
		finish.disabled = true;
		finish.textContent = 'Creating…';

		// Gather payload (arrays where your Worker expects arrays)
		const payload = {
			// Step 1
			name: v('p_name'),
			description: v('p_desc'),
			phase: v('p_phase'),
			status: v('p_status'),

			// Step 2
			stakeholders: parseStakeholders(v('p_stakeholders')),
			objectives: parseObjectives(v('p_objectives')),
			user_groups: parseUserGroups(v('p_usergroups')),

			// Step 3
			lead_researcher: v('lead_name'),
			lead_researcher_email: v('lead_email'),
			notes: v('p_notes'),

			// Optional local id / org for your CSV dual-write
			org: 'Home Office Biometrics',
			id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()))
		};

		// Front-end requireds
		if (!payload.name || !payload.description) {
			showError('Project name and description are required.');
			finish.disabled = false;
			finish.textContent = originalLabel;
			finish.dataset.busy = '';
			return;
		}

		try {
			const res = await postJson('/api/projects', payload, 15000);

			// Helpful console trace
			console.log('[StartNewProject] /api/projects →', res);

			if (!res.ok) {
				// Try to decode Worker error shape
				const e = res.json && typeof res.json === 'object' ? res.json : {};
				const statusLine = `HTTP ${res.status}`;
				const detail = e.detail || res.text || '';
				// Common CORS/Origin hint
				const maybeCors = res.status === 403 && /Origin not allowed/i.test(e.error || detail || '');
				const hint = maybeCors ?
					'Hint: ensure your page Origin is listed in ALLOWED_ORIGINS in the Worker.' :
					'';
				showError(`${statusLine}: ${e.error || 'Failed to create project.'}${detail ? ` — ${detail}` : ''}${hint ? `\n${hint}` : ''}`, res);
				finish.disabled = false;
				finish.textContent = originalLabel;
				finish.dataset.busy = '';
				return;
			}

			const data = res.json || {};
			const airtableId = data.project_id || '';
			// Redirect with ?created=<AirtableId> (fallback to list if missing)
			const target = airtableId ?
				`/pages/projects/?created=${encodeURIComponent(airtableId)}` :
				`/pages/projects/`;
			window.location.href = target;

		} catch (err) {
			showError('Network error while creating project.', err);
			finish.disabled = false;
			finish.textContent = originalLabel;
			finish.dataset.busy = '';
		}
	});
})();
