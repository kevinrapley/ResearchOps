#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const MANIFEST_FILE = 'registry-manifest.yaml';
const PROMPT_SPEC_FILE = 'prompt.spec.yaml';
const GENERATED_PARTS = new Set([
	'__pycache__',
	'.pytest_cache',
	'node_modules',
	'dist',
	'build',
	'coverage',
	'artifacts',
	'tmp',
	'temp',
	'__MACOSX'
]);
const GENERATED_SUFFIXES = new Set(['.pyc', '.pyo', '.log']);
const GENERATED_NAMES = new Set([
	'release-gate-report.json',
	'fast-release-gate-report.json',
	'full-release-gate-report.json',
	'live-release-gate-report.json'
]);

function parseArgs(argv) {
	const options = {
		bundleRoot: DEFAULT_BUNDLE_ROOT,
		check: false
	};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];

		if (current === '--bundle-root') {
			options.bundleRoot = argv[index + 1];
			index += 1;
		} else if (current === '--check') {
			options.check = true;
		} else {
			throw new Error(`Unknown argument: ${current}`);
		}
	}

	return options;
}

function normalise(value) {
	return value.split(path.sep).join('/');
}

function isGeneratedRelative(relativePath) {
	const parts = relativePath.split('/');
	const suffix = path.extname(relativePath);
	const name = path.basename(relativePath);

	return (
		parts.some((part) => GENERATED_PARTS.has(part)) ||
		GENERATED_SUFFIXES.has(suffix) ||
		GENERATED_NAMES.has(name)
	);
}

function yamlScalar(value) {
	if (/^[A-Za-z0-9._/+-]+$/.test(value)) {
		return value;
	}

	return JSON.stringify(value);
}

async function fileExists(filePath) {
	try {
		const info = await stat(filePath);
		return info.isFile();
	} catch {
		return false;
	}
}

async function collectManifestFiles(bundleRoot, currentDir = bundleRoot) {
	const entries = await readdir(currentDir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(currentDir, entry.name);
		const relativePath = normalise(path.relative(bundleRoot, fullPath));

		if (entry.isDirectory()) {
			if (!isGeneratedRelative(relativePath)) {
				files.push(...(await collectManifestFiles(bundleRoot, fullPath)));
			}
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		if (entry.name === MANIFEST_FILE || isGeneratedRelative(relativePath)) {
			continue;
		}

		files.push(relativePath);
	}

	return files.sort((left, right) => left.localeCompare(right));
}

function parsePromptSpecVersion(promptSpec) {
	const lines = promptSpec.split(/\r?\n/);
	let insideBundleBlock = false;

	for (const line of lines) {
		if (/^bundle:\s*$/.test(line)) {
			insideBundleBlock = true;
			continue;
		}

		if (insideBundleBlock && /^\S/.test(line)) {
			insideBundleBlock = false;
		}

		if (insideBundleBlock) {
			const match = line.match(/^\s+version:\s*['"]?([^'"\s]+)['"]?\s*$/);
			if (match) {
				return match[1];
			}
		}
	}

	throw new Error(`Could not find bundle version in ${PROMPT_SPEC_FILE}`);
}

function manifestHeader(existingManifest, version) {
	const lines = existingManifest.split(/\r?\n/);
	const artifactsIndex = lines.findIndex((line) => line.trim() === 'artifacts:');

	if (artifactsIndex === -1) {
		throw new Error(`Could not find artifacts: section in ${MANIFEST_FILE}`);
	}

	const headerLines = lines.slice(0, artifactsIndex);
	const versionIndex = headerLines.findIndex((line) => /^\s+version:\s*/.test(line));

	if (versionIndex === -1) {
		throw new Error(`Could not find bundle version header in ${MANIFEST_FILE}`);
	}

	headerLines[versionIndex] = `  version: ${version}`;

	const header = headerLines.join('\n').trimEnd();
	return header ? `${header}\n` : '';
}

async function artifactFor(bundleRoot, relativePath) {
	const filePath = path.join(bundleRoot, relativePath);
	const buffer = await readFile(filePath);
	const sha256 = createHash('sha256').update(buffer).digest('hex');

	return {
		path: relativePath,
		sha256
	};
}

function renderManifest(header, artifacts) {
	const lines = [`${header}artifacts:`];

	for (const artifact of artifacts) {
		lines.push(`- path: ${yamlScalar(artifact.path)}`);
		lines.push(`  sha256: ${artifact.sha256}`);
	}

	return `${lines.join('\n')}\n`;
}

async function updateManifest(options) {
	const bundleRoot = path.resolve(process.cwd(), options.bundleRoot);
	const manifestPath = path.join(bundleRoot, MANIFEST_FILE);
	const promptSpecPath = path.join(bundleRoot, PROMPT_SPEC_FILE);

	if (!(await fileExists(manifestPath))) {
		throw new Error(`Manifest not found: ${normalise(path.relative(process.cwd(), manifestPath))}`);
	}

	if (!(await fileExists(promptSpecPath))) {
		throw new Error(`Prompt spec not found: ${normalise(path.relative(process.cwd(), promptSpecPath))}`);
	}

	const existingManifest = await readFile(manifestPath, 'utf8');
	const promptSpec = await readFile(promptSpecPath, 'utf8');
	const version = parsePromptSpecVersion(promptSpec);
	const files = await collectManifestFiles(bundleRoot);
	const artifacts = [];

	for (const relativePath of files) {
		artifacts.push(await artifactFor(bundleRoot, relativePath));
	}

	const nextManifest = renderManifest(manifestHeader(existingManifest, version), artifacts);

	if (nextManifest === existingManifest) {
		console.log(`${MANIFEST_FILE} is already current.`);
		return false;
	}

	if (options.check) {
		console.error(`${MANIFEST_FILE} is stale. Run this script without --check to update SHA-256 checksums.`);
		process.exitCode = 1;
		return true;
	}

	await writeFile(manifestPath, nextManifest, 'utf8');
	console.log(`Updated ${normalise(path.relative(process.cwd(), manifestPath))} with ${artifacts.length} SHA-256 checksum(s).`);
	return true;
}

try {
	await updateManifest(parseArgs(process.argv.slice(2)));
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
