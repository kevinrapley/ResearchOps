/**
 * @file caqdas-interface.js
 * @module CAQDASInterface
 * @summary Complete CAQDAS functionality for qualitative research.
 * @description
 * Integrates journal entries, coding, memos, and analysis tools
 * for comprehensive qualitative data analysis.
 */

/* =========================
 * Configuration
 * ========================= */

const CONFIG = Object.freeze({
	API_BASE: window.location.origin,
	TIMEOUT_MS: 10_000,
	CATEGORY_LABELS: {
		perceptions: 'Evolving perceptions',
		procedures: 'Day-to-day procedures',
		decisions: 'Methodological decision points',
		introspections: 'Personal introspections'
	},
	MEMO_TYPES: {
		analytical: 'Analytical',
		methodological: 'Methodological',
		theoretical: 'Theoretical',
		reflexive: 'Reflexive'
	}
});

/* =========================
 * State Management
 * ========================= */

const state = {
	projectId: null,
	currentTab: 'journal',
	entries: [],
	codes: [],
	memos: [],
	codeApplications: [],
	currentFilter: 'all',
	currentMemoFilter: 'all',
	formVisible: false,
	selectedText: null,
	selectedEntry: null,
	selectedCode: null
};

/* =========================
 * Utilities
 * ========================= */

async function fetchWithTimeout(url, init, timeoutMs = CONFIG.TIMEOUT_MS) {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(id);
	}
}

function showStatus(message, type, elementId = 'form-status') {
	const el = document.getElementById(elementId);
	if (!el) return;
	el.textContent = message;
	el.className = `status ${type === 'error' ? 'error-message' : 'success-message'}`;
	setTimeout(() => {
		el.textContent = '';
		el.className = 'status';
	}, 5000);
}

function getUrlParams() {
	const params = new URLSearchParams(window.location.search);
	return { id: params.get('id') };
}

function formatDatetime(isoString) {
	if (!isoString) return '—';
	try {
		const d = new Date(isoString);
		const now = new Date();
		const diffMs = now - d;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

		return d.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return isoString;
	}
}

function escapeHtml(str) {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}

/* =========================
 * Tab Management
 * ========================= */

function setupTabs() {
	const tabs = document.querySelectorAll('[role="tab"]');
	tabs.forEach(tab => {
		tab.addEventListener('click', (e) => {
			const tabId = e.target.id.replace('-tab', '');
			switchTab(tabId);
		});
	});
}

function switchTab(tabName) {
	state.currentTab = tabName;

	// Update tab states
	document.querySelectorAll('[role="tab"]').forEach(tab => {
		const isSelected = tab.id === `${tabName}-tab`;
		tab.setAttribute('aria-selected', isSelected);
	});

	// Update panel visibility
	document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
		panel.hidden = panel.id !== `${tabName}-panel`;
	});

	// Load data for the selected tab
	switch (tabName) {
		case 'journal':
			loadEntries();
			break;
		case 'codes':
			loadCodes();
			break;
		case 'memos':
			loadMemos();
			break;
		case 'analysis':
			loadAnalysis();
			break;
	}
}

/* =========================
 * Journal Functionality
 * ========================= */

async function loadEntries() {
	if (!state.projectId) return;

	try {
		const url = `${CONFIG.API_BASE}/api/journal-entries?project=${encodeURIComponent(state.projectId)}`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();
		state.entries = data.entries || [];

		// Load code applications for entries
		await loadCodeApplications();
		renderEntries();
	} catch (err) {
		console.error('Failed to load journal entries:', err);
		showStatus('Could not load journal entries', 'error');
	}
}

