/**
 * @file /components/guides/guide-editor.js
 * @module GuideEditor
 * @summary Render a Discussion Guide (Mustache → Markdown → Sanitised HTML).
 *
 * @description
 * - Safely strips front-matter (`--- ... ---`) before Mustache rendering.
 * - Renders only the Markdown body, keeping FM available (namespaced) via `context.meta`.
 * - Does NOT flatten `meta` onto root (prevents `{project,study}` from being clobbered).
 *
 * @requires /lib/mustache.min.js
 * @requires /lib/marked.min.js
 * @requires /lib/purify.min.js
 */

import Mustache from '/lib/mustache.min.js';
import { marked } from '/lib/marked.min.js';
import DOMPurify from '/lib/purify.min.js';

/**
 * Split a source string into `{ meta, body }`.
 * FM format supported:
 * 
 * ---
 * key: value
 * another_key: 123
 * ---
 * # Markdown starts here
 *
 * Values remain strings except simple numbers/booleans.
 * @param {string} src
 * @returns {{ meta: Record<string, any>, body: string }}
 */
function splitFrontMatter(src = '') {
	if (!src.startsWith('---')) return { meta: {}, body: src };
	const end = src.indexOf('\n---', 3);
	if (end === -1) return { meta: {}, body: src };

	const yaml = src.slice(3, end).trim();
	const body = src.slice(end + 4).replace(/^\n*/, '');

	/** @type {Record<string, any>} */
	const meta = {};
	yaml.split('\n').forEach(line => {
		const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!m) return;
		let val = m[2];
		if (/^\d+$/.test(val)) val = Number(val);
		if (val === 'true') val = true;
		if (val === 'false') val = false;
		meta[m[1]] = val;
	});

	return { meta, body };
}

/**
 * Replace plain-text punctuation with typographic equivalents in inline contexts.
 * - `---` → em dash (—) when between non-space characters
 * - `--`  → en dash (–) when between non-space characters
 *
 * Avoids converting horizontal-rule lines (e.g. `---` alone on a line).
 *
 * @param {string} md
 * @returns {string}
 */
function typographize(md) {
	if (!md) return md;

	// Em dash: X---Y  => X—Y   (between non-space chars)
	md = md.replace(/(\S)---(\S)/g, '$1—$2');

	// En dash: X--Y    => X–Y   (between non-space chars)
	md = md.replace(/(\S)--(\S)/g, '$1–$2');

	return md;
}

// Make `_emphasis_` robust (without breaking `*emphasis*`)
try {
	if (!globalThis.__underscoreEmExtApplied && typeof marked?.use === 'function') {
		marked.use({
			extensions: [{
				name: 'underscore-em',
				level: 'inline',
				start(src) { return src.indexOf('_'); },
				tokenizer(src) {
					// single underscore, not double; skip code spans; allow \_ escapes
					const m = /^_((?:\\_|[^`_])+?)_(?!_)/.exec(src);
					if (!m) return;
					return {
						type: 'underscoreEm',
						raw: m[0],
						text: m[1].replace(/\\_/g, '_')
					};
				},
				renderer(token) {
					// basic inline render
					return '<em>' + token.text + '</em>';
				}
			}]
		});
		globalThis.__underscoreEmExtApplied = true;
	}
} catch (e) {
	// Ignore—fallback to default marked behavior if extension fails
}

/**
 * Render a guide: Mustache over Markdown body, then marked → DOMPurify.
 *
 * @param {{
 *   source:   string,
 *   context:  {
 *     project?: any,
 *     study?: any,
 *     session?: any,
 *     participant?: any,
 *     meta?: Record<string, any>
 *   },
 *   partials?: Record<string,string>
 * }} args
 * @returns {Promise<{ md: string, html: string, meta?: Record<string, any> }>}
 */
export async function renderGuide({ source, context, partials }) {
	const { meta: fm, body } = splitFrontMatter(source);

	// Keep meta namespaced; never flatten into the root context.
	// If page code already supplied context.meta, the FM keys just augment it.
	const safeCtx = {
		...(context || {}),
		meta: { ...(context?.meta || {}), ...(fm || {}) }
	};

	// Mustache over the Markdown body only
	const mdRaw = Mustache.render(body, safeCtx, partials || {});

	// Optional typography pass (smart dashes etc.) that avoids HR lines
	const md = typographize(mdRaw);

	// Markdown → HTML (expanded options)
	const raw = marked.parse(md, {
		// keep headings stable for TOC/links
		mangle: false,
		headerIds: true,

		// GitHub-flavored markdown: tables, strikethrough, task-lists
		gfm: true,

		// Soft line breaks become <br> (useful for authoring)
		breaks: true,

		// Nicer list handling (e.g., auto-detect ordered vs unordered)
		smartLists: true,

		// Makes _underscore_ emphasis behave more like classic Markdown
		pedantic: true
	});

	// Sanitise
	const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

	return { md, html, meta: fm };
}

/**
 * Fetch partials by name from API; fallback to in-page registry.
 * @param {string[]} names
 * @returns {Promise<Record<string,string>>}
 */
export async function buildPartials(names) {
	/** @type {Record<string,string>} */
	const partials = {};
	for (const name of names) {
		try {
			const res = await fetch(`/api/patterns/${encodeURIComponent(name)}`);
			if (res.ok) {
				const p = await res.json();
				partials[name] = p.sourceMarkdown || '';
			} else {
				const local = window.__patternRegistry?.[name];
				if (local) partials[name] = local;
			}
		} catch {
			const local = window.__patternRegistry?.[name];
			if (local) partials[name] = local;
		}
	}
	return partials;
}

/* Starter source for new guides (kept minimal; FM is optional) */
export const DEFAULT_SOURCE = `---
version: 1
---
# {{study.title}} — Discussion guide

_Study:_ **{{study.title}}**  
_Project:_ **{{project.name}}**

{{> intro_opening_v1}}
{{> consent_standard_v2}}

## Tasks
{{#tasks}}
{{> task_observation_shell_v1}}
{{/tasks}}

## Probes
{{> probe_error_recovery_v1}}
{{> probe_trust_signals_v1}}

{{> wrapup_debrief_v1}}

{{> note_observer_grid_v1}}
`;
