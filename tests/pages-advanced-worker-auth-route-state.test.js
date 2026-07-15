import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import worker from "../public/_worker.js";

const workerSource = fs.readFileSync("public/_worker.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(workerSource, "stripAccessHeaders: true", "Pages advanced worker");
includes(workerSource, "headers.delete('cf-access-jwt-assertion');", "Pages advanced worker");
includes(workerSource, "headers.delete('cf-access-authenticated-user-email');", "Pages advanced worker");
includes(workerSource, "headers.delete('cf-access-user-email');", "Pages advanced worker");
includes(workerSource, "function proxyDiagnosticsEnabled(env = {})", "Pages advanced worker");
includes(workerSource, "RESEARCHOPS_PROXY_DIAGNOSTICS_ENABLED", "Pages advanced worker");
includes(workerSource, "function shouldDisableStaticCache(pathname)", "Pages advanced worker static cache policy");
includes(workerSource, "pathname === '/' || pathname.endsWith('/') || pathname.endsWith('.html')", "Pages advanced worker static cache policy");
includes(workerSource, "headers.set('cache-control', 'no-store');", "Pages advanced worker static cache policy");
includes(workerSource, "headers.delete('content-length');", "Pages advanced worker brand routing");
includes(workerSource, "function protectedPageRedirect(request, env)", "Pages advanced worker protected page preflight");
includes(workerSource, "apiEndpointTarget(request, env, '/api/me')", "Pages advanced worker protected page preflight");
includes(workerSource, "cleanPath === '/pages/start'", "Pages advanced worker protected page preflight");
includes(workerSource, "cleanPath === '/pages/project-dashboard'", "Pages advanced worker protected page preflight");
includes(workerSource, "return response.ok ? null : signInRedirect(request);", "Pages advanced worker protected page preflight");
includes(workerSource, "x-researchops-auth-redirect", "Pages advanced worker protected page preflight");
includes(workerSource, "const PRODUCTION_BRAND_HOSTS = new Map", "Pages advanced worker brand routing");
includes(workerSource, "['research-operations.com', HOME_OFFICE_BRAND]", "Pages advanced worker brand routing");
includes(workerSource, "['govuk.research-operations.com', GOVUK_BRAND]", "Pages advanced worker brand routing");
includes(workerSource, "headers.set('x-researchops-brand', brand);", "Pages advanced worker brand routing");
includes(workerSource, "injectBrandIntoHtml(await response.text(), brand)", "Pages advanced worker brand routing");
includes(workerSource, "return staticAssetResponse(request, env);", "Pages advanced worker static cache policy");
excludes(workerSource, "'jwt-only'", "Pages advanced worker");

function assetEnv(headers = {}, body = "asset") {
	return {
		ASSETS: {
			fetch: async () => new Response(body, { headers }),
		},
	};
}

async function withMockedFetch(handler, run) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = handler;
	try {
		return await run();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

function authenticatedFetch() {
	return new Response(JSON.stringify({ ok: true, authenticated: true }), { status: 200 });
}

test("Pages advanced worker disables browser caching for static HTML routes", async () => {
	const response = await worker.fetch(new Request("https://researchops.pages.dev/"), assetEnv());
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("Pages advanced worker preserves cache policy for static non-HTML assets", async () => {
	const response = await worker.fetch(
		new Request("https://researchops.pages.dev/assets/researchops/researchops-home.css"),
		assetEnv({ "cache-control": "public, max-age=3600" }),
	);
	assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
});

test("Pages advanced worker serves the Home Office brand from the production apex host", async () => {
	await withMockedFetch(authenticatedFetch, async () => {
		const response = await worker.fetch(
			new Request("https://research-operations.com/pages/projects/"),
			assetEnv(
				{ "content-type": "text/html; charset=utf-8", "content-length": "89" },
				'<!doctype html><html class="govuk-template" lang="en"><head></head><body></body></html>',
			),
		);
		const body = await response.text();
		assert.equal(response.headers.get("x-researchops-brand"), "home-office");
		assert.equal(response.headers.has("content-length"), false);
		assert.match(body, /<html class="govuk-template" lang="en" data-researchops-brand="home-office">/);
		assert.match(body, /<meta name="researchops-brand" content="home-office">/);
		assert.match(body, /href="\/css\/brands\/home-office\.css"/);
		assert.match(body, /href="\/css\/brands\/home-office-buttons\.css"/);
	});
});

test("Pages advanced worker serves the GOV.UK brand from the GOV.UK production subdomain", async () => {
	await withMockedFetch(authenticatedFetch, async () => {
		const response = await worker.fetch(
			new Request("https://govuk.research-operations.com/pages/projects/?brand=home-office"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html class=\"govuk-template\" lang=\"en\"><head></head><body></body></html>"),
		);
		const body = await response.text();
		assert.equal(response.headers.get("x-researchops-brand"), "govuk");
		assert.match(body, /<html class="govuk-template" lang="en" data-researchops-brand="govuk">/);
		assert.match(body, /<meta name="researchops-brand" content="govuk">/);
		assert.equal(body.includes("/css/brands/home-office.css"), false);
	});
});

test("Pages advanced worker still supports query-string brand testing off production hosts", async () => {
	await withMockedFetch(authenticatedFetch, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/projects/?brand=home-office"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html class=\"govuk-template\" lang=\"en\"><head></head><body></body></html>"),
		);
		assert.equal(response.headers.get("x-researchops-brand"), "home-office");
	});
});

test("Pages advanced worker redirects unauthenticated Projects page requests to sign in", async () => {
	await withMockedFetch(async (url) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/me");
		return new Response(JSON.stringify({ ok: false, error: "authentication_required" }), { status: 401 });
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/projects/?sort=newest"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Projects</body></html>"),
		);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(response.headers.get("x-researchops-auth-redirect"), "pages-static-preflight");
		assert.equal(
			response.headers.get("location"),
			"https://researchops.pages.dev/pages/account/sign-in/?returnTo=%2Fpages%2Fprojects%2F%3Fsort%3Dnewest",
		);
	});
});

