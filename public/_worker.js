const PREVIEW_API_ORIGIN = 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
const PRODUCTION_API_ORIGIN = 'https://rops-api.digikev-kevin-rapley.workers.dev';
const PRODUCTION_PAGES_HOST = 'researchops.pages.dev';
const HOME_OFFICE_BRAND = 'home-office';
const GOVUK_BRAND = 'govuk';
const SUPPORTED_BRANDS = new Set([HOME_OFFICE_BRAND, GOVUK_BRAND]);
const PRODUCTION_BRAND_HOSTS = new Map([
	['research-operations.com', HOME_OFFICE_BRAND],
	['www.research-operations.com', HOME_OFFICE_BRAND],
	['govuk.research-operations.com', GOVUK_BRAND],
]);

function isPagesPreviewHost(hostname) {
	return hostname.endsWith('.researchops.pages.dev') && hostname !== PRODUCTION_PAGES_HOST;
}

function resolveApiTarget(request, env = {}) {
	const pageUrl = new URL(request.url);
	const hostname = pageUrl.hostname;

	if (isPagesPreviewHost(hostname)) {
		return {
			origin: PREVIEW_API_ORIGIN,
			source: 'preview-host',
			hostname,
			stripAccessHeaders: true,
		};
	}

	if (env.RESEARCHOPS_API_ORIGIN) {
		return {
			origin: env.RESEARCHOPS_API_ORIGIN,
			source: 'env:RESEARCHOPS_API_ORIGIN',
			hostname,
			stripAccessHeaders: false,
		};
	}

	if (env.UPSTREAM_API) {
		return {
			origin: env.UPSTREAM_API,
			source: 'env:UPSTREAM_API',
			hostname,
			stripAccessHeaders: false,
		};
	}

	return {
		origin: PRODUCTION_API_ORIGIN,
		source: 'production-host',
		hostname,
		stripAccessHeaders: false,
	};
}

function apiTargetUrl(request, env) {
	const source = new URL(request.url);
	const target = resolveApiTarget(request, env);
	const base = new URL(target.origin);
	const path = source.pathname.startsWith('/api/') || source.pathname === '/api'
		? source.pathname
		: `/api${source.pathname.startsWith('/') ? source.pathname : `/${source.pathname}`}`;
	return {
		url: new URL(path + source.search, base.origin).toString(),
		origin: base.origin,
		source: target.source,
		hostname: target.hostname,
		stripAccessHeaders: target.stripAccessHeaders,
	};
}

function requestHeaders(request, target) {
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cf-connecting-ip');
	headers.delete('cf-ipcountry');
	headers.delete('cf-ray');
	headers.delete('cf-visitor');

	if (target.stripAccessHeaders) {
		headers.delete('cf-access-jwt-assertion');
		headers.delete('cf-access-authenticated-user-email');
		headers.delete('cf-access-user-email');
	}

	if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()) && !headers.has('x-researchops-csrf')) {
		headers.set('x-researchops-csrf', 'pages-proxy');
	}

	return headers;
}

function proxyDiagnosticsEnabled(env = {}) {
	return String(env.RESEARCHOPS_PROXY_DIAGNOSTICS_ENABLED || '').toLowerCase() === 'true';
}

function addDiagnosticHeaders(headers, target, env = {}) {
	headers.set('cache-control', 'no-store');
	headers.set('x-content-type-options', 'nosniff');
	headers.set('x-researchops-api-proxy', 'pages-advanced-worker');
	if (proxyDiagnosticsEnabled(env)) {
		headers.set('x-researchops-api-upstream', target.origin);
		headers.set('x-researchops-api-origin-source', target.source);
		headers.set('x-researchops-pages-host', target.hostname);
		headers.set('x-researchops-access-headers-forwarded', target.stripAccessHeaders ? 'false' : 'true');
	}
	return headers;
}

function proxiedResponseHeaders(response, target, env) {
	const headers = new Headers(response.headers);
	headers.delete('access-control-allow-origin');
	headers.delete('access-control-allow-credentials');
	headers.delete('access-control-allow-methods');
	headers.delete('access-control-allow-headers');
	headers.delete('vary');
	return addDiagnosticHeaders(headers, target, env);
}

