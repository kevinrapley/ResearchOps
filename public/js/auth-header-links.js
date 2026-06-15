/**
 * @file public/js/auth-header-links.js
 * @module AuthHeaderLinks
 * @summary Signed-in account links for the shared ResearchOps header.
 */

function defaultApiOrigin() {
	return location.origin;
}

const API_ORIGIN = document.documentElement?.dataset?.apiOrigin || window.API_ORIGIN || defaultApiOrigin();

const CONFIG = Object.freeze({
	ACCOUNT_URL: '/pages/account/',
	API_BASE: API_ORIGIN,
	CACHE: 'no-store',
	FETCH_TIMEOUT_MS: 8000,
	SIGN_IN_URL: '/pages/account/sign-in/',
});

function apiUrl(path) {
	const value = String(path || '');
	if (/^https?:\/\//i.test(value)) return value;
	return `${CONFIG.API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function displayName(context) {
	const rawName = context?.user?.displayName || context?.user?.email || '';
	return String(rawName).includes('@') ? String(rawName).split('@')[0] : rawName;
}

async function fetchJson(path, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort('timeout'), CONFIG.FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(apiUrl(path), {
			cache: CONFIG.CACHE,
			credentials: 'include',
			signal: controller.signal,
			...options,
			headers: {
				accept: 'application/json',
				...(options.body ? { 'content-type': 'application/json' } : {}),
				...(options.headers || {}),
			},
		});
		const text = await response.text();
		let data = {};
		try {
			data = text ? JSON.parse(text) : {};
		} catch {
			data = { ok: false, error: 'invalid_json_response', message: text };
		}
		return { data, ok: response.ok, status: response.status };
	} finally {
		clearTimeout(timer);
	}
}

function setVisible(element, visible) {
	if (!element) return;
	element.hidden = !visible;
	element.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function hydrateAccountLinks(root = document) {
	const accountNav = root.querySelector('[data-auth-header-account]');
	const userLink = root.querySelector('[data-auth-header-user]');
	const signOutLink = root.querySelector('[data-auth-header-sign-out]');
	if (!accountNav || !userLink || !signOutLink) return null;

	return { accountNav, userLink, signOutLink };
}

function renderSignedInUser(elements, context) {
	const name = displayName(context).trim();
	if (!name) {
		setVisible(elements.accountNav, false);
		return;
	}

	elements.userLink.textContent = name;
	elements.userLink.setAttribute('href', CONFIG.ACCOUNT_URL);
	setVisible(elements.accountNav, true);
}

async function signOut(event) {
	event.preventDefault();
	const link = event.currentTarget;
	link.setAttribute('aria-disabled', 'true');
	try {
		await fetchJson('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
	} finally {
		location.assign(CONFIG.SIGN_IN_URL);
	}
}

async function init(root = document) {
	const elements = hydrateAccountLinks(root);
	if (!elements) return;

	elements.signOutLink.addEventListener('click', signOut);

	try {
		const response = await fetchJson('/api/me/identity');
		if (!response.ok || !response.data?.ok || !response.data?.authenticated) return;
		renderSignedInUser(elements, response.data);
	} catch {
		setVisible(elements.accountNav, false);
	}
}

init();

window.__ropsAuthHeaderLinks = Object.freeze({
	CONFIG,
	defaultApiOrigin,
	displayName,
	hydrateAccountLinks,
	renderSignedInUser,
});
