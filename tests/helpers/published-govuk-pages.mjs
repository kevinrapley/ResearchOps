import { publishGovukPages } from '../../scripts/govuk/page-publisher/index.mjs';

const renderedPages = new Map();

function routeFromReference(reference) {
	if (reference === '/' || reference === 'public/index.html') return '/';
	if (reference.startsWith('public/'))
		return `/${reference.replace(/^public\//, '').replace(/index\.html$/, '')}`;
	return reference;
}

function createMemoryOutput() {
	return {
		async write(publications) {
			for (const publication of publications)
				renderedPages.set(publication.route, publication.html);
		},
	};
}

export async function publishedGovukPage(reference) {
	const route = routeFromReference(reference);
	if (!renderedPages.has(route)) {
		await publishGovukPages({ routes: [route], output: createMemoryOutput() });
	}
	return renderedPages.get(route);
}
