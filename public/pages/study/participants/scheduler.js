/* eslint-env browser */
'use strict';

/**
 * Participants + Sessions UI wiring for the Study page.
 * Follows platform conventions: ESM, abortable fetch w/ timeout, no innerHTML from user input.
 * Endpoints consumed:
 *  - GET  /api/participants?study=:id
 *  - POST /api/participants
 *  - GET  /api/sessions?study=:id
 *  - POST /api/sessions
 *  - GET  /api/sessions/:id/ics (download)
 */

/** @typedef {{
 *   id:string, display_name:string, email?:string, phone?:string, timezone?:string,
 *   channel_pref?:string, status?:string
 * }} Participant */
/** @typedef {{
 *   id:string, participant_id:string, starts_at:string, duration_min:number,
 *   status:string
 * }} Session */

const DEFAULTS = Object.freeze({
	TIMEOUT_MS: 10000
});

/** @returns {string|null} */
function qp(name) {
	const u = new URL(window.location.href);
	return u.searchParams.get(name);
}

/** @template T
 * @param {string} url
 * @param {RequestInit & {timeoutMs?:number}} [init]
 * @returns {Promise<T>}
 */
async function http(url, init = {}) {
	const c = new AbortController();
	const t = setTimeout(() => c.abort('timeout'), init.timeoutMs ?? DEFAULTS.TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			...init,
			signal: c.signal,
			headers: {
				'Content-Type': 'application/json',
				...(init.headers || {})
			}
		});
		const text = await res.text();
		if (!res.ok) {
			let detail;
			try { detail = JSON.parse(text); } catch { detail = { error: text || `HTTP ${res.status}` }; }
			throw new Error(detail?.detail || detail?.error || `HTTP ${res.status}`);
		}
		if (!text) return /** @type any */ ({});
		try { return JSON.parse(text); } catch { return /** @type any */ ({}); }
	} finally {
		clearTimeout(t);
	}
}

/** @param {HTMLElement} el @param {string} text */
function setText(el, text) { el.textContent = text; }

/** @param {HTMLElement} parent @param {string} tag @param {Record<string,string>} [attrs] */
function el(parent, tag, attrs) {
	const e = document.createElement(tag);
	if (attrs)
		for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
	parent.appendChild(e);
	return e;
}

