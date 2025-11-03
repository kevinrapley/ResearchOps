// ESLint v9 flat config
// Scopes: Cloudflare Workers, browser UI, and Node scripts.
// - Uses top-level ignores (v9 replaces .eslintignore).
// - Declares both browser + serviceworker globals by default to avoid no-undef
//   in shared utilities and browser bundles.
// - Narrows rules per area to keep signal high without blocking CI on debug/vendor files.

import js from '@eslint/js';
import globals from 'globals';

export default [
	// Base recommended rules
	js.configs.recommended,

	// Global language options & globals (apply to all files)
	{
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				// Browser (window, document, fetch, AbortController, AbortSignal, localStorage, etc.)
				...globals.browser,
				// Service Worker (FetchEvent, caches, etc.) for Cloudflare Workers code paths
				...globals.serviceworker,
			},
		},
	},

	// Global ignores (v9 replaces .eslintignore)
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'coverage/**',
			'.tmp/**',

			// Vendor / minified
			'**/*.min.js',
			'**/*.min.css',
			'**/*.min.html',
			'public/lib/**',

			// Prose / static (kept out of lint for now)
			'docs/**',
			'README.md',
		],
	},

	// Node / scripts
	{
		files: ['scripts/**/*.js', 'src/jobs/**/*.js'],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			'no-console': 'off',
		},
	},

	// Cloudflare Worker + Functions
	{
		files: ['infra/cloudflare/src/**/*.js', 'functions/**/*.js'],
		rules: {
			'no-console': 'warn',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},

	// Browser UI
	{
		files: ['public/**/*.js'],
		ignores: [
			'public/**/debug*.js', // allow rough debug helpers
		],
		rules: {
			'no-alert': 'warn',
			'no-console': 'warn',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

			// In classic multi-script pages, names may be defined in other tags.
			// Avoid hard failing CI for cross-file globals; rely on runtime and tests.
			'no-undef': 'off',

			// Some regex in UI code intentionally escapes more than needed.
			'no-useless-escape': 'warn',
			'no-case-declarations': 'warn',
		},
	},
];
