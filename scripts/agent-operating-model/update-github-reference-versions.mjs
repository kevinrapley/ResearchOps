#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const DEFAULT_TARGET_VERSION = '2.9.3';

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

function bumpRootVersion(source, targetVersion) {
	const versionAttribute = /(<[A-Za-z][^>]*\sversion=")([^"]+)(")/;

	if (!versionAttribute.test(source)) {
		return {
			content: source,
			changed: false,
			reason: 'no root version attribute found'
		};
	}

	const currentVersion = source.match(versionAttribute)?.[2];

	if (currentVersion === targetVersion) {
		return {
			content: source,
			changed: false,
			reason: 'already current'
		};
	}

	return {
		content: source.replace(versionAttribute, `$1${targetVersion}$3`),
		changed: true,
		reason: `${currentVersion} -> ${targetVersion}`
	};
}

async function updateReferenceVersions(options) {
	const bundleRoot = path.resolve(process.cwd(), options.bundleRoot);
	const referencesDir = path.join(bundleRoot, 'references');
	const entries = await readdir(referencesDir, { withFileTypes: true });
	const xmlFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.xml'))
		.map((entry) => path.join(referencesDir, entry.name))
		.sort((left, right) => left.localeCompare(right));
	const changed = [];
	const unchanged = [];

	for (const filePath of xmlFiles) {
		const source = await readFile(filePath, 'utf8');
		const result = bumpRootVersion(source, options.targetVersion);
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
		console.error(`Reference version drift found in ${changed.length} file(s).`);
		process.exitCode = 1;
	}

	console.log(`Checked ${xmlFiles.length} GitHub reference file(s). ${changed.length} update(s), ${unchanged.length} already current or skipped.`);
}

try {
	await updateReferenceVersions(parseArgs(process.argv.slice(2)));
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
