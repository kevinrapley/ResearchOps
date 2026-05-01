import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { visualWalkthroughConfig } from '../visual-walkthrough.config.mjs';
import { synthesisEmptyCluster, synthesisPath } from '../visual-walkthrough.synthesis-fixtures.mjs';
import {
	synthesisDefaultState,
	synthesisVisualStates,
} from '../visual-walkthrough.synthesis-states.mjs';

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

function stateById(stateId) {
	return synthesisVisualStates.find((state) => state.id === stateId);
}

function actionTextValues(stateId) {
	return (stateById(stateId)?.actions || [])
		.filter((action) => action.type === 'waitForText')
		.map((action) => action.text);
}

function actionSelectorValues(stateId) {
	return (stateById(stateId)?.actions || [])
		.filter((action) => action.type === 'waitForSelector')
		.map((action) => action.selector);
}

const discoveredRoutes = listHtmlFiles(visualWalkthroughConfig.publicRoot)
	.map(routeFromPublicFile)
	.filter((route) => !visualWalkthroughConfig.excludedRoutes.includes(route));

const registeredRoutes = visualWalkthroughConfig.pages.map((page) => page.path);
const registeredIds = visualWalkthroughConfig.pages.map((page) => page.id);
const synthesisStateIds = synthesisVisualStates.map((state) => state.id);

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
	assert.equal(Boolean(page.title), true, `Expected registered page to have a title: ${page.id}`);
	assert.equal(Boolean(page.group), true, `Expected registered page to have a group: ${page.id}`);
}

assert.equal(
	new Set(registeredIds).size,
	registeredIds.length,
	'Expected registered page ids to be unique'
);

assert.equal(
	synthesisDefaultState.id,
	'missing-sid-error',
	'Expected synthesis walkthrough to capture the missing study ID error as its default state'
);

assert.deepEqual(
	synthesisStateIds,
	[
		'empty-evidence',
		'evidence-loaded',
		'working-cluster-created',
		'evidence-added-to-cluster',
		'theme-blocked-without-evidence',
		'theme-created',
	],
	'Expected synthesis walkthrough states to cover the production first-slice workflow'
);

assert.ok(
	actionTextValues('working-cluster-created').includes(
		`Created working cluster grouping ${synthesisEmptyCluster.label}.`
	),
	'Expected cluster creation capture to wait for the production status text'
);

assert.ok(
	actionSelectorValues('theme-blocked-without-evidence').includes(
		`[data-cluster-id="${synthesisEmptyCluster.id}"]`
	),
	'Expected blocked theme capture to wait for the visible cluster card rather than a hidden option'
);

assert.ok(
	actionTextValues('theme-blocked-without-evidence').includes(
		'Add evidence to a working cluster grouping before creating a theme.'
	),
	'Expected blocked theme capture to wait for the disabled-control hint rather than selecting a disabled control'
);

for (const state of synthesisVisualStates) {
	assert.equal(
		state.path,
		synthesisPath,
		`Expected synthesis state to use the study-scoped route: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.mockRoutes) && state.mockRoutes.length >= 2,
		`Expected synthesis state to provide mocked API routes: ${state.id}`
	);
	assert.ok(
		Array.isArray(state.actions) && state.actions.length >= 1,
		`Expected synthesis state to provide capture actions: ${state.id}`
	);
}
