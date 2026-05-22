#!/usr/bin/env node

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const DOCS_ROOT = 'docs/agent-operating-model/bundles/github';
const PUBLIC_URL = 'https://agents.research-operations.com/bundles/github';

async function fileExists(filePath) {
	return Boolean((await stat(filePath).catch(() => null))?.isFile());
}

async function readRequired(filePath) {
	if (!(await fileExists(filePath))) {
		throw new Error(`Missing required file: ${filePath}`);
	}

	return readFile(filePath, 'utf8');
}

function readBundleVersion(promptSpec) {
	const match = promptSpec.match(/^\s*version:\s*['"]?([^'"\n]+)['"]?\s*$/m);

	if (!match) {
		throw new Error('Could not read GitHub bundle version from prompt.spec.yaml');
	}

	return match[1].trim();
}

function updateOverviewVersion(html, version) {
	if (html.includes('<strong>Version</strong>')) {
		return html.replace(/(<strong>Version<\/strong>)([^<]*)/, `$1${version}`);
	}

	return html;
}

function updateMetadataJson(source, version) {
	const metadata = JSON.parse(source);
	const now = new Date().toISOString().slice(0, 10);

	metadata.generatedAt = now;
	metadata.repository = metadata.repository || 'kevinrapley/ResearchOps';
	metadata.branch = metadata.branch || 'main';
	metadata.outputPath = metadata.outputPath || `${DOCS_ROOT}/`;
	metadata.canonicalSourcePath = `${BUNDLE_ROOT}/`;
	metadata.publicUrl = PUBLIC_URL;
	metadata.bundle = {
		...(metadata.bundle || {}),
		id: 'github-diamond-standard',
		version
	};

	if (Array.isArray(metadata.pages) && !metadata.pages.includes('source/examples/index.html')) {
		metadata.pages.push('source/examples/index.html');
	}

	return `${JSON.stringify(metadata, null, 2)}\n`;
}

async function main() {
	const promptSpec = await readRequired(path.join(BUNDLE_ROOT, 'prompt.spec.yaml'));
	const version = readBundleVersion(promptSpec);
	const overviewPath = path.join(DOCS_ROOT, 'index.html');
	const generatedMetadataPath = path.join(DOCS_ROOT, 'generated-metadata.json');
	const sourceMetadataPath = path.join(DOCS_ROOT, 'source', 'source-metadata.json');

	if (await fileExists(overviewPath)) {
		const overviewBefore = await readRequired(overviewPath);
		const overviewAfter = updateOverviewVersion(overviewBefore, version);
		if (overviewAfter !== overviewBefore) {
			await writeFile(overviewPath, overviewAfter, 'utf8');
		}
	}

	if (await fileExists(generatedMetadataPath)) {
		const metadataBefore = await readRequired(generatedMetadataPath);
		const metadataAfter = updateMetadataJson(metadataBefore, version);
		if (metadataAfter !== metadataBefore) {
			await writeFile(generatedMetadataPath, metadataAfter, 'utf8');
		}
	}

	if (await fileExists(sourceMetadataPath)) {
		const sourceMetadataBefore = await readRequired(sourceMetadataPath);
		const sourceMetadata = JSON.parse(sourceMetadataBefore);
		sourceMetadata.bundleVersion = version;
		if (Array.isArray(sourceMetadata.pages) && !sourceMetadata.pages.includes('source/examples/index.html')) {
			sourceMetadata.pages.push('source/examples/index.html');
		}
		const sourceMetadataAfter = `${JSON.stringify(sourceMetadata, null, 2)}\n`;
		if (sourceMetadataAfter !== sourceMetadataBefore) {
			await writeFile(sourceMetadataPath, sourceMetadataAfter, 'utf8');
		}
	}

	console.log(`Synced GitHub generated documentation metadata to version ${version}.`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
