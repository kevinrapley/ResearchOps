/** @type {import('@cucumber/cucumber').IConfiguration} */
export default {
	default: {
		requireModule: [],
		import: ['features/steps/**/*.js', 'features/support/**/*.js'],
		format: ['progress', 'html:reports/cucumber-report.html'],
		publishQuiet: true,
		paths: ['features/**/*.feature'],
		worldParameters: {
			baseURL:
				process.env.BASE_URL ||
				process.env.PAGES_URL ||
				process.env.PREVIEW_URL ||
				'http://localhost:8788',
		},
		parallel: 2,
		strict: true,
		failFast: false,
		dryRun: false,
	},
};
