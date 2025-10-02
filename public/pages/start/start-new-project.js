/**
 * @file start-new-project.js
 * @module StartNewProject
 * @summary Multi-step controller. On Step 3 submit, POST to /api/projects → Airtable, then route to /pages/projects/.
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

/** Show error summary panel. */
function showError(msg) {
	const panel = /** @type {HTMLElement|null} */ (document.getElementById('error-summary'));
	if (!panel) return;
	panel.textContent = esc(msg);
	panel.style.display = 'block';
	panel.focus?.();
}

/** Hide error summary panel. */
function hideError() {
	const panel = /** @type {HTMLElement|null} */ (document.getElementById('error-summary'));
	if (!panel) return;
	panel.style.display = 'none';
}

/** POST JSON with timeout. */
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
		return res;
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

	if (!step1 || !step2 || !step3) return;

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

	// Final submit → /api/projects → redirect
	finish?.addEventListener('click', async () => {
		hideError();
		const btn = finish;
		btn.disabled = true;
		btn.textContent = 'Creating…';

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

			// Optional local id / org if you use them upstream
			org: 'Home Office Biometrics',
			id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())
		};

		if (!payload.name || !payload.description) {
			showError('Project name and description are required.');
			btn.disabled = false;
			btn.textContent = 'Create project';
			return;
		}

		try {
			const res = await postJson('/api/projects', payload);
			if (!res.ok) {
				let msg = 'Failed to create project.';
				try {
					const data = await res.json();
					msg = data?.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : msg;
				} catch {}
				showError(msg);
				btn.disabled = false;
				btn.textContent = 'Create project';
				return;
			}
			// Success → route to projects list
			window.location.href = '/pages/projects/';
		} catch {
			showError('Network error while creating project.');
			btn.disabled = false;
			btn.textContent = 'Create project';
		}
	});
})();
