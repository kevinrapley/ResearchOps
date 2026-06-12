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

function slugId(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'code';
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

function cooccurrenceRows(nodes, links) {
	return links
		.map((link) => {
			const weight = Number(link.weight == null ? 1 : link.weight);
			const source = nodeLabel(nodes, link.source);
			const target = nodeLabel(nodes, link.target);
			return {
				source,
				target,
				weight: Number.isFinite(weight) ? weight : 1,
				label: `${source} and ${target}`,
			};
		})
		.sort((a, b) => b.weight - a.weight || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
}

function renderCooccurrenceTable(rows) {
	return `<table class="govuk-table">
		<caption class="govuk-table__caption govuk-table__caption--m">Code pairs by strength</caption>
		<thead class="govuk-table__head">
			<tr class="govuk-table__row">
				<th scope="col" class="govuk-table__header">Source code</th>
				<th scope="col" class="govuk-table__header">Target code</th>
				<th scope="col" class="govuk-table__header govuk-table__header--numeric">Weight</th>
			</tr>
		</thead>
		<tbody class="govuk-table__body">
			${rows.map((row) => `<tr class="govuk-table__row">
				<td class="govuk-table__cell">${esc(row.source)}</td>
				<td class="govuk-table__cell">${esc(row.target)}</td>
				<td class="govuk-table__cell govuk-table__cell--numeric">${esc(String(row.weight))}</td>
			</tr>`).join('')}
		</tbody>
	</table>`;
}

function renderOnsCooccurrenceBarChart(rows) {
	const topRows = rows.slice(0, 20);
	const maxWeight = Math.max(...topRows.map((row) => row.weight), 1);
	return `<section aria-labelledby="cooccurrence-chart-heading" data-ons-chart="bar-chart">
		<h4 class="govuk-heading-s" id="cooccurrence-chart-heading">Highest weighted code pairs</h4>
		<p class="govuk-hint">Showing the 20 strongest co-occurring pairs.</p>
		<ol class="govuk-list">
			${topRows.map((row) => {
				const width = Math.max(4, Math.round((row.weight / maxWeight) * 100));
				return `<li class="govuk-!-margin-bottom-3">
					<div class="govuk-body-s govuk-!-font-weight-bold govuk-!-margin-bottom-1">${esc(row.label)}</div>
					<div style="display: flex; align-items: center; gap: 0.75rem;">
						<div aria-hidden="true" style="background: #206095; min-width: 2px; width: ${width}%; height: 1.25rem;"></div>
						<span class="govuk-body-s govuk-!-margin-bottom-0">${esc(String(row.weight))}</span>
					</div>
				</li>`;
			}).join('')}
		</ol>
	</section>`;
}

function cooccurrenceCodeTotals(rows) {
	const totals = new Map();
	rows.forEach((row) => {
		totals.set(row.source, (totals.get(row.source) || 0) + row.weight);
		totals.set(row.target, (totals.get(row.target) || 0) + row.weight);
	});
	return [...totals]
		.map(([code, total]) => ({ code, total }))
		.sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
}

function cooccurrencePairLookup(rows) {
	const lookup = new Map();
	rows.forEach((row) => {
		lookup.set(`${row.source}\u0000${row.target}`, row.weight);
		lookup.set(`${row.target}\u0000${row.source}`, row.weight);
	});
	return lookup;
}

function cooccurrenceSourceGroups(rows) {
	const grouped = new Map();
	rows.forEach((row) => {
		if (!grouped.has(row.source)) grouped.set(row.source, []);
		grouped.get(row.source).push(row);
	});
	return [...grouped]
		.map(([source, sourceRows]) => ({
			source,
			total: sourceRows.reduce((sum, row) => sum + row.weight, 0),
			rows: sourceRows.slice().sort((a, b) => b.weight - a.weight || a.target.localeCompare(b.target)),
		}))
		.sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
}

function cooccurrenceBar(width, colour, label, value) {
	return `<div style="display: flex; align-items: center; gap: 0.75rem;">
		<div aria-hidden="true" style="background: ${colour}; min-width: 2px; width: ${width}%; height: 1.25rem;"></div>
		<span class="govuk-body-s govuk-!-margin-bottom-0">${esc(String(value))}</span>
		<span class="govuk-visually-hidden">${esc(label)}: ${esc(String(value))}</span>
	</div>`;
}

function renderOnsCooccurrenceHeatmap(rows) {
	const codes = cooccurrenceCodeTotals(rows).slice(0, 5).map((row) => row.code);
	const lookup = cooccurrencePairLookup(rows);
	const maxWeight = Math.max(...rows.map((row) => row.weight), 1);
	return `<section aria-labelledby="cooccurrence-heatmap-heading" data-ons-chart="heatmap">
		<h4 class="govuk-heading-s" id="cooccurrence-heatmap-heading">Code co-occurrence matrix</h4>
		<p class="govuk-hint">Showing weights between the 5 most connected codes.</p>
		<div style="overflow-x: auto;">
			<table class="govuk-table govuk-!-font-size-16">
				<caption class="govuk-table__caption govuk-table__caption--s">Matrix heatmap of code-pair weights</caption>
				<thead class="govuk-table__head">
					<tr class="govuk-table__row">
						<th scope="col" class="govuk-table__header">Code</th>
						${codes.map((code) => `<th scope="col" class="govuk-table__header" style="max-width: 7rem; overflow-wrap: anywhere;">${esc(code)}</th>`).join('')}
					</tr>
				</thead>
				<tbody class="govuk-table__body">
					${codes.map((source) => `<tr class="govuk-table__row">
						<th scope="row" class="govuk-table__header" style="max-width: 9rem; overflow-wrap: anywhere;">${esc(source)}</th>
						${codes.map((target) => {
							const weight = source === target ? 0 : lookup.get(`${source}\u0000${target}`) || 0;
							const opacity = weight ? Math.max(0.12, Math.min(0.55, (weight / maxWeight) * 0.55)) : 0;
							return `<td class="govuk-table__cell govuk-table__cell--numeric" style="${weight ? `background: rgba(32, 96, 149, ${opacity});` : ''}">${weight || ''}</td>`;
						}).join('')}
					</tr>`).join('')}
				</tbody>
			</table>
		</div>
	</section>`;
}

function renderOnsCooccurrenceSmallMultiples(rows) {
	const groups = cooccurrenceSourceGroups(rows).slice(0, 6);
	const maxWeight = Math.max(...groups.flatMap((group) => group.rows.slice(0, 5).map((row) => row.weight)), 1);
	return `<section aria-labelledby="cooccurrence-small-multiples-heading" data-ons-chart="bar-chart-sm">
		<h4 class="govuk-heading-s" id="cooccurrence-small-multiples-heading">Small multiple bar charts</h4>
		<p class="govuk-hint">Comparing the strongest target codes for the 6 highest weighted source codes on a shared scale.</p>
		<div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));">
			${groups.map((group) => `<section aria-labelledby="cooccurrence-small-multiple-${slugId(group.source)}">
				<h5 class="govuk-heading-s govuk-!-margin-bottom-2" id="cooccurrence-small-multiple-${slugId(group.source)}">${esc(group.source)}</h5>
				<ol class="govuk-list">
					${group.rows.slice(0, 5).map((row) => {
						const width = Math.max(4, Math.round((row.weight / maxWeight) * 100));
						return `<li class="govuk-!-margin-bottom-2">
							<div class="govuk-body-s govuk-!-font-weight-bold govuk-!-margin-bottom-1">${esc(row.target)}</div>
							${cooccurrenceBar(width, '#206095', row.label, row.weight)}
						</li>`;
					}).join('')}
				</ol>
			</section>`).join('')}
		</div>
	</section>`;
}

function renderOnsCooccurrenceStackedBarSummary(rows) {
	const colours = ['#206095', '#27a0cc', '#871a5b', '#f66068', '#0f8243'];
	const groups = cooccurrenceSourceGroups(rows).slice(0, 8);
	return `<section aria-labelledby="cooccurrence-stacked-heading" data-ons-chart="bar-chart-stacked">
		<h4 class="govuk-heading-s" id="cooccurrence-stacked-heading">Stacked bar summary</h4>
		<p class="govuk-hint">Showing how each high-weight source code is distributed across its strongest target codes.</p>
		<ol class="govuk-list">
			${groups.map((group) => {
				const topTargets = group.rows.slice(0, 4);
				const otherWeight = group.rows.slice(4).reduce((sum, row) => sum + row.weight, 0);
				const segments = otherWeight ? topTargets.concat([{ target: 'Other pairs', weight: otherWeight }]) : topTargets;
				return `<li class="govuk-!-margin-bottom-4">
					<div class="govuk-body-s govuk-!-font-weight-bold govuk-!-margin-bottom-1">${esc(group.source)}</div>
					<div style="display: flex; width: 100%; min-height: 1.5rem;" aria-hidden="true">
						${segments.map((segment, index) => {
							const width = Math.max(2, (segment.weight / group.total) * 100);
							return `<div style="background: ${colours[index % colours.length]}; width: ${width}%;" title="${esc(segment.target)}: ${esc(String(segment.weight))}"></div>`;
						}).join('')}
					</div>
					<ul class="govuk-list govuk-!-font-size-16 govuk-!-margin-top-1">
						${segments.map((segment, index) => `<li><span aria-hidden="true" style="background: ${colours[index % colours.length]}; display: inline-block; height: 0.75rem; margin-right: 0.4rem; width: 0.75rem;"></span>${esc(segment.target)}: ${esc(String(segment.weight))}</li>`).join('')}
					</ul>
				</li>`;
			}).join('')}
		</ol>
	</section>`;
}

function renderOnsCooccurrenceClusteredBarSummary(rows) {
	const colours = ['#206095', '#27a0cc', '#871a5b'];
	const groups = cooccurrenceSourceGroups(rows).slice(0, 5);
	const topRows = groups.flatMap((group) => group.rows.slice(0, 3));
	const maxWeight = Math.max(...topRows.map((row) => row.weight), 1);
	return `<section aria-labelledby="cooccurrence-clustered-heading" data-ons-chart="bar-chart-grouped">
		<h4 class="govuk-heading-s" id="cooccurrence-clustered-heading">Clustered bar comparison</h4>
		<p class="govuk-hint">Comparing the strongest 3 target-code links for the 5 highest weighted source codes.</p>
		${groups.map((group) => `<section class="govuk-!-margin-bottom-4" aria-labelledby="cooccurrence-clustered-${slugId(group.source)}">
			<h5 class="govuk-heading-s govuk-!-margin-bottom-2" id="cooccurrence-clustered-${slugId(group.source)}">${esc(group.source)}</h5>
			<ol class="govuk-list">
				${group.rows.slice(0, 3).map((row, index) => {
					const width = Math.max(4, Math.round((row.weight / maxWeight) * 100));
					return `<li class="govuk-!-margin-bottom-2">
						<div class="govuk-body-s govuk-!-font-weight-bold govuk-!-margin-bottom-1">${esc(row.target)}</div>
						${cooccurrenceBar(width, colours[index % colours.length], row.label, row.weight)}
					</li>`;
				}).join('')}
			</ol>
		</section>`).join('')}
	</section>`;
}

function renderCooccurrenceOutput(rows) {
	return `<div class="govuk-form-group">
		<fieldset class="govuk-fieldset" aria-describedby="cooccurrence-display-hint">
			<legend class="govuk-fieldset__legend govuk-fieldset__legend--s">Display co-occurrence as</legend>
			<div id="cooccurrence-display-hint" class="govuk-hint">Each view uses the same code-pair weights.</div>
			<div class="govuk-radios govuk-radios--small" data-module="govuk-radios">
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-table" name="cooccurrence-view" type="radio" value="table" checked aria-controls="cooccurrence-table-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-table">Table</label>
				</div>
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-chart" name="cooccurrence-view" type="radio" value="chart" aria-controls="cooccurrence-chart-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-chart">Ranked bar chart</label>
				</div>
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-heatmap" name="cooccurrence-view" type="radio" value="heatmap" aria-controls="cooccurrence-heatmap-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-heatmap">Matrix heatmap</label>
				</div>
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-small-multiples" name="cooccurrence-view" type="radio" value="small-multiples" aria-controls="cooccurrence-small-multiples-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-small-multiples">Small multiples</label>
				</div>
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-stacked" name="cooccurrence-view" type="radio" value="stacked" aria-controls="cooccurrence-stacked-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-stacked">Stacked summary</label>
				</div>
				<div class="govuk-radios__item">
					<input class="govuk-radios__input" id="cooccurrence-view-clustered" name="cooccurrence-view" type="radio" value="clustered" aria-controls="cooccurrence-clustered-panel">
					<label class="govuk-label govuk-radios__label" for="cooccurrence-view-clustered">Clustered summary</label>
				</div>
			</div>
		</fieldset>
	</div>
	<div id="cooccurrence-table-panel" data-cooccurrence-panel="table">
		${renderCooccurrenceTable(rows)}
	</div>
	<div id="cooccurrence-chart-panel" data-cooccurrence-panel="chart" hidden>
		${renderOnsCooccurrenceBarChart(rows)}
	</div>
	<div id="cooccurrence-heatmap-panel" data-cooccurrence-panel="heatmap" hidden>
		${renderOnsCooccurrenceHeatmap(rows)}
	</div>
	<div id="cooccurrence-small-multiples-panel" data-cooccurrence-panel="small-multiples" hidden>
		${renderOnsCooccurrenceSmallMultiples(rows)}
	</div>
	<div id="cooccurrence-stacked-panel" data-cooccurrence-panel="stacked" hidden>
		${renderOnsCooccurrenceStackedBarSummary(rows)}
	</div>
	<div id="cooccurrence-clustered-panel" data-cooccurrence-panel="clustered" hidden>
		${renderOnsCooccurrenceClusteredBarSummary(rows)}
	</div>`;
}

function setupCooccurrenceDisplaySwitch(wrap) {
	const panels = wrap.querySelectorAll('[data-cooccurrence-panel]');
	wrap.querySelectorAll('input[name="cooccurrence-view"]').forEach((input) => {
		input.addEventListener('change', () => {
			if (!input.checked) return;
			panels.forEach((panel) => {
				panel.hidden = panel.dataset.cooccurrencePanel !== input.value;
			});
		});
	});
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
		const rows = cooccurrenceRows(nodes, links);
		wrap.innerHTML = renderCooccurrenceOutput(rows);
		setupCooccurrenceDisplaySwitch(wrap);
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