function renderEntries() {
	const container = document.getElementById('entries-container');
	if (!container) return;

	const filtered = state.currentFilter === 'all' ?
		state.entries :
		state.entries.filter(e => e.category === state.currentFilter);

	if (filtered.length === 0) {
		container.innerHTML = `
			<div class="empty-journal">
				<div class="empty-journal-icon" aria-hidden="true">📔</div>
				<p><strong>No entries yet</strong></p>
				<p>Start documenting your research journey by adding your first journal entry.</p>
			</div>
		`;
		return;
	}

	container.innerHTML = filtered.map(entry => {
		const codedSegments = state.codeApplications.filter(app => app.entry_id === entry.id);
		const relatedMemos = state.memos.filter(memo =>
			memo.linkedEntries && memo.linkedEntries.includes(entry.id)
		);

		return `
			<article class="entry-card" data-category="${entry.category}" data-id="${entry.id}">
				<div class="entry-header">
					<div class="entry-meta">
						<time class="entry-timestamp" datetime="${entry.createdAt}">
							${formatDatetime(entry.createdAt)}
						</time>
						${entry.author ? `<span class="entry-author">by ${escapeHtml(entry.author)}</span>` : ''}
					</div>
					<span class="entry-category-badge" data-category="${entry.category}">
						${CONFIG.CATEGORY_LABELS[entry.category] || entry.category}
					</span>
				</div>
				
				<div class="entry-content codeable-text" data-entry-id="${entry.id}">
					${renderCodeableText(entry.content, codedSegments)}
				</div>
				
				<div class="coding-status">
					<span class="coded-segments-count">
						${codedSegments.length} coded segment${codedSegments.length !== 1 ? 's' : ''}
					</span>
					${relatedMemos.length > 0 ? 
						`<span class="has-memos">📝 ${relatedMemos.length} memo${relatedMemos.length !== 1 ? 's' : ''}</span>` : 
						''
					}
				</div>
				
				${entry.tags && entry.tags.length > 0 ? `
					<div style="margin-top: var(--space-200);">
						${entry.tags.map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join(' ')}
					</div>
				` : ''}
				
				<div class="entry-actions">
					<button type="button" class="btn-secondary btn-icon code-entry" data-id="${entry.id}">
						Code
					</button>
					<button type="button" class="btn-secondary btn-icon add-memo" data-id="${entry.id}">
						Add Memo
					</button>
					<button type="button" class="btn-secondary btn-icon view-codes" data-id="${entry.id}">
						View Codes
					</button>
					<button type="button" class="btn-secondary btn-icon edit-entry" data-id="${entry.id}">
						Edit
					</button>
					<button type="button" class="btn-secondary btn-icon delete-entry" data-id="${entry.id}">
						Delete
					</button>
				</div>
			</article>
		`;
	}).join('');

	// Attach event listeners
	setupEntryEventListeners();
}

function renderCodeableText(content, codedSegments) {
	// Sort coded segments by position
	const sorted = [...codedSegments].sort((a, b) => a.start_pos - b.start_pos);

	if (sorted.length === 0) {
		return escapeHtml(content);
	}

	let html = '';
	let lastEnd = 0;

	sorted.forEach(segment => {
		// Add text before this segment
		if (segment.start_pos > lastEnd) {
			html += escapeHtml(content.substring(lastEnd, segment.start_pos));
		}

		// Add coded segment
		const code = state.codes.find(c => c.id === segment.code_id);
		const codeLabel = code ? code.name : 'Unknown';
		const codeColor = code ? code.color : '#505a5f';

		html += `<span class="coded-segment" 
			data-code-id="${segment.code_id}"
			data-application-id="${segment.id}"
			style="--code-bg: ${codeColor}22; --code-color: ${codeColor};"
			title="Code: ${codeLabel}">`;
		html += escapeHtml(content.substring(segment.start_pos, segment.end_pos));
		html += '</span>';

		lastEnd = segment.end_pos;
	});

	// Add remaining text
	if (lastEnd < content.length) {
		html += escapeHtml(content.substring(lastEnd));
	}

	return html;
}

function setupEntryEventListeners() {
	// Code button
	document.querySelectorAll('.code-entry').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const entryId = e.target.dataset.id;
			state.selectedEntry = state.entries.find(e => e.id === entryId);
			showCodingInstructions();
		});
	});

	// Text selection
	document.querySelectorAll('.codeable-text').forEach(el => {
		el.addEventListener('mouseup', handleTextSelection);
	});

	// Other buttons...
	document.querySelectorAll('.delete-entry').forEach(btn => {
		btn.addEventListener('click', handleDeleteEntry);
	});
}

function handleTextSelection(e) {
	const selection = window.getSelection();
	const text = selection.toString().trim();

	if (text && text.length > 3) {
		const entryId = e.currentTarget.dataset.entryId;
		state.selectedEntry = state.entries.find(e => e.id === entryId);
		state.selectedText = {
			text: text,
			range: selection.getRangeAt(0),
			entryId: entryId
		};

		showCodingPanel();
	}
}

function showCodingInstructions() {
	alert('Select text in this entry to apply codes');
}

function showCodingPanel() {
	const panel = document.getElementById('coding-panel');
	const display = document.getElementById('selected-text-display');

	display.textContent = state.selectedText.text;
	renderCodingCodebook();

	panel.hidden = false;
}

/* =========================
 * Coding Functionality
 * ========================= */

async function loadCodes() {
	if (!state.projectId) return;

	try {
		const url = `${CONFIG.API_BASE}/api/codes?project=${encodeURIComponent(state.projectId)}`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();
		state.codes = data.codes || [];
		renderCodebook();
	} catch (err) {
		console.error('Failed to load codes:', err);
	}
}

