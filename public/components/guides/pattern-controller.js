/**
 * @file pattern-controller.js
 * @module GuidesPatternController
 * @summary Pattern drawer, tray and partial-management behaviours for discussion guides.
 */

export function createPatternController(deps) {
	const {
		$,
		announce,
		closeTagDialog,
		closeVariablesDrawer,
		escapeHtml,
		fetchJSON,
		insertAtCursor,
		listStarterPatterns,
		preview,
		revealDrawer,
		syncHighlighting,
	} = deps;

	let patternServiceAvailable = false;
	let patternCache = [];

	function setPatternStatus(msg) {
		const drawer = document.getElementById('drawer-patterns');
		const list = document.getElementById('pattern-list');
		if (!drawer || !list) {
			console.warn('[patterns] status:', msg);
			return;
		}

		let p = document.getElementById('pattern-status');
		if (!p) {
			p = document.createElement('p');
			p.id = 'pattern-status';
			p.className = 'govuk-warning-text pattern-status';
			list.parentNode.insertBefore(p, list);
		}

		p.innerHTML = msg
			? `<span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span>${escapeHtml(msg)}</strong>`
			: '';
	}

	async function refreshPatternList() {
		const urls = ['/api/partials', '/api/patterns'];

		for (const url of urls) {
			try {
				const data = await fetchJSON(
					url,
					{ headers: { Accept: 'application/json' } },
					{ allowHeuristics: false }
				);
				const partials = Array.isArray(data?.partials)
					? data.partials
					: Array.isArray(data)
						? data
						: [];

				if (partials.length) {
					patternServiceAvailable = true;
					setCreatePatternVisibility(true);
					populatePatternList(partials);
					setPatternStatus('');
					return;
				}

				console.warn(`refreshPatternList: ${url} returned empty JSON array`);
			} catch (e) {
				console.warn(`refreshPatternList: ${url} failed`, e.message);
			}
		}

		try {
			let starters = [];
			const maybe = typeof listStarterPatterns === 'function' ? listStarterPatterns() : [];
			starters = maybe && typeof maybe.then === 'function' ? await maybe : maybe;

			if (Array.isArray(starters) && starters.length) {
				patternServiceAvailable = false;
				setCreatePatternVisibility(false);
				populatePatternList(starters);
				setPatternStatus('Pattern service unavailable — showing local starter patterns.');
				return;
			}
		} catch (e) {
			console.warn('refreshPatternList: starter fallback failed', e);
		}

		patternServiceAvailable = false;
		setCreatePatternVisibility(false);
		populatePatternList([]);
		setPatternStatus('No patterns available (API returned HTML).');
	}

	function setCreatePatternVisibility(isVisible) {
		const button = $('#btn-new-pattern');
		if (!button) return;
		button.hidden = !isVisible;
	}

	function openPatternDrawer() {
		closeVariablesDrawer();
		closeTagDialog();

		const drawer = $('#drawer-patterns');
		if (drawer) {
			revealDrawer(drawer, $('#pattern-search'));
		}

		const ul = $('#pattern-list');
		const needsLoad =
			!ul ||
			ul.children.length === 0 ||
			(ul.children.length === 1 && ul.firstElementChild?.classList.contains('muted'));
		if (needsLoad) {
			refreshPatternList();
		}

		announce('Pattern drawer opened');
	}

	function closePatternDrawer() {
		$('#drawer-patterns')?.setAttribute('hidden', 'true');
		$('#btn-insert-pattern')?.focus();
		announce('Pattern drawer closed');
	}

	function populatePatternList(items) {
		const ul = $('#pattern-list');
		if (!ul) return;
		ul.innerHTML = '';

		const arr = Array.isArray(items) ? items : [];
		patternCache = arr.slice();

		if (!arr.length) {
			const li = document.createElement('li');
			li.className = 'govuk-body muted';
			li.textContent = 'No patterns found.';
			ul.appendChild(li);

			ul.removeEventListener('click', handlePatternClick);
			ul.addEventListener('click', handlePatternClick);
			bindPatternListActions(ul);
			return;
		}

		const grouped = {};
		for (const p of arr) {
			const cat = formatPatternCategory(p.category);
			if (!grouped[cat]) grouped[cat] = [];
			grouped[cat].push(p);
		}

		for (const [cat, patterns] of Object.entries(grouped)) {
			const header = document.createElement('li');
			header.className = 'pattern-category-header';
			header.innerHTML = `<h3 class="govuk-heading-s pattern-category-header__heading">${escapeHtml(cat)}</h3>`;
			ul.appendChild(header);

			for (const p of patterns) {
				const li = document.createElement('li');
				li.className = 'pattern-item';
				const insertName = patternPartialName(p);

				li.innerHTML = `
        <div class="pattern-item__content">
          <div class="pattern-item__title">
            <h4 class="govuk-heading-s">${escapeHtml(p.title)}</h4>
            <p class="govuk-body-s muted">Partial <code>${escapeHtml(insertName)}</code></p>
          </div>
          <button class="govuk-button govuk-button--secondary" type="button" data-insert="${escapeHtml(insertName)}" onclick="window.__researchOpsHandlePatternClick(event)">
            Add to guide
          </button>
        </div>
        <div class="govuk-button-group pattern-item__actions">
          <button class="govuk-button govuk-button--secondary pattern-action-button" type="button" data-view="${escapeHtml(p.name)}">View</button>
          <button class="govuk-button govuk-button--secondary pattern-action-button" type="button" data-edit="${escapeHtml(p.name)}">Edit</button>
          <button class="govuk-button govuk-button--warning pattern-action-button" type="button" data-delete="${escapeHtml(p.name)}">Delete</button>
        </div>
      `;
				ul.appendChild(li);
			}
		}

		ul.removeEventListener('click', handlePatternClick);
		ul.addEventListener('click', handlePatternClick);
		bindPatternListActions(ul);
	}

	function formatPatternCategory(category) {
		const raw = String(category || 'Uncategorised').trim() || 'Uncategorised';
		const spaced = raw.replace(/[-_]+/g, ' ');
		const capitalised = spaced.charAt(0).toUpperCase() + spaced.slice(1);
		return /\bpatterns$/i.test(capitalised) ? capitalised : `${capitalised} patterns`;
	}

	function patternPartialName(pattern) {
		const name = String(pattern?.name || '').trim();
		const version = String(pattern?.version || '').trim();
		if (!name || !version || new RegExp(`_v${version}$`, 'i').test(name)) {
			return name;
		}
		return `${name}_v${version}`;
	}

	function bindPatternListActions(ul) {
		ul.querySelectorAll('button').forEach((button) => {
			button.addEventListener('click', handlePatternClick);
		});
	}

	function bindPatternDocumentActions() {
		if (document.documentElement.dataset.patternActionsBound === 'true') return;
		document.documentElement.dataset.patternActionsBound = 'true';
		document.addEventListener('click', (event) => {
			const button = event.target.closest('#drawer-patterns button');
			if (!button) return;

			const saveName = button.getAttribute('data-save-local-pattern');
			if (saveName) {
				event.preventDefault();
				const pattern = findPattern(saveName);
				if (pattern) {
					pattern.source =
						button.closest('.govuk-details__text')?.querySelector('textarea')?.value || '';
					if (window.__patternRegistry) window.__patternRegistry[pattern.name] = pattern.source;
				}
				populatePatternList(patternCache);
				announce('Pattern saved');
				return;
			}

			const deleteName = button.getAttribute('data-confirm-delete-local-pattern');
			if (deleteName) {
				event.preventDefault();
				patternCache = (patternCache || []).filter((pattern) => pattern.name !== deleteName);
				if (window.__patternRegistry) delete window.__patternRegistry[deleteName];
				populatePatternList(patternCache);
				announce('Pattern deleted');
				return;
			}

			if (
				button.dataset.insert ||
				button.dataset.view ||
				button.dataset.edit ||
				button.dataset.delete ||
				button.id === 'btn-new-pattern'
			) {
				handlePatternClick(event);
			}
		});
	}

	async function handlePatternClick(e) {
		e.preventDefault();
		e.stopPropagation();
		const t = e.target.closest('button');
		if (!t) return;

		if (t.dataset.insert) {
			const name = t.dataset.insert;
			insertAtCursor($('#guide-source'), `\n{{> ${name}}}\n`);
			syncHighlighting();
			await preview();
			closePatternDrawer();
			announce(`Pattern ${name} inserted`);
			return;
		}

		if (t.dataset.view) {
			const pattern = findPattern(t.dataset.view);
			if (pattern?.isLocal) {
				viewLocalPattern(pattern, t);
				return;
			}
			await viewPartial(t.dataset.view);
			return;
		}
		if (t.dataset.edit) {
			const pattern = findPattern(t.dataset.edit);
			if (pattern?.isLocal) {
				editLocalPattern(pattern, t);
				return;
			}
			await editPartial(t.dataset.edit);
			return;
		}
		if (t.dataset.delete) {
			const pattern = findPattern(t.dataset.delete);
			if (pattern?.isLocal) {
				deleteLocalPattern(pattern, t);
				return;
			}
			await deletePartial(t.dataset.delete);
			return;
		}

		if (t.id === 'btn-new-pattern') {
			if (!patternServiceAvailable) return;
			await createNewPartial();
		}
	}

	window.__researchOpsHandlePatternClick = handlePatternClick;

	function findPattern(idOrName) {
		return (patternCache || []).find(
			(pattern) =>
				String(pattern.id || '') === String(idOrName) ||
				String(pattern.name || '') === String(idOrName)
		);
	}

	function getPatternTray() {
		let tray = $('#pattern-tray');
		if (!tray) {
			tray = document.createElement('div');
			tray.id = 'pattern-tray';
			tray.className = 'pattern-tray';
			tray.hidden = true;
			$('#drawer-patterns')?.appendChild(tray);
		}
		return tray;
	}

	function renderPatternTray(html, origin) {
		const tray = getPatternTray();
		tray.innerHTML = html;
		tray.hidden = false;
		const patternItem = origin?.closest?.('.pattern-item');
		if (patternItem) {
			patternItem.appendChild(tray);
		}
		tray.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		tray.querySelector('button, input, textarea, [href]')?.focus({ preventScroll: true });
	}

	function closePatternTray() {
		const tray = getPatternTray();
		if (!tray) return;
		tray.hidden = true;
		tray.innerHTML = '';
	}

	function viewLocalPattern(pattern, origin) {
		renderPatternTray(
			`
		<h3 class="govuk-heading-s">${escapeHtml(pattern.title)}</h3>
		<dl class="govuk-summary-list">
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Partial</dt>
				<dd class="govuk-summary-list__value"><code>${escapeHtml(patternPartialName(pattern))}</code></dd>
			</div>
			<div class="govuk-summary-list__row">
				<dt class="govuk-summary-list__key">Category</dt>
				<dd class="govuk-summary-list__value">${escapeHtml(pattern.category || 'Uncategorised')}</dd>
			</div>
		</dl>
		<h4 class="govuk-heading-s">Pattern source</h4>
		<pre class="govuk-body pattern-tray__source"><code>${escapeHtml(pattern.source || '')}</code></pre>
		<div class="govuk-button-group">
			<button class="govuk-button govuk-button--secondary" type="button" data-pattern-tray-close>Close pattern</button>
		</div>
	`,
			origin
		);
	}

	function editLocalPattern(pattern, origin) {
		renderPatternTray(
			`
		<h3 class="govuk-heading-s">Edit ${escapeHtml(pattern.title)}</h3>
		<div class="govuk-form-group">
			<label class="govuk-label govuk-label--s" for="local-pattern-source">Pattern source</label>
			<textarea class="govuk-textarea" id="local-pattern-source" rows="8">${escapeHtml(pattern.source || '')}</textarea>
		</div>
		<div class="govuk-button-group">
			<button class="govuk-button" type="button" data-save-local-pattern="${escapeHtml(pattern.name)}">Save pattern</button>
			<button class="govuk-button govuk-button--secondary" type="button" data-pattern-tray-close>Cancel</button>
		</div>
	`,
			origin
		);
	}

	function deleteLocalPattern(pattern, origin) {
		const confirmationId = `delete-pattern-confirmation-${escapeHtml(pattern.name)}`;
		renderPatternTray(
			`
		<h3 class="govuk-heading-s">Delete ${escapeHtml(pattern.title)}</h3>
		<p class="govuk-body">This removes the local starter pattern from this editor session.</p>
		<div class="govuk-form-group">
			<label class="govuk-label govuk-label--s" for="${confirmationId}">Confirm deletion</label>
			<div id="${confirmationId}-hint" class="govuk-hint">Type <strong>delete pattern</strong> to confirm you want to delete this pattern.</div>
			<input class="govuk-input govuk-input--width-20" id="${confirmationId}" name="${confirmationId}" type="text" spellcheck="false" autocomplete="off" aria-describedby="${confirmationId}-hint" data-delete-pattern-confirmation="${escapeHtml(pattern.name)}">
		</div>
		<div class="govuk-button-group">
			<button class="govuk-button govuk-button--warning" type="button" data-confirm-delete-local-pattern="${escapeHtml(pattern.name)}" disabled>Delete pattern</button>
			<button class="govuk-button govuk-button--secondary" type="button" data-pattern-tray-close>Cancel</button>
		</div>
	`,
			origin
		);
	}

	function bindPatternTrayActions() {
		const tray = $('#pattern-tray');
		if (!tray) return;
		tray.addEventListener('input', (e) => {
			const input = e.target.closest('[data-delete-pattern-confirmation]');
			if (!input) return;
			const patternName = input.getAttribute('data-delete-pattern-confirmation');
			const button = tray.querySelector(
				`[data-confirm-delete-local-pattern="${cssEscape(patternName)}"]`
			);
			if (button) {
				button.disabled = input.value.trim() !== 'delete pattern';
			}
		});
		tray.addEventListener('click', (e) => {
			const button = e.target.closest('button');
			if (!button) return;

			if (button.hasAttribute('data-pattern-tray-close')) {
				closePatternTray();
				$('#pattern-search')?.focus();
				return;
			}

			const saveName = button.getAttribute('data-save-local-pattern');
			if (saveName) {
				const pattern = findPattern(saveName);
				if (pattern) {
					pattern.source = $('#local-pattern-source')?.value || '';
					if (window.__patternRegistry) window.__patternRegistry[pattern.name] = pattern.source;
				}
				closePatternTray();
				populatePatternList(patternCache);
				announce('Pattern saved');
				return;
			}

			const deleteName = button.getAttribute('data-confirm-delete-local-pattern');
			if (deleteName) {
				const input = tray.querySelector(
					`[data-delete-pattern-confirmation="${cssEscape(deleteName)}"]`
				);
				if (input?.value.trim() !== 'delete pattern') {
					announce('Type "delete pattern" before deleting this pattern');
					input?.focus();
					return;
				}
				patternCache = (patternCache || []).filter((pattern) => pattern.name !== deleteName);
				if (window.__patternRegistry) delete window.__patternRegistry[deleteName];
				closePatternTray();
				populatePatternList(patternCache);
				announce('Pattern deleted');
			}
		});
	}

	function cssEscape(value) {
		if (window.CSS?.escape) return window.CSS.escape(String(value || ''));
		return String(value || '').replace(/["\\]/g, '\\$&');
	}

	async function viewPartial(id) {
		try {
			const data = await fetchJSON(`/api/partials/${encodeURIComponent(id)}`).catch(() => null);
			if (!data?.ok || !data?.partial) {
				announce('Failed to load partial: Invalid response');
				return;
			}
			const { partial } = data;

			const modal = document.createElement('dialog');
			modal.className = 'modal';
			modal.innerHTML = `
      <h2 class="govuk-heading-m">${escapeHtml(partial.title)}</h2>
      <dl class="govuk-summary-list">
        <div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Name:</dt><dd class="govuk-summary-list__value"><code>${escapeHtml(partial.name)}_v${partial.version}</code></dd></div>
        <div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Category:</dt><dd class="govuk-summary-list__value">${escapeHtml(partial.category)}</dd></div>
        <div class="govuk-summary-list__row"><dt class="govuk-summary-list__key">Status:</dt><dd class="govuk-summary-list__value">${escapeHtml(partial.status)}</dd></div>
      </dl>
      <h3 class="govuk-heading-s">Source</h3>
      <pre class="code code--readonly">${escapeHtml(partial.source)}</pre>
      ${partial.description ? `<h3 class="govuk-heading-s">Description</h3><p>${escapeHtml(partial.description)}</p>` : ''}
      <div class="modal-actions">
        <button class="btn btn--secondary" data-close>Close</button>
        <button class="btn" data-edit="${escapeHtml(id)}">Edit</button>
      </div>
    `;
			document.body.appendChild(modal);
			modal.showModal();

			modal.addEventListener('click', async (e) => {
				if (e.target.dataset.close || e.target === modal) {
					modal.close();
					modal.remove();
				}
				if (e.target.dataset.edit) {
					modal.close();
					modal.remove();
					await editPartial(e.target.dataset.edit);
				}
			});
		} catch (err) {
			console.error('Error in viewPartial:', err);
			announce('Failed to load partial: ' + err.message);
		}
	}

	async function editPartial(id) {
		try {
			const data = await fetchJSON(`/api/partials/${encodeURIComponent(id)}`).catch(() => null);
			if (!data?.ok || !data?.partial) {
				announce('Failed to load partial: Invalid response');
				return;
			}

			const { partial } = data;
			const modal = document.createElement('dialog');
			modal.className = 'modal';
			modal.innerHTML = `
      <h2 class="govuk-heading-m">Edit: ${escapeHtml(partial.title)}</h2>
      <form id="partial-edit-form">
        <div class="govuk-form-group">
          <label class="govuk-label" for="partial-title">Title</label>
          <input class="govuk-input" id="partial-title" value="${escapeHtml(partial.title)}" required />
        </div>
        <div class="govuk-form-group">
          <label class="govuk-label" for="partial-category">Category</label>
          <input class="govuk-input" id="partial-category" value="${escapeHtml(partial.category)}" />
        </div>
        <div class="govuk-form-group">
          <label class="govuk-label" for="partial-source">Source (Mustache)</label>
          <textarea class="code" id="partial-source" rows="15" required>${escapeHtml(partial.source)}</textarea>
        </div>
        <div class="govuk-form-group">
          <label class="govuk-label" for="partial-description">Description</label>
          <textarea class="govuk-textarea" id="partial-description" rows="3">${escapeHtml(partial.description || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn--secondary" data-cancel>Cancel</button>
          <button type="submit" class="btn">Save changes</button>
        </div>
      </form>
    `;
			document.body.appendChild(modal);
			modal.showModal();

			const form = modal.querySelector('#partial-edit-form');
			form.addEventListener('submit', async (e) => {
				e.preventDefault();

				const update = {
					title: document.getElementById('partial-title').value,
					category: document.getElementById('partial-category').value,
					source: document.getElementById('partial-source').value,
					description: document.getElementById('partial-description').value,
				};

				const updateRes = await fetch(`/api/partials/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify(update),
				});

				if (updateRes.ok) {
					announce('Partial updated');
					modal.close();
					modal.remove();
					await refreshPatternList();
				} else {
					const errorText = await updateRes.text();
					console.error('Update failed:', errorText);
					announce(`Update failed: ${updateRes.status}`);
				}
			});

			modal.querySelector('[data-cancel]').addEventListener('click', () => {
				modal.close();
				modal.remove();
			});
			modal.addEventListener('click', (e) => {
				if (e.target === modal) {
					modal.close();
					modal.remove();
				}
			});
		} catch (err) {
			console.error('Error in editPartial:', err);
			announce('Failed to load partial: ' + err.message);
		}
	}

	async function deletePartial(id) {
		if (!confirm('Are you sure you want to delete this pattern? This action cannot be undone.'))
			return;
		const res = await fetch(`/api/partials/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (res.ok) {
			announce('Pattern deleted');
			await refreshPatternList();
		} else {
			announce('Delete failed');
		}
	}

	async function createNewPartial() {
		const modal = document.createElement('dialog');
		modal.className = 'modal';
		modal.innerHTML = `
		<h2 class="govuk-heading-m">Create new pattern</h2>
		<form id="partial-create-form">
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-name">Name (no spaces)</label>
				<input class="govuk-input" id="new-partial-name" placeholder="task_consent" required />
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-title">Title</label>
				<input class="govuk-input" id="new-partial-title" placeholder="Consent task introduction" required />
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-category">Category</label>
				<select class="govuk-select" id="new-partial-category">
					<option>Consent</option>
					<option>Tasks</option>
					<option>Questions</option>
					<option>Debrief</option>
					<option>Notes</option>
					<option>Other</option>
				</select>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-source">Source (Mustache)</label>
				<textarea class="code" id="new-partial-source" rows="15" required>## {{title}}

Write your template here...</textarea>
			</div>
			<div class="govuk-form-group">
				<label class="govuk-label" for="new-partial-description">Description</label>
				<textarea class="govuk-textarea" id="new-partial-description" rows="3"></textarea>
			</div>
			<div class="modal-actions">
				<button type="button" class="btn btn--secondary" data-cancel>Cancel</button>
				<button type="submit" class="btn">Create pattern</button>
			</div>
		</form>
	`;
		document.body.appendChild(modal);
		modal.showModal();

		const form = modal.querySelector('#partial-create-form');
		form.addEventListener('submit', async (e) => {
			e.preventDefault();

			const newPartial = {
				name: document.getElementById('new-partial-name').value.replace(/\s+/g, '_').toLowerCase(),
				title: document.getElementById('new-partial-title').value,
				category: document.getElementById('new-partial-category').value,
				source: document.getElementById('new-partial-source').value,
				description: document.getElementById('new-partial-description').value,
				version: 1,
				status: 'draft',
			};

			const res = await fetch('/api/partials', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(newPartial),
			});

			if (res.ok) {
				announce('Pattern created');
				modal.close();
				modal.remove();
				await refreshPatternList();
			} else {
				const err = await res.json().catch(() => ({}));
				announce(`Create failed: ${err.error || 'Unknown error'}`);
			}
		});

		modal.querySelector('[data-cancel]').addEventListener('click', () => {
			modal.close();
			modal.remove();
		});
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				modal.close();
				modal.remove();
			}
		});
	}

	async function onPatternSearch(e) {
		const q = (e?.target?.value || '').trim().toLowerCase();
		if (!q) {
			populatePatternList(patternCache);
			return;
		}

		try {
			const filtered = (patternCache || []).filter((p) => {
				const s = `${p?.name ?? ''} ${p?.title ?? ''} ${p?.category ?? ''}`.toLowerCase();
				return s.includes(q);
			});
			populatePatternList(filtered);
		} catch (err) {
			console.error('Pattern search error:', err);
			populatePatternList([]);
		}
	}

	return {
		bindPatternDocumentActions,
		bindPatternTrayActions,
		closePatternDrawer,
		formatPatternCategory,
		openPatternDrawer,
		onPatternSearch,
		patternPartialName,
		populatePatternList,
		refreshPatternList,
		setCreatePatternVisibility,
	};
}
