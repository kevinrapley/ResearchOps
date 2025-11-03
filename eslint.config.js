// Flat config for ESLint v9+
//
// Scope: modern JS, Cloudflare Workers (service worker), browser UI code, and Node in build/scripts.
// Keeps vendor/minified and static assets out via .eslintignore.

import js from '@eslint/js';
import globals from 'globals';

export default [
	// Base recommended rules
	js.configs.recommended,

	// Global ignores (additional path-level ignores live in .eslintignore)
	{
		ignores: [
			'node_modules/**',
			'dist/**',
			'coverage/**',
			'.tmp/**',
			'**/*.min.js',
			'**/*.min.css',
			'**/*.min.html',
		],
	},

	// Node / build scripts (optional)
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

	// Cloudflare Worker code
	{
		files: ['infra/cloudflare/src/**/*.js', 'functions/**/*.js'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.serviceworker, // FetchEvent, caches, etc.
				// Worker bindings you reference at runtime (declare as read-only)
				ASSETS: 'readonly',
				AI: 'readonly',
				SESSION_KV: 'readonly',
			},
		},
		rules: {
			// Bindings are injected by the platform at runtime
			'no-undef': 'off',
			'no-console': 'warn',
		},
	},

	// Frontend UI modules
	{
		files: ['public/**/*.js'],
		ignores: [
			'public/lib/**', // vendor bundles
			'public/**/debug*.js', // optional: relax on debug shims
		],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.browser,
			},
		},
		rules: {
			'no-alert': 'warn',
		},
	},
];
