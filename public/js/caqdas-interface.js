/* eslint-env browser */

import { clearJournalFeedback, showJournalError, showJournalStatus } from "./journal-feedback.js";

const API_ORIGIN =
	resolveApiBase();

function resolveApiBase() {
	const explicit = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || '';
	if (String(explicit || '').trim()) return String(explicit).trim().replace(/\/+$/, '');
	if (location.hostname.endsWith('pages.dev')) return '';
	return location.origin;
}

let cachedUserName = null;

function apiUrl(path) {
	const p = String(path || '');
	return `${API_ORIGIN}${p.startsWith('/') ? p : '/' + p}`;
}

function esc(value) {
	const node = document.createElement('div');
	node.textContent = String(value || '');
	return node.innerHTML;
}

function fetchJSON(url, init) {
	return fetch(url, init).then((res) => res.text().then((txt) => {
		const body = (res.headers.get('content-type') || '').toLowerCase().includes('application/json') && txt ? JSON.parse(txt) : {};
		if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
		return body;
	}));
}

function when(iso) {
	if (!iso) return '—';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return String(iso || '');
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const hours = date.getHours();
	const suffix = hours >= 12 ? 'pm' : 'am';
	const hour = hours % 12 || 12;
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} at ${hour}:${minute}${suffix}`;
}

function flashError(message, targetId) {
	showJournalError(message);
	if (targetId) document.getElementById(targetId)?.focus?.();
}

function flashStatus(message, options = {}) {
	showJournalStatus(message, options);
}

function retrievalInput() {
	return document.getElementById('retrieval-q');
}

function retrievalGroup() {
	const input = retrievalInput();
	return input ? input.closest('.govuk-form-group') : null;
}

function setRetrievalError(messageText) {
	const input = retrievalInput();
	const group = retrievalGroup();
	if (!input || !group) return;
	let message = document.getElementById('retrieval-q-error');
	if (!message) {
		message = document.createElement('p');
		message.id = 'retrieval-q-error';
		message.className = 'govuk-error-message';
		group.insertBefore(message, input);
	}
	message.textContent = `Error: ${messageText}`;
	group.classList.add('govuk-form-group--error');
	input.classList.add('govuk-input--error');
	input.setAttribute('aria-invalid', 'true');
	input.setAttribute('aria-describedby', 'retrieval-q-hint retrieval-q-error');
}

function clearRetrievalError() {
	const input = retrievalInput();
	const group = retrievalGroup();
	const message = document.getElementById('retrieval-q-error');
	if (message) message.remove();
	if (group) group.classList.remove('govuk-form-group--error');
	if (input) {
		input.classList.remove('govuk-input--error');
		input.removeAttribute('aria-invalid');
		input.setAttribute('aria-describedby', 'retrieval-q-hint');
	}
}

function currentUserName() {
	if (cachedUserName !== null) return Promise.resolve(cachedUserName);
	return fetchJSON(apiUrl('/api/me/identity'), { credentials: 'include' })
		.then((data) => {
			const user = data?.user || {};
			cachedUserName = user.displayName || user.display_name || user.name || '';
			return cachedUserName;
		})
		.catch(() => {
			cachedUserName = '';
			return cachedUserName;
		});
}

function updateJsonPanel(data, filename) {
	const code = document.getElementById('json-code');
	if (!code) return;
	code.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
	code.dataset.filename = filename || 'analysis.json';
}

function nodeLabel(nodes, id) {
	const found = nodes.find((node) => node?.id === id);
	return found?.label || found?.name || String(id);
}

function entryText(entry) {
	return entry.body || entry.content || entry.description || '';
}

function entryCategory(entry) {
	return entry.category || entry.action || 'Journal entry';
}

function sentenceCase(value) {
	const text = String(value || '').trim();
	return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function entryAuthor(entry, userName) {
	return entry.author || entry.authorName || entry.author_name || entry.createdBy || entry.created_by || userName || '';
}

function timelineTitle(entry) {
	const category = entryCategory(entry);
	return sentenceCase(category === 'Journal entry' ? category : `${category} journal entry`);
}

function timelineItemHtml(entry, userName) {
	const createdAt = entry.createdAt || entry.created_at || entry.createdat || '';
	const author = entryAuthor(entry, userName);
	const byline = author ? `<p class="hods-timeline__by">by ${esc(author)}</p>` : '';
	return `<div class="hods-timeline__item"><h2 class="hods-timeline__title">${esc(timelineTitle(entry))}</h2>${byline}<p class="hods-timeline__date"><time class="hods-date-time" datetime="${esc(createdAt)}">${esc(when(createdAt))}</time></p><p class="hods-timeline__description">${esc(entryText(entry))}</p></div>`;
}

function timelineFromJournalEntries(projectId) {
	return fetchJSON(apiUrl('/api/journal-entries?project=' + encodeURIComponent(projectId || ''))).then((res) => Array.isArray(res?.entries) ? res.entries : []);
}

function loadTimelineItems(projectId) {
	return fetchJSON(apiUrl('/api/analysis/timeline?project=' + encodeURIComponent(projectId || ''))).then((res) => {
		const items = Array.isArray(res?.timeline) ? res.timeline : [];
		return items.length ? items : timelineFromJournalEntries(projectId);
	});
}

function runTimeline(projectId) {
	const wrap = document.getElementById('analysis-timeline');
	if (wrap) wrap.innerHTML = '<p class="govuk-body">Loading timeline…</p>';
	clearJournalFeedback();
	showJournalStatus('Loading timeline view…');
	return Promise.all([loadTimelineItems(projectId), currentUserName()]).then(([items, userName]) => {
		updateJsonPanel({ timeline: items }, `timeline-${String(projectId || 'unknown')}.json`);
		if (!wrap) return;
		wrap.innerHTML = items.length ? items.map((item) => timelineItemHtml(item, userName)).join('') : '<p class="govuk-hint">No journal entries yet.</p>';
		flashStatus(items.length ? 'Timeline view updated.' : 'Timeline view is ready. There are no journal entries to show.', { success: true, title: 'Success' });
	}).catch((err) => {
		console.error('runTimeline', err);
		if (wrap) wrap.innerHTML = '';
		flashError('Timeline failed to load.');
	});
}

function runCooccurrence(projectId) {
	const wrap = document.getElementById('analysis-cooccurrence');
	if (wrap) wrap.innerHTML = '<p>Loading co-occurrence…</p>';
	clearJournalFeedback();
	showJournalStatus('Loading code co-occurrence…');
	return fetchJSON(apiUrl('/api/analysis/cooccurrence?project=' + encodeURIComponent(projectId || ''))).then((res) => {
		const nodes = Array.isArray(res?.nodes) ? res.nodes : [];
		const links = Array.isArray(res?.links) ? res.links : [];
		updateJsonPanel({ nodes, links }, `cooccurrence-${String(projectId || 'unknown')}.json`);
		if (!wrap) return;
		if (!links.length) {
			wrap.innerHTML = '<p class="hint">No co-occurrences yet.</p>';
			flashStatus('Code co-occurrence is ready. No co-occurring codes were found.');
			return;
		}
		links.sort((a, b) => (b.weight || 0) - (a.weight || 0));
		wrap.innerHTML = '<table class="table"><caption>Code pairs by strength</caption><thead><tr><th>Source</th><th>Target</th><th>Weight</th></tr></thead><tbody>' +
			links.map((link) => `<tr><td><span class="tag">${esc(nodeLabel(nodes, link.source))}</span></td><td><span class="tag">${esc(nodeLabel(nodes, link.target))}</span></td><td>${esc(String(link.weight == null ? 1 : link.weight))}</td></tr>`).join('') +
			'</tbody></table>';
		flashStatus('Code co-occurrence updated.', { success: true, title: 'Success' });
	}).catch((err) => {
		console.error('runCooccurrence', err);
		if (wrap) wrap.innerHTML = '';
		flashError('Co-occurrence failed to load.');
	});
}

function runRetrieval(projectId) {
	let form = document.getElementById('retrieval-form');
	const results = document.getElementById('retrieval-results');
	if (!form || !results) return;
	const clone = form.cloneNode(true);
	form.parentNode.replaceChild(clone, form);
	form = document.getElementById('retrieval-form');
	retrievalInput()?.addEventListener('input', clearRetrievalError);
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const term = String(document.getElementById('retrieval-q')?.value || '').trim();
		if (!term) { results.innerHTML = ''; setRetrievalError('Enter a term to search.'); flashError('Enter a term to search.', 'retrieval-q'); return; }
		clearRetrievalError();
		results.innerHTML = '<p>Searching…</p>';
		clearJournalFeedback();
		showJournalStatus('Running code retrieval search…');
		fetchJSON(apiUrl('/api/analysis/retrieval?project=' + encodeURIComponent(projectId || '') + '&q=' + encodeURIComponent(term))).then((res) => {
			const out = Array.isArray(res?.results) ? res.results : [];
			updateJsonPanel({ query: term, results: out }, `retrieval-${String(projectId || 'unknown')}.json`);
			if (!out.length) {
				results.innerHTML = '<p class="hint">No matches found.</p>';
				flashStatus(`Code retrieval is ready. No matches were found for "${term}".`);
				return;
			}
			const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
			results.innerHTML = '<ul class="analysis-list analysis-list--spaced" aria-live="polite">' + out.map((result) => {
				const codes = Array.isArray(result?.codes) ? result.codes : [];
				const badges = codes.map((code) => `<span class="tag">${esc(code.name)}</span>`).join(' ');
				const snippet = esc(result.snippet || '').replace(rx, (match) => `<mark>${match}</mark>`);
				return `<li><h5 class="analysis-subheading">${badges}</h5><p>${snippet}</p></li>`;
			}).join('') + '</ul>';
			flashStatus('Code retrieval updated.', { success: true, title: 'Success' });
		}).catch(() => {
			results.innerHTML = '';
			flashError('Search failed.');
		});
	});
}

function runExport(projectId) {
	const tUrl = apiUrl('/api/analysis/timeline?project=' + encodeURIComponent(projectId || ''));
	const cUrl = apiUrl('/api/analysis/cooccurrence?project=' + encodeURIComponent(projectId || ''));
	clearJournalFeedback();
	showJournalStatus('Preparing analysis export…');
	return Promise.all([fetchJSON(tUrl), fetchJSON(cUrl)]).then(([timelineData, cooccurrenceData]) => {
		const payload = {
			projectId: projectId || '',
			generatedAt: new Date().toISOString(),
			timeline: timelineData?.timeline || [],
			nodes: cooccurrenceData?.nodes || [],
			links: cooccurrenceData?.links || []
		};
		updateJsonPanel(payload, `analysis-${String(projectId || 'unknown')}.json`);
		flashStatus('Export analysis is ready in the JSON panel. Use Download JSON to save it.', { success: true, title: 'Success' });
	}).catch(() => {
		flashError('Failed to prepare export.');
	});
}

export { runTimeline, runCooccurrence, runRetrieval, runExport };
