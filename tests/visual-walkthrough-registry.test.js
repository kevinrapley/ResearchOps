import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';

function listHtmlFiles(dir) {
	if (!fs.existsSync(dir)) return [];

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...listHtmlFiles(entryPath));
			continue;
		}

		if (entry.isFile() && entry.name.endsWith('.html')) {
			files.push(entryPath);
		}
	}

	return files.sort();
}

function routeFromPublicFile(filePath) {
	const relativePath = path
		.relative(visualWalkthroughConfig.publicRoot, filePath)
		.replaceAll(path.sep, '/');

	if (relativePath === 'index.html') return '/';

	return `/${relativePath}`;
}

const discoveredRoutes = listHtmlFiles(visualWalkthroughConfig.publicRoot)
	.map(routeFromPublicFile)
	.filter((route) => !visualWalkthroughConfig.excludedRoutes.includes(route));

const registeredRoutes = visualWalkthroughConfig.pages.map((page) => page.path);
const registeredIds = visualWalkthroughConfig.pages.map((page) => page.id);

for (const route of discoveredRoutes) {
	assert.ok(
		registeredRoutes.includes(route),
		`Expected visual walkthrough registry to include public route: ${route}`
	);
}

for (const page of visualWalkthroughConfig.pages) {
	assert.equal(
		page.path.startsWith('/'),
		true,
		`Expected registered path to start with /: ${page.path}`
	);
	assert.equal(
		Boolean(page.title),
		true,
		`Expected registered page to have a title: ${page.id}`
	);
	assert.equal(
		Boolean(page.group),
		true,
		`Expected registered page to have a group: ${page.id}`
	);
}

assert.equal(
	new Set(registeredIds).size,
	registeredIds.length,
	'Expected registered page ids to be unique'
);
