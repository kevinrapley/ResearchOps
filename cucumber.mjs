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

if (isCI && !normalized) {
	throw new Error(
		'BASE_URL not set. Set BASE_URL, PAGES_URL or PREVIEW_URL in the workflow environment.'
	);
}

const BASE = normalized || 'http://localhost:8788/';

console.log(`[QA] Using BASE_URL: ${BASE}`);

const common = {
	requireModule: [],
	import: ['features/steps/**/*.js', 'features/support/**/*.js'],
	paths: ['features/**/*.feature'],
	publishQuiet: true,
	strict: true,
	failFast: false,
	dryRun: false,
	worldParameters: {
		baseURL: BASE,
		captureScreenshots: false,
	},
};

/** @type {import('@cucumber/cucumber').IConfiguration} */
export default {
	default: {
		...common,
		format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
		parallel: 0,
	},
	ci: {
		...common,
		format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
		parallel: 0,
	},
	walkthrough: {
		...common,
		format: ['progress', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
		parallel: 0,
		worldParameters: {
			baseURL: BASE,
			captureScreenshots: true,
		},
	},
};
