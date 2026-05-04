/* eslint-env node */

/**
 * @file scripts/sync-report-acceptance-criteria.mjs
 * @summary Refresh generated reporting-site acceptance criteria from current source content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHomeAcceptanceCriteriaFromSource } from './researchops-home-acceptance.mjs';

const DEFAULT_SITE_DIR = 'reports-site';

function escapeHtml(value = '') {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function findHomeState(manifest) {
	const homePage = (manifest.pages || []).find((page) => page.id === 'home');
	if (!homePage) throw new Error('No home page entry found in reports-site manifest.');

	const defaultState = (homePage.states || []).find((state) => state.id === 'default');
	if (!defaultState) throw new Error('No default home state found in reports-site manifest.');

	return defaultState;
}

function replaceHtmlCriteria(html, oldCriteria, nextCriteria) {
	const oldEscaped = escapeHtml(oldCriteria || '');
	const nextEscaped = escapeHtml(nextCriteria || '');

	if (oldEscaped && html.includes(oldEscaped)) {
		return html.replace(oldEscaped, nextEscaped);
	}

	const homeArticlePattern = /(<article\b[^>]*id="home"[^>]*>[\s\S]*?<pre\b[^>]*class="gherkin-criteria"[^>]*>\s*<code>)([\s\S]*?)(<\/code>\s*<\/pre>[\s\S]*?<\/article>)/i;
	if (!homeArticlePattern.test(html)) {
		throw new Error('Could not find the home-page acceptance criteria block in reports-site/index.html.');
	}

	return html.replace(homeArticlePattern, `$1${nextEscaped}$3`);
}

export function syncReportAcceptanceCriteria(options = {}) {
	const siteDir = options.siteDir || DEFAULT_SITE_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');

	if (!fs.existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}.`);
	if (!fs.existsSync(indexPath)) throw new Error(`Missing ${indexPath}.`);

	const manifest = readJson(manifestPath);
	const homeState = findHomeState(manifest);
	const previousCriteria = homeState.acceptanceCriteria || '';
	const nextCriteria = buildHomeAcceptanceCriteriaFromSource();

	homeState.acceptanceCriteria = nextCriteria;
	homeState.criteriaSource = {
		type: 'source-derived',
		path: 'public/index.html',
		generator: 'scripts/researchops-home-acceptance.mjs',
	};

	writeJson(manifestPath, manifest);

	const html = fs.readFileSync(indexPath, 'utf8');
	const updatedHtml = replaceHtmlCriteria(html, previousCriteria, nextCriteria);
	fs.writeFileSync(indexPath, updatedHtml, 'utf8');

	return {
		changed: previousCriteria !== nextCriteria,
		previousLength: previousCriteria.length,
		nextLength: nextCriteria.length,
	};
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	const result = syncReportAcceptanceCriteria({ siteDir: process.argv[2] || DEFAULT_SITE_DIR });
	console.log(JSON.stringify(result, null, 2));
}
