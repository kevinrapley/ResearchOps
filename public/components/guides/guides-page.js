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

/** @param {string} s @param {ParentNode} [r=document] */
const $ = (s, r = document) => r.querySelector(s);
/** @param {string} s @param {ParentNode} [r=document] */
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* -------------------- boot -------------------- */
window.addEventListener('DOMContentLoaded', async () => {
	const url = new URL(location.href);
	const pid = url.searchParams.get('pid') || '';
	const sid = url.searchParams.get('sid') || '';

	// Breadcrumb + context
	await hydrateCrumbs({ pid, sid });

	// List guides
	await loadGuides(sid);

	// Wire actions
	wireGlobalActions();
	wireEditor();
});

/* -------------------- title helpers -------------------- */

/**
 * Compute the Airtable-formula-equivalent title.
 * LEFT(Description, 80) else "Method — YYYY-MM-DD" (UTC date).
 * @param {{description?: string, method?: string, createdAt?: string}} s
 * @returns {string}
 */
function computeStudyTitle({ description = '', method = '', createdAt = '' } = {}) {
	if (description && description.trim()) return description.trim().slice(0, 80);
	const d = createdAt ? new Date(createdAt) : new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${method || 'Study'} — ${yyyy}-${mm}-${dd}`;
}

/**
 * Returns a study that always has a `.title` property.
 * @template T extends object
 * @param {T & { title?: string, Title?: string, description?: string, method?: string, createdAt?: string }} s
 */
function withSafeTitle(s) {
	return { ...s, title: s.title || s.Title || computeStudyTitle(s) };
}

/* -------------------- crumbs + context -------------------- */

/**
 * Hydrate breadcrumbs and stash a stable context with a safe study title.
 * @param {{pid:string, sid:string}} param0
 */
async function hydrateCrumbs({ pid, sid }) {
	try {
		// Project
		const projRes = await fetch(`/api/projects/${encodeURIComponent(pid)}`, { cache: 'no-store' });
		const project = projRes.ok ? await projRes.json() : {};

		// Study (align to Study page behaviour: list → find)
		const listRes = await fetch(`/api/studies?project=${encodeURIComponent(pid)}`, { cache: 'no-store' });
		const js = listRes.ok ? await listRes.json() : {};
		const studies = Array.isArray(js?.studies) ? js.studies : [];
		const rawStudy = studies.find(s => s.id === sid) || {};
		const study = withSafeTitle(rawStudy);

		// Breadcrumb labels + links
		const projCrumb = $('#breadcrumb-project');
		if (projCrumb) {
			projCrumb.href = `/pages/project-dashboard/?id=${encodeURIComponent(pid)}`;
			projCrumb.textContent = project?.name || 'Project';
		}

		const studyCrumb = $('#breadcrumb-study');
		if (studyCrumb) {
			studyCrumb.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
			studyCrumb.textContent = study.title || 'Study';
		}

		const sub = $('[data-bind="study.title"]');
		if (sub) sub.textContent = study.title || '—';

		// Back link to Study page
		const back = $('#back-to-study');
		if (back) back.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;

		// Stash context used by preview/export
		window.__guideCtx = { project, study };
	} catch (e) {
		console.warn('Crumb hydrate failed', e);
		$('[data-bind="study.title"]')?.textContent = '—';
		window.__guideCtx = { project: {}, study: { title: 'Study' } };
	}
}

/* -------------------- list guides -------------------- */

/**
 * Load all guides for this study and render table.
 * @param {string} studyId
 */
async function loadGuides(studyId) {
	const tbody = $('#guides-tbody');
	try {
		const res = await fetch(`/api/guides?study=${encodeURIComponent(studyId)}`, { cache: 'no-store' });
		const list = res.ok ? await res.json() : [];
		if (!Array.isArray(list) || !list.length) {
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
	} catch (e) {
		console.error(e);
		tbody.innerHTML = `<tr><td colspan="6">Failed to load guides.</td></tr>`;
	}
}

/* -------------------- global actions -------------------- */

function wireGlobalActions() {
	$('#btn-new').addEventListener('click', () => startNewGuide());
	$('#btn-import').addEventListener('click', importMarkdownFlow);

	document.addEventListener('click', (e) => {
		const m = $('#export-menu')?.closest('.menu');
		if (!m) return;
		if (m.contains(e.target)) return;
		m.removeAttribute('aria-expanded');
	});

	$('#btn-export').addEventListener('click', () => {
		const menu = $('#export-menu')?.closest('.menu');
		if (!menu) return;
		const expanded = menu.getAttribute('aria-expanded') === 'true';
		menu.setAttribute('aria-expanded', expanded ? 'false' : 'true');
	});
	$('#export-menu').addEventListener('click', (e) => {
		if (e.target.matches?.('[data-export]')) doExport(e.target.dataset.export);
	});
}

/* -------------------- editor -------------------- */

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

async function startNewGuide() {
	$('#editor-section').classList.remove('is-hidden');
	window.__openGuideId = undefined; // reset
	$('#guide-title').value = 'Untitled guide';
	$('#guide-status').textContent = 'draft';
	$('#guide-source').value = DEFAULT_SOURCE.trim();
	populatePatternList(listStarterPatterns());
	populateVariablesForm({});
	await preview();
	$('#guide-title').focus();
	announce('Started a new guide');
}

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
	} catch (e) {
		console.error(e);
		announce('Failed to open guide');
	}
}

/**
 * Render preview with a **safe study title** available for {{study.title}}.
 */
async function preview() {
	const source = $('#guide-source').value;
	const { project, study: rawStudy } = window.__guideCtx || {};
	const study = withSafeTitle(rawStudy); // ← ensure .title exists
	const meta = readFrontMatter(source).meta;
	const context = buildContext({ project, study, session: {}, participant: {}, meta });
	const partialNames = collectPartialNames(source);
	const partials = await buildPartials(partialNames).catch(() => ({}));
	const out = await renderGuide({ source, context, partials });
	$('#guide-preview').innerHTML = out.html;
	runLints({ source, context, partials });
}

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

/* -------------------- drawers: patterns -------------------- */
function openPatternDrawer() {
	$('#drawer-patterns').hidden = false;
	$('#pattern-search').focus();
	announce('Pattern drawer opened');
}

function closePatternDrawer() {
	$('#drawer-patterns').hidden = true;
	$('#btn-insert-pattern').focus();
	announce('Pattern drawer closed');
}

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

function onPatternSearch(e) {
	const q = e.target.value.trim().toLowerCase();
	populatePatternList(searchPatterns(q));
}

/* -------------------- drawers: variables -------------------- */
function openVariablesDrawer() {
	const src = $('#guide-source').value;
	const { meta } = readFrontMatter(src);
	populateVariablesForm(meta || {});
	$('#drawer-variables').hidden = false;
	$('#drawer-variables').focus();
}

function closeVariablesDrawer() {
	$('#drawer-variables').hidden = true;
	$('#btn-variables').focus();
}

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

function onVarsEdit() {
	const src = $('#guide-source').value;
	const fm = readFrontMatter(src);
	const formVals = {};
	$$('#variables-form input').forEach(i => formVals[i.id.replace(/^var-/, '')] = i.value);
	const rebuilt = writeFrontMatter(src, { ...fm.meta, ...formVals });
	$('#guide-source').value = rebuilt;
	preview();
}

/* -------------------- export -------------------- */
async function doExport(kind) {
	const source = $('#guide-source').value;
	const { project, study: rawStudy } = window.__guideCtx || {};
	const study = withSafeTitle(rawStudy); // ensure .title
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

/* -------------------- helpers -------------------- */
function runLints({ source, context, partials }) {
	const out = $('#lint-output');
	const warnings = [];

	// Unknown partials
	const parts = collectPartialNames(source);
	for (const p of parts) {
		if (!(p in partials)) warnings.push(`Unknown partial: {{> ${p}}}`);
	}

	// Simple tag existence ({{study.something}})
	const tagRegex = /{{\s*([a-z0-9_.]+)\s*}}/gi;
	let m;
	while ((m = tagRegex.exec(source))) {
		const path = m[1].split('.');
		if (!getPath(context, path)) warnings.push(`Missing value for {{${m[1]}}}`);
	}

	out.textContent = warnings[0] || 'No issues';
}

function collectPartialNames(src) {
	const re = /{{>\s*([a-zA-Z0-9_\-]+)\s*}}/g;
	const names = new Set();
	let m;
	while ((m = re.exec(src))) names.add(m[1]);
	return Array.from(names);
}

function readFrontMatter(src) {
	if (!src.startsWith('---')) return { meta: {}, body: src };
	const end = src.indexOf('\n---', 3);
	if (end === -1) return { meta: {}, body: src };
	const yaml = src.slice(3, end).trim();
	const body = src.slice(end + 4);
	const meta = parseYamlLite(yaml);
	return { meta, body };
}

function writeFrontMatter(src, meta) {
	const { body } = readFrontMatter(src);
	const yaml = emitYamlLite(meta);
	return `---\n${yaml}\n---\n${body.replace(/^\n*/, '')}`;
}

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

function emitYamlLite(o) {
	return Object.entries(o || {})
		.map(([k, v]) => `${k}: ${String(v)}`)
		.join('\n');
}

function insertAtCursor(textarea, snippet) {
	const { selectionStart: s, selectionEnd: e, value } = textarea;
	textarea.value = value.slice(0, s) + snippet + value.slice(e);
	textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

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

function debounce(fn, ms = 200) {
	let t;
	return (...a) => { clearTimeout(t);
		t = setTimeout(() => fn(...a), ms); };
}

/**
 * Safe nested property get by path array.
 * @param {unknown} obj
 * @param {string[]} pathArr
 * @returns {unknown}
 */
function getPath(obj, pathArr) {
	return pathArr.reduce((acc, k) => {
		if (acc == null) return undefined;
		if (typeof acc !== 'object') return undefined;
		return (k in acc) ? acc[k] : undefined;
	}, obj);
}

function escapeHtml(s) {
	return (s ?? '').toString()
		.replace(/&/g, '&amp;').replace(/</g, '&lt;')
		.replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function announce(msg) {
	$('#sr-live').textContent = msg;
}
