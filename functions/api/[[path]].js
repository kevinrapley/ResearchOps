const PREVIEW_API_ORIGIN = 'https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev';
const PRODUCTION_API_ORIGIN = 'https://rops-api.digikev-kevin-rapley.workers.dev';
const PRODUCTION_PAGES_HOST = 'researchops.pages.dev';

const VALID_PROJECT_PHASES = new Set(['pre-discovery', 'discovery', 'alpha', 'beta', 'live']);

function isPagesPreviewHost(hostname) {
	return hostname.endsWith('.researchops.pages.dev') && hostname !== PRODUCTION_PAGES_HOST;
}

function upstreamApiFor(request, env = {}) {
	if (env.UPSTREAM_API) return env.UPSTREAM_API;
	if (env.RESEARCHOPS_API_ORIGIN) return env.RESEARCHOPS_API_ORIGIN;

	const hostname = new URL(request.url).hostname;
	if (isPagesPreviewHost(hostname)) return PREVIEW_API_ORIGIN;
	return PRODUCTION_API_ORIGIN;
}

function corsHeaders(origin) {
	return {
		'Access-Control-Allow-Origin': origin || '*',
		'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ResearchOps-Team-Id',
		'Access-Control-Allow-Credentials': 'true',
		Vary: 'Origin',
		'Access-Control-Max-Age': '86400',
	};
}

function buildUpstreamUrl(request, env) {
	const inReqUrl = new URL(request.url);
	const upstreamBase = new URL(upstreamApiFor(request, env));
	const tailPath = inReqUrl.pathname.replace(/^\/api\/?/, '');
	const cleanBasePath = upstreamBase.pathname.replace(/\/+$/, '');
	const tailSegment = tailPath ? `/${tailPath}` : '';
	const normalizedBasePath = cleanBasePath.toLowerCase();
	let upstreamPath;

	if (normalizedBasePath.endsWith('/api') || normalizedBasePath.includes('/api/')) {
		upstreamPath = `${cleanBasePath}${tailSegment}`;
	} else {
		upstreamPath = `${cleanBasePath}/api${tailSegment}`;
	}

	if (!upstreamPath.startsWith('/')) {
		upstreamPath = `/${upstreamPath.replace(/^\/+/, '')}`;
	}

	const outUrl = new URL(upstreamBase.origin + upstreamPath);
	outUrl.search = inReqUrl.search;
	return outUrl;
}

function forwardedHeaders(request) {
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cf-connecting-ip');
	headers.delete('cf-ipcountry');
	headers.delete('cf-ray');
	headers.delete('cf-visitor');
	return headers;
}

function jsonResponse(body, status = 200, origin = null, extraHeaders = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			'x-content-type-options': 'nosniff',
			'x-researchops-api-proxy': 'pages-function',
			...corsHeaders(origin),
			...extraHeaders,
		},
	});
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || '').trim());
}

function looksLikeIdentityFragment(value) {
	const text = String(value || '').trim();
	if (!text) return false;
	return /"?EMAIL"?\s*:/i.test(text) ||
		/"?email"?\s*:/i.test(text) ||
		/"?role"?\s*:/i.test(text) ||
		/^[}\]]+$/.test(text) ||
		/^[{[]/.test(text) ||
		(/^[^,\s]+@[^,\s]+\.[^,\s]+$/i.test(text) && !/\s/.test(text));
}

function looksLikeUuid(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function hasValidProjectPhase(project) {
	const phase = String(project?.['rops:servicePhase'] || project?.Phase || project?.phase || '').trim().toLowerCase();
	return VALID_PROJECT_PHASES.has(phase);
}

function isProjectListRequest(request) {
	const url = new URL(request.url);
	return request.method.toUpperCase() === 'GET' && url.pathname.replace(/\/+$/, '') === '/api/projects';
}

function isRenderableProject(project = {}) {
	const id = project.id || project.airtableId || project.recordId || project['Record ID'];
	const name = project.name || project.Name;
	const status = project['rops:projectStatus'] || project.Status || project.status;
	if (!isAirtableRecordId(id)) return false;
	if (!String(name || '').trim()) return false;
	if (looksLikeIdentityFragment(name)) return false;
	if (!hasValidProjectPhase(project)) return false;
	if (looksLikeIdentityFragment(status) || looksLikeUuid(status)) return false;
	return true;
}

async function parseJsonResponse(response) {
	try {
		return await response.clone().json();
	} catch {
		return null;
	}
}

async function blockMalformedProjectList(request, origin, response) {
	if (!isProjectListRequest(request)) return null;
	const data = await parseJsonResponse(response);
	if (!data || data.ok !== true || !Array.isArray(data.projects)) return null;

	const malformed = data.projects.filter((project) => !isRenderableProject(project));
	if (!malformed.length) return null;

	return jsonResponse(
		{
			ok: false,
			error: 'projects_unavailable',
			detail: '/api/projects returned records that do not match the Airtable/D1 project contract. CSV fallback is disabled for project cards.',
			upstreamStatus: response.status,
			malformedCount: malformed.length,
			projectCount: data.projects.length,
			expected: {
				id: 'Airtable record id beginning rec...',
				requiredFields: ['id', 'name', 'rops:servicePhase', 'rops:projectStatus'],
				sources: ['airtable', 'd1'],
			},
		},
		503,
		origin,
		{
			'x-researchops-api-proxy-blocked': 'malformed-project-list',
			'x-researchops-api-upstream-status': String(response.status),
		},
	);
}

export async function onRequest({ request, env }) {
	const method = request.method.toUpperCase();
	const origin = request.headers.get('Origin');

	if (method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(origin),
		});
	}

	try {
		const targetUrl = buildUpstreamUrl(request, env);
		const response = await fetch(targetUrl.toString(), {
			method,
			headers: forwardedHeaders(request),
			body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
			redirect: 'manual',
		});

		const projectBlock = await blockMalformedProjectList(request, origin, response);
		if (projectBlock) return projectBlock;

		const headers = new Headers(response.headers);
		headers.set('cache-control', 'no-store');
		headers.set('x-content-type-options', 'nosniff');
		headers.set('x-researchops-api-proxy', 'pages-function');
		headers.set('x-researchops-api-upstream', targetUrl.origin);
		for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch (error) {
		return jsonResponse(
			{
				ok: false,
				error: 'api_proxy_error',
				message: 'ResearchOps could not contact the sign-in service.',
				detail: String(error?.message || error),
			},
			502,
			origin,
		);
	}
}
