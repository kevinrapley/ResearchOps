/**
 * @file public/js/study-canonical-url-bridge.js
 * @module study-canonical-url-bridge
 * @summary Allows Study-scoped pages to use ?id=<Study record id> while legacy modules complete migration.
 */

import { resolveStudyContextFromUrl, route, studyTitle } from './study-route-context.js';

const params = new URLSearchParams(window.location.search);
const canonicalStudyId = params.get('id') || '';

if (window.location.hostname.endsWith('pages.dev') && !window.API_ORIGIN) {
	window.API_ORIGIN = window.location.origin;
}

function canonicaliseStudyUrl(url, context) {
	if (!context?.studyId) return url;
	const next = new URL(url, window.location.origin);
	const pathname = next.pathname.replace(/\/+$/, '/');
	const sid = next.searchParams.get('sid') || '';
	const id = next.searchParams.get('id') || '';

	if (pathname === '/pages/synthesize/') {
		next.pathname = '/pages/study/synthesis/';
	}

	if (
		pathname.startsWith('/pages/study/') ||
		next.pathname.startsWith('/pages/study/') ||
		pathname === '/pages/synthesize/'
	) {
		if (!id && (!sid || sid === context.studyId)) {
			next.searchParams.delete('pid');
			next.searchParams.delete('sid');
			next.searchParams.set('id', context.studyId);
		}
	}

	return `${next.pathname}${next.search}${next.hash}`;
}

function rewriteStudyLinks(context) {
	for (const anchor of document.querySelectorAll('a[href]')) {
		const current = anchor.getAttribute('href') || '';
		if (!current || current.startsWith('#') || current.startsWith('mailto:') || current.startsWith('tel:')) continue;
		try {
			const next = canonicaliseStudyUrl(current, context);
			if (next !== current) anchor.setAttribute('href', next);
		} catch {
			/* Ignore non-standard URLs. */
		}
	}
}

function exposeLegacyUrlSearchParams(context) {
	if (!canonicalStudyId || !context?.projectId || !context?.studyId || URLSearchParams.prototype.__ropsStudyCanonicalBridge) {
		return;
	}

	const originalGet = URLSearchParams.prototype.get;
	Object.defineProperty(URLSearchParams.prototype, '__ropsStudyCanonicalBridge', {
		value: true,
		configurable: true
	});

	URLSearchParams.prototype.get = function getWithStudyBridge(key) {
		const id = originalGet.call(this, 'id');
		if (id === context.studyId) {
			if (key === 'pid') return context.projectId;
			if (key === 'sid') return context.studyId;
		}
		return originalGet.call(this, key);
	};
}

async function resolveContext() {
	if (!canonicalStudyId) return null;
	const context = await resolveStudyContextFromUrl(params);
	window.__studyRouteContext = context;
	window.__studyRouteParams = { id: context.studyId, pid: context.projectId, sid: context.studyId };
	window.__studyCanonicalRoute = route('/pages/study/', { id: context.studyId });
	window.__studyCanonicalTitle = studyTitle(context.study || {});
	try {
		sessionStorage.setItem(`rops:study:${context.studyId}:projectId`, context.projectId);
	} catch {
		/* Session storage is best-effort. */
	}
	exposeLegacyUrlSearchParams(context);
	return context;
}

const context = await resolveContext().catch((error) => {
	console.warn('[study-canonical-url-bridge] canonical Study route could not be resolved', error);
	return null;
});

if (context) {
	rewriteStudyLinks(context);
	const observer = new MutationObserver(() => rewriteStudyLinks(context));
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['href']
	});
}

export { canonicaliseStudyUrl, rewriteStudyLinks };