/** @param {string} iso */
function fmtWhen(iso) {
	if (!iso) return '';
	const d = new Date(iso);
	if (isNaN(d.getTime())) return iso;
	return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** safe link builder for email/phone */
function contactCell(p) {
	const frag = document.createDocumentFragment();
	if (p.email) {
		const a = document.createElement('a');
		a.href = `mailto:${encodeURIComponent(p.email)}`;
		setText(a, p.email);
		frag.appendChild(a);
	}
	if (p.phone) {
		if (frag.childNodes.length) frag.appendChild(document.createTextNode(' · '));
		const a = document.createElement('a');
		a.href = `tel:${p.phone.replace(/\s+/g, '')}`;
		setText(a, p.phone);
		frag.appendChild(a);
	}
	if (p.timezone) {
		if (frag.childNodes.length) frag.appendChild(document.createTextNode(' · '));
		const span = document.createElement('span');
		setText(span, p.timezone);
		frag.appendChild(span);
	}
	return frag;
}

/** @param {HTMLElement} msgEl @param {'ok'|'err'} kind @param {string} text */
function flash(msgEl, kind, text) {
	msgEl.classList.remove('ok', 'err');
	msgEl.classList.add(kind);
	setText(msgEl, text);
	setTimeout(() => { setText(msgEl, '');
		msgEl.classList.remove('ok', 'err'); }, 4000);
}

const studyId = qp('study');
if (!studyId) {
	console.error('Missing ?study=…');
}

/** Breadcrumb + badge context (progressive enhancement) */
(function initContext() {
	const badge = /** @type {HTMLElement} */ (document.getElementById('studyBadge'));
	if (badge && studyId) setText(badge, `Study: ${studyId}`);
	const crumbStudy = /** @type {HTMLAnchorElement} */ (document.getElementById('breadcrumb-study'));
	if (crumbStudy && studyId) { crumbStudy.href = `/pages/study/?id=${encodeURIComponent(studyId)}`; }
})();

/** DOM refs */
const participantsTable = /** @type {HTMLElement} */ (document.getElementById('participantsTable'));
const sessionsTable = /** @type {HTMLElement} */ (document.getElementById('sessionsTable'));
const addForm = /** @type {HTMLFormElement} */ (document.getElementById('addParticipantForm'));
const addMsg = /** @type {HTMLElement} */ (document.getElementById('addParticipantMsg'));
const schedForm = /** @type {HTMLFormElement} */ (document.getElementById('scheduleForm'));
const schedMsg = /** @type {HTMLElement} */ (document.getElementById('scheduleMsg'));
const selParticipant = /** @type {HTMLSelectElement} */ (document.getElementById('s_participant'));

/** Render participants table + <select> */
function renderParticipants(arr /** @type {Participant[]} */ ) {
	// drop old rows
	for (const n of Array.from(participantsTable.querySelectorAll('.rowi'))) n.remove();
	selParticipant.innerHTML = '';

	if (!arr.length) {
		const r = el(participantsTable, 'div', { class: 'rowi', role: 'row' });
		const c = el(r, 'div');
		c.setAttribute('role', 'cell');
		c.setAttribute('colspan', '4');
		setText(c, 'No participants yet.');
		return;
	}

	for (const p of arr) {
		// table row
		const row = el(participantsTable, 'div', { class: 'rowi', role: 'row' });
		const c1 = el(row, 'div', { role: 'cell' });
		setText(c1, p.display_name || '—');
		const c2 = el(row, 'div', { role: 'cell' });
		c2.appendChild(contactCell(p));
		const c3 = el(row, 'div', { role: 'cell' });
		const pill = el(c3, 'span', { class: 'pill' });
		setText(pill, p.status || 'invited');
		const c4 = el(row, 'div', { role: 'cell' });
		const btn = el(c4, 'button', { class: 'secondary', type: 'button' });
		setText(btn, 'Schedule');
		btn.addEventListener('click', () => {
			selParticipant.value = p.id;
			selParticipant.dispatchEvent(new Event('change'));
			document.getElementById('s_datetime')?.focus();
		});

		// <select> option
		const opt = document.createElement('option');
		opt.value = p.id;
		setText(opt, p.display_name || p.id);
		selParticipant.appendChild(opt);
	}
}

/** Render sessions table */
function renderSessions(arr /** @type {Session[]} */ ) {
	for (const n of Array.from(sessionsTable.querySelectorAll('.rowi'))) n.remove();

	if (!arr.length) {
		const r = el(sessionsTable, 'div', { class: 'rowi', role: 'row' });
		const c = el(r, 'div');
		c.setAttribute('role', 'cell');
		c.setAttribute('colspan', '4');
		setText(c, 'No sessions yet.');
		return;
	}

	for (const s of arr) {
		const row = el(sessionsTable, 'div', { class: 'rowi', role: 'row' });
		const c1 = el(row, 'div', { role: 'cell' });
		setText(c1, fmtWhen(s.starts_at));
		const c2 = el(row, 'div', { role: 'cell' });
		setText(c2, s.participant_id || '—');
		const c3 = el(row, 'div', { role: 'cell' });
		const pill = el(c3, 'span', { class: 'pill' });
		setText(pill, s.status || 'scheduled');
		const c4 = el(row, 'div', { role: 'cell' });

		// ICS download link (direct to worker route)
		const aIcs = document.createElement('a');
		aIcs.className = 'secondary';
		aIcs.setAttribute('rel', 'noopener');
		aIcs.href = `/api/sessions/${encodeURIComponent(s.id)}/ics`;
		aIcs.download = `session-${s.id}.ics`;
		setText(aIcs, 'Download .ics');
		c4.appendChild(aIcs);
	}
}

/** Loaders */
async function loadParticipants() {
	if (!studyId) return [];
	const data = await http(`/api/participants?study=${encodeURIComponent(studyId)}`);
	if (data?.ok !== true) throw new Error('Failed to load participants');
	const list = /** @type {Participant[]} */ (data.participants || []);
	renderParticipants(list);
	return list;
}

async function loadSessions() {
	if (!studyId) return [];
	const data = await http(`/api/sessions?study=${encodeURIComponent(studyId)}`);
	if (data?.ok !== true) throw new Error('Failed to load sessions');
	const list = /** @type {Session[]} */ (data.sessions || []);
	renderSessions(list);
	return list;
}

/** Form handlers */
addForm?.addEventListener('submit', async (ev) => {
	ev.preventDefault();
	if (!studyId) return;

	const fd = new FormData(addForm);
	/** @type {Record<string, any>} */
	const body = {
		study_airtable_id: studyId,
		display_name: String(fd.get('display_name') || '').trim(),
		email: String(fd.get('email') || '').trim() || undefined,
		phone: String(fd.get('phone') || '').trim() || undefined,
		timezone: String(fd.get('timezone') || '').trim() || undefined,
		channel_pref: String(fd.get('channel_pref') || 'email'),
		access_needs: String(fd.get('access_needs') || '').trim() || undefined
	};
	if (!body.display_name) {
		flash(addMsg, 'err', 'Display name is required.');
		return;
	}

	try {
		const resp = await http('/api/participants', { method: 'POST', body: JSON.stringify(body) });
		if (resp?.ok) {
			addForm.reset();
			flash(addMsg, 'ok', 'Participant created.');
			await loadParticipants();
		} else {
			throw new Error(resp?.error || 'Create failed');
		}
	} catch (e) {
		flash(addMsg, 'err', `Error: ${e?.message || e}`);
	}
});

schedForm?.addEventListener('submit', async (ev) => {
	ev.preventDefault();
	if (!studyId) return;

	const fd = new FormData(schedForm);
	/** @type {Record<string, any>} */
	const body = {
		study_airtable_id: studyId,
		participant_airtable_id: String(document.getElementById('s_participant')?.value || ''),
		starts_at: String(document.getElementById('s_datetime')?.value || ''),
		duration_min: Number(document.getElementById('s_duration')?.value || 60),
		type: String(document.getElementById('s_type')?.value || 'remote'),
		location_or_link: String(document.getElementById('s_location')?.value || '').trim(),
		backup_contact: String(document.getElementById('s_backup')?.value || '').trim() || undefined,
		researchers: String(document.getElementById('s_researchers')?.value || '').trim() || undefined,
		notes: String(document.getElementById('s_notes')?.value || '').trim() || undefined
	};

	if (!body.participant_airtable_id || !body.starts_at || !body.location_or_link) {
		flash(schedMsg, 'err', 'Participant, start time, and location/link are required.');
		return;
	}

	// Convert local datetime-local (no TZ) to ISO by assuming local time zone
	try {
		const local = body.starts_at; // "YYYY-MM-DDTHH:mm"
		const [date, time] = local.split('T');
		const [y, m, d] = date.split('-').map(Number);
		const [hh, mm] = (time || '00:00').split(':').map(Number);
		const dt = new Date(y, (m - 1), d, hh, mm);
		body.starts_at = dt.toISOString();
	} catch { /* if parsing fails, let server validate */ }

	try {
		const resp = await http('/api/sessions', { method: 'POST', body: JSON.stringify(body) });
		if (resp?.ok) {
			flash(schedMsg, 'ok', 'Session created.');
			await loadSessions();
		} else {
			throw new Error(resp?.error || 'Create failed');
		}
	} catch (e) {
		flash(schedMsg, 'err', `Error: ${e?.message || e}`);
	}
});

/** initial load */
(async function init() {
	try {
		await loadParticipants();
		await loadSessions();
	} catch (e) {
		console.error(e);
	}
})();