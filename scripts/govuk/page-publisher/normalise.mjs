const GOVUK_FRONTEND_STYLESHEET = '/assets/govuk/govuk-frontend.css';
const SHARED_LAYOUT_SCRIPT = '/components/layout.js';
const GOVUK_INIT_SCRIPT = '/js/govuk-frontend-init.js';
const HEADER_PARTIAL = '/partials/header.html';
const FOOTER_PARTIAL = '/partials/footer.html';
const GOOGLE_TAG_MANAGER_CONTAINER_ID = 'GTM-KGGFK4KW';
const GOOGLE_TAG_MANAGER_LOADER_PATH = '/js/google-tag-manager.js';
const GOOGLE_TAG_MANAGER_NOSCRIPT_URL = `https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_CONTAINER_ID}`;
const GOOGLE_TAG_MANAGER_SCRIPT = `<script src="${GOOGLE_TAG_MANAGER_LOADER_PATH}"></script>`;
const GOOGLE_TAG_MANAGER_NOSCRIPT = `<noscript><iframe src="${GOOGLE_TAG_MANAGER_NOSCRIPT_URL}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

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

function hasIncludeForPartial(html, partial) {
	return new RegExp(`<x-include\\b[^>]*\\bsrc=["']${partial.replaceAll('.', '\\.')}(?:\\?[^"']*)?["']`, 'i').test(html);
}

function supportSnippet() {
	return `<script>document.body.className += ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');</script>`;
}

function removeHardcodedGovukChromeFallbacks(html) {
	return html.replace(/\s*<noscript>[\s\S]*?<\/noscript>/gi, (match) => {
		return /<header\b[^>]*class=["'][^"']*\bgovuk-header\b/i.test(match) || /<footer\b[^>]*class=["'][^"']*\bgovuk-footer\b/i.test(match) ? '' : match;
	});
}

function ensureHeadAsset(head, assetMarkup, marker) {
	if (head.includes(marker)) return head;
	return head.replace(/<\/head>/i, `\t${assetMarkup}\n</head>`);
}

function normaliseHead(html) {
	let next = html.replace(/<html\b[^>]*>/i, '<html class="govuk-template" lang="en">');

	next = next.replace(/<head>([\s\S]*?)<\/head>/i, (match) => {
		let head = match;
		head = ensureHeadAsset(head, `<link rel="stylesheet" href="${GOVUK_FRONTEND_STYLESHEET}" media="screen">`, GOVUK_FRONTEND_STYLESHEET);
		head = ensureHeadAsset(head, GOOGLE_TAG_MANAGER_SCRIPT, GOOGLE_TAG_MANAGER_LOADER_PATH);
		head = ensureHeadAsset(head, `<script type="module" src="${SHARED_LAYOUT_SCRIPT}" defer></script>`, SHARED_LAYOUT_SCRIPT);
		head = ensureHeadAsset(head, `<script type="module" src="${GOVUK_INIT_SCRIPT}" defer></script>`, GOVUK_INIT_SCRIPT);
		return head;
	});

	return next;
}

function ensureGoogleTagManagerNoscript(html) {
	if (html.includes(GOOGLE_TAG_MANAGER_NOSCRIPT_URL)) return html;

	return html.replace(/<body\b[^>]*>/i, (match) => `${match}\n\t${GOOGLE_TAG_MANAGER_NOSCRIPT}`);
}

function normaliseBody(html) {
	let next = html.replace(/<body\b([^>]*)>/i, (match, rawAttributes) => {
		let attributes = rawAttributes;
		const classMatch = attributes.match(/\sclass=["']([^"']*)["']/i);

		if (classMatch) {
			const nextClass = mergeClassValue(classMatch[1], 'govuk-template__body');
			attributes = attributes.replace(/\sclass=["'][^"']*["']/i, ` class="${nextClass}"`);
		} else {
			attributes += ' class="govuk-template__body"';
		}

		return `<body${attributes}>`;
	});

	if (!next.includes('govuk-frontend-supported')) {
		next = next.replace(/<body\b[^>]*>/i, (match) => `${match}\n\t${supportSnippet()}`);
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
	if (hasIncludeForPartial(html, HEADER_PARTIAL)) return html;

	const insert = `\n\t${headerInclude(activeNavigation)}`;
	if (html.includes(supportSnippet())) {
		return html.replace(supportSnippet(), `${supportSnippet()}${insert}`);
	}

	return html.replace(/<body class="govuk-template__body">/i, `<body class="govuk-template__body">${insert}`);
}

function normaliseFooter(html) {
	if (hasIncludeForPartial(html, FOOTER_PARTIAL)) return html;
	return html.replace(/\s*<\/body>/i, `\n\t<x-include src="${FOOTER_PARTIAL}"></x-include>\n</body>`);
}

export function normaliseGovukPageHtml(html, route) {
	const activeNavigation = activeNavigationForRoute(route);
	let next = removeHardcodedGovukChromeFallbacks(html);
	next = normaliseHead(next);
	next = normaliseBody(next);
	next = ensureGoogleTagManagerNoscript(next);
	next = normaliseHeader(next, activeNavigation);
	next = normaliseMain(next);
	next = normaliseFooter(next);
	return `${next.trim()}\n`;
}
