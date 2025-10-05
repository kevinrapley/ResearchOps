/**
 * @file guides-page.js
 * @module GuidesPage
 * @description
 * Discussion Guides interface (list, edit, preview, export) for the Study.
 * - Route: /pages/study/guides/?pid=<projectId>&sid=<studyId>
 * - Renders Markdown + Mustache with partials
 * - Uses Worker API for projects, studies, guides, and render service
 *
 * Depends on:
 *  - /lib/mustache.min.js
 *  - /lib/marked.min.js
 *  - /lib/purify.min.js
 *  - /components/guides/context.js
 *  - /components/guides/guide-editor.js
 *  - /components/guides/patterns.js
 *
 * Author:  Kevin Rapley
 * Version: 1.0.0
 * Date:    2025-10-05
 */

import Mustache from '/lib/mustache.min.js';
import { marked } from '/lib/marked.min.js';
import DOMPurify from '/lib/purify.min.js';

import { buildContext } from '/components/guides/context.js';
import { renderGuide, buildPartials, DEFAULT_SOURCE } from '/components/guides/guide-editor.js';
import { searchPatterns, listStarterPatterns } from '/components/guides/patterns.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ==========================================================================
   =BOOTSTRAP
   ========================================================================== */

/**
 * Initialise page on DOM ready (fetch study context, list guides, wire UI).
 * @returns {Promise<void>}
 */
window.addEventListener('DOMContentLoaded', async () => {
	const url = new URL(location.href);
	const pid = url.searchParams.get('pid');
	const sid = url.searchParams.get('sid');

	await hydrateCrumbs({ pid, sid });
	await loadGuides(sid);

	wireGlobalActions();
	wireEditor();
});

/**
 * Load all studies for a project (mirrors Study page behaviour).
 * @param {string} projectId Airtable project record id
 * @returns {Promise<Array<Object>>} studies
 * @throws {Error} when API contract fails
 */
async function loadStudies(projectId) {
	const url = `/api/studies?project=${encodeURIComponent(projectId)}`;
	const res = await fetch(url, { cache: 'no-store' });
	const js = await res.json().catch(() => ({}));
	if (!res.ok || js?.ok !== true || !Array.isArray(js.studies)) {
		throw new Error(js?.error || `Studies fetch failed (${res.status})`);
	}
	return js.studies;
}

/**
 * Populate breadcrumbs and stash {project, study} as global render context.
 * @param {{ pid:string, sid:string }} ids
 * @returns {Promise<void>}
 */
async function hydrateCrumbs({ pid, sid }) {
	try {
		const projRes = await fetch(`/api/projects/${encodeURIComponent(pid)}`, { cache: 'no-store' });
		const project = projRes.ok ? await projRes.json() : {};

		const studies = await loadStudies(pid);
		const study = studies.find(s => s.id === sid) || {};

		$('#breadcrumb-project').href = `/pages/project-dashboard/?id=${encodeURIComponent(pid)}`;
		$('#breadcrumb-project').textContent = project?.name || 'Project';

		$('#breadcrumb-study').href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
		$('#breadcrumb-study').textContent = study?.title || study?.method || 'Study';

		$('#back-to-study').href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
		$('[data-bind="study.title"]').textContent = study?.title || study?.method || '—';

		window.__guideCtx = { project, study };
	} catch (e) {
		console.warn('Crumb hydrate failed', e);
		$('[data-bind="study.title"]').textContent = '—';
		window.__guideCtx = { project: {}, study: {} };
	}
}

/* ==========================================================================
   =LIST
   ========================================================================== */

/**
 * Fetch and render guides table for a study.
 * @param {string} studyId Airtable study record id
 * @returns {Promise<void>}
 */
