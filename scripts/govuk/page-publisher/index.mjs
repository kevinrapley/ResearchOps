import { pageCatalogue } from './catalogue.mjs';
import { renderFinalGovukPage } from './rendering.mjs';
import { selectPageCatalogueEntries, validatePageCatalogue } from './validation.mjs';

/**
 * Render final, post-normalised GOV.UK HTML and publish it through the supplied output adapter.
 * All selected pages are rendered successfully before the adapter is asked to write any output.
 *
 * @param {{routes?: 'all' | string | string[], output: {write(publications: object[]): Promise<void>}}} options
 * @returns {Promise<Array<{route: string, output: string, html: string}>>}
 */
export async function publishGovukPages({ routes = 'all', output } = {}) {
	if (!output || typeof output.write !== 'function') {
		throw new TypeError('A GOV.UK page output adapter with a write(publications) method is required.');
	}

	await validatePageCatalogue(pageCatalogue);
	const selectedPages = selectPageCatalogueEntries(pageCatalogue, routes);
	const publications = [];

	for (const { page, route } of selectedPages) {
		publications.push({
			route,
			output: page.output,
			html: await renderFinalGovukPage(page, route),
		});
	}

	await output.write(publications);
	return publications;
}
