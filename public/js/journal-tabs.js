/**
 * @file /js/journal-tabs.js
 * @description Journals page: tab-specific rendering and interactions.
 * - Renders Journal entries (filters, edit/delete, link to full view)
 * - Renders Codes (add form, Coloris, parent select)
 * - Renders Memos (filters, add form)
 * - Bridges Analysis buttons to CAQ-DAS (data/analysis-only) module
 *
 * NOTE: Heavy analysis logic lives in /js/caqdas-interface.js
 */

import { runTimeline, runCooccurrence, runRetrieval, runExport } from './caqdas-interface.js';

/* eslint-env browser */
(function() {
	// ---------- tiny helpers ----------
	function $(s, r) { if (!r) r = document; return r.querySelector(s); }

	function $all(s, r) { if (!r) r = document; return Array.from(r.querySelectorAll(s)); }

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

	function toHex8(input) {
		if (!input) return '#1d70b8ff';
		var v = String(input).trim().toLowerCase();
		if (/^#[0-9a-f]{8}$/.test(v)) return v;
		if (/^#[0-9a-f]{6}$/.test(v)) return v + 'ff';
		if (/^#[0-9a-f]{3}$/.test(v)) {
			var parts = v.slice(1).split('');
			return '#' + parts[0] + parts[0] + parts[1] + parts[1] + parts[2] + parts[2] + 'ff';
		}
		var ctx = document.createElement('canvas').getContext('2d');
		try { ctx.fillStyle = v; } catch (e) { return '#1d70b8ff'; }
		var hex6 = ctx.fillStyle;
		if (/^#[0-9a-f]{6}$/i.test(hex6)) return hex6 + 'ff';
		return '#1d70b8ff';
	}

	function mapById(arr) {
		var m = Object.create(null);
		if (!Array.isArray(arr)) return m;
		for (var i = 0; i < arr.length; i++) {
			var c = arr[i];
			if (c && c.id) m[c.id] = c;
		}
		return m;
	}

	function depthOf(codesById, id) {
		var d = 1;
		var cur = String(id || '');
		var guard = 12;
		while (cur && guard-- > 0) {
			var node = codesById[cur];
			if (!node || !node.parentId) break;
			d += 1;
			cur = node.parentId;
		}
		return d;
	}

	function flash(msg, asHtml = false) {
		let el = document.getElementById('flash');
		if (!el) {
			el = document.createElement('div');
			el.id = 'flash';
			el.setAttribute('role', 'status');
			el.setAttribute('aria-live', 'polite');
			el.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #d0d7de;background:#fff;';
			document.querySelector('main')?.prepend(el);
		}
		el[asHtml ? 'innerHTML' : 'textContent'] = msg;
	}

	function fetchJSON(url, init) {
		return fetch(url, init).then(res =>
			res.text().then(txt => {
				const ct = (res.headers.get('content-type') || '').toLowerCase();
				const body = ct.includes('application/json') && txt ? JSON.parse(txt) : {};
				if (!res.ok) {
					const err = new Error('HTTP ' + res.status + (txt ? ' — ' + txt : ''));
					err.response = body;
					throw err;
				}
				return body;
			})
		);
	}

	// === Mural sync: Reflexive Journal behaviour ===============================
	async function _syncToMural(newEntry) {
		try {
			const projectId = state.projectId;
			if (!projectId) {
				console.warn('[journal] No projectId in state — skipping Mural sync');
				return;
			}

			const payload = {
				uid: localStorage.getItem('mural.uid') || localStorage.getItem('userId') || 'anon',
				// muralId intentionally omitted — server resolves from projectId mapping
				projectId,
				studyId: newEntry?.studyId || null,
				category: String(newEntry?.category || '').toLowerCase(),
				description: String(newEntry?.description || newEntry?.content || ''),
				tags: Array.isArray(newEntry?.tags) ? newEntry.tags : []
			};

			const res = await fetch('/api/mural/journal-sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const body = await res.text().catch(() => '');
				console.warn('[journal] Mural journal-sync failed', res.status, body);
			} else {
				console.log('[journal] ✓ Synced to Mural');
			}
		} catch (err) {
			console.warn('[journal] Mural journal-sync error', err);
		}
	}

	// ---------- state ----------
	var state = {
		projectId: '',
		projectLocalId: '',
		projectAirtableId: '',
		entries: [],
		entryFilter: 'all',
		codes: [],
		memos: [],
		memoFilter: 'all'
	};

	// ---------- ROUTES ----------
	var ROUTES = {
		viewEntry: id => '/pages/journal/entry?id=' + encodeURIComponent(id),
		editEntry: id => '/pages/journal/edit?id=' + encodeURIComponent(id)
	};

	// ---------- JOURNAL ----------
	function loadEntries() {
		if (!state.projectId) return Promise.resolve();
		return fetchJSON('/api/journal-entries?project=' + encodeURIComponent(state.projectId))
			.then(data => {
				const arr = Array.isArray(data?.entries) ? data.entries : Array.isArray(data) ? data : [];
				state.entries = arr.map(e => {
					let tags = Array.isArray(e.tags) ?
						e.tags :
						String(e.tags || '').split(',').map(s => s.trim()).filter(Boolean);
					return {
						id: e.id,
						category: e.category || '—',
						content: e.content ?? e.body ?? '',
						tags,
						createdAt: e.createdAt || e.created_at || ''
					};
				});
				renderEntries();
			})
			.catch(err => {
				console.error('loadEntries', err);
				state.entries = [];
				renderEntries();
				flash('Could not load journal entries.');
			});
	}

	function currentEntryFilter() { return String(state.entryFilter || 'all').toLowerCase(); }

	function renderEntries() {
		const wrap = document.getElementById('entries-container');
		const empty = document.getElementById('empty-journal');
		if (!wrap) return;

		const filter = currentEntryFilter();
		const list = state.entries.filter(en => filter === 'all' || String(en.category || '').toLowerCase() === filter);

		if (!list.length) { wrap.innerHTML = ''; if (empty) empty.hidden = false; return; }
		if (empty) empty.hidden = true;

		wrap.innerHTML = list.map(en => {
			const snippet = truncateWords(en.content || '', 200);
			const wasShortened = snippet.length < String(en.content || '').trim().length;
			const tagsHTML = (en.tags || []).map(t => `<span class="tag" aria-label="Tag: ${esc(t)}">${esc(t)}</span>`).join('');
			return `
				<article class="entry-card" data-id="${esc(en.id)}" data-category="${esc(en.category)}">
					<header class="entry-header">
						<div class="entry-meta">
							<a class="entry-link" href="${ROUTES.viewEntry(en.id)}">
								<span class="entry-category-badge" data-category="${esc(en.category)}">${esc(en.category)}</span>
								<span class="entry-timestamp">${when(en.createdAt)}</span>
							</a>
						</div>
						<div class="entry-actions" role="group">
							<a class="btn-quiet" href="${ROUTES.editEntry(en.id)}">Edit</a>
							<button class="btn-quiet danger" data-act="delete" data-id="${esc(en.id)}">Delete</button>
						</div>
					</header>
					<div class="entry-content">${esc(snippet)}${wasShortened ? ` <a class="read-more" href="${ROUTES.viewEntry(en.id)}">Read full entry</a>` : ''}</div>
					<div class="entry-tags">${tagsHTML}</div>
				</article>`;
		}).join('');

		$all('[data-act="delete"]', wrap).forEach(btn => btn.addEventListener('click', onDeleteEntry));
	}

	function onDeleteEntry(e) {
		const id = e.currentTarget?.getAttribute('data-id');
		if (!id || !confirm('Delete this entry?')) return;
		fetchJSON('/api/journal-entries/' + encodeURIComponent(id), { method: 'DELETE' })
			.then(() => {
				flash('Entry deleted.');
				loadEntries();
			})
			.catch(() => flash('Could not delete entry.'));
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
			if (!category || !content) { flash('Category and content are required.'); return; }

			const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);

			// Prefer explicit data-project-local-id / data-project-airtable-id if present
			const projectLocalId = state.projectLocalId || state.projectId;
			const projectAirtableId = state.projectAirtableId || state.projectId;

			const body = {
				// Airtable link uses the Airtable id
				project: projectAirtableId,
				project_airtable_id: projectAirtableId,
				// D1 mirror can use a stable local id if available
				project_local_id: projectLocalId,
				category,
				content,
				tags
			};

			try {
				const createdRes = await fetchJSON('/api/journal-entries', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				});

				// Best-effort sync to Mural (server resolves muralId)
				await _syncToMural({
					category,
					description: content,
					tags,
					projectId: state.projectId
				});

				form.reset();
				toggle(false);
				flash('Entry saved.');
				await loadEntries();
			} catch (err) {
				console.error('add-entry', err);
				flash('Could not save entry.');
			}
		});
	}

	function setupEntryFilters() {
		const container = document.querySelector('#journal-entries-panel .filter-chips');
		if (!container) return;
		const active = container.querySelector('.filter-chip--active');
		state.entryFilter = active?.dataset?.filter?.toLowerCase() || 'all';

		$all('.filter-chip', container).forEach(b => {
			b.setAttribute('role', 'button');
			b.tabIndex = 0;
			b.addEventListener('click', e => {
				e.preventDefault();
				$all('.filter-chip', container).forEach(x => x.classList.remove('filter-chip--active'));
				b.classList.add('filter-chip--active');
				state.entryFilter = b.dataset.filter || 'all';
				renderEntries();
			});
			b.addEventListener('keydown', e => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					b.click();
				}
			});
		});
	}

	/* ---- Codes, Memos, Analysis (unchanged from your existing file) ---- */

	function setupAnalysisButtons() {
		const wrap = document.querySelector('#analysis-panel .govuk-button-group');
		if (!wrap) return;
		wrap.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-analysis]');
			if (!btn) return;
			const mode = btn.getAttribute('data-analysis');
			if (mode === 'timeline') runTimeline();
			else if (mode === 'co-occurrence') runCooccurrence();
			else if (mode === 'retrieval') runRetrieval();
			else if (mode === 'export') runExport();
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

		// Try to pick up explicit local + Airtable ids from <main>,
		// but fall back to whatever was previously used so behaviour stays stable.
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

		var active = (location.hash || '').replace(/^#/, '') || 'journal-entries';
		onTabShown(active);
		document.addEventListener('tab:shown', e => onTabShown(e?.detail?.id || ''));
	});
})();