#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const DEFAULT_TARGET_VERSION = '2.9.3';
const SKIPPED_DIRECTORIES = new Set(['__pycache__', '.pytest_cache', 'node_modules', 'dist', 'build', 'coverage', 'artifacts', 'tmp', 'temp', '__MACOSX']);
const SKIPPED_SUFFIXES = new Set(['.pyc', '.pyo', '.log']);

function parseArgs(argv) {
	const options = {
		bundleRoot: DEFAULT_BUNDLE_ROOT,
		targetVersion: DEFAULT_TARGET_VERSION,
		check: false
	};

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];

		if (current === '--bundle-root') {
			options.bundleRoot = argv[index + 1];
			index += 1;
		} else if (current === '--target-version') {
			options.targetVersion = argv[index + 1];
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

function isSkipped(relativePath) {
	const parts = relativePath.split('/');
	return parts.some((part) => SKIPPED_DIRECTORIES.has(part)) || SKIPPED_SUFFIXES.has(path.extname(relativePath));
}

function updateRootVersion(source, targetVersion) {
	const rootStart = source.indexOf('<');

	if (rootStart === -1) {
		return {
			content: source,
			changed: false,
			reason: 'no XML root element found'
		};
	}

	const rootEnd = source.indexOf('>', rootStart);

	if (rootEnd === -1) {
		return {
			content: source,
			changed: false,
			reason: 'no complete XML root element found'
		};
	}

	const openTag = source.slice(rootStart, rootEnd + 1);
	const versionKey = ' version="';
	const versionStart = openTag.indexOf(versionKey);

	if (versionStart === -1) {
		return {
			content: source,
			changed: false,
			reason: 'no root version attribute found'
		};
	}

	const valueStart = rootStart + versionStart + versionKey.length;
	const valueEnd = source.indexOf('"', valueStart);

	if (valueEnd === -1 || valueEnd > rootEnd) {
		return {
			content: source,
			changed: false,
			reason: 'root version attribute is malformed'
		};
	}

	const currentVersion = source.slice(valueStart, valueEnd);

	if (currentVersion === targetVersion) {
		return {
			content: source,
			changed: false,
			reason: 'already current'
		};
	}

	return {
		content: `${source.slice(0, valueStart)}${targetVersion}${source.slice(valueEnd)}`,
		changed: true,
		reason: `${currentVersion} -> ${targetVersion}`
	};
}

async function collectXmlFiles(root, current = root) {
	const entries = await readdir(current, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(current, entry.name);
		const relativePath = normalise(path.relative(root, fullPath));

		if (entry.isDirectory()) {
			if (!isSkipped(relativePath)) {
				files.push(...(await collectXmlFiles(root, fullPath)));
			}
			continue;
		}

		if (entry.isFile() && entry.name.endsWith('.xml') && !isSkipped(relativePath)) {
			files.push(fullPath);
		}
	}

	return files.sort((left, right) => left.localeCompare(right));
}

async function updateBundleXmlVersions(options) {
	const bundleRoot = path.resolve(process.cwd(), options.bundleRoot);
	const xmlFiles = await collectXmlFiles(bundleRoot);
	const changed = [];
	const unchanged = [];

	for (const filePath of xmlFiles) {
		const source = await readFile(filePath, 'utf8');
		const result = updateRootVersion(source, options.targetVersion);
		const relativePath = normalise(path.relative(process.cwd(), filePath));

		if (!result.changed) {
			unchanged.push(`${relativePath}: ${result.reason}`);
			continue;
		}

		changed.push(`${relativePath}: ${result.reason}`);

		if (!options.check) {
			await writeFile(filePath, result.content, 'utf8');
		}
	}

	for (const item of changed) {
		console.log(`updated ${item}`);
	}

	for (const item of unchanged) {
		console.log(`kept ${item}`);
	}

	if (options.check && changed.length > 0) {
		console.error(`Bundle XML version drift found in ${changed.length} file(s).`);
		process.exitCode = 1;
	}

	console.log(`Checked ${xmlFiles.length} GitHub bundle XML file(s). ${changed.length} update(s), ${unchanged.length} already current or skipped.`);
}

try {
	await updateBundleXmlVersions(parseArgs(process.argv.slice(2)));
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