async function loadGuides(studyId) {
	const tbody = $('#guides-tbody');
	try {
		const res = await fetch(`/api/guides?study=${encodeURIComponent(studyId)}`, { cache: 'no-store' });
		const list = res.ok ? await res.json() : [];
		if (!list.length) {
			tbody.innerHTML = `<tr><td colspan="6" class="muted">No guides yet. Create one to get started.</td></tr>`;
			return;
		}
		tbody.innerHTML = '';
		for (const g of list) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td>${escapeHtml(g.title || 'Untitled')}</td>
				<td>${escapeHtml(g.status || 'draft')}</td>
				<td>v${g.version || 0}</td>
				<td>${new Date(g.updatedAt || g.createdAt).toLocaleString()}</td>
				<td>${escapeHtml(g.createdBy?.name || '—')}</td>
				<td><button class="link-like" data-open="${g.id}">Open</button></td>
			`;
			tbody.appendChild(tr);
		}
		$$('button[data-open]').forEach(b => b.addEventListener('click', () => openGuide(b.dataset.open)));
	} catch {
		tbody.innerHTML = `<tr><td colspan="6">Failed to load guides.</td></tr>`;
	}
}

/* ==========================================================================
   =ACTIONS & MENUS
   ========================================================================== */

/**
 * Wire top toolbar actions and export dropdown menu.
 * @returns {void}
 */
function wireGlobalActions() {
	$('#btn-new').addEventListener('click', () => startNewGuide());
	$('#btn-import').addEventListener('click', importMarkdownFlow);

	document.addEventListener('click', (e) => {
		const m = $('#export-menu').closest('.menu');
		if (!m) return;
		if (m.contains(e.target)) return;
		m.removeAttribute('aria-expanded');
	});

	$('#btn-export').addEventListener('click', () => {
		const menu = $('#export-menu').closest('.menu');
		const expanded = menu.getAttribute('aria-expanded') === 'true';
		menu.setAttribute('aria-expanded', expanded ? 'false' : 'true');
	});

	$('#export-menu').addEventListener('click', (e) => {
		if (e.target.matches('[data-export]')) doExport(e.target.dataset.export);
	});
}

/* ==========================================================================
   =EDITOR
   ========================================================================== */

/**
 * Set up editor controls and keyboard shortcuts.
 * @returns {void}
 */
function wireEditor() {
	$('#btn-insert-pattern').addEventListener('click', openPatternDrawer);
	$('#drawer-patterns-close').addEventListener('click', closePatternDrawer);
	$('#pattern-search').addEventListener('input', onPatternSearch);

	$('#btn-variables').addEventListener('click', openVariablesDrawer);
	$('#drawer-variables-close').addEventListener('click', closeVariablesDrawer);

	$('#guide-source').addEventListener('input', debounce(preview, 150));
	$('#guide-title').addEventListener('input', debounce(() => announce('Title updated'), 400));

	$('#btn-insert-tag').addEventListener('click', onInsertTag);
	$('#btn-save').addEventListener('click', onSave);
	$('#btn-publish').addEventListener('click', onPublish);

	document.addEventListener('keydown', (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			onSave();
		}
	});
}

/**
 * Start a new guide using DEFAULT_SOURCE.
 * @returns {Promise<void>}
 */
async function startNewGuide() {
	$('#editor-section').classList.remove('is-hidden');
	window.__openGuideId = undefined;
	$('#guide-title').value = 'Untitled guide';
	$('#guide-status').textContent = 'draft';
	$('#guide-source').value = DEFAULT_SOURCE.trim();
	populatePatternList(listStarterPatterns());
	populateVariablesForm({});
	await preview();
	$('#guide-title').focus();
	announce('Started a new guide');
}

/**
 * Open an existing guide for editing.
 * @param {string} id Guide id
 * @returns {Promise<void>}
 */
async function openGuide(id) {
	try {
		const res = await fetch(`/api/guides/${encodeURIComponent(id)}`);
		const g = res.ok ? await res.json() : null;
		if (!g) throw new Error('Not found');

		window.__openGuideId = g.id;

		$('#editor-section').classList.remove('is-hidden');
		$('#guide-title').value = g.title || 'Untitled';
		$('#guide-status').textContent = g.status || 'draft';
		$('#guide-source').value = g.sourceMarkdown || '';
		populatePatternList(listStarterPatterns());
		populateVariablesForm(g.variables || {});
		await preview();
		announce(`Opened guide “${g.title || 'Untitled'}”`);
	} catch {
		announce('Failed to open guide');
	}
}

/**
 * Render live preview from Markdown + Mustache.
 * @returns {Promise<void>}
 */
async function preview() {
	const source = $('#guide-source').value;
	const { project, study } = window.__guideCtx || {};
	const meta = readFrontMatter(source).meta;
	const context = buildContext({ project, study, session: {}, participant: {}, meta });
	const partialNames = collectPartialNames(source);
	const partials = await buildPartials(partialNames).catch(() => ({}));
	const out = await renderGuide({ source, context, partials });
	$('#guide-preview').innerHTML = out.html;
	runLints({ source, context, partials });
}

/**
 * Save current guide (create or update).
 * @returns {Promise<void>}
 */
async function onSave() {
	const title = $('#guide-title').value.trim() || 'Untitled guide';
	const body = {
		title,
		sourceMarkdown: $('#guide-source').value,
		variables: readFrontMatter($('#guide-source').value).meta || {}
	};
	const id = window.__openGuideId;
	const method = id ? 'PATCH' : 'POST';
	const url = id ? `/api/guides/${encodeURIComponent(id)}` : `/api/guides`;
	const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	if (res.ok) {
		announce('Guide saved');
		loadGuides((window.__guideCtx?.study || {}).id);
	} else {
		announce('Save failed');
	}
}

/**
 * Publish the currently open guide.
 * @returns {Promise<void>}
 */
async function onPublish() {
	const id = window.__openGuideId;
	const title = $('#guide-title').value.trim();
	if (!id) { announce('Save the guide before publishing.'); return; }
	const res = await fetch(`/api/guides/${encodeURIComponent(id)}/publish`, { method: 'POST' });
	if (res.ok) {
		$('#guide-status').textContent = 'published';
		announce(`Published “${title || 'Untitled'}”`);
		loadGuides((window.__guideCtx?.study || {}).id);
	} else {
		announce('Publish failed');
	}
}

/**
 * Import a local .md file into a new guide.
 * @returns {void}
 */
function importMarkdownFlow() {
	const inp = document.createElement('input');
	inp.type = 'file';
	inp.accept = '.md,text/markdown';
	inp.addEventListener('change', async () => {
		const file = inp.files?.[0];
		if (!file) return;
		const text = await file.text();
		await startNewGuide();
		$('#guide-source').value = text;
		await preview();
	});
	inp.click();
}

/* ==========================================================================
   =DRAWERS: PATTERNS
   ========================================================================== */

/**
 * Open pattern library drawer.
 * @returns {void}
 */
function openPatternDrawer() {
	$('#drawer-patterns').hidden = false;
	$('#pattern-search').focus();
	announce('Pattern drawer opened');
}

/**
 * Close pattern library drawer.
 * @returns {void}
 */
function closePatternDrawer() {
	$('#drawer-patterns').hidden = true;
	$('#btn-insert-pattern').focus();
	announce('Pattern drawer closed');
}

/**
 * Populate pattern list UI.
 * @param {Array<{name:string,title:string,category:string,version:number}>} items
 * @returns {void}
 */
function populatePatternList(items) {
	const ul = $('#pattern-list');
	ul.innerHTML = '';
	for (const p of items) {
		const li = document.createElement('li');
		li.innerHTML = `
			<button class="btn btn--secondary" data-pattern="${p.name}_v${p.version}">
				${escapeHtml(p.title)} <span class="muted">(${p.category} · v${p.version})</span>
			</button>
		`;
		ul.appendChild(li);
	}
	$('#pattern-list').addEventListener('click', (e) => {
		const b = e.target.closest('button[data-pattern]');
		if (!b) return;
		insertAtCursor($('#guide-source'), `\n{{> ${b.dataset.pattern}}}\n`);
		preview();
		closePatternDrawer();
	});
}

/**
 * Filter patterns in the drawer on input.
 * @param {InputEvent} e
 * @returns {void}
 */
function onPatternSearch(e) {
	const q = e.target.value.trim().toLowerCase();
	populatePatternList(searchPatterns(q));
}

/* ==========================================================================
   =DRAWERS: VARIABLES
   ========================================================================== */

/**
 * Open Variables drawer and populate from front-matter.
 * @returns {void}
 */
function openVariablesDrawer() {
	const src = $('#guide-source').value;
	const { meta } = readFrontMatter(src);
	populateVariablesForm(meta || {});
	$('#drawer-variables').hidden = false;
	$('#drawer-variables').focus();
}

/**
 * Close Variables drawer.
 * @returns {void}
 */
function closeVariablesDrawer() {
	$('#drawer-variables').hidden = true;
	$('#btn-variables').focus();
}

/**
 * Populate Variables form (simple key/value inputs).
 * @param {Object} meta Front-matter object
 * @returns {void}
 */
function populateVariablesForm(meta) {
	const form = $('#variables-form');
	form.innerHTML = '';
	const fields = Object.entries(meta || {}).slice(0, 40);
	for (const [k, v] of fields) {
		const id = `var-${k}`;
		const row = document.createElement('div');
		row.innerHTML = `
			<label for="${id}">${escapeHtml(k)}</label>
			<input id="${id}" class="input" value="${escapeHtml(String(v))}" />
		`;
		form.appendChild(row);
	}
	form.addEventListener('input', debounce(onVarsEdit, 200));
}

/**
 * Write edited Variables back to front-matter YAML and refresh preview.
 * @returns {void}
 */
function onVarsEdit() {
	const src = $('#guide-source').value;
	const fm = readFrontMatter(src);
	const formVals = {};
	$$('#variables-form input').forEach(i => formVals[i.id.replace(/^var-/, '')] = i.value);
	const rebuilt = writeFrontMatter(src, { ...fm.meta, ...formVals });
	$('#guide-source').value = rebuilt;
	preview();
}

/* ==========================================================================
   =EXPORT
   ========================================================================== */

/**
 * Export current guide via render service.
 * @param {'md'|'html'|'pdf'|'docx'} kind Output type
 * @returns {Promise<void>}
 */
async function doExport(kind) {
	const source = $('#guide-source').value;
	const { project, study } = window.__guideCtx || {};
	const meta = readFrontMatter(source).meta;
	const context = buildContext({ project, study, session: {}, participant: {}, meta });
	const partials = await buildPartials(collectPartialNames(source)).catch(() => ({}));
	const payload = { source, context, partials, kind };
	const res = await fetch('/api/render', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) { announce('Export failed'); return; }
	const { filename, blobBase64 } = await res.json();
	const a = document.createElement('a');
	a.href = `data:application/octet-stream;base64,${blobBase64}`;
	a.download = filename || `guide.${kind}`;
	a.click();
	announce(`Exported ${filename || kind}`);
}

/* ==========================================================================
   =HELPERS
   ========================================================================== */

/**
 * Run simple lints for unknown partials and missing tags.
 * @param {{ source:string, context:Object, partials:Object }} args
 * @returns {void}
 */
function runLints({ source, context, partials }) {
	const out = $('#lint-output');
	const warnings = [];

	// Unknown partials
	const parts = collectPartialNames(source);
	for (const p of parts) {
		if (!(p in partials)) warnings.push(`Unknown partial: {{> ${p}}}`);
	}

	// Tag existence check ({{a.b}})
	const tagRegex = /{{\s*([a-z0-9_.]+)\s*}}/gi;
	let m;
	while ((m = tagRegex.exec(source))) {
		const path = m[1].split('.');
		if (!getPath(context, path)) warnings.push(`Missing value for {{${m[1]}}}`);
	}

	out.textContent = warnings[0] || 'No issues';
}

/**
 * Collect partial names from template source.
 * @param {string} src
 * @returns {string[]} names
 */
function collectPartialNames(src) {
	const re = /{{>\s*([a-zA-Z0-9_\-]+)\s*}}/g;
	const names = new Set();
	let m;
	while ((m = re.exec(src))) names.add(m[1]);
	return Array.from(names);
}

/**
 * Parse YAML front-matter at the top of the source.
 * @param {string} src Markdown with optional front-matter
 * @returns {{ meta:Object, body:string }}
 */
function readFrontMatter(src) {
	if (!src.startsWith('---')) return { meta: {}, body: src };
	const end = src.indexOf('\n---', 3);
	if (end === -1) return { meta: {}, body: src };
	const yaml = src.slice(3, end).trim();
	const body = src.slice(end + 4);
	const meta = parseYamlLite(yaml);
	return { meta, body };
}

/**
 * Rebuild source with updated front-matter.
 * @param {string} src Original source
 * @param {Object} meta New meta to serialise into YAML
 * @returns {string} updated source
 */
function writeFrontMatter(src, meta) {
	const { body } = readFrontMatter(src);
	const yaml = emitYamlLite(meta);
	return `---\n${yaml}\n---\n${body.replace(/^\n*/, '')}`;
}

/**
 * Very small YAML reader (flat key:value, bools, ints).
 * @param {string} y
 * @returns {Object}
 */
function parseYamlLite(y) {
	const obj = {};
	y.split('\n').forEach(line => {
		const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!m) return;
		let val = m[2];
		if (/^\d+$/.test(val)) val = Number(val);
		if (val === 'true') val = true;
		if (val === 'false') val = false;
		obj[m[1]] = val;
	});
	return obj;
}

/**
 * Very small YAML writer (flat key:value).
 * @param {Object} o
 * @returns {string}
 */
function emitYamlLite(o) {
	return Object.entries(o || {})
		.map(([k, v]) => `${k}: ${String(v)}`)
		.join('\n');
}

/**
 * Insert text at the current cursor position in a textarea.
 * @param {HTMLTextAreaElement} textarea
 * @param {string} snippet
 * @returns {void}
 */
function insertAtCursor(textarea, snippet) {
	const { selectionStart: s, selectionEnd: e, value } = textarea;
	textarea.value = value.slice(0, s) + snippet + value.slice(e);
	textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Quick picker for common Mustache tags.
 * @returns {void}
 */
function onInsertTag() {
	const tags = [
		'{{study.title}}', '{{project.name}}', '{{participant.id}}',
		'{{#tasks}}…{{/tasks}}', '{{#study.remote}}…{{/study.remote}}'
	];
	const pick = prompt('Insert tag (example):\n' + tags.join('\n'));
	if (pick) {
		insertAtCursor($('#guide-source'), pick);
		preview();
	}
}

/**
 * Debounce utility.
 * @param {Function} fn
 * @param {number} [ms=200]
 * @returns {Function}
 */
function debounce(fn, ms = 200) {
	let t;
	return (...a) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...a), ms);
	};
}

/**
 * Safe nested getter that tolerates falsy values.
 * @param {Object} obj
 * @param {string[]} pathArr
 * @returns {*|undefined}
 */
function getPath(obj, pathArr) {
	return pathArr.reduce((acc, k) => {
		if (acc == null) return undefined; /* stop only on null/undefined */
		if (typeof acc !== 'object') return undefined;
		return (k in acc) ? acc[k] : undefined;
	}, obj);
}

/**
 * Minimal HTML escaper for table & inputs.
 * @param {*} s
 * @returns {string}
 */
function escapeHtml(s) {
	return (s ?? '').toString()
		.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Announce a message to the live region.
 * @param {string} msg
 * @returns {void}
 */
function announce(msg) {
	$('#sr-live').textContent = msg;
}
