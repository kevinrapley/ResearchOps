// cucumber.mjs
/* eslint-env node */

/** Normalize a base URL and ensure a trailing slash. */
function normalizeBase(url) {
	if (!url) return null;
	const s = String(url).trim();
	return s.endsWith('/') ? s : `${s}/`;
}

const fromEnv =
	process.env.BASE_URL || process.env.PAGES_URL || process.env.PREVIEW_URL;

const normalized = normalizeBase(fromEnv);
const isCI = !!process.env.CI;

if (isCI && !normalized) {
	// Don’t silently use localhost in CI — make the failure obvious.
	throw new Error(
		'BASE_URL not set (nor PAGES_URL / PREVIEW_URL). Set BASE_URL in your workflow env.'
	);
}

// For local dev, fall back to your dev server; in CI we already enforced presence.
const BASE = normalized || 'http://localhost:8788/';

console.log(`[QA] Using BASE_URL: ${BASE}`);

/** @type {import('@cucumber/cucumber').IConfiguration} */
export default {
	default: {
		requireModule: [],
		import: ['features/steps/**/*.js', 'features/support/**/*.js'],
		format: ['progress', ['html:reports/cucumber-report.html']],
		publishQuiet: true,
		paths: ['features/**/*.feature'],
		worldParameters: {
			baseURL: BASE
		},
		parallel: 2,
		strict: true,
		failFast: false,
		dryRun: false
	}
};
