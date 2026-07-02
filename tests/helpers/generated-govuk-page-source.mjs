import fs from 'node:fs';
import { resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import {
	cacheBustOutcomesPageScripts,
	complianceAbbreviationMarkup,
	govukPages,
} from '../../scripts/govuk/render-govuk-pages.mjs';

const originalReadFileSync = fs.readFileSync.bind(fs);
const root = process.cwd();
const renderedPageOutputs = new Map(
	govukPages.map((page) => [normalize(resolve(root, page.output)), page])
);

const env = new nunjucks.Environment(
	[
		new nunjucks.FileSystemLoader(resolve(root, 'src/govuk/templates')),
		new nunjucks.FileSystemLoader(resolve(root, 'node_modules/govuk-frontend/dist')),
	],
	{
		autoescape: true,
		throwOnUndefined: true,
	}
);

function escapeHtmlAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function govukAttributes(attributes = {}) {
	if (!attributes || typeof attributes !== 'object') return '';

	const html = Object.entries(attributes)
		.filter(([, value]) => value !== false && value !== null && value !== undefined)
		.map(([name, value]) => {
			if (value === true) return ` ${name}`;
			return ` ${name}="${escapeHtmlAttribute(value)}"`;
		})
		.join('');

	return new nunjucks.runtime.SafeString(html);
}

env.addFilter('govukAttributes', govukAttributes);
env.addFilter('complianceAbbreviations', complianceAbbreviationMarkup);
env.addGlobal('govukAttributes', govukAttributes);

function fileSystemPath(pathLike) {
	if (pathLike instanceof URL) return normalize(fileURLToPath(pathLike));
	return normalize(resolve(root, String(pathLike)));
}

function renderPage(page) {
	return cacheBustOutcomesPageScripts(env.render(page.template, page.context), page);
}

function encodedContent(text, options) {
	if (typeof options === 'string') return text;
	if (options && typeof options === 'object' && options.encoding) return text;
	return Buffer.from(text, 'utf8');
}

fs.readFileSync = function readFileSyncWithGeneratedGovukPages(pathLike, options) {
	const page = renderedPageOutputs.get(fileSystemPath(pathLike));
	if (page) return encodedContent(renderPage(page), options);

	return originalReadFileSync(pathLike, options);
};

export { renderedPageOutputs };
