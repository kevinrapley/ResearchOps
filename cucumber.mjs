/* eslint-env node */

// cucumber.mjs

/** Normalize a base URL and ensure a trailing slash. */
function normalizeBase(url) {
	if (!url) return null;

	const s = String(url).trim();

	if (!s) return null;

	return s.endsWith('/') ? s : `${s}/`;
}

const fromEnv = process.env.BASE_URL || process.env.PAGES_URL || process.env.PREVIEW_URL;
const normalized = normalizeBase(fromEnv);
const isCI = Boolean(process.env.CI);
const captureScreenshots = process.env.BDD_CAPTURE_SCREENSHOTS === 'true';

if (isCI && !normalized) {
	throw new Error(
		'BASE_URL not set. Set BASE_URL, PAGES_URL or PREVIEW_URL in the workflow environment.'
	);
}

const BASE = normalized || 'http://localhost:8788/';

console.log(`[QA] Using BASE_URL: ${BASE}`);
console.log(`[QA] Capture screenshots: ${captureScreenshots ? 'yes' : 'no'}`);

/** @type {import('@cucumber/cucumber').IConfiguration} */
export default {
	default: {
		requireModule: [],
		import: ['features/steps/**/*.js', 'features/support/**/*.js'],
		format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
		publishQuiet: true,
		paths: ['features/**/*.feature'],
		worldParameters: {
			baseURL: BASE,
			captureScreenshots,
		},
		parallel: 0,
		strict: true,
		failFast: false,
		dryRun: false,
		timeout: 15000,
	},
};
