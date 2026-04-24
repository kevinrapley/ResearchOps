/* eslint-env browser */
(function() {
	const API_ORIGIN =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith('pages.dev') ?
			'https://rops-api.digikev-kevin-rapley.workers.dev' :
			location.origin);

	function apiUrl(path) {
		const p = String(path || '');
		return `${API_ORIGIN}${p.startsWith('/') ? p : '/' + p}`;
	}

	function projectId() {
		const url = new URL(location.href);
		return url.searchParams.get('project') || url.searchParams.get('id') || '';
	}

	function muralUid() {
		return localStorage.getItem('mural.uid') || localStorage.getItem('userId') || 'anon';
	}

	function payload(mode) {
		return {
			mode,
			uid: muralUid(),
			projectId: projectId(),
			projectName: document.querySelector('h1')?.textContent?.trim() || projectId()
		};
	}

	function setStatus(label, message, pending, busy) {
		const messageEl = document.getElementById('mural-sync-message');
		const action = document.getElementById('mural-sync-pending-btn');
		if (messageEl) messageEl.textContent = message ? `${label}: ${message}` : label;
		if (action) {
			action.hidden = !!busy || !pending;
			action.disabled = !!busy || !pending;
			action.textContent = pending ? `Add ${pending} pending ${pending === 1 ? 'entry' : 'entries'} to Mural` : 'Add pending entries to Mural';
		}
	}

	async function postJson(mode) {
		const res = await fetch(apiUrl('/api/mural/journal-sync'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload(mode))
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw Object.assign(new Error('Mural request failed'), { response: body, status: res.status });
		return body;
	}

	async function loadMuralSyncStatus() {
		if (!projectId()) return;
		setStatus('Checking', 'checking sync status', 0, true);
		try {
			const status = await postJson('status');
			const pending = Number(status.pending || 0);
			const synced = Number(status.synced || 0);
			const total = Number(status.total || 0);
			setStatus(pending ? 'Pending' : 'Synced', pending ? `${pending} pending. ${synced} of ${total} synced.` : `${synced} of ${total} entries synced.`, pending, false);
		} catch (error) {
			const code = error?.response?.error || '';
			if (code === 'not_authenticated') setStatus('Not connected', 'connect Mural from the project dashboard before syncing entries', 0, false);
			else if (code === 'mural_board_not_found') setStatus('No board', 'no Reflexive Journal Mural board was found for this project', 0, false);
			else setStatus('Unavailable', 'could not check Mural sync. Entries remain saved in ResearchOps.', 0, false);
		}
	}

	async function syncPendingEntriesToMural() {
		if (!projectId()) return;
		setStatus('Syncing', 'adding pending entries to Mural', 0, true);
		try {
			const result = await postJson('hydrate');
			const after = result.after || {};
			const pending = Number(after.pending || 0);
			const synced = Number(after.synced || 0);
			const total = Number(after.total || 0);
			const changed = Number(result.createdOrUpdated || 0);
			setStatus(pending ? 'Pending' : 'Synced', `${changed} added to Mural. ${synced} of ${total} entries synced.`, pending, false);
		} catch {
			setStatus('Failed', 'could not add pending entries to Mural. Entries remain saved in ResearchOps.', 0, false);
		}
	}

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('mural-sync-pending-btn')?.addEventListener('click', syncPendingEntriesToMural);
		document.getElementById('add-entry-form')?.addEventListener('submit', function() {
			window.setTimeout(loadMuralSyncStatus, 750);
			window.setTimeout(loadMuralSyncStatus, 2500);
		});
		loadMuralSyncStatus();
	});
})();
