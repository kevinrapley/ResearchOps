/* eslint-env browser */
(function() {
	const API_ORIGIN =
		document.documentElement?.dataset?.apiOrigin ||
		window.API_ORIGIN ||
		(location.hostname.endsWith('pages.dev') ?
			'https://rops-api.digikev-kevin-rapley.workers.dev' :
			location.origin);

	let lastStatus = null;
	let applying = false;

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

	function actionText(pending) {
		return pending ? `Add ${pending} ${pending === 1 ? 'entry' : 'entries'} to Mural` : 'Add entries to Mural';
	}

	function statusMessage(pending, synced, total) {
		if (pending) {
			return `${pending} ${pending === 1 ? 'entry is' : 'entries are'} not yet on Mural. ${synced} of ${total} ${total === 1 ? 'entry is' : 'entries are'} on Mural.`;
		}
		return `${synced} of ${total} ${total === 1 ? 'entry is' : 'entries are'} on Mural.`;
	}

	function setStatus(label, message, pending, busy) {
		const messageEl = document.getElementById('mural-sync-message');
		const action = document.getElementById('mural-sync-pending-btn');

		lastStatus = { label, message, pending, busy };
		applying = true;

		if (messageEl) messageEl.textContent = message ? `${label}: ${message}` : label;
		if (action) {
			action.hidden = !!busy || !pending;
			action.disabled = !!busy || !pending;
			action.textContent = actionText(Number(pending || 0));
		}

		applying = false;
	}

	function restoreStatusText() {
		if (applying || !lastStatus) return;
		const action = document.getElementById('mural-sync-pending-btn');
		if (!action) return;

		const expected = actionText(Number(lastStatus.pending || 0));
		if (action.textContent.trim() !== expected) {
			setStatus(lastStatus.label, lastStatus.message, lastStatus.pending, lastStatus.busy);
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
		setStatus('Checking', 'checking whether journal entries are on Mural', 0, true);
		try {
			const status = await postJson('status');
			const pending = Number(status.pending || 0);
			const synced = Number(status.synced || 0);
			const total = Number(status.total || 0);
			setStatus(pending ? 'Action needed' : 'Up to date', statusMessage(pending, synced, total), pending, false);
		} catch (error) {
			const code = error?.response?.error || '';
			if (code === 'not_authenticated') setStatus('Not connected', 'connect Mural from the project dashboard before adding entries to Mural', 0, false);
			else if (code === 'mural_board_not_found') setStatus('No board found', 'create or reconnect the Reflexive Journal Mural from the project dashboard', 0, false);
			else setStatus('Unavailable', 'could not check Mural. Entries remain saved in ResearchOps.', 0, false);
		}
	}

	async function addPendingEntriesToMural() {
		if (!projectId()) return;
		setStatus('Adding to Mural', 'adding entries to the Reflexive Journal Mural', 0, true);
		try {
			const result = await postJson('hydrate');
			const after = result.after || {};
			const pending = Number(after.pending || result.pending || 0);
			const synced = Number(after.synced || result.synced || 0);
			const total = Number(after.total || result.total || 0);
			const changed = Number(result.createdOrUpdated || 0);
			const failed = Number(result.failed || 0);
			const skipped = Number(result.skipped || 0);

			if (pending && !changed) {
				const reason = result.reason || (failed ? `${failed} ${failed === 1 ? 'entry could' : 'entries could'} not be added.` : `${skipped} ${skipped === 1 ? 'entry was' : 'entries were'} skipped.`);
				setStatus('Not added', `${reason} ${statusMessage(pending, synced, total)}`, pending, false);
				return;
			}

			const added = `${changed} ${changed === 1 ? 'entry was' : 'entries were'} added to Mural.`;
			setStatus(pending ? 'Action needed' : 'Up to date', `${added} ${statusMessage(pending, synced, total)}`, pending, false);
		} catch {
			const pending = Number(lastStatus?.pending || 0);
			setStatus('Not added', 'could not add entries to Mural. Entries remain saved in ResearchOps.', pending, false);
		}
	}

	function observeStatusAction() {
		const target = document.getElementById('mural-sync-pending-btn');
		if (!target || typeof MutationObserver !== 'function') return;

		const observer = new MutationObserver(restoreStatusText);
		observer.observe(target, {
			childList: true,
			characterData: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['disabled', 'hidden']
		});
	}

	document.addEventListener('DOMContentLoaded', function() {
		document.getElementById('mural-sync-pending-btn')?.addEventListener('click', addPendingEntriesToMural);
		document.getElementById('add-entry-form')?.addEventListener('submit', function() {
			window.setTimeout(loadMuralSyncStatus, 750);
			window.setTimeout(loadMuralSyncStatus, 2500);
		});
		observeStatusAction();
		loadMuralSyncStatus();
	});
})();
