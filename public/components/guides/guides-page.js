/**
 * @file guides-page.js
 * @module GuidesPage
 * @summary Discussion Guides hub (list + editor bootstrap) — JSON-only variables.
 *
 * @description
 * - Variables source of truth: Airtable “Variables (JSON)” column (guide.variables).
 * - Preview/render: Mustache uses ctx.meta from VariableManager JSON only.
 * - Save: PATCH/POST { title, sourceMarkdown, variables }
 * - Drawers are mutually exclusive: opening **Variables** closes **Pattern/Tag**; opening **Pattern** closes **Variables/Tag**; opening **Tag** closes **Variables/Pattern**.
 * - Variables drawer provides independent “Save variables” (PATCH variables only) and “Discard” to revert to last saved values.
 *
 * @requires /lib/mustache.min.js
 * @requires /lib/marked.min.js
 * @requires /lib/purify.min.js
 * @requires /components/guides/api.js
 * @requires /components/guides/front-matter.js
 * @requires /components/guides/guide-editor.js
 * @requires /components/guides/pattern-controller.js
 * @requires /components/guides/patterns.js
 * @requires /components/guides/variable-manager.js
 */

import { marked } from '/lib/marked.min.js';
import DOMPurify from '/lib/purify.min.js';

import { fetchJSON, loadStudies } from '/components/guides/api.js';
import {
	extractAndStripFrontMatter,
	parseSimpleYaml,
	stripFrontMatter,
} from '/components/guides/front-matter.js';
import {
	renderGuide,
	buildPartials,
	DEFAULT_SOURCE,
} from '/components/guides/guide-editor.js?v=study-guides-delete-confirmation-20260605';
import { listStarterPatterns } from '/components/guides/patterns.js?v=study-guides-delete-confirmation-20260605';
import { createPatternController } from '/components/guides/pattern-controller.js';
import { VariableManager } from '/components/guides/variable-manager.js?v=study-guides-delete-confirmation-20260605';

/* ============================================================================
 * qS helpers / small utilities
 * ============================================================================ */

const $ = (s, r = document) => r.querySelector(s);

let varManager = null; // VariableManager instance (JSON-only)
let __openGuideId = null; // currently open guide id
let __guideCtx = { project: {}, study: {} }; // page context

let __lintErrors = [];

/* -------------------- boot -------------------- */
async function bootGuidesPage() {
	try {
		console.log('[guides] Boot starting...');

		installLoadingKiller();
		wireGlobalActions();
		wireEditor();

		const url = new URL(location.href);
		const pid = url.searchParams.get('pid');
		const sid = url.searchParams.get('sid');
		const gid = url.searchParams.get('gid'); // optional direct-open

		console.log('[guides] URL params - pid:', pid, 'sid:', sid, 'gid:', gid);

		if (!pid || !sid) {
			console.error('[guides] Missing required URL parameters');
			announce('Missing project or study ID in URL');
			const tbody = document.querySelector('#guides-tbody');
			if (tbody) {
				tbody.innerHTML = '';
			}
			setGuidesListState(
				'unavailable',
				'The page needs a project and study ID before it can load saved guides. You can still review the editor layout below.'
			);
			return;
		}

		// Hydrate breadcrumbs/context first so __guideCtx.study.id is available
		await hydrateCrumbs({ pid, sid });
		console.log('[guides] Context hydrated:', __guideCtx);

		// Patterns don't block guides table; failure shouldn't stall the UI
		try {
			await refreshPatternList();
			console.log('[guides] Patterns loaded');
		} catch (e) {
			console.warn('[guides] Pattern load failed:', e);
		}

		// If gid provided, try to open it first (does not block loadGuides)
		if (gid) {
			try {
				await openGuide(gid);
				window.__hasAutoOpened = true;
				console.log('[guides] Opened guide from URL:', gid);
			} catch (err) {
				console.warn('[guides] Boot open gid failed:', err);
			}
		}

		// Always render the table; it manages its own loading/fallback UI
		console.log('[guides] Loading guides for study:', sid);
		await loadGuides(sid, { autoOpen: !window.__hasAutoOpened });
	} catch (err) {
		console.error('[guides] Boot fatal:', err);
		announce('Failed to initialise the page.');
		// As a last resort, unstick any "Loading…" spinners we know about
		const stuck = document.querySelector("#guides-loading, [data-role='guides-loading']");
		if (stuck) stuck.hidden = true;
		const tbody =
			document.querySelector('#guides-tbody') ||
			document.querySelector('#guides-table tbody') ||
			document.querySelector('[data-guides-tbody]');
		if (tbody) {
			tbody.innerHTML = `<tr class="govuk-table__row"><td colspan="6" class="govuk-table__cell muted guides-table-status">Failed to initialise guides: ${escapeHtml(err.message || 'Unknown error')}</td></tr>`;
		}
	}
}

const patternController = createPatternController({
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
});

const {
	bindPatternDocumentActions,
	bindPatternTrayActions,
	closePatternDrawer,
	openPatternDrawer,
	onPatternSearch,
	refreshPatternList,
} = patternController;

if (document.readyState === 'loading') {
	window.addEventListener('DOMContentLoaded', bootGuidesPage, { once: true });
} else {
	bootGuidesPage();
}

/* -------------------- breadcrumbs / context -------------------- */

