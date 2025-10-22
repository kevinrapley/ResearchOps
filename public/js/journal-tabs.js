/**
 * @file /js/journal-tabs.js
 * @description Journals page: tab-specific rendering and interactions.
 * - Renders Journal entries (filters, edit/delete, link to full view)
 * - Renders Codes (add form, Coloris, parent select)
 * - Renders Memos (filters, add form)
 * - Bridges Analysis buttons to CAQDAS (data/analysis-only) module
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
		var d = document.createElement('div');
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
		if (asHtml) {
			el.innerHTML = msg;
		} else {
			el.textContent = msg;
		}
	}

	function fetchJSON(url, init) {
		return fetch(url, init).then(function(res) {
			return res.text().then(function(txt) {
				var ct = (res.headers.get('content-type') || '').toLowerCase();
				var body = ct.indexOf('application/json') >= 0 ? (txt ? JSON.parse(txt) : {}) : {};
				if (!res.ok) {
					var err = new Error('HTTP ' + res.status + (txt ? ' — ' + txt : ''));
					err.response = body;
					throw err;
				}
				return body;
			});
		});
	}

	// ---------- state ----------
	var state = {
		projectId: '',
		entries: [],
		entryFilter: 'all',
		codes: [],
		memos: [],
		memoFilter: 'all'
	};

	// ---------- ROUTES ----------
	var ROUTES = {
		viewEntry: function(id) { return '/pages/journal/entry?id=' + encodeURIComponent(id); },
		editEntry: function(id) { return '/pages/journal/edit?id=' + encodeURIComponent(id); }
	};

	// ---------- JOURNAL ----------
	function loadEntries() {
		if (!state.projectId) return Promise.resolve();
		var url = '/api/journal-entries?project=' + encodeURIComponent(state.projectId);
		return fetchJSON(url).then(function(data) {
			var arr = Array.isArray(data && data.entries) ? data.entries : (Array.isArray(data) ? data : []);
			state.entries = arr.map(function(e) {
				var tags = e && e.tags;
				if (!Array.isArray(tags)) {
					var raw = String(e && e.tags ? e.tags : '');
					tags = raw ? raw.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
				}
				return {
					id: e.id,
					category: e.category || '—',
					content: e.content != null ? e.content : (e.body || ''),
					tags: tags,
					createdAt: e.createdAt || e.created_at || ''
				};
			});
			renderEntries();
		}).catch(function(err) {
			console.error('loadEntries', err);
			state.entries = [];
			renderEntries();
			flash('Could not load journal entries.');
		});
	}

	function currentEntryFilter() {
		return String(state.entryFilter || 'all').toLowerCase();
	}

	function renderEntries() {
		var wrap = document.getElementById('entries-container');
		var empty = document.getElementById('empty-journal');
		if (!wrap) return;

		var filter = currentEntryFilter();
		var list = state.entries.filter(function(en) {
			if (filter === 'all') return true;
			return String(en.category || '').toLowerCase() === filter;
		});

		if (!list.length) {
			wrap.innerHTML = '';
			if (empty) empty.hidden = false;
			return;
		}
		if (empty) empty.hidden = true;

		var html = list.map(function(en) {
			var snippet = truncateWords(en.content || '', 200);
			var wasShortened = snippet.length < String(en.content || '').trim().length;
			var tagsHTML = (en.tags || []).map(function(t) {
				return '<span class="tag" aria-label="Tag: ' + esc(t) + '">' + esc(t) + '</span>';
			}).join('');

			return '' +
				'<article class="entry-card" data-id="' + esc(en.id) + '" data-category="' + esc(en.category) + '">' +
				'  <header class="entry-header">' +
				'    <div class="entry-meta">' +
				'      <a class="entry-link" href="' + ROUTES.viewEntry(en.id) + '" aria-label="Open journal entry">' +
				'        <span class="entry-category-badge" data-category="' + esc(en.category) + '">' + esc(en.category) + '</span>' +
				'        <span class="entry-timestamp">' + when(en.createdAt) + '</span>' +
				'      </a>' +
				'    </div>' +
				'    <div class="entry-actions" role="group" aria-label="Entry actions">' +
				'      <a class="btn-quiet" href="' + ROUTES.editEntry(en.id) + '" aria-label="Edit entry">Edit</a>' +
				'      <button class="btn-quiet danger" data-act="delete" data-id="' + esc(en.id) + '" aria-label="Delete entry">Delete</button>' +
				'    </div>' +
				'  </header>' +
				'  <div class="entry-content">' +
				esc(snippet) + (wasShortened ? ' <a class="read-more" href="' + ROUTES.viewEntry(en.id) + '" aria-label="Read full entry">Read full entry</a>' : '') +
				'  </div>' +
				'  <div class="entry-tags" aria-label="Tags">' + tagsHTML + '</div>' +
				'</article>';
		}).join('');
		wrap.innerHTML = html;

		$all('[data-act="delete"]', wrap).forEach(function(btn) {
			btn.addEventListener('click', onDeleteEntry);
		});
	}

	function onDeleteEntry(e) {
		var id = e.currentTarget && e.currentTarget.getAttribute('data-id');
		if (!id) return;
		if (!confirm('Delete this entry?')) return;
		var url = '/api/journal-entries/' + encodeURIComponent(id);
		fetchJSON(url, { method: 'DELETE' }).then(function() {
			flash('Entry deleted.');
			return loadEntries();
		}).catch(function() {
			flash('Could not delete entry.');
		});
	}

	function setupEntryAddForm() {
		var formWrap = document.getElementById('entry-form');
		var form = document.getElementById('add-entry-form');
		var btnShow = document.getElementById('new-entry-btn');
		var btnCancel = document.getElementById('cancel-form-btn');

		function toggle(show) {
			if (!formWrap) return;
			var s = typeof show === 'boolean' ? show : formWrap.hidden;
			formWrap.hidden = !s;
			if (s) {
				var t = document.getElementById('entry-content');
				if (t) t.focus();
			}
		}

		if (btnShow) btnShow.addEventListener('click', function(e) {
			e.preventDefault();
			toggle();
		});
		if (btnCancel) btnCancel.addEventListener('click', function(e) {
			e.preventDefault();
			toggle(false);
		});

		if (form) {
			form.addEventListener('submit', function(e) {
				e.preventDefault();
				var fd = new FormData(form);
				var payload = {
					project: state.projectId,
					project_airtable_id: state.projectId,
					category: String(fd.get('category') || ''),
					content: String(fd.get('content') || ''),
					tags: String(fd.get('tags') || '')
				};
				if (!payload.category || !payload.content) {
					flash('Category and content are required.');
					return;
				}
				var parts = payload.tags ? payload.tags.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [];
				var body = {
					project: payload.project,
					project_airtable_id: payload.project_airtable_id,
					category: payload.category,
					content: payload.content,
					tags: parts
				};

				fetchJSON('/api/journal-entries', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				}).then(function() {
					form.reset();
					toggle(false);
					flash('Entry saved.');
					return loadEntries();
				}).catch(function(err) {
					console.error('add-entry', err);
					flash('Could not save entry.');
				});
			});
		}
	}

	function setupEntryFilters() {
		var container = document.querySelector('#journal-entries-panel .filter-chips');
		if (!container) return;

		var active = container.querySelector('.filter-chip--active');
		state.entryFilter = active && active.dataset ? String(active.dataset.filter || 'all').toLowerCase() : 'all';

		$all('.filter-chip', container).forEach(function(b) {
			b.setAttribute('role', 'button');
			b.setAttribute('aria-pressed', b.classList.contains('filter-chip--active') ? 'true' : 'false');
			if (!b.hasAttribute('tabindex')) b.tabIndex = 0;
		});

		function activate(btn) {
			$all('.filter-chip', container).forEach(function(x) {
				x.classList.remove('filter-chip--active');
				x.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('filter-chip--active');
			btn.setAttribute('aria-pressed', 'true');
			state.entryFilter = String(btn.dataset.filter || 'all').toLowerCase();
			renderEntries();
		}

		container.addEventListener('click', function(e) {
			var btn = e.target && e.target.closest ? e.target.closest('.filter-chip') : null;
			if (!btn) return;
			e.preventDefault();
			activate(btn);
		});

		container.addEventListener('keydown', function(e) {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			var btn = e.target && e.target.closest ? e.target.closest('.filter-chip') : null;
			if (!btn) return;
			e.preventDefault();
			activate(btn);
		});
	}

	// ---------- CODES ----------
	function ensureCodeForm() {
		var form = document.getElementById('code-form');
		if (form) return form;
		var host = document.getElementById('codes-panel') || document.getElementById('codes');
		if (!host) return null;

		form = document.createElement('form');
		form.id = 'code-form';
		form.hidden = true;
		form.noValidate = true;
		form.innerHTML =
			'<div class="govuk-form-group">' +
			'  <label class="govuk-label" for="code-name">Code name</label>' +
			'  <input class="govuk-input" id="code-name" name="name" required />' +
			'</div>' +

			'<div class="govuk-form-group">' +
			'  <label class="govuk-label" for="code-colour">Colour</label>' +
			'  <input class="govuk-input" id="code-colour" name="colour" data-coloris value="#1d70b8ff" />' +
			'</div>' +

			'<div class="govuk-form-group" id="code-parent-wrap" hidden>' +
			'  <label class="govuk-label" for="code-parent">Parent code (optional)</label>' +
			'  <select class="govuk-select" id="code-parent" name="parent">' +
			'    <option value="">— None —</option>' +
			'  </select>' +
			'</div>' +

			'<div class="govuk-form-group">' +
			'  <label class="govuk-label" for="code-description">Description</label>' +
			'  <textarea class="govuk-textarea" id="code-description" name="description" rows="3"></textarea>' +
			'</div>' +

			'<div class="govuk-button-group">' +
			'  <button id="save-code-btn" class="govuk-button" type="submit">Save</button>' +
			'  <button id="cancel-code-btn" class="govuk-button govuk-button--secondary" type="button">Cancel</button>' +
			'</div>';
		host.appendChild(form);

		if (window.Coloris) {
			window.Coloris({
				el: '#code-colour',
				alpha: true,
				forceAlpha: true,
				format: 'hex',
				themeMode: 'light',
				wrap: true
			});
		}
		return form;
	}

	function refreshParentSelector() {
		var wrap = document.getElementById('code-parent-wrap');
		var sel = document.getElementById('code-parent');
		if (!wrap || !sel) return;

		var hasCodes = Array.isArray(state.codes) && state.codes.length > 0;
		wrap.hidden = !hasCodes;

		var options = ['<option value="">— None —</option>'];
		for (var i = 0; i < state.codes.length; i += 1) {
			var c = state.codes[i];
			options.push('<option value="' + esc(c.id) + '">' + esc(c.name || c.id) + '</option>');
		}
		sel.innerHTML = options.join('');
	}

	function loadCodes() {
		if (!state.projectId) return Promise.resolve();
		var url = '/api/codes?project=' + encodeURIComponent(state.projectId);
		return fetchJSON(url).then(function(data) {
			state.codes = Array.isArray(data && data.codes) ? data.codes : [];
			renderCodes();
			refreshParentSelector();
		}).catch(function(e) {
			console.error('loadCodes', e);
			renderCodes(true);
			flash('Could not load codes.');
		});
	}

	// ---------- CODES (helpers for tree rendering) ----------
	function buildCodeTree(list) {
		// index by id
		var byId = Object.create(null);
		list.forEach(function(c) {
			byId[c.id] = {
				id: c.id,
				name: c.name || '—',
				description: c.description || '',
				colour: c.colour || c.color || '#1d70b8ff',
				parentId: c.parentId || null,
				children: []
			};
		});
		// link children
		Object.keys(byId).forEach(function(id) {
			var node = byId[id];
			if (node.parentId && byId[node.parentId]) {
				byId[node.parentId].children.push(node);
			}
		});
		// roots = items without valid parent
		var roots = [];
		Object.keys(byId).forEach(function(id) {
			var node = byId[id];
			if (!node.parentId || !byId[node.parentId]) roots.push(node);
		});
		return roots;
	}

	function renderCodeNode(node, level) {
		var indentPx = Math.max(0, (level - 1) * 16); // visual indent per level
		var hasKids = node.children && node.children.length > 0;

		var html =
			'<li role="treeitem" aria-level="' + level + '" aria-expanded="' + (hasKids ? 'true' : 'false') + '">' +
			'  <div class="code-node" style="margin-left:' + indentPx + 'px">' +
			'    <span class="code-swatch" style="background-color:' + toHex8(node.colour) + ';"></span>' +
			'    <strong class="code-name">' + esc(node.name) + '</strong>' +
			(node.description ? '    <div class="code-desc">' + esc(node.description) + '</div>' : '') +
			'  </div>';

		if (hasKids) {
			html += '<ul role="group">';
			for (var i = 0; i < node.children.length; i += 1) {
				html += renderCodeNode(node.children[i], level + 1);
			}
			html += '</ul>';
		}

		html += '</li>';
		return html;
	}

	// ---------- CODES (render) ----------
	function renderCodes(error) {
		var wrap = document.getElementById('codes-container');
		if (!wrap) return;
		if (error) { wrap.innerHTML = '<p>Could not load codes.</p>'; return; }
		if (!state.codes.length) { wrap.innerHTML = '<p>No codes yet.</p>'; return; }

		var roots = buildCodeTree(state.codes);

		var html = '' +
			'<div class="codebook-tree" aria-label="Codebook hierarchy">' +
			'  <ul class="code-tree" role="tree">' +
			roots.map(function(n) { return renderCodeNode(n, 1); }).join('') +
			'  </ul>' +
			'</div>';

		wrap.innerHTML = html;
	}

	function setupCodeAdd() {
		var btn = document.getElementById('new-code-btn');
		var form = ensureCodeForm();
		var nameEl = document.getElementById('code-name');
		var colourEl = document.getElementById('code-colour');
		var descEl = document.getElementById('code-description');
		var parentSel = document.getElementById('code-parent');
		var cancelBtn = document.getElementById('cancel-code-btn');

		function showForm(show) {
			if (!form) return;
			form.hidden = !show;
			if (show) {
				refreshParentSelector();
				if (nameEl) nameEl.focus();
			}
		}

		if (btn) btn.addEventListener('click', function(e) {
			e.preventDefault();
			showForm(form ? form.hidden : true);
		});
		if (cancelBtn) cancelBtn.addEventListener('click', function(e) {
			e.preventDefault();
			showForm(false);
		});
		if (!form) return;

		form.addEventListener('submit', function(e) {
			e.preventDefault();

			var name = nameEl ? String(nameEl.value || '').trim() : '';
			if (!name) { flash('Please enter a code name.'); return; }

			var hex8 = toHex8(colourEl ? colourEl.value : '#1d70b8');
			var parentId = parentSel ? String(parentSel.value || '').trim() : '';
			if (!parentId) parentId = null;

			var body = {
				name: name,
				projectId: state.projectId,
				colour: hex8,
				description: descEl ? String(descEl.value || '').trim() : ''
			};
			if (parentId) body.parentId = parentId;

			fetchJSON('/api/codes?diag=1', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			}).then(function() {
				if (nameEl) nameEl.value = '';
				if (colourEl) colourEl.value = '#1d70b8ff';
				if (descEl) descEl.value = '';
				if (parentSel) parentSel.value = '';
				showForm(false);
				flash('Code &ldquo;' + name + '&rdquo; created.', true);
				return loadCodes();
			}).catch(function(err) {
				console.error('[codes] POST failed:', err);
				flash('Could not create code (see console for diagnostics).');
			});
		});
	}

	// ---------- MEMOS ----------
	function loadMemos() {
		if (!state.projectId) return Promise.resolve();
		var url = '/api/memos?project=' + encodeURIComponent(state.projectId);
		return fetchJSON(url).then(function(data) {
			state.memos = Array.isArray(data && data.memos) ? data.memos : [];
			renderMemos();
		}).catch(function(e) {
			console.error('loadMemos', e);
			renderMemos(true);
		});
	}

	function currentMemoFilter() {
		return String(state.memoFilter || 'all').toLowerCase();
	}

	function renderMemos(error) {
		var wrap = document.getElementById('memos-container');
		if (!wrap) return;
		if (error) { wrap.innerHTML = '<p>Could not load memos.</p>'; return; }

		var filter = currentMemoFilter();
		var items = state.memos.filter(function(m) {
			if (filter === 'all') return true;
			var t = String(m.memoType || m.type || '').toLowerCase();
			return t === filter;
		});

		if (!items.length) { wrap.innerHTML = '<p>No memos yet.</p>'; return; }

		var html = items.map(function(m) {
			return '' +
				'<article class="memo-card" data-id="' + esc(m.id || '') + '">' +
				'  <header class="memo-header">' +
				'    <strong>' + esc(m.title || m.memoType || 'Memo') + '</strong>' +
				'    <time>' + when(m.createdAt) + '</time>' +
				'  </header>' +
				(m.title ? '<p class="memo-title">' + esc(m.title) + '</p>' : '') +
				'  <p>' + esc(m.content || '') + '</p>' +
				'</article>';
		}).join('');
		wrap.innerHTML = html;
	}

	function setupMemoAddForm() {
		var form = document.getElementById('memo-form');
		if (!form) {
			var host = document.getElementById('memos-panel') || document.getElementById('memos');
			if (!host) return;
			form = document.createElement('form');
			form.id = 'memo-form';
			form.hidden = true;
			form.noValidate = true;
			form.innerHTML =
				'<div class="govuk-form-group">' +
				'  <label class="govuk-label" for="memo-type">Memo type</label>' +
				'  <select class="govuk-select" id="memo-type" name="memo_type">' +
				'    <option value="analytical">Analytical</option>' +
				'    <option value="methodological">Methodological</option>' +
				'    <option value="theoretical">Theoretical</option>' +
				'    <option value="reflexive">Reflexive</option>' +
				'  </select>' +
				'</div>' +
				'<div class="govuk-form-group">' +
				'  <label class="govuk-label" for="memo-title">Title (optional)</label>' +
				'  <input class="govuk-input" id="memo-title" name="title" />' +
				'</div>' +
				'<div class="govuk-form-group">' +
				'  <label class="govuk-label" for="memo-content">Content</label>' +
				'  <textarea class="govuk-textarea" id="memo-content" name="content" rows="4" required></textarea>' +
				'</div>' +
				'<div class="govuk-button-group">' +
				'  <button id="save-memo-btn" class="govuk-button" type="submit">Save</button>' +
				'  <button id="cancel-memo-btn" class="govuk-button govuk-button--secondary" type="button">Cancel</button>' +
				'  </div>';
			host.appendChild(form);
		}

		var newBtn = document.getElementById('new-memo-btn');
		var cancelBtn = document.getElementById('cancel-memo-btn');

		function toggleForm(show) {
			if (!form) return;
			var s = typeof show === 'boolean' ? show : form.hidden;
			form.hidden = !s ? true : false;
			if (s) {
				var t = form.querySelector('#memo-content');
				if (t) t.focus();
			}
		}

		if (newBtn) newBtn.addEventListener('click', function(e) {
			e.preventDefault();
			toggleForm(true);
		});
		if (cancelBtn) cancelBtn.addEventListener('click', function(e) {
			e.preventDefault();
			toggleForm(false);
		});

		form.addEventListener('submit', function(e) {
			e.preventDefault();
			var type = String($('#memo-type').value || 'analytical');
			var title = String($('#memo-title').value || '');
			var content = String($('#memo-content').value || '');
			if (!content.trim()) { flash('Content is required.'); return; }

			var body = {
				project_id: state.projectId,
				memo_type: type,
				title: title,
				content: content
			};

			fetchJSON('/api/memos', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			}).then(function() {
				form.reset();
				toggleForm(false);
				flash('Memo created.');
				return loadMemos();
			}).catch(function() {
				flash('Could not create memo.');
			});
		});
	}

	function setupMemoFilters() {
		var container = document.querySelector('#memos-panel .filter-chips');
		if (!container) return;

		var active = container.querySelector('.filter-chip--active');
		state.memoFilter = active && active.dataset ? String(active.dataset.memoFilter || 'all').toLowerCase() : 'all';

		$all('.filter-chip', container).forEach(function(b) {
			b.setAttribute('role', 'button');
			b.setAttribute('aria-pressed', b.classList.contains('filter-chip--active') ? 'true' : 'false');
			if (!b.hasAttribute('tabindex')) b.tabIndex = 0;
		});

		function activate(btn) {
			$all('.filter-chip', container).forEach(function(x) {
				x.classList.remove('filter-chip--active');
				x.setAttribute('aria-pressed', 'false');
			});
			btn.classList.add('filter-chip--active');
			btn.setAttribute('aria-pressed', 'true');
			state.memoFilter = String(btn.dataset.memoFilter || 'all').toLowerCase();
			renderMemos();
		}

		container.addEventListener('click', function(e) {
			var btn = e.target && e.target.closest ? e.target.closest('.filter-chip') : null;
			if (!btn) return;
			e.preventDefault();
			activate(btn);
		});

		container.addEventListener('keydown', function(e) {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			var btn = e.target && e.target.closest ? e.target.closest('.filter-chip') : null;
			if (!btn) return;
			e.preventDefault();
			activate(btn);
		});
	}

	// ---------- ANALYSIS (bridge to CAQDAS) ----------
	function setupAnalysisButtons() {
		var panel = document.getElementById('analysis-panel') || document;
		panel.addEventListener('click', function(e) {
			var t = e.target && e.target.closest ? e.target.closest('[data-analysis]') : null;
			if (!t) return;
			e.preventDefault();
			var mode = t.getAttribute('data-analysis');
			if (mode === 'timeline') { runTimeline(state.projectId); return; }
			if (mode === 'co-occurrence') { runCooccurrence(state.projectId); return; }
			if (mode === 'retrieval') { runRetrieval(state.projectId); return; }
			if (mode === 'export') { runExport(state.projectId); return; }
		});
	}

	// ---------- TAB lifecycle ----------
	function onTabShown(id) {
		if (id === 'journal-entries') loadEntries();
		if (id === 'codes') loadCodes();
		if (id === 'memos') loadMemos();
		// analysis: button-driven
	}

	// ---------- boot ----------
	document.addEventListener('DOMContentLoaded', function() {
		var url = new URL(location.href);
		state.projectId = url.searchParams.get('project') || url.searchParams.get('id') || '';

		setupEntryAddForm();
		setupEntryFilters();

		setupCodeAdd();

		setupMemoAddForm();
		setupMemoFilters();

		setupAnalysisButtons();

		var active = (location.hash || '').replace(/^#/, '') || 'journal-entries';
		onTabShown(active);

		document.addEventListener('tab:shown', function(e) {
			var id = e && e.detail ? e.detail.id : '';
			if (id) onTabShown(id);
		});
	});
})();
