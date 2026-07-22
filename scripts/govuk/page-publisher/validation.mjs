import { access, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const templatesRoot = resolve(root, 'src/govuk/templates');
const pageTemplatesRoot = resolve(templatesRoot, 'pages');

export function routeFromOutput(output) {
	if (output === 'public/index.html') return '/';

	return `/${output.replace(/^public\//, '').replace(/index\.html$/, '')}`;
}

function normaliseRoute(route) {
	const routeWithoutQuery = String(route).split(/[?#]/, 1)[0];
	if (routeWithoutQuery === '' || routeWithoutQuery === '/' || routeWithoutQuery === '/index.html') return '/';

	const withLeadingSlash = routeWithoutQuery.startsWith('/') ? routeWithoutQuery : `/${routeWithoutQuery}`;
	const withoutIndex = withLeadingSlash.replace(/index\.html$/, '');
	return withoutIndex.endsWith('/') ? withoutIndex : `${withoutIndex}/`;
}

export async function validatePageCatalogue(catalogue) {
	if (!Array.isArray(catalogue) || catalogue.length === 0) {
		throw new Error('The GOV.UK page catalogue must contain at least one page.');
	}

	const routes = new Set();
	const outputs = new Set();
	const registeredTemplates = new Set();

	for (const [index, page] of catalogue.entries()) {
		if (!page || typeof page !== 'object') throw new Error(`Catalogue entry ${index} must be an object.`);
		if (typeof page.template !== 'string' || page.template === '') {
			throw new Error(`Catalogue entry ${index} must name a template.`);
		}
		if (
			typeof page.output !== 'string' ||
			!/^public\/(?:index\.html|[^/]+(?:\/[^/]+)*\/index\.html)$/.test(page.output) ||
			page.output.split('/').some((segment) => segment === '.' || segment === '..')
		) {
			throw new Error(`Catalogue entry ${index} has an invalid public index output path.`);
		}
		if (!page.context || typeof page.context !== 'object') {
			throw new Error(`Catalogue entry ${index} must provide a page context.`);
		}

		const route = routeFromOutput(page.output);
		if (routes.has(route)) throw new Error(`Duplicate GOV.UK page route: ${route}`);
		if (outputs.has(page.output)) throw new Error(`Duplicate GOV.UK page output: ${page.output}`);
		routes.add(route);
		outputs.add(page.output);

		const templatePath = resolve(templatesRoot, page.template);
		const relativeTemplatePath = relative(templatesRoot, templatePath);
		if (
			!page.template.endsWith('.njk') ||
			relativeTemplatePath.startsWith('..') ||
			isAbsolute(relativeTemplatePath)
		) {
			throw new Error(`Catalogue entry ${index} has an invalid template path: ${page.template}`);
		}

		try {
			await access(templatePath);
		} catch {
			throw new Error(`GOV.UK page template does not exist: ${page.template}`);
		}

		registeredTemplates.add(page.template);
	}

	const unregisteredPageTemplates = (await readdir(pageTemplatesRoot, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.endsWith('.njk'))
		.map((entry) => `pages/${entry.name}`)
		.filter((template) => !registeredTemplates.has(template))
		.sort();

	if (unregisteredPageTemplates.length > 0) {
		throw new Error(
			`No GOV.UK publisher catalogue registration found for: ${unregisteredPageTemplates.join(', ')}`
		);
	}
}

export function selectPageCatalogueEntries(catalogue, requestedRoutes = 'all') {
	if (requestedRoutes === 'all' || requestedRoutes === undefined) {
		return catalogue.map((page) => ({ page, route: routeFromOutput(page.output) }));
	}

	const routes = Array.isArray(requestedRoutes) ? requestedRoutes : [requestedRoutes];
	const availablePages = new Map(catalogue.map((page) => [routeFromOutput(page.output), page]));
	const selectedRoutes = new Set();

	return routes.map((requestedRoute) => {
		const route = normaliseRoute(requestedRoute);
		if (selectedRoutes.has(route)) throw new Error(`Duplicate requested GOV.UK page route: ${route}`);
		selectedRoutes.add(route);

		const page = availablePages.get(route);
		if (!page) throw new Error(`Unknown GOV.UK page route: ${route}`);
		return { page, route };
	});
}