test("Pages advanced worker redirects unauthenticated Start page requests to sign in", async () => {
	await withMockedFetch(async (url) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/me");
		return new Response(JSON.stringify({ ok: false, error: "authentication_required" }), { status: 401 });
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/start/"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Start</body></html>"),
		);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(response.headers.get("x-researchops-auth-redirect"), "pages-static-preflight");
		assert.equal(
			response.headers.get("location"),
			"https://researchops.pages.dev/pages/account/sign-in/?returnTo=%2Fpages%2Fstart%2F",
		);
	});
});

test("Pages advanced worker redirects unauthenticated Project dashboard requests to sign in", async () => {
	await withMockedFetch(async (url) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/me");
		return new Response(JSON.stringify({ ok: false, error: "authentication_required" }), { status: 401 });
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/project-dashboard/?id=recMtdmBbaFilF2Tm"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Project dashboard</body></html>"),
		);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(response.headers.get("x-researchops-auth-redirect"), "pages-static-preflight");
		assert.equal(
			response.headers.get("location"),
			"https://researchops.pages.dev/pages/account/sign-in/?returnTo=%2Fpages%2Fproject-dashboard%2F%3Fid%3DrecMtdmBbaFilF2Tm",
		);
	});
});

test("Pages advanced worker redirects unauthenticated Repository page requests to sign in", async () => {
	await withMockedFetch(async (url) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/me");
		return new Response(JSON.stringify({ ok: false, error: "authentication_required" }), { status: 401 });
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/repository/"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Repository</body></html>"),
		);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("location"), "https://researchops.pages.dev/pages/account/sign-in/?returnTo=%2Fpages%2Frepository%2F");
	});
});

test("Pages advanced worker serves the public product proof page without auth preflight", async () => {
	let authCheckCalled = false;

	await withMockedFetch(async () => {
		authCheckCalled = true;
		throw new Error("Product proof page should not call the auth preflight");
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/product-proof/"),
			assetEnv(
				{ "content-type": "text/html; charset=utf-8" },
				"<!doctype html><html><head></head><body>ResearchOps Product Proof</body></html>",
			),
		);
		const body = await response.text();

		assert.equal(response.status, 200);
		assert.equal(authCheckCalled, false);
		assert.match(body, /ResearchOps Product Proof/);
	});
});