async function loadCodeApplications() {
	if (!state.projectId) return;

	try {
		const url = `${CONFIG.API_BASE}/api/code-applications?project=${encodeURIComponent(state.projectId)}`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
		}

		const data = await res.json();
		state.codeApplications = data.applications || [];
	} catch (err) {
		console.error('Failed to load code applications:', err);
	}
}

function renderCodebook() {
	const container = document.getElementById('codebook-display');
	if (!container) return;

	if (state.codes.length === 0) {
		container.innerHTML = '<p>No codes yet. Add your first code to start coding.</p>';
		return;
	}

	// Render hierarchical code structure
	container.innerHTML = renderCodeTree(null, 1);
}

function renderCodeTree(parentId, level) {
	const codes = state.codes.filter(c => c.parent === parentId);

	return codes.map(code => `
		<div class="code-item" aria-level="${level}" data-code-id="${code.id}">
			<span class="code-color-indicator" style="background-color: ${code.color};"></span>
			<span class="code-name">${escapeHtml(code.name)}</span>
			${code.definition ? `<span class="code-definition">${escapeHtml(code.definition)}</span>` : ''}
		</div>
		${renderCodeTree(code.id, level + 1)}
	`).join('');
}

function renderCodingCodebook() {
	const container = document.getElementById('coding-codebook');
	if (!container) return;

	container.innerHTML = state.codes.map(code => `
		<div class="code-item selectable" data-code-id="${code.id}">
			<span class="code-color-indicator" style="background-color: ${code.color};"></span>
			<span>${escapeHtml(code.name)}</span>
		</div>
	`).join('');

	// Add selection handlers
	container.querySelectorAll('.code-item').forEach(item => {
		item.addEventListener('click', (e) => {
			container.querySelectorAll('.code-item').forEach(i => i.classList.remove('selected'));
			item.classList.add('selected');
			state.selectedCode = item.dataset.codeId;
		});
	});
}

async function applyCode() {
	if (!state.selectedText || !state.selectedCode) return;

	const confidence = document.querySelector('input[name="confidence"]:checked').value;
	const memo = document.getElementById('coding-memo-input').value;

	// Calculate text position
	const content = state.selectedEntry.content;
	const startPos = content.indexOf(state.selectedText.text);
	const endPos = startPos + state.selectedText.text.length;

	const payload = {
		entry_id: state.selectedText.entryId,
		code_id: state.selectedCode,
		text_segment: state.selectedText.text,
		start_pos: startPos,
		end_pos: endPos,
		confidence: confidence,
		notes: memo,
		coder: 'current-user' // Would come from auth
	};

	try {
		const res = await fetchWithTimeout(`${CONFIG.API_BASE}/api/code-applications`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		// Refresh data
		await loadCodeApplications();
		await loadEntries();

		// Close panel
		document.getElementById('coding-panel').hidden = true;
		state.selectedText = null;
		state.selectedCode = null;

	} catch (err) {
		console.error('Failed to apply code:', err);
		showStatus('Failed to apply code', 'error');
	}
}

/* =========================
 * Memo Functionality
 * ========================= */

async function loadMemos() {
	if (!state.projectId) return;

	try {
		const url = `${CONFIG.API_BASE}/api/memos?project=${encodeURIComponent(state.projectId)}`;
		const res = await fetchWithTimeout(url);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const data = await res.json();
		state.memos = data.memos || [];
		renderMemos();
	} catch (err) {
		console.error('Failed to load memos:', err);
	}
}

function renderMemos() {
	const container = document.getElementById('memos-container');
	if (!container) return;

	const filtered = state.currentMemoFilter === 'all' ?
		state.memos :
		state.memos.filter(m => m.memoType === state.currentMemoFilter);

	if (filtered.length === 0) {
		container.innerHTML = '<p>No memos yet.</p>';
		return;
	}

	container.innerHTML = filtered.map(memo => `
		<article class="memo-card">
			<div class="memo-header">
				<span class="memo-type-badge" data-type="${memo.memoType}">
					${CONFIG.MEMO_TYPES[memo.memoType]}
				</span>
				<time>${formatDatetime(memo.createdAt)}</time>
			</div>
			<div class="memo-content">
				${escapeHtml(memo.content)}
			</div>
			${memo.linkedEntries.length > 0 ? 
				`<div class="memo-links">Linked to ${memo.linkedEntries.length} entries</div>` : 
				''
			}
		</article>
	`).join('');
}

/* =========================
 * Analysis Functionality
 * ========================= */

async function loadAnalysis() {
	// Placeholder for analysis loading
	const container = document.getElementById('analysis-container');
	container.innerHTML = '<p>Select an analysis tool above to begin.</p>';
}

/* =========================
 * Form Handlers
 * ========================= */

async function handleAddEntry(e) {
	e.preventDefault();
	const form = e.target;
	const formData = new FormData(form);

	const payload = {
		project_airtable_id: state.projectId,
		category: formData.get('category'),
		content: formData.get('content'),
		tags: formData.get('tags') ?
			formData.get('tags').split(',').map(t => t.trim()).filter(Boolean) : []
	};

	if (!payload.category || !payload.content) {
		showStatus('Category and entry content are required', 'error');
		return;
	}

	try {
		const url = `${CONFIG.API_BASE}/api/journal-entries`;
		const res = await fetchWithTimeout(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => ({}));
			throw new Error(errData.error || `HTTP ${res.status}`);
		}

		showStatus('Entry saved successfully', 'success');
		form.reset();
		toggleForm(false);
		await loadEntries();

	} catch (err) {
		console.error('Failed to add entry:', err);
		showStatus(`Error: ${err.message}`, 'error');
	}
}