function jsonResponse(body, status = 200, target = null, extraHeaders = {}, env = {}) {
	const headers = new Headers({
		'content-type': 'application/json; charset=utf-8',
		...extraHeaders,
	});
	if (target) addDiagnosticHeaders(headers, target, env);
	else headers.set('x-researchops-api-proxy', 'pages-advanced-worker');
	return new Response(JSON.stringify(body), { status, headers });
}

function isProtectedPage(pathname) {
	const cleanPath = pathname.replace(/\/+$/, '');
	return cleanPath === '/pages/projects' || cleanPath === '/pages/project-dashboard' || cleanPath === '/pages/repository';
}

function signInRedirect(request) {
	const source = new URL(request.url);
	const destination = new URL('/pages/account/sign-in/', source.origin);
	destination.searchParams.set('returnTo', `${source.pathname}${source.search || ''}`);
	return new Response(null, {
		status: 302,
		headers: {
			location: destination.toString(),
			'cache-control': 'no-store',
			'x-researchops-auth-redirect': 'pages-static-preflight',
		},
	});
}

function apiEndpointTarget(request, env, apiPath) {
	const pageUrl = new URL(request.url);
	const target = resolveApiTarget(request, env);
	const base = new URL(target.origin);
	return {
		url: new URL(apiPath, base.origin).toString(),
		origin: base.origin,
		source: target.source,
		hostname: pageUrl.hostname,
		stripAccessHeaders: target.stripAccessHeaders,
	};
}

async function protectedPageRedirect(request, env) {
	const url = new URL(request.url);
	const method = request.method.toUpperCase();
	if ((method !== 'GET' && method !== 'HEAD') || !isProtectedPage(url.pathname)) return null;

	const target = apiEndpointTarget(request, env, '/api/me');
	const response = await fetch(target.url, {
		method: 'GET',
		headers: requestHeaders(request, target),
		redirect: 'manual',
	});

	return response.ok ? null : signInRedirect(request);
}

function shouldDisableStaticCache(pathname) {
	return pathname === '/' || pathname.endsWith('/') || pathname.endsWith('.html');
}

function normaliseBrand(value) {
	const brand = String(value || '').trim().toLowerCase();
	return SUPPORTED_BRANDS.has(brand) ? brand : GOVUK_BRAND;
}

function productionHostBrand(hostname) {
	return PRODUCTION_BRAND_HOSTS.get(String(hostname || '').toLowerCase()) || null;
}

function requestBrand(url) {
	const hostBrand = productionHostBrand(url.hostname);
	if (hostBrand) return hostBrand;
	return normaliseBrand(url.searchParams.get('brand'));
}

function isHtmlResponse(response, pathname) {
	const contentType = response.headers.get('content-type') || '';
	return shouldDisableStaticCache(pathname) || contentType.toLowerCase().includes('text/html');
}

function htmlNonce() {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
	const bytes = new Uint8Array(16);
	globalThis.crypto?.getRandomValues?.(bytes);
	return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('') || String(Date.now());
}

