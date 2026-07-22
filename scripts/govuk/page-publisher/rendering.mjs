import { resolve } from 'node:path';
import nunjucks from 'nunjucks';
import prettier from 'prettier';

import {
	cacheBustOutcomesPageScripts,
	complianceAbbreviationMarkup,
	generatedGovukChromeCacheKey,
	govukAttributes,
	pageKeyFromOutput,
} from './catalogue.mjs';
import { normaliseGovukPageHtml } from './normalise.mjs';

const root = resolve(process.cwd());
const environment = new nunjucks.Environment(
	[
		new nunjucks.FileSystemLoader(resolve(root, 'src/govuk/templates')),
		new nunjucks.FileSystemLoader(resolve(root, 'node_modules/govuk-frontend/dist')),
	],
	{
		autoescape: true,
		throwOnUndefined: true,
	},
);

environment.addFilter('govukAttributes', govukAttributes);
environment.addFilter('complianceAbbreviations', complianceAbbreviationMarkup);
environment.addGlobal('govukAttributes', govukAttributes);

async function formatRenderedHtml(html) {
	return prettier.format(html, {
		parser: 'html',
		printWidth: 120,
		useTabs: true,
		tabWidth: 2,
		htmlWhitespaceSensitivity: 'ignore',
	});
}

export async function renderFinalGovukPage(page, route) {
	const context = {
		...page.context,
		fluxPageKey: pageKeyFromOutput(page.output),
		layoutCacheKey: generatedGovukChromeCacheKey,
		footerCacheKey: generatedGovukChromeCacheKey,
	};
	const renderedHtml = environment.render(page.template, context);
	const cacheBustedHtml = cacheBustOutcomesPageScripts(renderedHtml, page);
	const formattedHtml = await formatRenderedHtml(cacheBustedHtml);
	return normaliseGovukPageHtml(formattedHtml, route);
}
