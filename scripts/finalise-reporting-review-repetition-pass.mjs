/* eslint-env node */

/**
 * @file scripts/finalise-reporting-review-repetition-pass.mjs
 * @summary Remove obsolete non-state wording from the generated reporting review script.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE_DIR = 'reports-site';

export const REPLACEMENTS = Object.freeze([
	[
		/Step 2 completed without AI rewrite invoked/g,
		'Step 2 completed with researcher-authored context',
	],
	[
		/Feature: Step 2 completed without assisted wording/g,
		'Feature: Step 2 completed with researcher-authored context',
	],
	[
		/When I have entered stakeholders, objectives and user groups myself/g,
		'When I have entered stakeholders, objectives and user groups in my own wording',
	],
]);

function applyReplacements(value) {
	return REPLACEMENTS.reduce(
		(result, [pattern, replacement]) => result.replace(pattern, replacement),
		String(value || '')
	);
}

export function finaliseReportingReviewRepetitionHtml(html) {
	return applyReplacements(html);
}

export function finaliseReportingReviewRepetitionPass(options = {}) {
	const siteDir = typeof options === 'string' ? options : options.siteDir || DEFAULT_SITE_DIR;
	const indexPath = path.join(siteDir, 'index.html');

	if (!fs.existsSync(indexPath)) {
		throw new Error(`Missing ${indexPath}.`);
	}

	const previousHtml = fs.readFileSync(indexPath, 'utf8');
	const nextHtml = finaliseReportingReviewRepetitionHtml(previousHtml);

	fs.writeFileSync(indexPath, nextHtml, 'utf8');

	return {
		changed: previousHtml !== nextHtml,
		indexPath,
	};
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
	const result = finaliseReportingReviewRepetitionPass({ siteDir: process.argv[2] || DEFAULT_SITE_DIR });
	console.log(JSON.stringify(result, null, 2));
}
