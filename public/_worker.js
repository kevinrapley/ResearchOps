const PREVIEW_API_ORIGIN = 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
const PRODUCTION_API_ORIGIN = 'https://rops-api.digikev-kevin-rapley.workers.dev';
const PRODUCTION_PAGES_HOST = 'researchops.pages.dev';

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
		};
	}

	if (env.RESEARCHOPS_API_ORIGIN) {
		return {
			origin: env.RESEARCHOPS_API_ORIGIN,
			source: 'env:RESEARCHOPS_API_ORIGIN',
			hostname,
		};
	}

	if (env.UPSTREAM_API) {
		return {
			origin: env.UPSTREAM_API,
			source: 'env:UPSTREAM_API',
			hostname,
		};
	}

	return {
		origin: PRODUCTION_API_ORIGIN,
		source: 'production-host',
		hostname,
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
	};
}

function requestHeaders(request) {
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cf-connecting-ip');
	headers.delete('cf-ipcountry');
	headers.delete('cf-ray');
	headers.delete('cf-visitor');
	return headers;
}

function addDiagnosticHeaders(headers, target) {
	headers.set('cache-control', 'no-store');
	headers.set('x-content-type-options', 'nosniff');
	headers.set('x-researchops-api-proxy', 'pages-advanced-worker');
	headers.set('x-researchops-api-upstream', target.origin);
	headers.set('x-researchops-api-origin-source', target.source);
	headers.set('x-researchops-pages-host', target.hostname);
	return headers;
}

function proxiedResponseHeaders(response, target) {
	const headers = new Headers(response.headers);
	headers.delete('access-control-allow-origin');
	headers.delete('access-control-allow-credentials');
	headers.delete('access-control-allow-methods');
	headers.delete('access-control-allow-headers');
	headers.delete('vary');
	return addDiagnosticHeaders(headers, target);
}

function jsonResponse(body, status = 200, target = null, extraHeaders = {}) {
	const headers = new Headers({
		'content-type': 'application/json; charset=utf-8',
		...extraHeaders,
	});
	if (target) addDiagnosticHeaders(headers, target);
	else headers.set('x-researchops-api-proxy', 'pages-advanced-worker');
	return new Response(JSON.stringify(body), { status, headers });
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
			upstreamStatus: response.status,
			upstreamSource: upstreamSource || 'unknown',
			projectCount: projects.length,
			invalidCount,
		},
		503,
		target,
		{
			'x-researchops-api-proxy-blocked': upstreamSource.toLowerCase() === 'csv' ? 'csv-project-list' : 'invalid-project-list',
			'x-researchops-api-upstream-status': String(response.status),
			'x-researchops-api-upstream-source': upstreamSource || 'unknown',
		},
	);
}

async function proxyApiRequest(request, env) {
	const method = request.method.toUpperCase();
	const target = apiTargetUrl(request, env);
	const response = await fetch(target.url, {
		method,
		headers: requestHeaders(request),
		body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
		redirect: 'manual',
	});

	const blocked = await projectListBlocker(request, response, target);
	if (blocked) return blocked;

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: proxiedResponseHeaders(response, target),
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
			const target = apiTargetUrl(request, env);
			try {
				return await proxyApiRequest(request, env);
			} catch (error) {
				return jsonResponse(
					{
						ok: false,
						error: 'api_proxy_error',
						message: 'ResearchOps could not contact the API service.',
						detail: String(error?.message || error),
					},
					502,
					target,
				);
			}
		}

		return env.ASSETS.fetch(request);
	},
};