async function hydrateCrumbs({ pid, sid }) {
	try {
		const [projects, studies] = await Promise.all([
			fetchJSON(`/api/projects`)
				.then((d) => d.projects || [])
				.catch(() => []),
			loadStudies(pid),
		]);

		const project = projects.find((p) => p.id === pid) || { name: '(Unnamed project)' };
		const studyRaw = Array.isArray(studies) ? studies.find((s) => s.id === sid) || {} : {};
		const study = ensureStudyTitle(studyRaw);

		const bcProj = document.getElementById('breadcrumb-project');
		if (bcProj) {
			bcProj.href = `/pages/project-dashboard/?id=${encodeURIComponent(pid)}`;
			bcProj.textContent = project.name || 'Project';
		}

		const bcStudy = document.getElementById('breadcrumb-study');
		if (bcStudy) {
			bcStudy.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;
			bcStudy.textContent = study.title;
		}

		const sub = document.querySelector('[data-bind="study.title"]');
		if (sub) sub.textContent = study.title;

		const back = document.getElementById('back-to-study');
		if (back)
			back.href = `/pages/study/?pid=${encodeURIComponent(pid)}&sid=${encodeURIComponent(sid)}`;

		document.title = `Discussion Guides — ${study.title}`;

		__guideCtx = {
			project: { id: project.id, name: project.name || '(Unnamed project)' },
			study,
		};
	} catch (err) {
		console.warn('Crumb hydrate failed', err);
		__guideCtx = { project: { name: '(Unnamed project)' }, study: {} };
	}
}

/* -------------------- list + open -------------------- */

/**
 * Aggressively hide/remove any "Loading…" UI that might linger.
 * - Hides known spinners
 * - Removes stray text nodes / wrappers containing only Loading…, Loading..., or Loading
 * - Works even if they were injected later by other scripts
 */
function nukeGuidesLoadingUI() {
	const KNOWN = [
		'#guides-loading',
		"[data-role='guides-loading']",
		'[data-guides-loading]',
		'#guides-spinner',
		'.js-guides-loading',
		"[aria-busy='true']",
	];
	// Hide known elements
	for (const sel of KNOWN) {
		document.querySelectorAll(sel).forEach((el) => {
			el.hidden = true;
			el.setAttribute('aria-hidden', 'true');
		});
	}

	// Remove nodes whose *only* visible text is "Loading…/Loading..."
	const LOADING_RE = /^(loading…?|loading\.\.\.)$/i;
	const candidates = Array.from(document.querySelectorAll('div, span, p, td, li, h2, h3, h4'));
	for (const el of candidates) {
		const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
		if (LOADING_RE.test(text)) {
			// If this looks like a naked loader stub, remove it outright
			if (!el.querySelector('button,table,tbody,thead,tr,td')) {
				el.remove();
			} else {
				el.hidden = true;
				el.setAttribute('aria-hidden', 'true');
			}
		}
	}
}

/**
 * Observe future DOM mutations for any newly inserted "Loading…" nodes
 * and squash them immediately. Call once on boot.
 */
function installLoadingKiller() {
	try {
		const obs = new MutationObserver(() => nukeGuidesLoadingUI());
		obs.observe(document.documentElement, { childList: true, subtree: true });
		// One immediate pass too
		nukeGuidesLoadingUI();
	} catch {
		/* no-op */
	}
}

/**
 * Ensure a guides table skeleton exists and return its <tbody>.
 * This prevents "stuck on Loading…" when the original DOM isn't present
 * or when a loader placeholder never gets replaced.
 */
function ensureGuidesTableSkeleton() {
	// Try to find an existing tbody first
	let tbody =
		document.querySelector('#guides-tbody') ||
		document.querySelector('#guides-table tbody') ||
		document.querySelector('[data-guides-tbody]');

	if (tbody) return tbody;

	// Try to find a sensible container to mount into
	let host =
		document.querySelector('#guides-list-section') ||
		document.querySelector('#guides-section') ||
		document.querySelector('[data-guides-section]') ||
		document.querySelector('#editor-section') ||
		document.querySelector('main') ||
		document.body;

	// Create a minimal table structure
	const wrapper = document.createElement('div');
	wrapper.id = 'guides-fallback-wrapper';
	wrapper.className = 'table-wrap';
	wrapper.innerHTML = `
    <table class="govuk-table" id="guides-table">
      <thead class="govuk-table__head">
        <tr class="govuk-table__row">
          <th scope="col" class="govuk-table__header">Title</th>
          <th scope="col" class="govuk-table__header">Status</th>
          <th scope="col" class="govuk-table__header">Version</th>
          <th scope="col" class="govuk-table__header">Updated</th>
          <th scope="col" class="govuk-table__header">Owner</th>
          <th scope="col" class="govuk-table__header"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody id="guides-tbody" class="govuk-table__body"></tbody>
    </table>
  `;
	host.appendChild(wrapper);
	return wrapper.querySelector('#guides-tbody');
}

function setGuidesListState(state, message) {
	const tableWrap = $('#guides-table-wrap') || $('#guides-table')?.closest('.table-wrap');
	const emptyState = $('#guides-empty');
	const heading = emptyState?.querySelector('.govuk-heading-s');
	const body = emptyState?.querySelector('.govuk-body');

	if (state === 'empty' || state === 'unavailable') {
		if (tableWrap) tableWrap.hidden = true;
		if (emptyState) {
			emptyState.hidden = false;
			if (heading)
				heading.textContent =
					state === 'unavailable' ? 'Guides cannot be loaded yet' : 'No guides yet';
			if (body) {
				body.textContent =
					message ||
					'Draft a discussion guide in the editor, save it as a draft, then publish it when it is ready to use for fieldwork.';
			}
		}
		return;
	}

	if (emptyState) emptyState.hidden = true;
	if (tableWrap) tableWrap.hidden = false;
}

