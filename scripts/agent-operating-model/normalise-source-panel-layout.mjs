#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DOCS_ROOT = 'docs/agent-operating-model/bundles/github';
const ASSETS_DIR = path.join(DOCS_ROOT, 'assets');
const ASSET_VERSION = 'source-panel-height-cap-v3';
const CSS_PATH = '/bundles/github/assets/source-panel-layout.css';
const JS_PATH = '/bundles/github/assets/source-panel-layout.js';
const CSS_HREF = `${CSS_PATH}?v=${ASSET_VERSION}`;
const JS_SRC = `${JS_PATH}?v=${ASSET_VERSION}`;
const CODE_PANEL_MAX_HEIGHT = 1400;

const CSS = `.source-grid { align-items: start; }
.source-grid pre {
  align-self: start;
  box-sizing: border-box;
  height: auto;
  max-height: ${CODE_PANEL_MAX_HEIGHT}px !important;
  min-height: 0;
  overflow-y: auto !important;
}
.source-grid aside.notes p { margin: 0 0 12px; }
.source-grid aside.notes h4 + p { margin-top: 0; }
`;

const JS = `var SOURCE_PANEL_CODE_MAX_HEIGHT = ${CODE_PANEL_MAX_HEIGHT};

function syncSourcePanelHeights() {
  document.querySelectorAll('.source-grid').forEach(function (grid) {
    var code = grid.querySelector('pre');
    var notes = grid.querySelector('aside.notes');
    if (!code || !notes) return;
    code.style.height = 'auto';
    code.style.maxHeight = SOURCE_PANEL_CODE_MAX_HEIGHT + 'px';
    code.style.overflowY = 'auto';
    code.style.alignSelf = 'start';
    if (window.matchMedia('(max-width: 1020px)').matches) return;
    var height = Math.min(Math.ceil(notes.getBoundingClientRect().height), SOURCE_PANEL_CODE_MAX_HEIGHT);
    code.style.height = height + 'px';
    code.style.maxHeight = SOURCE_PANEL_CODE_MAX_HEIGHT + 'px';
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
	output = output.replace(/<link rel="stylesheet" href="\/bundles\/github\/assets\/source-panel-layout\.css(?:\?[^\"]*)?">\n?/g, '');
	output = output.replace(/<script src="\/bundles\/github\/assets\/source-panel-layout\.js(?:\?[^\"]*)?" defer><\/script>\n?/g, '');
	output = output.replace('</head>', `<link rel="stylesheet" href="${CSS_HREF}">\n</head>`);
	output = output.replace('</body>', `<script src="${JS_SRC}" defer></script>\n</body>`);
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