function nonceInlineScripts(html, nonce) {
	return String(html || '').replace(/<script\b(?![^>]*\bsrc=)(?![^>]*\bnonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
}

function contentSecurityPolicy(nonce) {
	return [
		"default-src 'self'",
		"connect-src 'self' https://rops-api.digikev-kevin-rapley.workers.dev https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev https://flux-behaviour.pages.dev",
		"img-src 'self' data:",
		"style-src 'self' 'unsafe-inline'",
		`script-src 'self' 'nonce-${nonce}' https://flux-behaviour.pages.dev https://www.googletagmanager.com`,
		"font-src 'self'",
		"frame-src https://www.googletagmanager.com",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join('; ');
}

function brandHtmlAttributes(match, brand) {
	let html = match;
	if (/\sdata-researchops-brand=/.test(html)) {
		html = html.replace(/\sdata-researchops-brand=(["'])[^"']*\1/, ` data-researchops-brand="${brand}"`);
	} else {
		html = html.replace(/>$/, ` data-researchops-brand="${brand}">`);
	}
	return html;
}

function brandHeadHtml(brand) {
	const meta = `<meta name="researchops-brand" content="${brand}">`;
	if (brand !== HOME_OFFICE_BRAND) return meta;
	return `${meta}
	<link rel="stylesheet" href="/css/brands/home-office.css" media="screen">
	<link rel="stylesheet" href="/css/brands/home-office-buttons.css" media="screen">`;
}

function injectBrandIntoHtml(html, brand) {
	let next = html.replace(/<html\b[^>]*>/i, (match) => brandHtmlAttributes(match, brand));
	if (!next.includes('name="researchops-brand"')) {
		next = next.replace(/<head\b[^>]*>/i, (match) => `${match}
	${brandHeadHtml(brand)}`);
	}
	return next;
}

async function staticAssetResponse(request, env) {
	const response = await env.ASSETS.fetch(request);
	const url = new URL(request.url);
	if (!isHtmlResponse(response, url.pathname)) return response;

	const headers = new Headers(response.headers);
	headers.set('cache-control', 'no-store');
	headers.set('x-content-type-options', 'nosniff');
	headers.delete('content-length');
	const brand = requestBrand(url);
	headers.set('x-researchops-brand', brand);
	const nonce = htmlNonce();
	headers.set('content-security-policy', contentSecurityPolicy(nonce));
	const body = nonceInlineScripts(injectBrandIntoHtml(await response.text(), brand), nonce);
	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function isProjectListRequest(request) {
	const url = new URL(request.url);
	return request.method.toUpperCase() === 'GET' && url.pathname.replace(/\/+$/, '') === '/api/projects';
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || '').trim());
}

function isProjectCardRecord(project = {}) {
	const id = project.id || project.airtableId || project.recordId || project['Record ID'];
	return isAirtableRecordId(id) && Boolean(project.name || project.Name) && Boolean(project['rops:servicePhase'] || project.Phase || project.phase) && Boolean(project['rops:projectStatus'] || project.Status || project.status);
}

async function projectListBlocker(request, response, target) {
	if (!isProjectListRequest(request)) return null;
	const upstreamSource = response.headers.get('x-rops-source') || '';
	let data = null;
	try {
		data = await response.clone().json();
	} catch {
		return null;
	}
	const projects = Array.isArray(data?.projects) ? data.projects : [];
	const invalidCount = projects.filter((project) => !isProjectCardRecord(project)).length;
	if (upstreamSource.toLowerCase() !== 'csv' && invalidCount === 0) return null;
	return jsonResponse(
		{
			ok: false,
			error: 'projects_unavailable',
			detail: 'Project lists must come from Airtable or D1 and must contain valid Airtable record ids.',
			projectCount: projects.length,
			invalidCount,
		},
		503,
		target,
		{
			'x-researchops-api-proxy-blocked': upstreamSource.toLowerCase() === 'csv' ? 'csv-project-list' : 'invalid-project-list',
		},
	);
}

async function proxyApiRequest(request, env) {
	const method = request.method.toUpperCase();
	const target = apiTargetUrl(request, env);
	const response = await fetch(target.url, {
		method,
		headers: requestHeaders(request, target),
		body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
		redirect: 'manual',
	});

	const blocked = await projectListBlocker(request, response, target);
	if (blocked) return blocked;

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxiedResponseHeaders(response, target, env),
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
			const target = apiTargetUrl(request, env);
			try {
				return await proxyApiRequest(request, env);
			} catch {
				return jsonResponse(
					{
						ok: false,
						error: 'api_proxy_error',
						message: 'ResearchOps could not contact the API service.',
					},
					502,
					target,
					{},
					env,
				);
			}
		}

		const redirect = await protectedPageRedirect(request, env);
		if (redirect) return redirect;

		return staticAssetResponse(request, env);
	},
};
