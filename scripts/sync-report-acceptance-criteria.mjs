/* eslint-env node */

/**
 * @file scripts/sync-report-acceptance-criteria.mjs
 * @summary Refresh generated reporting-site acceptance criteria from current source content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHomeAcceptanceCriteriaFromSource } from './researchops-home-acceptance.mjs';
import { buildProjectsAcceptanceCriteriaFromSource } from './researchops-projects-acceptance.mjs';

const DEFAULT_SITE_DIR = 'reports-site';

const CRITERIA_BUILDERS = {
	home: {
		path: 'public/index.html',
		generator: 'scripts/researchops-home-acceptance.mjs',
		build: buildHomeAcceptanceCriteriaFromSource,
	},
	projects: {
		path: 'public/pages/projects/index.html',
		generator: 'scripts/researchops-projects-acceptance.mjs',
		build: buildProjectsAcceptanceCriteriaFromSource,
	},
};

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

function findPage(manifest, pageId) {
	return (manifest.pages || []).find((page) => page.id === pageId);
}

function findDefaultState(page, pageId) {
	const defaultState = (page.states || []).find((state) => state.id === 'default');
	if (!defaultState) throw new Error(`No default ${pageId} state found in reports-site manifest.`);
	return defaultState;
}

function replaceHtmlCriteria(html, pageId, oldCriteria, nextCriteria) {
	const oldEscaped = escapeHtml(oldCriteria || '');
	const nextEscaped = escapeHtml(nextCriteria || '');

	if (oldEscaped && html.includes(oldEscaped)) {
		return html.replace(oldEscaped, nextEscaped);
	}

	const articlePattern = new RegExp(
		`(<article\\b[^>]*id=["']${pageId}["'][^>]*>[\\s\\S]*?<pre\\b[^>]*class=["']gherkin-criteria["'][^>]*>\\s*<code>)([\\s\\S]*?)(<\\/code>\\s*<\\/pre>[\\s\\S]*?<\\/article>)`,
		'i'
	);

	if (!articlePattern.test(html)) {
		throw new Error(`Could not find the ${pageId} acceptance criteria block in reports-site/index.html.`);
	}

	return html.replace(articlePattern, `$1${nextEscaped}$3`);
}

function syncPageAcceptanceCriteria(manifest, html, pageId, config) {
	const page = findPage(manifest, pageId);
	if (!page) {
		return {
			pageId,
			changed: false,
			skipped: true,
			reason: `No ${pageId} page entry found in reports-site manifest.`,
		};
	}

	const state = findDefaultState(page, pageId);
	const previousCriteria = state.acceptanceCriteria || '';
	const nextCriteria = config.build();

	state.acceptanceCriteria = nextCriteria;
	state.criteriaSource = {
		type: 'source-derived',
		path: config.path,
		generator: config.generator,
	};

	return {
		pageId,
		changed: previousCriteria !== nextCriteria,
		previousLength: previousCriteria.length,
		nextLength: nextCriteria.length,
		html: replaceHtmlCriteria(html, pageId, previousCriteria, nextCriteria),
	};
}

export function syncReportAcceptanceCriteria(options = {}) {
	const siteDir = options.siteDir || DEFAULT_SITE_DIR;
	const manifestPath = path.join(siteDir, 'manifest.json');
	const indexPath = path.join(siteDir, 'index.html');

	if (!fs.existsSync(manifestPath)) throw new Error(`Missing ${manifestPath}.`);
	if (!fs.existsSync(indexPath)) throw new Error(`Missing ${indexPath}.`);

	const manifest = readJson(manifestPath);
	let html = fs.readFileSync(indexPath, 'utf8');
	const pages = options.pages || Object.keys(CRITERIA_BUILDERS);
	const results = [];

	for (const pageId of pages) {
		const config = CRITERIA_BUILDERS[pageId];
		if (!config) throw new Error(`No acceptance criteria builder registered for ${pageId}.`);

		const result = syncPageAcceptanceCriteria(manifest, html, pageId, config);
		if (result.html) html = result.html;
		results.push(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'html')));
	}

	writeJson(manifestPath, manifest);
	fs.writeFileSync(indexPath, html, 'utf8');

	const changed = results.some((result) => result.changed);

	return {
		changed,
		results,
		previousLength: results[0]?.previousLength || 0,
		nextLength: results[0]?.nextLength || 0,
	};
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	const result = syncReportAcceptanceCriteria({ siteDir: process.argv[2] || DEFAULT_SITE_DIR });
	console.log(JSON.stringify(result, null, 2));
}
