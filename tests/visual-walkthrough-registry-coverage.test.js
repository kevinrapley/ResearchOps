import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

function trackedHtmlFiles(dir) {
	return execFileSync(
		'git',
		['ls-files', `${dir.replace(/\/$/, '')}/**/*.html`, `${dir.replace(/\/$/, '')}/*.html`],
		{
			encoding: 'utf8',
		}
	)
		.split('\n')
		.map((file) => file.trim())
		.filter(Boolean);
}

function routeFromPublicFile(filePath) {
	const relativePath = path
		.relative(visualWalkthroughConfig.publicRoot, filePath)
		.replaceAll(path.sep, '/');

	return relativePath === 'index.html' ? '/' : `/${relativePath}`;
}

const publicRoutes = trackedHtmlFiles(visualWalkthroughConfig.publicRoot)
	.map(routeFromPublicFile)
	.sort();

const registeredRoutes = new Set(visualWalkthroughConfig.pages.map((page) => page.path));
const excludedRoutes = new Set(visualWalkthroughConfig.excludedRoutes || []);
const excludedReasons = visualWalkthroughConfig.excludedRouteReasons || {};

for (const route of excludedRoutes) {
	assert.equal(
		typeof excludedReasons[route],
		'string',
		`Expected excluded route ${route} to have a documented exclusion reason.`
	);

	assert.notEqual(
		excludedReasons[route].trim(),
		'',
		`Expected excluded route ${route} to have a non-empty exclusion reason.`
	);
}

for (const route of publicRoutes) {
	assert.equal(
		registeredRoutes.has(route) || excludedRoutes.has(route),
		true,
		`Expected discoverable route ${route} to be registered or explicitly excluded.`
	);
}

assert.equal(
	registeredRoutes.has('/pages/study/synthesis/index.html'),
	true,
	'Expected the canonical Study synthesis route to be registered.'
);

assert.equal(
	excludedRoutes.has('/pages/synthesize/index.html'),
	true,
	'Expected the legacy synthesize route to be explicitly excluded.'
);

assert.equal(
	registeredRoutes.has('/pages/synthesize/index.html'),
	false,
	'Expected the legacy synthesize route not to appear in the walkthrough registry.'
);
