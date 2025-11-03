// ESLint v9 flat config
// Scopes: Cloudflare Workers, browser UI, and Node scripts.
// Notes:
// - Use top-level `ignores` instead of .eslintignore (ESLint v9).
// - Declare globals for service worker and browser to avoid no-undef.
// - Treat console and a few patterns as warnings rather than hard errors.

import js from '@eslint/js';
import globals from 'globals';

export default [
	// Base recommended rules
	js.configs.recommended,

	// Global ignores (v9 replaces .eslintignore)
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'coverage/**',
			'.tmp/**',
			'**/*.min.js',
			'**/*.min.css',
			'**/*.min.html',
			'public/lib/**',           // vendor bundles
			'docs/**',
			'config/**',
			'README.md',
			// If you want to exclude all static HTML/CSS from lint, uncomment:
			// 'public/**/*.html',
			// 'public/**/*.css',
		],
	},

	// Node / scripts
	{
		files: ['scripts/**/*.js', 'src/jobs/**/*.js'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: globals.node,
		},
		rules: {
			'no-console': 'off',
		},
	},

	// Cloudflare Worker + Functions (service worker globals)
	{
		files: ['infra/cloudflare/src/**/*.js', 'functions/**/*.js'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.serviceworker, // fetch, caches, Request, etc.
				ASSETS: 'readonly',
				AI: 'readonly',
				SESSION_KV: 'readonly',
			},
		},
		rules: {
			'no-console': 'warn',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
		},
	},

	// Browser UI (public code)
	{
		files: ['public/**/*.js'],
		// Fine-grained per-scope ignore (keeps top-level ignores too)
		ignores: ['public/**/debug*.js'], // relax on debug shims if you want
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.browser, // window, document, fetch, AbortController, etc.
			},
		},
		rules: {
			'no-alert': 'warn',
			'no-console': 'warn',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'no-useless-escape': 'warn',
			'no-case-declarations': 'warn',
		},
	},
];