test("Pages advanced worker redirects protected static page requests when the app auth check fails", async () => {
	await withMockedFetch(async (url) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/me");
		return new Response(JSON.stringify({ ok: false, error: "auth_service_unavailable" }), { status: 503 });
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/projects/"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Projects</body></html>"),
		);
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("x-researchops-auth-redirect"), "pages-static-preflight");
		assert.equal(response.headers.get("location"), "https://researchops.pages.dev/pages/account/sign-in/?returnTo=%2Fpages%2Fprojects%2F");
	});
});

test("Pages advanced worker serves protected static pages after app authentication", async () => {
	await withMockedFetch(authenticatedFetch, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/pages/projects/"),
			assetEnv({ "content-type": "text/html; charset=utf-8" }, "<!doctype html><html><head></head><body>Projects</body></html>"),
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-researchops-brand"), "govuk");
		assert.equal(await response.text(), '<!doctype html><html data-researchops-brand="govuk"><head>\n\t<meta name="researchops-brand" content="govuk"></head><body>Projects</body></html>');
	});
});

test("Pages advanced worker strips Cloudflare Access headers from preview API requests", async () => {
	await withMockedFetch(async (url, init = {}) => {
		assert.equal(url, "https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev/api/projects/recMtdmBbaFilF2Tm");
		const headers = new Headers(init.headers);
		assert.equal(headers.has("cf-access-jwt-assertion"), false);
		assert.equal(headers.has("cf-access-authenticated-user-email"), false);
		assert.equal(headers.has("cf-access-user-email"), false);
		assert.equal(headers.get("cookie"), "rops_session=test-session");
		return new Response(JSON.stringify({ ok: true, id: "recMtdmBbaFilF2Tm" }), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}, async () => {
		const response = await worker.fetch(
			new Request("https://feature-edit-project-objectives-markdown.researchops.pages.dev/api/projects/recMtdmBbaFilF2Tm", {
				headers: {
					"cf-access-jwt-assertion": "access.jwt",
					"cf-access-authenticated-user-email": "user@example.test",
					"cf-access-user-email": "user@example.test",
					cookie: "rops_session=test-session",
				},
			}),
			assetEnv(),
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-researchops-api-origin-source"), null);
		assert.equal(response.headers.get("x-researchops-api-upstream"), null);
		assert.equal(response.headers.get("x-researchops-access-headers-forwarded"), null);
	});
});

test("Pages advanced worker only emits API proxy diagnostics when explicitly enabled", async () => {
	await withMockedFetch(async (url, init = {}) => {
		assert.equal(url, "https://rops-api-passwordless-preview.digikev-kevin-rapley.workers.dev/api/projects/recMtdmBbaFilF2Tm");
		const headers = new Headers(init.headers);
		assert.equal(headers.has("cf-access-jwt-assertion"), false);
		return new Response(JSON.stringify({ ok: true, id: "recMtdmBbaFilF2Tm" }), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}, async () => {
		const response = await worker.fetch(
			new Request("https://feature-edit-project-objectives-markdown.researchops.pages.dev/api/projects/recMtdmBbaFilF2Tm", {
				headers: { "cf-access-jwt-assertion": "access.jwt" },
			}),
			{ ...assetEnv(), RESEARCHOPS_PROXY_DIAGNOSTICS_ENABLED: "true" },
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-researchops-api-origin-source"), "preview-host");
		assert.equal(response.headers.get("x-researchops-access-headers-forwarded"), "false");
	});
});

test("Pages advanced worker adds CSRF confirmation to proxied API mutations", async () => {
	await withMockedFetch(async (url, init = {}) => {
		assert.equal(url, "https://rops-api.digikev-kevin-rapley.workers.dev/api/session-notes");
		const headers = new Headers(init.headers);
		assert.equal(headers.get("x-researchops-csrf"), "pages-proxy");
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}, async () => {
		const response = await worker.fetch(
			new Request("https://researchops.pages.dev/api/session-notes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: "Session note" }),
			}),
			assetEnv(),
		);
		assert.equal(response.status, 200);
	});
});
