import assert from "node:assert/strict";
import fs from "node:fs";

const pagesConfig = fs.readFileSync("wrangler.toml", "utf8");
const redirects = fs.readFileSync("public/_redirects", "utf8");
const muralSource = fs.readFileSync("infra/cloudflare/src/service/internals/mural.js", "utf8");
const workerConfig = fs.readFileSync("infra/cloudflare/wrangler.toml", "utf8");
const routerSource = fs.readFileSync("infra/cloudflare/src/core/router.js", "utf8");

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

function excludes(source, text, label) {
	assert.equal(source.includes(text), false, `Expected ${label} not to include: ${text}`);
}

includes(pagesConfig, 'pages_build_output_dir = "public"', "root Pages Wrangler config");
includes(pagesConfig, "[vars]", "root Pages Wrangler config");
includes(pagesConfig, 'NODE_VERSION = "20"', "root Pages Wrangler config");

includes(redirects, "/assets/fonts/*", "Pages redirects");
includes(redirects, "/assets/images/govuk-crest.svg", "Pages redirects");
includes(redirects, "/reporting/* https://reopsreporting.pages.dev/:splat", "Pages redirects");
excludes(redirects, "/api/*", "Pages redirects");
excludes(redirects, "https://rops-api.digikev-kevin-rapley.workers.dev/api/:splat", "Pages redirects");

includes(workerConfig, 'MURAL_REDIRECT_URI = "https://rops-api.digikev-kevin-rapley.workers.dev/api/mural/callback"', "Worker Mural OAuth config");
includes(workerConfig, 'PAGES_ORIGIN       = "https://researchops.pages.dev"', "Worker Mural OAuth config");

includes(routerSource, 'if (url.pathname === "/api/mural/auth" && request.method === "GET") return service.mural.muralAuth(origin, url);', "Worker router");
includes(routerSource, 'if (url.pathname === "/api/mural/callback" && request.method === "GET") return service.mural.muralCallback(origin, url);', "Worker router");

includes(muralSource, 'const ret = url.searchParams.get("return") || "";', "Mural auth route");
includes(muralSource, 'if (ret && new URL(ret).origin === new URL(origin).origin) safeReturn = ret;', "Mural auth route");
includes(muralSource, 'if (ret.startsWith("/")) safeReturn = ret;', "Mural auth route");
includes(muralSource, 'const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn, dbg }));', "Mural auth route");
includes(muralSource, 'const pagesOrigin = env.PAGES_ORIGIN || "https://researchops.pages.dev";', "Mural callback route");
includes(muralSource, 'backUrl = new URL(want, pagesOrigin);', "Mural callback route");
includes(muralSource, "return Response.redirect(finalUrl, 302);", "Mural callback route");

excludes(muralSource, "backUrl = new URL(want, url);", "Mural callback route");
excludes(muralSource, 'new URL("/pages/projects/", url)', "Mural callback route");
