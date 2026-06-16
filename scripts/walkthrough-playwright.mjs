/* eslint-env node */

/**
 * @file scripts/walkthrough-playwright.mjs
 * @summary Shared Playwright routing helpers for deterministic walkthrough capture.
 */

import fs from 'node:fs';
import path from 'node:path';
import { operationalMockRoutes } from '../visual-walkthrough.operational-fixtures.mjs';

const CONTENT_TYPES = new Map([
	['.css', 'text/css; charset=utf-8'],
	['.html', 'text/html; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.png', 'image/png'],
	['.svg', 'image/svg+xml'],
	['.txt', 'text/plain; charset=utf-8'],
	['.woff2', 'font/woff2'],
]);

const SIGN_IN_CHALLENGE_ID = 'chl_qa_bdd_walkthrough';
const SIGN_IN_EMAIL = 'qa-bdd.walkthrough@example.gov.uk';

function publicFileForPath(publicRoot, pathname) {
	const decodedPath = decodeURIComponent(pathname);
	const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
	const filePath = path.join(publicRoot, relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath);
	const resolvedRoot = path.resolve(publicRoot);
	const resolvedFile = path.resolve(filePath);

	if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`) && resolvedFile !== resolvedRoot) {
		return null;
	}

	if (fs.existsSync(resolvedFile) && fs.statSync(resolvedFile).isFile()) return resolvedFile;

	if (!path.extname(resolvedFile)) {
		const indexPath = path.join(resolvedFile, 'index.html');
		if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) return indexPath;
	}

	return null;
}

function contentTypeFor(filePath) {
	return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function serialiseBody(body, request) {
	const resolvedBody = typeof body === 'function' ? body({
		url: request.url(),
		method: request.method(),
	}) : body;
	return typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody ?? {});
}

function matchMockRoute(mockRoute, request) {
	const requestUrl = request.url();
	const requestMethod = request.method().toUpperCase();
	const expectedMethod = String(mockRoute.method || requestMethod).toUpperCase();

	if (requestMethod !== expectedMethod) return false;
	if (typeof mockRoute.url === 'string') return requestUrl.includes(mockRoute.url.replaceAll('**', ''));
	if (mockRoute.url instanceof RegExp) return mockRoute.url.test(requestUrl);
	return false;
}

function mockRouteKey(mockRoute) {
	return String(mockRoute.url);
}

function signInMockRoutes({ email = SIGN_IN_EMAIL } = {}) {
	return [
		{
			url: /\/api\/me(?:\?.*)?$/,
			method: 'GET',
			status: 401,
			body: {
				ok: false,
				authenticated: false,
				error: 'authentication_required',
				message: 'Sign in is required to use this part of ResearchOps.',
			},
		},
		{
			url: /\/api\/auth\/email\/start(?:\?.*)?$/,
			method: 'POST',
			body: {
				ok: true,
				challengeId: SIGN_IN_CHALLENGE_ID,
				expiresInSeconds: 600,
				deliveryProvider: 'qa-bdd-walkthrough',
				email,
			},
		},
	];
}

function walkthroughMockRoutes({ authenticated = true, extraRoutes = [], signInEmail = SIGN_IN_EMAIL } = {}) {
	const baseRoutes = authenticated ? operationalMockRoutes() : signInMockRoutes({ email: signInEmail });
	const extraKeys = new Set(extraRoutes.map(mockRouteKey));
	return [...extraRoutes, ...baseRoutes.filter((route) => !extraKeys.has(mockRouteKey(route)))];
}

async function registerMockRoutes(page, mockRoutes = []) {
	for (const mockRoute of mockRoutes) {
		await page.route(mockRoute.url, async (route) => {
			const request = route.request();
			if (!matchMockRoute(mockRoute, request)) {
				await route.fallback();
				return;
			}

			await route.fulfill({
				status: mockRoute.status ?? 200,
				contentType: mockRoute.contentType || 'application/json',
				headers: mockRoute.headers || {},
				body: serialiseBody(mockRoute.body, request),
			});
		});
	}
}

async function registerLocalAssetRoutes(page, { baseURL, publicRoot = 'public' } = {}) {
	const base = new URL(baseURL || 'http://localhost:8788/');
	await page.route('**/*', async (route) => {
		const requestUrl = new URL(route.request().url());

		if (requestUrl.origin !== base.origin || requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
			await route.fallback();
			return;
		}

		const filePath = publicFileForPath(publicRoot, requestUrl.pathname);
		if (!filePath) {
			await route.fallback();
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: contentTypeFor(filePath),
			body: fs.readFileSync(filePath),
		});
	});
}

export {
	SIGN_IN_CHALLENGE_ID,
	SIGN_IN_EMAIL,
	registerLocalAssetRoutes,
	registerMockRoutes,
	signInMockRoutes,
	walkthroughMockRoutes,
};
