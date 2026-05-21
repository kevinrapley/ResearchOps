#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DOCS_ROOT = 'docs/agent-operating-model/bundles/github';
const ASSETS_DIR = path.join(DOCS_ROOT, 'assets');
const CSS_HREF = '/bundles/github/assets/source-panel-layout.css';
const JS_SRC = '/bundles/github/assets/source-panel-layout.js';

const CSS = `.source-grid { align-items: stretch; }
.source-grid pre { height: auto; max-height: none; min-height: 0; }
.source-grid aside.notes p { margin: 0 0 12px; }
.source-grid aside.notes h4 + p { margin-top: 0; }
`;

const JS = `function syncSourcePanelHeights() {
  document.querySelectorAll('.source-grid').forEach(function (grid) {
    var code = grid.querySelector('pre');
    var notes = grid.querySelector('aside.notes');
    if (!code || !notes) return;
    code.style.height = 'auto';
    code.style.maxHeight = 'none';
    if (window.matchMedia('(max-width: 1020px)').matches) return;
    var height = Math.ceil(notes.getBoundingClientRect().height);
    code.style.height = height + 'px';
    code.style.maxHeight = height + 'px';
  });
}
window.addEventListener('load', syncSourcePanelHeights);
window.addEventListener('resize', syncSourcePanelHeights);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncSourcePanelHeights);
`;

function decodeHtml(value) {
	return String(value)
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
}

function encodeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

async function walk(directory) {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...await walk(fullPath));
		else if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
	}

	return files.sort();
}

function paragraphsFromList(listHtml) {
	return [...listHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)]
		.map((match) => `<p>${encodeHtml(decodeHtml(match[1].replace(/<[^>]+>/g, '').trim()))}</p>`)
		.join('');
}

function normaliseNotes(html) {
	return html.replace(/(<aside class="notes">)([\s\S]*?)(<\/aside>)/g, (_match, start, body, end) => {
		const normalised = body.replace(/<ul>([\s\S]*?)<\/ul>/g, (_list, items) => paragraphsFromList(items));
		return `${start}${normalised}${end}`;
	});
}

function addAssets(html) {
	let output = html;
	if (!output.includes(CSS_HREF)) {
		output = output.replace('</head>', `<link rel="stylesheet" href="${CSS_HREF}">\n</head>`);
	}
	if (!output.includes(JS_SRC)) {
		output = output.replace('</body>', `<script src="${JS_SRC}" defer></script>\n</body>`);
	}
	return output;
}

async function main() {
	await mkdir(ASSETS_DIR, { recursive: true });
	await writeFile(path.join(ASSETS_DIR, 'source-panel-layout.css'), CSS, 'utf8');
	await writeFile(path.join(ASSETS_DIR, 'source-panel-layout.js'), JS, 'utf8');

	const files = await walk(DOCS_ROOT);
	let changed = 0;

	for (const filePath of files) {
		const before = await readFile(filePath, 'utf8');
		const after = addAssets(normaliseNotes(before));
		if (after !== before) {
			await writeFile(filePath, after, 'utf8');
			changed += 1;
		}
	}

	console.log(`Normalised source panel layout in ${changed} generated HTML files.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
