/**
 * @file /js/journal-tabs.js
 * @description Journals page: tab-specific rendering and interactions.
 * - Renders Journal entries (filters, edit/delete, link to full view)
 * - Renders Codes (list, add form)
 * - Renders Memos (list, filters, add form)
 * - Bridges Analysis buttons to CAQ-DAS module
 * - Shows page-level Reflexive Journal Mural sync status and hydration controls
 */

import { runTimeline, runCooccurrence, runRetrieval, runExport } from './caqdas-interface.js';
import { clearJournalFeedback, showJournalError, showJournalStatus } from './journal-feedback.js';

/* eslint-env browser */
(function() {
	const API_ORIGIN =
		resolveApiBase();

	function resolveApiBase() {
		const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || '';
		if (String(explicit || '').trim()) return String(explicit).trim().replace(/\/+$/, '');
		if (location.hostname.endsWith('pages.dev')) return '';
		return location.origin;
	}

	function apiUrl(path) {
		const p = String(path || '');
		return `${API_ORIGIN}${p.startsWith('/') ? p : '/' + p}`;
	}

	function $all(s, r) { if (!r) r = document; return Array.from(r.querySelectorAll(s)); }

	function hideDeleteConfirmations(scope) {
		$all('[data-delete-confirmation]', scope).forEach(panel => {
			panel.hidden = true;
		});
	}

	function showDeleteConfirmation(button, key) {
		const card = button?.closest('.govuk-summary-card') || document;
		hideDeleteConfirmations(document);
		const panel = $all('[data-delete-confirmation]', card).find(item => item.getAttribute('data-delete-confirmation') === key);
		if (!panel) return;
		panel.hidden = false;
		panel.querySelector('button')?.focus();
	}

	function esc(s) {
		const d = document.createElement('div');
		d.textContent = String(s || '');
		return d.innerHTML;
	}

	function when(iso) { return iso ? new Date(iso).toLocaleString() : '—'; }

	function truncateWords(s, limit) {
		var text = String(s || '').trim();
		if (text.length <= limit) return text;
		var cut = text.slice(0, limit + 1);
		var lastSpace = cut.lastIndexOf(' ');
		if (lastSpace > 0) return cut.slice(0, lastSpace) + '…';
		return text.slice(0, limit) + '…';
	}

	function normalizeCategoryKey(value) {
		const raw = String(value || '').trim().toLowerCase();
		if (!raw || raw === '—') return 'uncategorised';
		if (raw === 'perceptions' || raw.includes('perception')) return 'perceptions';
		if (raw === 'procedures' || raw.includes('procedure') || raw.includes('day-to-day')) return 'procedures';
		if (raw === 'decisions' || raw.includes('decision') || raw.includes('methodological')) return 'decisions';
		if (raw === 'introspections' || raw.includes('introspection') || raw.includes('personal')) return 'introspections';
		return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorised';
	}

	function categoryLabel(value) {
		const raw = String(value || '').trim();
		if (!raw) return '—';
		const key = normalizeCategoryKey(raw);
		if (key === 'perceptions') return 'Perceptions';
		if (key === 'procedures') return 'Procedures';
		if (key === 'decisions') return 'Decisions';
		if (key === 'introspections') return 'Introspections';
		return raw;
	}

	function tagHtml(value) {
		return `<strong class="govuk-tag govuk-tag--grey govuk-!-margin-right-1 govuk-!-margin-bottom-1">${esc(value)}</strong>`;
	}

	function normaliseTags(value) {
		if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
		return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
	}

	function codeTags(code) {
		const tags = normaliseTags(code.tags || code.Tags);
		if (tags.length) return tags;
		const path = String(code.path || '').trim();
		if (path) {
			const pathTags = path.split('/').map(part => part.trim()).filter(Boolean);
			if (pathTags.length) return pathTags;
		}
		return normaliseTags(code.name);
	}

	function codeParentOptions(selectedId, currentId) {
		const selected = String(selectedId || '');
		const current = String(currentId || '');
		const options = ['<option value="">No parent — thematic aggregate code</option>'];
		state.codes
			.filter(code => String(code.id || '') && String(code.id) !== current && codeDepth(code) < 3)
			.forEach(code => {
				const id = String(code.id);
				const label = `${codeLevelLabel(code)}: ${String(code.path || code.name || id)}`;
				options.push(`<option value="${esc(id)}"${id === selected ? ' selected' : ''}>${esc(label)}</option>`);
			});
		return options.join('');
	}

	function codeDepth(code, guard = 12) {
		if (!code || !code.parentId || guard <= 0) return 1;
		const parent = state.codes.find(candidate => String(candidate.id) === String(code.parentId));
		return 1 + codeDepth(parent, guard - 1);
	}

	function codeLevelLabel(code) {
		const depth = codeDepth(code);
		if (depth <= 1) return 'Thematic code';
		if (depth === 2) return 'Second-order code';
		return 'First-order code';
	}

	function codeLevelTag(code) {
		const label = codeLevelLabel(code);
		const modifier = label === 'Thematic code' ? 'govuk-tag--blue' :
			label === 'Second-order code' ? 'govuk-tag--green' :
				'govuk-tag--purple';
		return `<strong class="govuk-tag ${modifier}">${esc(label)}</strong>`;
	}

	function emptyEntriesHtml() {
		return '<div class="govuk-inset-text" id="empty-journal"><p class="govuk-body">No entries match the current filter.</p></div>';
	}

	function flash(msg, options = {}) {
		if (options.error) {
			showJournalError(msg);
			return;
		}
		showJournalStatus(msg, { success: !!options.success, title: options.title || 'Information' });
	}

	function fetchJSON(url, init) {
		return fetch(url, init).then(res =>
			res.text().then(txt => {
				const ct = (res.headers.get('content-type') || '').toLowerCase();
				const body = ct.includes('application/json') && txt ? JSON.parse(txt) : {};
				if (!res.ok) {
					const err = new Error('HTTP ' + res.status + (txt ? ' — ' + txt : ''));
					err.response = body;
					err.status = res.status;
					throw err;
				}
				return body;
			})
		);
	}

	function projectIdForWrite() {
		return state.projectAirtableId || state.projectId;
	}

	function projectContextParam() {
		const projectId = state.projectAirtableId || state.projectId;
		return projectId ? '&project=' + encodeURIComponent(projectId) : '';
	}

	function projectNameForSync() {
		return document.querySelector('main')?.dataset?.projectName ||
			document.querySelector('h1')?.textContent?.trim() ||
			state.projectId;
	}

	function muralUid() {
		return localStorage.getItem('mural.uid') || localStorage.getItem('userId') || 'anon';
	}

	function muralSyncPayload(mode, extra = {}) {
		return {
			mode,
			uid: muralUid(),
			projectId: state.projectId,
			projectName: projectNameForSync(),
			...extra
		};
	}

	function ensureMuralSyncPanel() {
		let panel = document.getElementById('mural-sync-panel');
		if (panel && panel.childElementCount) return panel;

		const host = document.getElementById('journal-entries-panel');
		const entries = document.getElementById('entries-container');
		if (!host || !entries) return null;

		if (!panel) {
			panel = document.createElement('section');
			panel.id = 'mural-sync-panel';
			host.insertBefore(panel, entries);
		}

		panel.hidden = false;
		panel.removeAttribute('aria-hidden');
		panel.className = 'govuk-inset-text govuk-!-margin-bottom-4';
		panel.setAttribute('aria-labelledby', 'mural-sync-title');
		panel.innerHTML = '' +
			'<h3 class="govuk-heading-s" id="mural-sync-title">Reflexive Journal Mural</h3>' +
			'<p class="govuk-body" id="mural-sync-message" role="status" aria-live="polite">Checking Reflexive Journal Mural sync status.</p>' +
			'<p class="govuk-body"><strong class="govuk-tag govuk-tag--grey" id="mural-sync-state">Checking</strong></p>' +
			'<div class="govuk-button-group">' +
			'  <button type="button" class="govuk-button govuk-button--secondary" id="mural-sync-pending-btn">Sync pending entries</button>' +
			'  <button type="button" class="govuk-button govuk-button--secondary" id="mural-sync-refresh-btn">Check sync status</button>' +
			'</div>';

		document.getElementById('mural-sync-pending-btn')?.addEventListener('click', syncPendingEntriesToMural);
		document.getElementById('mural-sync-refresh-btn')?.addEventListener('click', loadMuralSyncStatus);
		return panel;
	}

	function setMuralSyncPanel(stateText, message, pending = 0, busy = false) {
		const panel = ensureMuralSyncPanel();
		if (!panel) return;

		const stateEl = document.getElementById('mural-sync-state');
		const messageEl = document.getElementById('mural-sync-message');
		const syncBtn = document.getElementById('mural-sync-pending-btn');
		const refreshBtn = document.getElementById('mural-sync-refresh-btn');

		if (stateEl) stateEl.textContent = stateText;
		if (messageEl) messageEl.textContent = message;
		if (syncBtn) {
			syncBtn.disabled = busy || !pending;
			syncBtn.textContent = pending ? `Sync ${pending} pending ${pending === 1 ? 'entry' : 'entries'}` : 'Sync pending entries';
		}
		if (refreshBtn) refreshBtn.disabled = busy;
	}

	async function loadMuralSyncStatus() {
		if (!state.projectId) return;
		setMuralSyncPanel('Checking', 'Checking Reflexive Journal Mural sync status.', 0, true);

		try {
			const status = await fetchJSON(apiUrl('/api/mural/journal-sync'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(muralSyncPayload('status'))
			});

			state.muralSync = status;
			const pending = Number(status.pending || 0);
			const synced = Number(status.synced || 0);
			const total = Number(status.total || 0);
			const message = pending ?
				`${synced} of ${total} journal entries are synced to the Reflexive Journal Mural. ${pending} ${pending === 1 ? 'entry is' : 'entries are'} pending.` :
				`${synced} of ${total} journal entries are synced to the Reflexive Journal Mural.`;
			setMuralSyncPanel(pending ? 'Pending' : 'Synced', message, pending, false);
		} catch (err) {
			const error = err?.response?.error || '';
			if (error === 'not_authenticated') {
				setMuralSyncPanel('Not connected', 'Connect Mural from the project dashboard before syncing journal entries.', 0, false);
				return;
			}
			if (error === 'mural_board_not_found') {
				setMuralSyncPanel('No board', 'No Reflexive Journal Mural board was found for this project.', 0, false);
				return;
			}
			console.warn('[journal] Mural sync status failed', err);
			setMuralSyncPanel('Unavailable', 'Could not check Mural sync status. Journal entries remain saved in ResearchOps.', 0, false);
		}
	}

	async function syncPendingEntriesToMural() {
		if (!state.projectId) return;
		setMuralSyncPanel('Syncing', 'Syncing pending journal entries to the Reflexive Journal Mural.', 0, true);

		try {
			const result = await fetchJSON(apiUrl('/api/mural/journal-sync'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(muralSyncPayload('hydrate'))
			});

			const after = result.after || {};
			const pending = Number(after.pending || 0);
			const synced = Number(after.synced || 0);
			const total = Number(after.total || 0);
			const changed = Number(result.createdOrUpdated || 0);
			setMuralSyncPanel(
				pending ? 'Pending' : 'Synced',
				`${changed} ${changed === 1 ? 'entry was' : 'entries were'} synced. ${synced} of ${total} journal entries are now on the Reflexive Journal Mural.`,
				pending,
				false
			);
		} catch (err) {
			console.warn('[journal] Mural hydration failed', err);
			setMuralSyncPanel('Failed', 'Could not sync pending entries to Mural. Journal entries remain saved in ResearchOps.', 0, false);
		}
	}

	// === Mural sync: Reflexive Journal behaviour ===============================
	async function _syncToMural(newEntry) {
		try {
			if (!state.projectId) return null;

			const result = await fetchJSON(apiUrl('/api/mural/journal-sync'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(muralSyncPayload('entry', {
					entryId: newEntry?.entryId || newEntry?.id || '',
					category: newEntry?.category || '',
					description: newEntry?.description || newEntry?.content || '',
					tags: Array.isArray(newEntry?.tags) ? newEntry.tags : []
				}))
			});

			await loadMuralSyncStatus();
			return result;
		} catch (err) {
			console.warn('[journal] Mural journal-sync error', err);
			setMuralSyncPanel('Pending', 'Entry saved in ResearchOps, but it has not yet synced to Mural. Use Sync pending entries.', 1, false);
			return null;
		}
	}

	// ---------- state ----------
	var state = {
		projectId: '',
		projectLocalId: '',
		projectAirtableId: '',
		entries: [],
		entriesLoadSeq: 0,
		entryFilter: 'all',
		muralSync: null,
		codes: [],
		codeFormOpen: false,
		codeEditingId: '',
		memos: [],
		memoFormOpen: false,
		memoFilter: 'all'
	};

	// ---------- ROUTES ----------
	var ROUTES = {
		viewEntry: id => '/pages/journal/entry/?id=' + encodeURIComponent(id) + projectContextParam(),
		editEntry: id => '/pages/journal/edit/?id=' + encodeURIComponent(id) + projectContextParam()
	};

	// ---------- JOURNAL ----------
	function loadEntries() {
		if (!state.projectId) return Promise.resolve();
		const loadSeq = state.entriesLoadSeq + 1;
		state.entriesLoadSeq = loadSeq;

		return fetchJSON(apiUrl('/api/journal-entries?project=' + encodeURIComponent(state.projectId)))
			.then(data => {
				if (loadSeq !== state.entriesLoadSeq) return;

				const arr = Array.isArray(data?.entries) ? data.entries : Array.isArray(data) ? data : [];
				state.entries = arr.map(e => {
					const rawCategory = e.category || '—';
					let tags = Array.isArray(e.tags) ?
						e.tags :
						String(e.tags || '').split(',').map(s => s.trim()).filter(Boolean);
					return {
						id: e.id,
						category: categoryLabel(rawCategory),
						categoryKey: normalizeCategoryKey(rawCategory),
						content: e.content ?? e.body ?? '',
						tags,
						createdAt: e.createdAt || e.created_at || '',
						projectId: e.project || e.projectId || e.localProjectId || e.local_project_id || state.projectId
					};
				});
				renderEntries();
				loadMuralSyncStatus();
			})
			.catch(err => {
				if (loadSeq !== state.entriesLoadSeq) return;

				console.error('loadEntries', err);
				if (!state.entries.length) renderEntries();
				flash('Could not refresh journal entries.');
			});
	}

	function currentEntryFilter() { return String(state.entryFilter || 'all').toLowerCase(); }

	function renderEntries() {
		const wrap = document.getElementById('entries-container');
		if (!wrap) return;
		ensureMuralSyncPanel();

		const filter = currentEntryFilter();
		const list = state.entries.filter(en => filter === 'all' || String(en.categoryKey || normalizeCategoryKey(en.category)).toLowerCase() === filter);

		if (!list.length) { wrap.innerHTML = emptyEntriesHtml(); return; }

		wrap.innerHTML = '<ol class="govuk-list app-journal-entry-list">' + list.map(en => {
			const snippet = truncateWords(en.content || '', 300);
			const wasShortened = snippet.length < String(en.content || '').trim().length;
			const viewHref = ROUTES.viewEntry(en.id);
			const editHref = ROUTES.editEntry(en.id);
			const tagsHTML = (en.tags || []).length ?
				`<p class="govuk-body-s govuk-!-margin-bottom-0">${(en.tags || []).map(tagHtml).join('')}</p>` :
				'<p class="govuk-hint govuk-!-margin-bottom-0">No tags recorded.</p>';
			return `
				<li class="govuk-!-margin-bottom-6">
					<article class="govuk-summary-card" data-id="${esc(en.id)}" data-category="${esc(en.categoryKey || normalizeCategoryKey(en.category))}">
						<div class="govuk-summary-card__title-wrapper">
							<h3 class="govuk-summary-card__title">
								<a class="govuk-link" href="${viewHref}">${esc(en.category)} journal entry</a>
							</h3>
							<ul class="govuk-summary-card__actions">
								<li class="govuk-summary-card__action"><a class="govuk-link" href="${viewHref}">View entry<span class="govuk-visually-hidden"> ${esc(en.category)} ${esc(when(en.createdAt))}</span></a></li>
								<li class="govuk-summary-card__action"><a class="govuk-link" href="${editHref}">Edit entry<span class="govuk-visually-hidden"> ${esc(en.category)} ${esc(when(en.createdAt))}</span></a></li>
							</ul>
						</div>
						<div class="govuk-summary-card__content">
							<dl class="govuk-summary-list">
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Category</dt>
									<dd class="govuk-summary-list__value">${esc(en.category)}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Created</dt>
									<dd class="govuk-summary-list__value">${esc(when(en.createdAt))}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Entry</dt>
									<dd class="govuk-summary-list__value"><p class="govuk-body">${esc(snippet)}${wasShortened ? ` <a class="govuk-link" href="${viewHref}">Read full entry</a>` : ''}</p></dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Tags</dt>
									<dd class="govuk-summary-list__value">${tagsHTML}</dd>
								</div>
							</dl>
							<div class="govuk-button-group govuk-!-margin-bottom-0">
								<button type="button" class="govuk-button govuk-button--warning" data-module="govuk-button" data-act="delete" data-id="${esc(en.id)}">Delete entry</button>
							</div>
							<div class="govuk-inset-text govuk-!-margin-top-3" data-delete-confirmation="entry-${esc(en.id)}" hidden>
								<p class="govuk-body">Are you sure you want to delete this journal entry?</p>
								<div class="govuk-button-group">
									<button type="button" class="govuk-button govuk-button--warning" data-module="govuk-button" data-act="confirm-delete" data-id="${esc(en.id)}">Yes, delete entry</button>
									<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cancel-delete">Cancel</button>
								</div>
							</div>
						</div>
					</article>
				</li>`;
		}).join('') + '</ol>';

		$all('[data-act="delete"]', wrap).forEach(btn => btn.addEventListener('click', onDeleteEntry));
		$all('[data-act="confirm-delete"]', wrap).forEach(btn => btn.addEventListener('click', onConfirmDeleteEntry));
		$all('[data-act="cancel-delete"]', wrap).forEach(btn => btn.addEventListener('click', () => hideDeleteConfirmations(wrap)));
	}

	function onDeleteEntry(e) {
		const id = e.currentTarget?.getAttribute('data-id');
		if (!id) return;
		showDeleteConfirmation(e.currentTarget, `entry-${id}`);
	}

	function onConfirmDeleteEntry(e) {
		const id = e.currentTarget?.getAttribute('data-id');
		if (!id) return;
		clearJournalFeedback();
		fetchJSON(apiUrl('/api/journal-entries/' + encodeURIComponent(id)), { method: 'DELETE' })
			.then(() => {
				flash('Journal entry deleted.', { success: true, title: 'Success' });
				loadEntries();
			})
			.catch(() => flash('Could not delete journal entry.', { error: true }));
	}

	function setupEntryAddForm() {
		const formWrap = document.getElementById('entry-form');
		const form = document.getElementById('add-entry-form');
		const btnShow = document.getElementById('new-entry-btn');
		const btnCancel = document.getElementById('cancel-form-btn');

		function toggle(show) {
			if (!formWrap) return;
			const s = typeof show === 'boolean' ? show : formWrap.hidden;
			formWrap.hidden = !s;
			if (s) document.getElementById('entry-content')?.focus();
		}

		btnShow?.addEventListener('click', e => {
			e.preventDefault();
			toggle(true);
		});
		btnCancel?.addEventListener('click', e => {
			e.preventDefault();
			toggle(false);
		});

		if (!form) return;
		form.addEventListener('submit', async e => {
			e.preventDefault();
			const fd = new FormData(form);
			const category = String(fd.get('category') || '');
			const content = String(fd.get('content') || '');
			const tagsStr = String(fd.get('tags') || '');
			if (!category || !content) { flash('Category and content are required.', { error: true }); return; }

			const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
			const projectLocalId = state.projectLocalId || state.projectId;
			const projectAirtableId = state.projectAirtableId || state.projectId;

			const body = {
				project: projectAirtableId,
				project_airtable_id: projectAirtableId,
				project_local_id: projectLocalId,
				category,
				content,
				tags
			};

			try {
				const created = await fetchJSON(apiUrl('/api/journal-entries'), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				});

				await _syncToMural({ entryId: created.id, category, description: content, tags, projectId: state.projectId });
				form.reset();
				toggle(false);
				flash('Journal entry saved.', { success: true, title: 'Success' });
				await loadEntries();
			} catch (err) {
				console.error('add-entry', err);
				flash('Could not save journal entry.', { error: true });
			}
		});
	}

	function setupEntryFilters() {
		const container = document.querySelector('#journal-entries-panel .journal-filter-radios');
		if (!container) return;
		const active = container.querySelector('input[data-filter]:checked');
		state.entryFilter = active?.dataset?.filter?.toLowerCase() || 'all';

		$all('input[data-filter]', container).forEach(input => {
			input.addEventListener('change', () => {
				state.entryFilter = input.dataset.filter || 'all';
				renderEntries();
			});
		});
	}

	// ---------- CODES ----------
	function loadCodes() {
		if (!state.projectId) return Promise.resolve();
		return fetchJSON(apiUrl('/api/codes?project=' + encodeURIComponent(state.projectId)))
			.then(data => {
				state.codes = Array.isArray(data?.codes) ? data.codes : [];
				renderCodes();
			})
			.catch(err => {
				console.error('loadCodes', err);
				flash('Could not load codes.');
				renderCodes();
			});
	}

	function renderCodes() {
		const wrap = document.getElementById('codes-container');
		if (!wrap) return;

		const formHtml = state.codeFormOpen ? `
			<form id="add-code-form" class="govuk-!-margin-bottom-6" novalidate>
				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="code-name">Code name</label>
					<input class="govuk-input govuk-input--width-20" id="code-name" name="name" type="text" required>
				</div>

				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="code-description">Description</label>
					<textarea class="govuk-textarea" id="code-description" name="description" rows="3"></textarea>
				</div>

				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="code-parent">Parent code</label>
					<div id="code-parent-hint" class="govuk-hint">Leave blank for a thematic aggregate code. Choose an aggregate or interpretive parent to create a lower-level code.</div>
					<select class="govuk-select" id="code-parent" name="parentId" aria-describedby="code-parent-hint">
						${codeParentOptions('', '')}
					</select>
				</div>

				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="code-colour">Colour</label>
					<input class="govuk-input govuk-input--width-10" id="code-colour" name="colour" type="text" value="#1d70b8ff">
				</div>

				<div class="govuk-button-group">
					<button type="submit" class="govuk-button" data-module="govuk-button">Save code</button>
					<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" id="cancel-code-form-btn">Cancel</button>
				</div>
			</form>` : '';

		const hierarchyHelp = `
			<details class="govuk-details">
				<summary class="govuk-details__summary">
					<span class="govuk-details__summary-text">How code levels work</span>
				</summary>
				<div class="govuk-details__text">
					<p class="govuk-body">Use thematic codes for aggregate themes, second-order codes for interpretation, and first-order codes for descriptive labels that stay close to the journal entry.</p>
				</div>
			</details>`;

		const listHtml = state.codes.length ?
			hierarchyHelp + '<ol class="govuk-list app-code-list">' + state.codes.map(code => {
				if (state.codeEditingId === code.id) {
					return `
				<li class="govuk-!-margin-bottom-4">
					<article class="govuk-summary-card" data-code-id="${esc(code.id)}">
						<div class="govuk-summary-card__title-wrapper">
							<h3 class="govuk-summary-card__title">Edit ${esc(code.name || code.id)}</h3>
						</div>
						<div class="govuk-summary-card__content">
							<form class="code-edit-form" data-code-edit-id="${esc(code.id)}" novalidate>
								<div class="govuk-form-group">
									<label class="govuk-label govuk-label--s" for="code-name-${esc(code.id)}">Code name</label>
									<input class="govuk-input govuk-input--width-20" id="code-name-${esc(code.id)}" name="name" type="text" value="${esc(code.name || '')}" required>
								</div>

								<div class="govuk-form-group">
									<label class="govuk-label govuk-label--s" for="code-description-${esc(code.id)}">Description</label>
									<textarea class="govuk-textarea" id="code-description-${esc(code.id)}" name="description" rows="3">${esc(code.description || '')}</textarea>
								</div>

								<div class="govuk-form-group">
									<label class="govuk-label govuk-label--s" for="code-parent-${esc(code.id)}">Parent code</label>
									<div id="code-parent-hint-${esc(code.id)}" class="govuk-hint">Leave blank for a thematic aggregate code. Choose an aggregate or interpretive parent to create a lower-level code.</div>
									<select class="govuk-select" id="code-parent-${esc(code.id)}" name="parentId" aria-describedby="code-parent-hint-${esc(code.id)}">
										${codeParentOptions(code.parentId || '', code.id)}
									</select>
								</div>

								<div class="govuk-form-group">
									<label class="govuk-label govuk-label--s" for="code-colour-${esc(code.id)}">Colour</label>
									<input class="govuk-input govuk-input--width-10" id="code-colour-${esc(code.id)}" name="colour" type="text" value="${esc(code.colour || '#1d70b8ff')}">
								</div>

								<div class="govuk-button-group">
									<button type="submit" class="govuk-button" data-module="govuk-button">Save changes</button>
									<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cancel-code-edit">Cancel</button>
								</div>
							</form>
						</div>
					</article>
				</li>`;
				}
				const tags = codeTags(code);
				const tagsHTML = tags.length ?
					`<p class="govuk-body-s govuk-!-margin-bottom-0">${tags.map(tagHtml).join('')}</p>` :
					'<p class="govuk-hint govuk-!-margin-bottom-0">No tags recorded.</p>';
				return `
				<li class="govuk-!-margin-bottom-4">
					<article class="govuk-summary-card" data-code-id="${esc(code.id)}">
						<div class="govuk-summary-card__title-wrapper">
							<h3 class="govuk-summary-card__title">${esc(code.name || code.id)} ${codeLevelTag(code)}</h3>
							<ul class="govuk-summary-card__actions">
								<li class="govuk-summary-card__action"><button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-module="govuk-button" data-act="edit-code" data-id="${esc(code.id)}">Edit<span class="govuk-visually-hidden"> ${esc(code.name || code.id)}</span></button></li>
								<li class="govuk-summary-card__action"><button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-module="govuk-button" data-act="delete-code" data-id="${esc(code.id)}">Delete<span class="govuk-visually-hidden"> ${esc(code.name || code.id)}</span></button></li>
							</ul>
						</div>
						<div class="govuk-summary-card__content">
							<dl class="govuk-summary-list">
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Code type</dt>
									<dd class="govuk-summary-list__value">${codeLevelTag(code)}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Path</dt>
									<dd class="govuk-summary-list__value">${esc(code.path || code.name || code.id)}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Description</dt>
									<dd class="govuk-summary-list__value">${esc(code.description || 'No description recorded.')}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Tags</dt>
									<dd class="govuk-summary-list__value">${tagsHTML}</dd>
								</div>
							</dl>
							<div class="govuk-inset-text govuk-!-margin-top-3" data-delete-confirmation="code-${esc(code.id)}" hidden>
								<p class="govuk-body">Are you sure you want to delete this codebook entry?</p>
								<div class="govuk-button-group">
									<button type="button" class="govuk-button govuk-button--warning" data-module="govuk-button" data-act="confirm-delete-code" data-id="${esc(code.id)}">Yes, delete code</button>
									<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cancel-delete">Cancel</button>
								</div>
							</div>
						</div>
					</article>
				</li>`;
			}).join('') + '</ol>' :
			'<div class="govuk-inset-text"><p class="govuk-body">No codes have been added yet.</p></div>';

		wrap.innerHTML = formHtml + listHtml;

		const cancel = document.getElementById('cancel-code-form-btn');
		cancel?.addEventListener('click', () => {
			state.codeFormOpen = false;
			renderCodes();
		});

		const form = document.getElementById('add-code-form');
		form?.addEventListener('submit', onCreateCode);
		$all('[data-act="edit-code"]', wrap).forEach(btn => btn.addEventListener('click', onEditCode));
		$all('[data-act="delete-code"]', wrap).forEach(btn => btn.addEventListener('click', onDeleteCode));
		$all('[data-act="confirm-delete-code"]', wrap).forEach(btn => btn.addEventListener('click', onConfirmDeleteCode));
		$all('[data-act="cancel-delete"]', wrap).forEach(btn => btn.addEventListener('click', () => hideDeleteConfirmations(wrap)));
		$all('[data-act="cancel-code-edit"]', wrap).forEach(btn => btn.addEventListener('click', () => {
			state.codeEditingId = '';
			renderCodes();
		}));
		$all('.code-edit-form', wrap).forEach(codeForm => codeForm.addEventListener('submit', onSubmitCodeEdit));
	}

	async function onCreateCode(e) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const name = String(fd.get('name') || '').trim();
		if (!name) { flash('Code name is required.', { error: true }); return; }

		const body = {
			projectId: projectIdForWrite(),
			name,
			description: String(fd.get('description') || '').trim(),
			parentId: String(fd.get('parentId') || '').trim() || null,
			colour: String(fd.get('colour') || '#1d70b8ff').trim()
		};

		try {
			await fetchJSON(apiUrl('/api/codes'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			state.codeFormOpen = false;
			flash('Code saved.', { success: true, title: 'Success' });
			await loadCodes();
		} catch (err) {
			console.error('createCode', err);
			flash('Could not save code.', { error: true });
		}
	}

	function onEditCode(e) {
		const id = e.currentTarget?.getAttribute('data-id');
		if (!id) return;
		state.codeEditingId = id;
		state.codeFormOpen = false;
		renderCodes();
		document.getElementById(`code-name-${id}`)?.focus();
	}

	async function onSubmitCodeEdit(e) {
		e.preventDefault();
		const form = e.currentTarget;
		const codeId = form.getAttribute('data-code-edit-id');
		const fd = new FormData(form);
		const name = String(fd.get('name') || '').trim();
		if (!codeId || !name) {
			flash('Code name is required.', { error: true });
			return;
		}

		try {
			await fetchJSON(apiUrl('/api/codes/' + encodeURIComponent(codeId)), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					description: String(fd.get('description') || '').trim(),
					parentId: String(fd.get('parentId') || '').trim() || null,
					colour: String(fd.get('colour') || '#1d70b8ff').trim()
				})
			});
			state.codeEditingId = '';
			flash('Code updated.', { success: true, title: 'Success' });
			await loadCodes();
		} catch (err) {
			console.error('updateCode', err);
			flash('Could not update code.', { error: true });
		}
	}

	function onDeleteCode(e) {
		const codeId = e.currentTarget?.getAttribute('data-id');
		if (!codeId) return;
		showDeleteConfirmation(e.currentTarget, `code-${codeId}`);
	}

	async function onConfirmDeleteCode(e) {
		const codeId = e.currentTarget?.getAttribute('data-id');
		if (!codeId) return;

		try {
			await fetchJSON(apiUrl('/api/codes/' + encodeURIComponent(codeId)), { method: 'DELETE' });
			flash('Code deleted.', { success: true, title: 'Success' });
			await loadCodes();
		} catch (err) {
			console.error('deleteCode', err);
			flash('Could not delete code.', { error: true });
		}
	}

	function setupCodeAdd() {
		const btn = document.getElementById('new-code-btn');
		btn?.addEventListener('click', e => {
			e.preventDefault();
			state.codeFormOpen = true;
			state.codeEditingId = '';
			renderCodes();
			document.getElementById('code-name')?.focus();
		});
	}

	// ---------- MEMOS ----------
	function loadMemos() {
		if (!state.projectId) return Promise.resolve();
		return fetchJSON(apiUrl('/api/memos?project=' + encodeURIComponent(state.projectId)))
			.then(data => {
				state.memos = Array.isArray(data?.memos) ? data.memos : [];
				renderMemos();
			})
			.catch(err => {
				console.error('loadMemos', err);
				flash('Could not load memos.');
				renderMemos();
			});
	}

	function currentMemoFilter() { return String(state.memoFilter || 'all').toLowerCase(); }

	function memoTypeLabel(value) {
		const key = String(value || 'memo').toLowerCase();
		if (key === 'analytical') return 'Analytical';
		if (key === 'methodological') return 'Methodological';
		if (key === 'theoretical') return 'Theoretical';
		if (key === 'reflexive') return 'Reflexive';
		return 'Memo';
	}

	function renderMemos() {
		const wrap = document.getElementById('memos-container');
		if (!wrap) return;

		const formHtml = state.memoFormOpen ? `
			<form id="add-memo-form" class="govuk-!-margin-bottom-6" novalidate>
				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="memo-type">Memo type</label>
					<select class="govuk-select" id="memo-type" name="memo_type" required>
						<option value="analytical">Analytical</option>
						<option value="methodological">Methodological</option>
						<option value="theoretical">Theoretical</option>
						<option value="reflexive">Reflexive</option>
					</select>
				</div>

				<div class="govuk-form-group">
					<label class="govuk-label govuk-label--s" for="memo-content">Memo</label>
					<textarea class="govuk-textarea" id="memo-content" name="content" rows="6" required></textarea>
				</div>

				<div class="govuk-button-group">
					<button type="submit" class="govuk-button" data-module="govuk-button">Save memo</button>
					<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" id="cancel-memo-form-btn">Cancel</button>
				</div>
			</form>` : '';

		const filter = currentMemoFilter();
		const list = state.memos.filter(memo => filter === 'all' || String(memo.memoType || '').toLowerCase() === filter);
		const listHtml = list.length ?
			'<ol class="govuk-list app-memo-list">' + list.map(memo => `
				<li class="govuk-!-margin-bottom-4">
					<article class="govuk-summary-card" data-memo-id="${esc(memo.id)}">
						<div class="govuk-summary-card__title-wrapper">
							<h3 class="govuk-summary-card__title">${memoTypeLabel(memo.memoType)} memo <strong class="govuk-tag govuk-tag--blue memo-type-tag">${esc(memoTypeLabel(memo.memoType))}</strong></h3>
							<ul class="govuk-summary-card__actions">
								<li class="govuk-summary-card__action"><button type="button" class="govuk-button govuk-button--secondary govuk-!-margin-bottom-0" data-act="edit-memo" data-id="${esc(memo.id)}">Edit<span class="govuk-visually-hidden"> ${esc(memoTypeLabel(memo.memoType))} memo</span></button></li>
								<li class="govuk-summary-card__action"><button type="button" class="govuk-button govuk-button--warning govuk-!-margin-bottom-0" data-act="delete-memo" data-id="${esc(memo.id)}">Delete<span class="govuk-visually-hidden"> ${esc(memoTypeLabel(memo.memoType))} memo</span></button></li>
							</ul>
						</div>
						<div class="govuk-summary-card__content">
							<dl class="govuk-summary-list">
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Created</dt>
									<dd class="govuk-summary-list__value">${esc(when(memo.createdAt))}</dd>
								</div>
								<div class="govuk-summary-list__row">
									<dt class="govuk-summary-list__key">Memo</dt>
									<dd class="govuk-summary-list__value"><p class="govuk-body">${esc(truncateWords(memo.content || '', 300))}</p></dd>
								</div>
							</dl>
							<div class="govuk-inset-text govuk-!-margin-top-3" data-delete-confirmation="memo-${esc(memo.id)}" hidden>
								<p class="govuk-body">Are you sure you want to delete this memo?</p>
								<div class="govuk-button-group">
									<button type="button" class="govuk-button govuk-button--warning" data-module="govuk-button" data-act="confirm-delete-memo" data-id="${esc(memo.id)}">Yes, delete memo</button>
									<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button" data-act="cancel-delete">Cancel</button>
								</div>
							</div>
						</div>
					</article>
				</li>`).join('') + '</ol>' :
			'<div class="govuk-inset-text"><p class="govuk-body">No memos match the current filter.</p></div>';

		wrap.innerHTML = formHtml + listHtml;

		const cancel = document.getElementById('cancel-memo-form-btn');
		cancel?.addEventListener('click', () => {
			state.memoFormOpen = false;
			renderMemos();
		});

		const form = document.getElementById('add-memo-form');
		form?.addEventListener('submit', onCreateMemo);
		$all('[data-act="edit-memo"]', wrap).forEach(btn => btn.addEventListener('click', onEditMemo));
		$all('[data-act="delete-memo"]', wrap).forEach(btn => btn.addEventListener('click', onDeleteMemo));
		$all('[data-act="confirm-delete-memo"]', wrap).forEach(btn => btn.addEventListener('click', onConfirmDeleteMemo));
		$all('[data-act="cancel-delete"]', wrap).forEach(btn => btn.addEventListener('click', () => hideDeleteConfirmations(wrap)));
	}

	async function onCreateMemo(e) {
		e.preventDefault();
		const form = e.currentTarget;
		const fd = new FormData(form);
		const content = String(fd.get('content') || '').trim();
		if (!content) { flash('Memo content is required.', { error: true }); return; }

		const body = {
			project_id: projectIdForWrite(),
			memo_type: String(fd.get('memo_type') || 'analytical'),
			content
		};

		try {
			await fetchJSON(apiUrl('/api/memos'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			state.memoFormOpen = false;
			flash('Memo saved.', { success: true, title: 'Success' });
			await loadMemos();
		} catch (err) {
			console.error('createMemo', err);
			flash('Could not save memo.', { error: true });
		}
	}

	function onEditMemo(e) {
		const id = e.currentTarget?.getAttribute('data-id');
		const memo = state.memos.find(item => item.id === id);
		const card = e.currentTarget?.closest('.govuk-summary-card');
		if (!memo || !card) return;

		card.innerHTML = `
			<form class="govuk-form-group memo-edit-form" data-memo-edit-id="${esc(memo.id)}" novalidate>
				<label class="govuk-label govuk-label--s" for="memo-type-${esc(memo.id)}">Memo type</label>
				<select class="govuk-select" id="memo-type-${esc(memo.id)}" name="memo_type" required>
					<option value="analytical"${memo.memoType === 'analytical' ? ' selected' : ''}>Analytical</option>
					<option value="methodological"${memo.memoType === 'methodological' ? ' selected' : ''}>Methodological</option>
					<option value="theoretical"${memo.memoType === 'theoretical' ? ' selected' : ''}>Theoretical</option>
					<option value="reflexive"${memo.memoType === 'reflexive' ? ' selected' : ''}>Reflexive</option>
				</select>

				<label class="govuk-label govuk-label--s govuk-!-margin-top-3" for="memo-content-${esc(memo.id)}">Memo</label>
				<textarea class="govuk-textarea" id="memo-content-${esc(memo.id)}" name="content" rows="8" required>${esc(memo.content || '')}</textarea>

				<div class="govuk-button-group govuk-!-margin-top-3">
					<button type="submit" class="govuk-button">Save changes</button>
					<button type="button" class="govuk-button govuk-button--secondary" data-act="cancel-memo-edit">Cancel</button>
				</div>
			</form>`;

		const form = card.querySelector('form');
		form?.addEventListener('submit', onSubmitMemoEdit);
		card.querySelector('[data-act="cancel-memo-edit"]')?.addEventListener('click', renderMemos);
		card.querySelector('textarea')?.focus();
	}

	async function onSubmitMemoEdit(e) {
		e.preventDefault();
		const form = e.currentTarget;
		const memoId = form.getAttribute('data-memo-edit-id');
		const fd = new FormData(form);
		const content = String(fd.get('content') || '').trim();
		if (!memoId || !content) {
			flash('Memo content is required.', { error: true });
			return;
		}

		try {
			await fetchJSON(apiUrl('/api/memos/' + encodeURIComponent(memoId)), {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					memo_type: String(fd.get('memo_type') || 'analytical'),
					content
				})
			});
			flash('Memo updated.', { success: true, title: 'Success' });
			await loadMemos();
		} catch (err) {
			console.error('updateMemo', err);
			flash('Could not update memo.', { error: true });
		}
	}

	async function onDeleteMemo(e) {
		const memoId = e.currentTarget?.getAttribute('data-id');
		if (!memoId) return;
		showDeleteConfirmation(e.currentTarget, `memo-${memoId}`);
	}

	async function onConfirmDeleteMemo(e) {
		const memoId = e.currentTarget?.getAttribute('data-id');
		if (!memoId) return;
		try {
			await fetchJSON(apiUrl('/api/memos/' + encodeURIComponent(memoId)), { method: 'DELETE' });
			flash('Memo deleted.', { success: true, title: 'Success' });
			await loadMemos();
		} catch (err) {
			console.error('deleteMemo', err);
			flash('Could not delete memo.', { error: true });
		}
	}

	function setupMemoAddForm() {
		const btn = document.getElementById('new-memo-btn');
		btn?.addEventListener('click', e => {
			e.preventDefault();
			state.memoFormOpen = true;
			renderMemos();
			document.getElementById('memo-content')?.focus();
		});
	}

	function setupMemoFilters() {
		const container = document.querySelector('#memos-panel .journal-filter-radios');
		if (!container) return;
		const active = container.querySelector('input[data-memo-filter]:checked');
		state.memoFilter = active?.dataset?.memoFilter?.toLowerCase() || 'all';

		$all('input[data-memo-filter]', container).forEach(input => {
			input.addEventListener('change', () => {
				state.memoFilter = input.dataset.memoFilter || 'all';
				renderMemos();
			});
		});
	}

	// ---------- ANALYSIS ----------
	function setupAnalysisButtons() {
		const wrap = document.querySelector('#analysis-panel .govuk-button-group');
		if (!wrap) return;
		wrap.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-analysis]');
			if (!btn) return;
			const mode = btn.getAttribute('data-analysis');
			if (mode === 'timeline') runTimeline(state.projectId);
			else if (mode === 'co-occurrence') runCooccurrence(state.projectId);
			else if (mode === 'retrieval') {
				runRetrieval(state.projectId);
				document.getElementById('retrieval-q')?.focus();
				showJournalStatus('Enter a search term in Code retrieval, then select Run search.');
			} else if (mode === 'export') runExport(state.projectId);
		});
	}

	// ---------- TAB lifecycle ----------
	function onTabShown(id) {
		if (id === 'journal-entries') loadEntries();
		if (id === 'codes') loadCodes();
		if (id === 'memos') loadMemos();
	}

	// ---------- boot ----------
	document.addEventListener('DOMContentLoaded', function() {
		var url = new URL(location.href);
		state.projectId = url.searchParams.get('project') || url.searchParams.get('id') || '';

		var mainEl = document.querySelector('main');
		state.projectLocalId =
			(mainEl && (mainEl.getAttribute('data-project-local-id') || mainEl.getAttribute('data-project-id'))) ||
			state.projectId;
		state.projectAirtableId =
			(mainEl && mainEl.getAttribute('data-project-airtable-id')) ||
			state.projectId;

		setupEntryAddForm();
		setupEntryFilters();
		setupCodeAdd();
		setupMemoAddForm();
		setupMemoFilters();
		setupAnalysisButtons();
		ensureMuralSyncPanel();
		clearJournalFeedback();
		try {
			const queued = sessionStorage.getItem('journal-feedback');
			if (queued) {
				sessionStorage.removeItem('journal-feedback');
				const data = JSON.parse(queued);
				if (data?.type === 'error') showJournalError(data.message);
				else if (data?.message) showJournalStatus(data.message, { success: !!data.success, title: data.title || 'Information' });
			}
		} catch {
			// Ignore malformed client-side feedback payloads.
		}

		var active = (location.hash || '').replace(/^#/, '') || 'journal-entries';
		onTabShown(active);
		document.addEventListener('tab:shown', e => onTabShown(e?.detail?.id || ''));
	});
})();
