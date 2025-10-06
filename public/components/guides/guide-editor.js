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

	const yamlBlock = src.slice(3, end).trim();
	const bodyStart = end + 4;
	const body = src.substring(bodyStart).replace(/^\n*/, '');

	/** @type {Record<string, any>} */
	const meta = {};
	for (const line of yamlBlock.split(/\r?\n/)) {
		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!match) continue;
		let [, key, val] = match;
		if (/^\d+$/.test(val)) val = Number(val);
		else if (val === 'true') val = true;
		else if (val === 'false') val = false;
		meta[key] = val;
	}

	return { meta, body };
}

/**
 * Convert single-underscore emphasis `_text_` to `*text*` outside code spans/blocks.
 * - Leaves double underscores, code blocks (```), and inline code (`code`) untouched.
 * - Avoids lookbehind to stay Safari-compatible.
 *
 * @param {string} md
 * @returns {string}
 */
function normalizeUnderscoreItalics(md) {
	if (!md) return md;

	const parts = md.split(/(```[\s\S]*?```)/g);
	for (let i = 0; i < parts.length; i += 2) {
		const segs = parts[i].split(/(`[^`]*`)/g);
		for (let j = 0; j < segs.length; j += 2) {
			segs[j] = segs[j].replace(/(^|[^_])_([^_\n][^_\n]*?)_(?!_)/g, '$1*$2*');
		}
		parts[i] = segs.join('');
	}
	return parts.join('');
}

/**
 * Replace plain-text punctuation with typographic equivalents in inline contexts.
 * - `---` → em dash (—) when between non-space characters
 * - `--`  → en dash (–) when between non-space characters
 * Avoids converting horizontal-rule lines (e.g. `---` alone on a line).
 * @param {string} md
 * @returns {string}
 */
function typographize(md) {
	if (!md) return md;
	md = md.replace(/(\S)---(\S)/g, '$1—$2'); // em dash
	md = md.replace(/(\S)--(\S)/g, '$1–$2'); // en dash
	return md;
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

	const safeCtx = {
		...(context || {}),
		meta: { ...(context?.meta || {}), ...(fm || {}) }
	};

	// Mustache over the Markdown body only
	const mdRaw = Mustache.render(body, safeCtx, partials || {});

	// Normalize underscores, then smart dashes (both Safari-safe)
	const md = typographize(normalizeUnderscoreItalics(mdRaw));

	// Markdown → HTML (expanded options)
	const raw = marked.parse(md, {
		mangle: false,
		headerIds: true,
		gfm: true,
		breaks: true,
		smartLists: true
	});

	const html = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
	return { md, html, meta: fm };
}

/**
 * Fetch partials by name from API; fallback to in-page registry.
 * @param {string[]} names
 * @returns {Promise<Record<string,string>>}
 */
export async function buildPartials(names) {
	const res = await fetch("/api/partials", { cache: "no-store" });
	if (!res.ok) return {};

	const { partials = [] } = await res.json();
	const map = {};

	for (const name of names) {
		// Match name_v1 format
		const match = name.match(/^(.+)_v(\d+)$/);
		const baseName = match ? match[1] : name;
		const version = match ? parseInt(match[2], 10) : 1;

		const partial = partials.find(p =>
			p.name === baseName && p.version === version
		);

		if (partial) {
			// Fetch full source
			const r2 = await fetch(`/api/partials/${partial.id}`, { cache: "no-store" });
			if (r2.ok) {
				const { partial: full } = await r2.json();
				map[name] = full.source;
			}
		}
	}

	return map;
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
