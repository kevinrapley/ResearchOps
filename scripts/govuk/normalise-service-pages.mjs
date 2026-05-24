import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualWalkthroughConfig } from '../../visual-walkthrough.config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicRoot = resolve(root, visualWalkthroughConfig.publicRoot || 'public');

const GOVUK_FRONTEND_STYLESHEET = '/assets/govuk/govuk-frontend.css';
const SHARED_LAYOUT_SCRIPT = '/components/layout.js';
const GOVUK_INIT_SCRIPT = '/js/govuk-frontend-init.js';
const HEADER_PARTIAL = '/partials/header.html';
const FOOTER_PARTIAL = '/partials/footer.html';

const legacyStylesheets = new Set([
	'/css/govuk/govuk-typography.css',
	'/css/govuk/govuk-colours.css',
	'/css/govuk/govuk-page-chrome.css',
	'/css/govuk/govuk-buttons.css',
	'/css/govuk/govuk-forms.css',
	'/css/govuk/govuk-frontend-v6.css',
	'/css/screen.css',
	'/css/home-lifecycle.css',
]);

function routeToFile(route) {
	if (route === '/') return resolve(publicRoot, 'index.html');

	const cleanRoute = route.split('?')[0];
	const routePath = cleanRoute.endsWith('/') ? `${cleanRoute}index.html` : cleanRoute;
	return resolve(publicRoot, routePath.replace(/^\//, ''));
}

function activeNavigationForRoute(route) {
	if (route === '/') return 'Home';
	if (route.startsWith('/pages/start/')) return 'Start Research Project';
	if (route.startsWith('/pages/projects') || route.startsWith('/pages/project-dashboard')) return 'Projects';
	return '';
}

function escapeAttribute(value) {
	return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function headerInclude(activeNavigation) {
	const vars = escapeAttribute(JSON.stringify({ active: activeNavigation }));
	return `<x-include src="${HEADER_PARTIAL}" vars='${vars}'></x-include>`;
}

function supportSnippet() {
	return `<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>`;
}

function removeLegacyStylesheets(head) {
	return head.replace(/\n?\s*<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (match) => {
		const href = match.match(/href=["']([^"']+)["']/i)?.[1];
		return href && legacyStylesheets.has(href) ? '' : match;
	});
}

function ensureHeadAsset(head, assetMarkup, marker) {
	if (head.includes(marker)) return head;
	return head.replace(/<\/head>/i, `\t${assetMarkup}\n</head>`);
}

function normaliseHead(html) {
	let next = html.replace(/<html\b[^>]*>/i, '<html class="govuk-template" lang="en">');

	next = next.replace(/<head>([\s\S]*?)<\/head>/i, (match) => {
		let head = removeLegacyStylesheets(match);
		head = ensureHeadAsset(head, `<link rel="stylesheet" href="${GOVUK_FRONTEND_STYLESHEET}" media="screen">`, GOVUK_FRONTEND_STYLESHEET);
		head = ensureHeadAsset(head, `<script type="module" src="${SHARED_LAYOUT_SCRIPT}" defer></script>`, SHARED_LAYOUT_SCRIPT);
		head = ensureHeadAsset(head, `<script type="module" src="${GOVUK_INIT_SCRIPT}" defer></script>`, GOVUK_INIT_SCRIPT);
		return head;
	});

	return next;
}

function normaliseBody(html) {
	let next = html.replace(/<body\b[^>]*>/i, '<body class="govuk-template__body">');

	if (!next.includes('govuk-frontend-supported')) {
		next = next.replace(/<body class="govuk-template__body">/i, `<body class="govuk-template__body">\n\t${supportSnippet()}`);
	}

	return next;
}

function mergeClassValue(existingClass = '', requiredClass = '') {
	const classes = new Set(existingClass.split(/\s+/).filter(Boolean));
	classes.add(requiredClass);
	return [...classes].join(' ');
}

function normaliseMain(html) {
	if (!/<main\b/i.test(html)) return html;

	return html.replace(/<main\b([^>]*)>/i, (match, rawAttributes) => {
		let attributes = rawAttributes;
		const classMatch = attributes.match(/\sclass=["']([^"']*)["']/i);

		if (classMatch) {
			const nextClass = mergeClassValue(classMatch[1], 'govuk-main-wrapper');
			attributes = attributes.replace(/\sclass=["'][^"']*["']/i, ` class="${nextClass}"`);
		} else {
			attributes += ' class="govuk-main-wrapper"';
		}

		if (/\sid=["'][^"']+["']/i.test(attributes)) {
			attributes = attributes.replace(/\sid=["'][^"']+["']/i, ' id="main-content"');
		} else {
			attributes += ' id="main-content"';
		}

		if (!/\srole=["'][^"']+["']/i.test(attributes)) attributes += ' role="main"';
		if (!/\stabindex=["'][^"']+["']/i.test(attributes)) attributes += ' tabindex="-1"';

		return `<main${attributes}>`;
	});
}

function normaliseHeader(html, activeNavigation) {
	if (html.includes(`src="${HEADER_PARTIAL}"`)) return html;

	const insert = `\n\t${headerInclude(activeNavigation)}`;
	if (html.includes(supportSnippet())) {
		return html.replace(supportSnippet(), `${supportSnippet()}${insert}`);
	}

	return html.replace(/<body class="govuk-template__body">/i, `<body class="govuk-template__body">${insert}`);
}

function normaliseFooter(html) {
	if (html.includes(`src="${FOOTER_PARTIAL}"`)) return html;
	return html.replace(/\s*<\/body>/i, `\n\t<x-include src="${FOOTER_PARTIAL}"></x-include>\n</body>`);
}

function normalisePage(html, route) {
	const activeNavigation = activeNavigationForRoute(route);
	let next = normaliseHead(html);
	next = normaliseBody(next);
	next = normaliseHeader(next, activeNavigation);
	next = normaliseMain(next);
	next = normaliseFooter(next);
	return `${next.trim()}\n`;
}

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

const registeredRoutes = visualWalkthroughConfig.pages.map((page) => page.path);
const uniqueRoutes = [...new Set(registeredRoutes)];

for (const route of uniqueRoutes) {
	const filePath = routeToFile(route);
	if (!(await fileExists(filePath))) {
		console.warn(`Skipped missing registered page ${route}`);
		continue;
	}

	const current = await readFile(filePath, 'utf8');
	const next = normalisePage(current, route);

	if (next !== current) {
		await writeFile(filePath, next, 'utf8');
		console.log(`Normalised ${routeToFile(route).replace(`${root}/`, '')}`);
	}
}