async function loadGuides(studyId, opts = {}) {
	console.log('[guides] loadGuides called with studyId:', studyId);

	// Always prepare a tbody to paint into
	const tbody = ensureGuidesTableSkeleton();
	console.log('[guides] tbody element:', tbody);

	// Small helpers
	const paint = (html) => {
		if (tbody) {
			tbody.innerHTML = html;
			console.log('[guides] painted:', html.substring(0, 100));
		} else {
			console.error('[guides] tbody is null, cannot paint');
		}
	};
	const row = (msg) =>
		`<tr class="govuk-table__row"><td colspan="6" class="govuk-table__cell muted guides-table-status">${escapeHtml(msg)}</td></tr>`;

	// Show loading row, then *immediately* kill any external loaders
	paint(row('Loading…'));
	nukeGuidesLoadingUI();

	// If no study id, finish now
	if (!studyId) {
		console.warn('[guides] loadGuides: no studyId');
		paint('');
		setGuidesListState(
			'unavailable',
			'Select a study before reviewing or drafting discussion guides.'
		);
		nukeGuidesLoadingUI();
		return;
	}

	// Safety timeout: if the network hangs, we still unstick the UI
	const ac = new AbortController();
	const timer = setTimeout(() => {
		console.warn('[guides] Request timed out after 8s');
		try {
			ac.abort();
		} catch {}
	}, 8000);

	try {
		console.log('[guides] Fetching from:', `/api/guides?study=${encodeURIComponent(studyId)}`);

		// Fetch with heuristics so HTML-with-JSON-body won't break us
		const data = await fetchJSON(
			`/api/guides?study=${encodeURIComponent(studyId)}`,
			{ headers: { Accept: 'application/json' }, signal: ac.signal },
			{ allowHeuristics: true, emptyAs: { ok: false, guides: [] } }
		);

		console.log('[guides] Received data:', data);

		// Defensive shape checks
		if (!data || typeof data !== 'object') {
			console.warn('[guides] unexpected payload:', data);
			paint(row('Failed to load guides.'));
			nukeGuidesLoadingUI();
			return;
		}

		const guides = Array.isArray(data.guides) ? data.guides : [];
		console.log('[guides] Parsed guides array:', guides.length, 'items');

		guides.sort(
			(a, b) =>
				(Date.parse(b.updatedAt || b.createdAt || 0) || 0) -
				(Date.parse(a.updatedAt || a.createdAt || 0) || 0)
		);

		if (!guides.length) {
			paint('');
			setGuidesListState('empty');
			nukeGuidesLoadingUI();
			return;
		}

		setGuidesListState('table');

		// Render rows
		const fr = document.createDocumentFragment();
		for (const g of guides) {
			const tr = document.createElement('tr');
			tr.className = 'govuk-table__row';

			// Format the updated date
			let dateStr = '—';
			try {
				const date = new Date(g.updatedAt || g.createdAt || 0);
				if (!isNaN(date.getTime())) {
					dateStr = date.toLocaleString('en-GB', {
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					});
				}
			} catch (e) {
				console.warn('[guides] Date parsing error:', e);
			}

			tr.innerHTML = `
        <td class="govuk-table__cell">${escapeHtml(g.title || 'Untitled')}</td>
        <td class="govuk-table__cell">${escapeHtml(g.status || 'draft')}</td>
        <td class="govuk-table__cell">v${Number.isFinite(g.version) ? g.version : parseInt(g.version, 10) || 0}</td>
        <td class="govuk-table__cell">${dateStr}</td>
        <td class="govuk-table__cell">${escapeHtml(g.createdBy?.name || '—')}</td>
        <td class="govuk-table__cell"><button class="link-like" data-open="${g.id}">Open</button></td>`;
			fr.appendChild(tr);
		}

		// Clear and append
		paint('');
		tbody.appendChild(fr);
		console.log('[guides] Table populated with', guides.length, 'rows');

		// Wire open buttons
		tbody.querySelectorAll('button[data-open]').forEach((btn) => {
			btn.addEventListener('click', () => {
				window.__hasAutoOpened = true;
				openGuide(btn.dataset.open);
			});
		});

		// Auto-open newest if requested
		if (opts.autoOpen && !window.__hasAutoOpened && !__openGuideId && guides[0]?.id) {
			window.__hasAutoOpened = true;
			console.log('[guides] Auto-opening first guide:', guides[0].id);
			try {
				await openGuide(guides[0].id);
			} catch (e) {
				console.warn('autoOpen failed:', e);
			}
		}

		// Success: nuke any external "Loading…" remnants
		nukeGuidesLoadingUI();
		console.log('[guides] Load complete, UI updated');
	} catch (err) {
		const aborted = err && err.name === 'AbortError';
		console.error('[guides] loadGuides error:', err);
		paint('');
		setGuidesListState(
			'unavailable',
			aborted
				? 'The guide list is taking longer than expected. Try again shortly.'
				: 'The guide list could not be loaded. You can still draft a guide and save it when the service is available.'
		);
		nukeGuidesLoadingUI();
	} finally {
		clearTimeout(timer);
		// One more sweep in case anything re-inserted a loader
		setTimeout(nukeGuidesLoadingUI, 0);
		setTimeout(nukeGuidesLoadingUI, 300);
	}
}

/* -------------------- syntax highlighting (unchanged) -------------------- */