async function handleDeleteEntry(e) {
	const entryId = e.target.dataset.id;

	if (!confirm('Are you sure you want to delete this journal entry? This cannot be undone.')) {
		return;
	}

	try {
		const url = `${CONFIG.API_BASE}/api/journal-entries/${encodeURIComponent(entryId)}`;
		const res = await fetchWithTimeout(url, { method: 'DELETE' });

		if (!res.ok) {
			const errData = await res.json().catch(() => ({}));
			throw new Error(errData.error || `HTTP ${res.status}`);
		}

		await loadEntries();

	} catch (err) {
		console.error('Failed to delete entry:', err);
		showStatus(`Error: ${err.message}`, 'error');
	}
}

function handleFilter(e) {
	const btn = e.target.closest('.filter-btn');
	if (!btn) return;

	const filter = btn.dataset.filter;
	state.currentFilter = filter;

	document.querySelectorAll('.filter-btn').forEach(b => {
		b.classList.toggle('active', b === btn);
	});

	renderEntries();
}

function toggleForm(show) {
	const form = document.getElementById('entry-form');
	const toggleBtn = document.getElementById('toggle-form-btn');

	if (show === undefined) {
		state.formVisible = !state.formVisible;
	} else {
		state.formVisible = show;
	}

	if (form) {
		form.hidden = !state.formVisible;
	}

	if (toggleBtn) {
		toggleBtn.textContent = state.formVisible ? '✕ Close form' : '+ New entry';
	}

	if (state.formVisible) {
		const firstField = document.getElementById('entry-category');
		if (firstField) firstField.focus();
	}
}

/* =========================
 * Initialization
 * ========================= */

async function init() {
	const params = getUrlParams();
	state.projectId = params.id;

	if (!state.projectId) {
		console.error('Missing project ID in URL');
		return;
	}

	// Update breadcrumb link
	const projectLink = document.getElementById('project-link');
	if (projectLink) {
		projectLink.href = `/pages/project-dashboard/?id=${state.projectId}`;
	}

	// Setup tabs
	setupTabs();

	// Journal form handlers
	const addEntryForm = document.getElementById('add-entry-form');
	const toggleFormBtn = document.getElementById('toggle-form-btn');
	const cancelFormBtn = document.getElementById('cancel-form-btn');
	const filterGroup = document.querySelector('.filter-group');

	if (addEntryForm) {
		addEntryForm.addEventListener('submit', handleAddEntry);
	}

	if (toggleFormBtn) {
		toggleFormBtn.addEventListener('click', () => toggleForm());
	}

	if (cancelFormBtn) {
		cancelFormBtn.addEventListener('click', () => toggleForm(false));
	}

	if (filterGroup) {
		filterGroup.addEventListener('click', handleFilter);
	}

	// Coding panel handlers
	const applyCodeBtn = document.getElementById('apply-code-btn');
	const cancelCodingBtn = document.getElementById('cancel-coding-btn');
	const closePanelBtn = document.querySelector('.close-panel');

	if (applyCodeBtn) {
		applyCodeBtn.addEventListener('click', applyCode);
	}

	if (cancelCodingBtn) {
		cancelCodingBtn.addEventListener('click', () => {
			document.getElementById('coding-panel').hidden = true;
		});
	}

	if (closePanelBtn) {
		closePanelBtn.addEventListener('click', () => {
			document.getElementById('coding-panel').hidden = true;
		});
	}

	// Load initial data
	await loadCodes();
	await loadEntries();
}

// Start
init();
