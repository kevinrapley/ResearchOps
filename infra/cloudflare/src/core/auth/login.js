/**
 * @file src/core/auth/login.js
 * @module core/auth/login
 * @summary Login handoff route for Cloudflare Access protected account entry.
 */

const DEFAULT_RETURN_PATH = '/pages/account/sign-in/';
const ACCESS_ASSERTION_HEADER = 'Cf-Access-Jwt-Assertion';

function normaliseReturnPath(value) {
	const raw = String(value || DEFAULT_RETURN_PATH).trim();

	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
		return DEFAULT_RETURN_PATH;
	}

	try {
		const parsed = new URL(raw, 'https://researchops.local');
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return DEFAULT_RETURN_PATH;
	}
}

function absoluteReturnUrl(request, returnPath) {
	const url = new URL(request.url);
	url.pathname = returnPath.split('?')[0].split('#')[0];
	url.search = '';
	url.hash = '';

	const queryIndex = returnPath.indexOf('?');
	const hashIndex = returnPath.indexOf('#');

	if (queryIndex >= 0) {
		url.search = hashIndex >= 0 ? returnPath.slice(queryIndex, hashIndex) : returnPath.slice(queryIndex);
	}

	if (hashIndex >= 0) {
		url.hash = returnPath.slice(hashIndex);
	}

	return url;
}

function configuredAccessLoginUrl(request, env, returnPath) {
	const raw = env.RESEARCHOPS_ACCESS_LOGIN_URL || env.CLOUDFLARE_ACCESS_LOGIN_URL || '';
	if (!raw) return null;

	const returnUrl = absoluteReturnUrl(request, returnPath);
	const resolved = raw.includes('{return}') ? raw.replaceAll('{return}', encodeURIComponent(returnUrl.toString())) : raw;
	const loginUrl = new URL(resolved, request.url);

	if (!loginUrl.searchParams.has('redirect_url')) {
		loginUrl.searchParams.set('redirect_url', returnUrl.toString());
	}

	return loginUrl;
}

function redirect(location, status = 303) {
	return new Response(null, {
		status,
		headers: {
			location,
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
		},
	});
}

function addStatus(returnPath, status) {
	const url = new URL(returnPath, 'https://researchops.local');
	url.searchParams.set('auth', status);
	return `${url.pathname}${url.search}${url.hash}`;
}

export function loginReturnPathFromRequest(request) {
	const url = new URL(request.url);
	return normaliseReturnPath(url.searchParams.get('return'));
}

export function hasAccessAssertion(request) {
	return Boolean(request.headers.get(ACCESS_ASSERTION_HEADER));
}

export function loginRedirectForRequest(request, env = {}) {
	const returnPath = loginReturnPathFromRequest(request);

	if (hasAccessAssertion(request)) {
		return absoluteReturnUrl(request, returnPath);
	}

	const configuredLogin = configuredAccessLoginUrl(request, env, returnPath);
	if (configuredLogin) return configuredLogin;

	return absoluteReturnUrl(request, addStatus(returnPath, 'access-policy-required'));
}

export async function handleAuthLoginRoute(request, env = {}) {
	return redirect(loginRedirectForRequest(request, env).toString());
}