function highlightMustache(source) {
	if (!source) return '';

	let highlighted = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	const mustacheTags = [];
	const tagPattern = /\{\{[^}]*\}\}/g;
	let match;
	while ((match = tagPattern.exec(source)) !== null) {
		mustacheTags.push({ start: match.index, end: match.index + match[0].length });
	}

	highlighted = highlighted
		.replace(/(\{\{!)([^}]*?)(\}\})/g, '<span class="token comment">$1$2$3</span>')
		.replace(
			/(\{\{&gt;)\s*([^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">{{&gt;</span><span class="token keyword">$2</span><span class="token mustache-tag">}}</span></span>'
		)
		.replace(
			/(\{\{)(#[^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>'
		)
		.replace(
			/(\{\{)(\/[^}]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1$2$3</span></span>'
		)
		.replace(
			/(\{\{)([^}#\/!&gt;]+?)(\}\})/g,
			'<span class="token mustache"><span class="token mustache-tag">$1</span><span class="token mustache-variable">$2</span><span class="token mustache-tag">$3</span></span>'
		);

	highlighted = highlighted
		.replace(/^(#{1,6})\s+(.+)$/gm, '<span class="token title">$1 $2</span>')
		.replace(/(\*\*|__)(?=\S)([^*_<]+?)(?<=\S)\1/g, '<span class="token bold">$1$2$1</span>')
		.replace(/(`+)([^`<]+?)\1/g, '<span class="token code">$1$2$1</span>');

	return highlighted;
}

function syncHighlighting() {
	const textarea = document.getElementById('guide-source');
	const codeElement = document.getElementById('guide-source-code');
	if (!textarea || !codeElement) return;

	const source = textarea.value;
	codeElement.innerHTML = highlightMustache(source);

	const highlightContainer = document.getElementById('guide-source-highlight');
	if (highlightContainer) {
		highlightContainer.scrollTop = textarea.scrollTop;
		highlightContainer.scrollLeft = textarea.scrollLeft;
	}
}

/* -------------------- editor wiring -------------------- */

function wireEditor() {
	const saveVarsBtn = document.getElementById('btn-save-vars');
	if (saveVarsBtn) saveVarsBtn.addEventListener('click', onSaveVariablesOnly);

	const resetVarsBtn = document.getElementById('btn-reset-vars');
	if (resetVarsBtn) resetVarsBtn.addEventListener('click', onResetVariables);

	// Pattern drawer
	const insertPat = $('#btn-insert-pattern');
	if (insertPat) insertPat.addEventListener('click', openPatternDrawer);
	const patClose = $('#drawer-patterns-close');
	if (patClose) patClose.addEventListener('click', closePatternDrawer);
	const patSearch = $('#pattern-search');
	if (patSearch) patSearch.addEventListener('input', onPatternSearch);
	bindPatternTrayActions();
	bindPatternDocumentActions();

	// Variables drawer
	const varsBtn = $('#btn-variables');
	if (varsBtn) varsBtn.addEventListener('click', openVariablesDrawer);
	const varsClose = $('#drawer-variables-close');
	if (varsClose) varsClose.addEventListener('click', closeVariablesDrawer);

	// Tag dialog (mutual exclusivity with drawers)
	const tagBtn = $('#btn-insert-tag');
	if (tagBtn) tagBtn.addEventListener('click', openTagDialog);

	// Source editor
	const src = $('#guide-source');
	if (src) {
		src.addEventListener(
			'input',
			debounce(function () {
				syncHighlighting();
				preview();
				validateGuide();
			}, 150)
		);

		src.addEventListener(
			'scroll',
			function () {
				const highlight = $('#guide-source-highlight');
				if (highlight) {
					highlight.scrollTop = src.scrollTop;
					highlight.scrollLeft = src.scrollLeft;
				}
			},
			{ passive: true }
		);

		setTimeout(syncHighlighting, 100);
	}

	// Title
	const title = $('#guide-title');
	if (title)
		title.addEventListener(
			'input',
			debounce(function () {
				announce('Title updated');
				validateGuide();
			}, 400)
		);

	// Save/Publish
	const saveBtn = $('#btn-save');
	if (saveBtn) saveBtn.addEventListener('click', onSave);
	const pubBtn = $('#btn-publish');
	if (pubBtn) pubBtn.addEventListener('click', onPublish);

	// Cmd/Ctrl+S
	document.addEventListener('keydown', function (e) {
		var k = e && e.key ? e.key.toLowerCase() : '';
		if ((e.metaKey || e.ctrlKey) && k === 's') {
			e.preventDefault();
			onSave();
		}
	});
}

/* -------------------- new / open / preview -------------------- */

async function startNewGuide() {
	try {
		$('#editor-section')?.classList.remove('is-hidden');

		__openGuideId = null;

		const titleEl = $('#guide-title');
		if (titleEl) titleEl.value = 'Untitled guide';

		const statusEl = $('#guide-status');
		if (statusEl) statusEl.textContent = 'draft';

		const defaultSrc =
			typeof DEFAULT_SOURCE === 'string' && DEFAULT_SOURCE.trim()
				? DEFAULT_SOURCE.trim()
				: '# New guide\n\nWelcome. Start writing…';

		const srcEl = $('#guide-source');
		if (srcEl) {
			// Force seed if empty
			srcEl.value = srcEl.value && srcEl.value.trim() ? srcEl.value : defaultSrc;
		}

		syncHighlighting();

		try {
			await refreshPatternList();
		} catch (err) {
			console.warn('Pattern list failed:', err);
		}

		// JSON-only: clear variables drawer
		populateVariablesFormEnhanced({});

		await preview();
		validateGuide();

		titleEl && titleEl.focus();
		announce('Started a new guide');
	} catch (err) {
		console.error('startNewGuide fatal:', err);
		announce('Could not start a new guide');
	}
}

/**
 * Open a guide and normalise for JSON-only mode.
 * API expected shape: { id, title, sourceMarkdown, variables }
 */
async function openGuide(id) {
	try {
		if (!id) throw new Error('No guide id provided to openGuide().');

		let guide = null;

		// 1) Preferred path: load by Airtable record id
		try {
			const js = await fetchJSON(`/api/guides/${encodeURIComponent(id)}`).catch((e) => {
				console.warn('openGuide: fetch by id failed', e);
				return null;
			});
			if (js && (js.guide || js.id || js.title)) {
				guide = js.guide || js; // tolerate both API response shapes
			}
		} catch (err) {
			console.warn('openGuide: fetch by id threw', err);
		}

		// 2) Optional fallback: list-by-study → find guide in list
		if (!guide) {
			const sid = __guideCtx?.study?.id || '';
			if (sid) {
				try {
					const list = await fetchJSON(
						`/api/guides?study=${encodeURIComponent(sid)}`,
						{},
						{ emptyAs: { guides: [] } }
					);
					const arr = Array.isArray(list?.guides) ? list.guides : [];
					guide = arr.find((g) => g.id === id) || null;
				} catch (err) {
					console.warn('openGuide: list fallback failed', err);
				}
			} else {
				// No study context yet → don't hard-fail; just announce and bail cleanly
				announce('Could not open guide (no study context available for fallback).');
				return;
			}
		}

		if (!guide) throw new Error('Guide not found');

		__openGuideId = guide.id;
		$('#editor-section')?.classList.remove('is-hidden');
		if ($('#guide-title')) $('#guide-title').value = guide.title || 'Untitled';
		if ($('#guide-status')) $('#guide-status').textContent = guide.status || 'draft';

		// JSON-only migration rules
		let source = String(guide.sourceMarkdown || '');
		let jsonVars =
			guide && typeof guide.variables === 'object' && guide.variables ? guide.variables : {};

		if (!jsonVars || Object.keys(jsonVars).length === 0) {
			// One-time import from YAML if present
			const { stripped, yaml } = extractAndStripFrontMatter(source);
			if (yaml) {
				try {
					const imported = parseSimpleYaml(yaml);
					if (imported && Object.keys(imported).length) {
						jsonVars = imported;
					}
				} catch {}
				source = stripped;
			} else {
				source = stripFrontMatter(source);
			}
		} else {
			source = stripFrontMatter(source);
		}

		if ($('#guide-source')) $('#guide-source').value = source;
		syncHighlighting();

		await refreshPatternList();

		// Variables drawer now seeded from JSON only
		populateVariablesFormEnhanced(jsonVars || {});

		await preview();
		validateGuide();
		announce(`Opened guide "${guide.title || 'Untitled'}"`);
	} catch (e) {
		console.warn(e);
		announce(`Failed to open guide: ${e && e.message ? e.message : 'Unknown error'}`);
	}
}

/**
 * Preview uses JSON variables
 */
async function preview() {
	const srcEl = document.getElementById('guide-source');
	const prev = document.getElementById('guide-preview');
	if (!srcEl || !prev) return;

	// Always read the current body (front-matter is stripped only for rendering)
	const sourceRaw = srcEl.value || '';
	const source = stripFrontMatter(sourceRaw);

	// If the editor is somehow empty, show a helpful placeholder in the preview
	if (!source.trim()) {
		prev.innerHTML = `<p class="muted">No content yet. Start typing in the editor…</p>`;
		return;
	}

	const ctx = __guideCtx || {};
	const project = ensureProjectName(ctx.project || {});
	const study = ensureStudyTitle(ctx.study || {});

	// Variables from manager
	const vars =
		varManager && typeof varManager.getVariables === 'function' ? varManager.getVariables() : {};

	// Expose variables at root *and* under meta
	const context = {
		project,
		study,
		session: {},
		participant: {},
		...vars,
		meta: vars,
	};

	// Try building any referenced partials, but don't fail preview if they 404
	const names = collectPartialNames(source);
	let partials = {};
	try {
		partials = await buildPartials(names);
	} catch (e) {
		console.warn('buildPartials failed; rendering without partials', e);
		partials = {};
	}

	// Render. If for any reason html comes back falsy, fall back to raw markdown.
	let html = '';
	try {
		const out = await renderGuide({ source, context, partials });
		html = out && typeof out.html === 'string' ? out.html : '';
	} catch (e) {
		console.warn('renderGuide failed; falling back to raw markdown', e);
		html = ''; // will be replaced by fallback below
	}

	if (!html.trim()) {
		// Fallback: show the user's markdown as-is (sanitized), so the panel is never blank
		try {
			const md = marked.parse(source);
			prev.innerHTML = DOMPurify.sanitize(md);
		} catch {
			prev.textContent = source; // last-resort, plain text
		}
	} else {
		prev.innerHTML = html;
	}

	// Lints still run against the computed context/partials
	runLints({ source, context, partials });
}

/* -------------------- save / publish -------------------- */

async function onSave() {
	const validationErrors = validateGuide();
	if (validationErrors.length) {
		$('#guide-error-summary')?.focus();
		announce('Guide editor has validation errors.');
		return;
	}

	const title = ($('#guide-title')?.value || '').trim();
	const source = stripFrontMatter($('#guide-source')?.value || '');
	const variables =
		varManager && typeof varManager.getVariables === 'function' ? varManager.getVariables() : {};

	const studyId = __guideCtx?.study?.id || '';
	const id = __openGuideId;

	const body = id
		? { title, sourceMarkdown: source, variables }
		: { study_airtable_id: studyId, title, sourceMarkdown: source, variables };

	const url = id ? `/api/guides/${encodeURIComponent(id)}` : `/api/guides`;
	const method = id ? 'PATCH' : 'POST';

	try {
		const js = await fetchJSON(
			url,
			{ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
			{ emptyAs: {} }
		);

		if (!id && js && js.id) {
			__openGuideId = js.id;
		}
		announce('Guide saved');
		if (studyId) loadGuides(studyId);
	} catch (err) {
		announce(`Save failed: ${err.status || '?'} ${JSON.stringify(err.data || {})}`);
	}
}

async function onPublish() {
	const validationErrors = validateGuide();
	if (validationErrors.length) {
		$('#guide-error-summary')?.focus();
		announce('Guide editor has validation errors.');
		return;
	}

	const id = __openGuideId;
	const sid = __guideCtx?.study?.id;
	const title = ($('#guide-title')?.value || '').trim();
	if (!id || !sid) {
		announce('Save the guide before publishing.');
		return;
	}

	const url = `/api/guides/${encodeURIComponent(id)}/publish`;
	const res = await fetch(url, { method: 'POST' });

	if (res.ok) {
		$('#guide-status').textContent = 'published';
		announce(`Published "${title || 'Untitled'}"`);
		loadGuides(sid);
	} else {
		const msg = await res.text().catch(() => '');
		announce(`Publish failed: ${res.status} ${msg || ''}`.trim());
	}
}

async function onSaveVariablesOnly() {
	try {
		const id = window.__openGuideId;
		const statusEl = document.getElementById('variables-status');

		// If the guide hasn't been created yet, create it first via your normal save path
		if (!id) {
			statusEl && (statusEl.textContent = 'Creating guide and saving variables…');
			await onSave(); // creates draft + sets __openGuideId
		}

		const guideId = window.__openGuideId;
		if (!guideId) {
			throw new Error('No guide id available to save variables');
		}

		const variables = window.guidesPage?.varManager?.().getVariables?.() || {};
		statusEl && (statusEl.textContent = 'Saving variables…');

		const res = await fetch(`/api/guides/${encodeURIComponent(guideId)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ variables }),
		});

		if (!res.ok) {
			const txt = await res.text().catch(() => '');
			throw new Error(`Save failed (${res.status}): ${txt}`);
		}

		statusEl && (statusEl.textContent = 'Variables saved to Airtable.');
		announce('Variables saved');
	} catch (err) {
		console.error('[guides] save variables:', err);
		const statusEl = document.getElementById('variables-status');
		statusEl && (statusEl.textContent = `Error: ${err.message || 'Failed to save variables'}`);
		announce('Failed to save variables');
	}
}

async function onResetVariables() {
	try {
		const id = window.__openGuideId;
		const statusEl = document.getElementById('variables-status');
		if (!id) {
			// No guide yet → just clear editor state
			window.guidesPage?.varManager?.().setVariables?.({});
			statusEl && (statusEl.textContent = 'Variables cleared.');
			preview();
			return;
		}
		statusEl && (statusEl.textContent = 'Reverting to last saved variables…');
		await openGuide(id); // re-fetches and repopulates from API/Airtable
		statusEl && (statusEl.textContent = 'Variables reverted to last saved.');
		announce('Variables reverted');
	} catch (err) {
		console.error('[guides] reset variables:', err);
		const statusEl = document.getElementById('variables-status');
		statusEl && (statusEl.textContent = `Error: ${err.message || 'Failed to reset variables'}`);
	}
}

/* -------------------- import (unchanged, but preview strips YAML) -------------------- */

function importMarkdownFlow() {
	const inp = document.createElement('input');
	inp.type = 'file';
	inp.accept = '.md,text/markdown';
	inp.addEventListener('change', async function () {
		const file = inp.files && inp.files[0];
		if (!file) return;
		const text = await file.text();
		await startNewGuide();
		const srcEl = $('#guide-source');
		if (srcEl) srcEl.value = text;
		syncHighlighting();
		await preview(); // will render with stripFrontMatter()
	});
	inp.click();
}

/* -------------------- drawers: patterns -------------------- */

function getDrawerFocusTarget(drawer, preferred) {
	return (
		preferred ||
		drawer.querySelector(
			"button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
		) ||
		drawer
	);
}

function revealDrawer(drawer, preferredFocusTarget) {
	if (!drawer) return;
	drawer.removeAttribute('hidden');
	drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });

	window.requestAnimationFrame(() => {
		getDrawerFocusTarget(drawer, preferredFocusTarget)?.focus({ preventScroll: true });
	});
}

/* -------------------- variables drawer (JSON-only) -------------------- */

/** Open Variables drawer; ensure Pattern/Tag are closed first (mutual exclusivity). */
function openVariablesDrawer() {
	closePatternDrawer();
	closeTagDialog();

	const d = $('#drawer-variables');
	// Ensure actions exist if someone navigates here very early
	if (!document.getElementById('btn-save-vars')) {
		populateVariablesFormEnhanced(varManager?.getVariables?.() || {});
	}
	if (d) {
		revealDrawer(d, $('#drawer-variables-close'));
	}
	announce('Variables drawer opened');
}

/** Close Variables drawer. */
function closeVariablesDrawer() {
	const d = $('#drawer-variables');
	if (d) d.hidden = true;
	const b = $('#btn-variables');
	if (b) b.focus();
	announce('Variables drawer closed');
}

/**
 * Tag dialog open/close shims for mutual exclusivity.
 * If you later replace the prompt-based flow with a real dialog,
 * wire its show/hide here.
 */
function openTagDialog() {
	// mutual exclusivity
	closeVariablesDrawer();
	closePatternDrawer();

	// Current implementation uses a simple prompt for demo/insert:
	onInsertTag();
}

function closeTagDialog() {
	// No-op placeholder (kept for symmetry/future dialog integration)
}

/**
 * Render the VariableManager UI with initial JSON variables.
 * @param {Record<string, any>} jsonVars
 */
function populateVariablesFormEnhanced(jsonVars) {
	const form = document.getElementById('variables-form');
	if (!form) return;

	// Build the form content fresh (container + actions + status)
	form.innerHTML = `
    <div id="variable-manager-container"></div>

    <div class="govuk-button-group actions-row">
      <button id="btn-save-vars" class="govuk-button" type="button">Save variables</button>
      <button id="btn-reset-vars" class="govuk-button govuk-button--secondary" type="button">Discard changes</button>
      <button id="drawer-variables-close" class="govuk-button govuk-button--secondary" type="button">Close</button>
    </div>

    <p id="variables-status" class="govuk-body-s muted" aria-live="polite"></p>
  `;

	// Prepare initial values (keep strings readable; non-strings shown as JSON)
	const initial = {};
	const src = jsonVars || {};
	for (const k in src) {
		if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
		initial[k] = typeof src[k] === 'string' ? src[k] : JSON.stringify(src[k]);
	}

	// (Re)create manager
	varManager = new VariableManager({
		containerId: 'variable-manager-container',
		initialVariables: initial,
		onChange: () => {
			preview();
			validateGuide();
		},
		onError: (msg) => {
			console.error('[guides] Variable error:', msg);
			const s = document.getElementById('variables-status');
			if (s) s.textContent = `Error: ${msg}`;
		},
	});

	// Bind buttons NOW (since we just injected them)
	document.getElementById('btn-save-vars')?.addEventListener('click', onSaveVariablesOnly);
	document.getElementById('btn-reset-vars')?.addEventListener('click', onResetVariables);
	document
		.getElementById('drawer-variables-close')
		?.addEventListener('click', closeVariablesDrawer);
}

/* -------------------- export / helpers / lints (mostly unchanged) -------------------- */

async function doExport(kind) {
	const srcEl = $('#guide-source');
	const source = srcEl?.value || '';
	const title = $('#guide-title')?.value || 'guide';
	const sanitized = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();

	try {
		switch (kind) {
			case 'md':
				// Export the visible body
				downloadText(stripFrontMatter(source), `${sanitized}.md`, 'text/markdown');
				announce(`Exported ${title}.md`);
				break;

			case 'html':
				const previewEl = $('#guide-preview');
				if (!previewEl) {
					announce('Preview not available');
					return;
				}
				const html = buildStandaloneHtml(previewEl.innerHTML, title);
				downloadText(html, `${sanitized}.html`, 'text/html');
				announce(`Exported ${title}.html`);
				break;

			case 'pdf':
				if (typeof window.jspdf === 'undefined') {
					announce('PDF export not available (library missing)');
					return;
				}
				await exportPdf(title);
				break;

			case 'docx':
				if (typeof window.docx === 'undefined') {
					announce('DOCX export not available (library missing)');
					return;
				}
				await exportDocx(source, title);
				break;

			default:
				announce('Unknown export format');
		}
	} catch (err) {
		console.error('Export error:', err);
		announce(`Export failed: ${err.message || 'Unknown error'}`);
	}
}

function downloadText(content, filename, mimeType) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function buildStandaloneHtml(bodyHtml, title) {
	return `<!doctype html>
<html lang="en-GB">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(title)}</title>
	<style>
		body { font-family: "GDS Transport", Arial, sans-serif; line-height: 1.5; max-width: 38em; margin: 2em auto; padding: 0 1em; color: #0b0c0c; }
		h1 { font-size: 2em; margin: 1em 0 0.5em; }
		h2 { font-size: 1.5em; margin: 1em 0 0.5em; }
		h3 { font-size: 1.25em; margin: 1em 0 0.5em; }
		p { margin: 0 0 1em; }
		code { background: #f3f2f1; padding: 0.125em 0.25em; font-family: monospace; }
		pre { background: #f3f2f1; padding: 1em; overflow-x: auto; }
	</style>
</head>
<body>
	<h1>${escapeHtml(title)}</h1>
	${bodyHtml}
</body>
</html>`;
}

async function exportPdf(title) {
	const { jsPDF } = window.jspdf;
	const doc = new jsPDF();

	const preview = $('#guide-preview');
	if (!preview) throw new Error('Preview not available');

	const text = preview.textContent || '';
	doc.text(text, 10, 10);
	doc.save(`${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`);
	announce(`Exported ${title}.pdf`);
}

async function exportDocx() {
	announce('DOCX export coming soon');
}

/* -------------------- misc helpers & lints -------------------- */

function ensureStudyTitle(s) {
	s = s || {};
	var explicit = (s.title || s.Title || '').toString().trim();
	var out = { ...s };
	var method = (s.method || 'Study').trim();
	var d = s.createdAt ? new Date(s.createdAt) : new Date();
	var yyyy = d.getUTCFullYear();
	var mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	var dd = String(d.getUTCDate()).padStart(2, '0');
	out.date = out.date || out.studyDate || `${yyyy}-${mm}-${dd}`;
	out.title = explicit || method;
	out.fileName = out.fileName || `${out.title}_${out.date}`;
	return out;
}

function ensureProjectName(p) {
	if (!p || typeof p !== 'object') return { name: '(Unnamed project)' };
	const name = (p.name || p.Name || '').toString().trim();
	return { ...p, name: name || '(Unnamed project)' };
}

function collectPartialNames(src) {
	var re = /{{>\s*([a-zA-Z0-9_\-]+)\s*}}/g;
	var names = new Set();
	var m;
	for (;;) {
		m = re.exec(src);
		if (!m) break;
		names.add(m[1]);
	}
	return Array.from(names);
}

function insertAtCursor(textarea, snippet) {
	if (!textarea) return;
	var s =
		typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
	var e = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length;
	var v = textarea.value;
	textarea.value = v.slice(0, s) + snippet + v.slice(e);
	textarea.selectionStart = textarea.selectionEnd = s + snippet.length;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function onInsertTag() {
	// Mutual exclusivity: ensure Variables/Pattern are closed when opening Tag insert flow
	closeVariablesDrawer();
	closePatternDrawer();

	var tags = [
		'{{study.title}}',
		'{{project.name}}',
		'{{participant.id}}',
		'{{#tasks}}…{{/tasks}}',
		'{{#study.remote}}…{{/study.remote}}',
	];
	var pick = prompt('Insert tag (example):\n' + tags.join('\n'));
	if (pick) {
		insertAtCursor($('#guide-source'), pick);
		syncHighlighting();
		preview();
	}
}

function debounce(fn, ms) {
	ms = typeof ms === 'number' ? ms : 200;
	var t;
	return function () {
		var args = arguments;
		clearTimeout(t);
		t = setTimeout(function () {
			fn.apply(null, args);
		}, ms);
	};
}

function escapeHtml(s) {
	var str = s == null ? '' : String(s);
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function announce(msg) {
	var sr = $('#sr-live');
	if (sr) sr.textContent = msg;
}

/**
 * Lint: missing partials + missing values for {{path}}.
 * Now checks against JSON-only context (no YAML).
 */
function runLints(args) {
	var source = args.source,
		context = args.context,
		partials = args.partials;
	var out = $('#lint-output');
	var warnings = [];

	var parts = collectPartialNames(source);
	for (var i = 0; i < parts.length; i++) {
		var p = parts[i];
		if (!(p in partials)) warnings.push('Unknown partial: {{> ' + p + '}}');
	}

	var tagRegex = /{{\s*([a-z0-9_.]+)\s*}}/gi;
	var m;
	for (;;) {
		m = tagRegex.exec(source);
		if (!m) break;
		var path = m[1].split('.');
		var v = getPath(context, path);
		if (v === undefined || v === null) warnings.push('Missing value for {{' + m[1] + '}}');
	}

	__lintErrors = warnings.map((message) => ({ fieldId: 'guide-source', message }));

	if (out) {
		out.textContent = warnings.length
			? `${warnings.length} guide ${warnings.length === 1 ? 'check needs' : 'checks need'} attention.`
			: 'No issues';
	}

	validateGuide();
}

function getPath(obj, pathArr) {
	var acc = obj;
	for (var i = 0; i < pathArr.length; i++) {
		var k = pathArr[i];
		if (acc == null) return undefined;
		if (typeof acc !== 'object') return undefined;
		if (!(k in acc)) return undefined;
		acc = acc[k];
	}
	return acc;
}

/**
 * Basic, robust form validation for the editor pane.
 * - Checks for required fields (title + body).
 * - Does not replace runLints(); preview() will still run Mustache checks.
 * - Renders required-field errors through GOV.UK error summary and field messages.
 */
function setFieldError(fieldId, message) {
	const field = $(`#${fieldId}`);
	if (!field) return;

	const group = field.closest('.govuk-form-group');
	const isTextarea = field.tagName.toLowerCase() === 'textarea';
	const errorClass = isTextarea ? 'govuk-textarea--error' : 'govuk-input--error';
	const errorId = `${fieldId}-error`;

	if (field.dataset.originalDescribedBy == null) {
		field.dataset.originalDescribedBy = field.getAttribute('aria-describedby') || '';
	}

	let error = $(`#${errorId}`);
	if (message) {
		if (!error) {
			error = document.createElement('p');
			error.id = errorId;
			error.className = 'govuk-error-message';
			field.parentNode?.insertBefore(error, field);
		}
		error.innerHTML = `<span class="govuk-visually-hidden">Error:</span> ${escapeHtml(message)}`;
		group?.classList.add('govuk-form-group--error');
		field.classList.add(errorClass);

		const describedBy = new Set(
			(field.dataset.originalDescribedBy || '').split(/\s+/).filter(Boolean)
		);
		describedBy.add(errorId);
		field.setAttribute('aria-describedby', Array.from(describedBy).join(' '));
		return;
	}

	error?.remove();
	group?.classList.remove('govuk-form-group--error');
	field.classList.remove(errorClass);

	const originalDescribedBy = field.dataset.originalDescribedBy || '';
	if (originalDescribedBy) {
		field.setAttribute('aria-describedby', originalDescribedBy);
	} else {
		field.removeAttribute('aria-describedby');
	}
}

function renderGuideErrorSummary(errors) {
	const summary = $('#guide-error-summary');
	if (!summary) return;

	const body = summary.querySelector('.govuk-error-summary__body') || summary;
	let list = summary.querySelector('.govuk-error-summary__list');
	if (!list) {
		list = document.createElement('ul');
		list.className = 'govuk-list govuk-error-summary__list';
		body.appendChild(list);
	}

	if (!errors.length) {
		summary.hidden = true;
		if (list) list.innerHTML = '';
		return;
	}

	if (list) {
		list.innerHTML = errors
			.map(
				(error) =>
					`<li><a href="#${escapeHtml(error.fieldId)}">${escapeHtml(error.message)}</a></li>`
			)
			.join('');
	}
	summary.hidden = false;
}

function getRequiredGuideErrors() {
	const errors = [];
	const title = ($('#guide-title')?.value || '').trim();
	const bodyEl = $('#guide-source');
	const body = (bodyEl?.value || '').trim();

	if (!title) errors.push({ fieldId: 'guide-title', message: 'Enter a guide title' });
	if (!body) errors.push({ fieldId: 'guide-source', message: 'Enter guide source' });
	return errors;
}

function validateGuide() {
	const requiredErrors = getRequiredGuideErrors();
	const errors = [...requiredErrors, ...__lintErrors];

	setFieldError(
		'guide-title',
		requiredErrors.find((error) => error.fieldId === 'guide-title')?.message || ''
	);
	setFieldError(
		'guide-source',
		requiredErrors.find((error) => error.fieldId === 'guide-source')?.message ||
			(__lintErrors.length ? 'Resolve guide source issues' : '')
	);
	renderGuideErrorSummary(errors);

	const el = $('#lint-output');
	if (el && !errors.length && (!el.textContent || el.textContent === 'No issues')) {
		el.textContent = 'No issues';
	}
	return errors;
}

/* -------------------- global actions -------------------- */

/**
 * Handle "New guide" button click
 */
async function onNewClick(e) {
	if (e) e.preventDefault();
	try {
		await startNewGuide();
		// Scroll editor into view
		const editor = document.getElementById('editor-section');
		if (editor) {
			editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	} catch (err) {
		console.error('[guides] Failed to start new guide:', err);
		announce('Failed to create new guide');
	}
}

function wireGlobalActions() {
	var newBtn = $('#btn-new');
	if (newBtn) newBtn.addEventListener('click', onNewClick);

	var importBtn = $('#btn-import');
	if (importBtn) importBtn.addEventListener('click', importMarkdownFlow);

	document.addEventListener('click', function (e) {
		var t = e.target;
		var hasClosest = t && typeof t.closest === 'function';
		var newBtn2 = hasClosest ? t.closest('#btn-new') : null;
		if (newBtn2) {
			e.preventDefault();
			onNewClick(e);
			return;
		}

		var exportMenu = $('#export-menu');
		var menu = exportMenu ? exportMenu.closest('.menu') : null;
		if (menu && (!hasClosest || !menu.contains(t))) {
			menu.removeAttribute('aria-expanded');
		}
	});

	var exportBtn = $('#btn-export');
	if (exportBtn) {
		exportBtn.addEventListener('click', function () {
			var exportMenu = $('#export-menu');
			var menu = exportMenu ? exportMenu.closest('.menu') : null;
			if (!menu) return;
			var expanded = menu.getAttribute('aria-expanded') === 'true';
			menu.setAttribute('aria-expanded', expanded ? 'false' : 'true');
		});
	}

	var exportMenuEl = $('#export-menu');
	if (exportMenuEl) {
		exportMenuEl.addEventListener('click', function (e) {
			var t = e.target;
			var hasClosest = t && typeof t.closest === 'function';
			var target = hasClosest ? t.closest('[data-export]') : null;
			if (target) doExport(target.getAttribute('data-export'));
		});
	}
}

/* -------------------- expose for debugging -------------------- */
window.guidesPage = {
	varManager: () => varManager,
	openVariablesDrawer,
	closeVariablesDrawer,
};
