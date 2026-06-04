#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BUNDLE_ROOT = '.agent-operating-model/bundles/github';
const MANIFEST_FILE = 'registry-manifest.yaml';
const MODULE_DIRECTORIES = ['roles', 'references', 'modes', 'graders'];

function parseArgs(argv) {
	const options = { bundleRoot: DEFAULT_BUNDLE_ROOT, check: false };

	for (let index = 0; index < argv.length; index += 1) {
		const value = argv[index];
		if (value === '--bundle-root') {
			options.bundleRoot = argv[index + 1];
			index += 1;
		} else if (value === '--check') {
			options.check = true;
		} else {
			throw new Error(`Unknown argument: ${value}`);
		}
	}

	return options;
}

function normalise(filePath) {
	return filePath.split(path.sep).join('/');
}

function manifestVersion(manifest) {
	const lines = manifest.split('\n');
	let inBundle = false;

	for (const line of lines) {
		if (line.trim() === 'bundle:') {
			inBundle = true;
			continue;
		}

		if (inBundle && line.trim() === 'artifacts:') {
			break;
		}

		if (inBundle && line.trim().startsWith('version:')) {
			return line.split(':').slice(1).join(':').trim().replaceAll('"', '').replaceAll("'", '');
		}
	}

	throw new Error(`Could not find bundle.version in ${MANIFEST_FILE}`);
}

async function xmlFiles(bundleRoot) {
	const files = [];

	for (const directory of MODULE_DIRECTORIES) {
		const absoluteDirectory = path.join(bundleRoot, directory);
		const entries = await readdir(absoluteDirectory, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith('.xml')) {
				files.push(path.join(absoluteDirectory, entry.name));
			}
		}
	}

	return files.sort((left, right) => left.localeCompare(right));
}

function replaceRootVersion(xml, version, relativePath) {
	const xmlEnd = xml.indexOf('?>');
	const searchFrom = xmlEnd === -1 ? 0 : xmlEnd + 2;
	const rootStart = xml.indexOf('<', searchFrom);
	const rootEnd = xml.indexOf('>', rootStart);

	if (rootStart === -1 || rootEnd === -1) {
		throw new Error(`Could not find XML root in ${relativePath}`);
	}

	const root = xml.slice(rootStart, rootEnd + 1);
	const marker = ' version=';
	const versionIndex = root.indexOf(marker);

	if (versionIndex === -1) {
		throw new Error(`Could not find root version attribute in ${relativePath}`);
	}

	const quoteIndex = versionIndex + marker.length;
	const quote = root[quoteIndex];
	const valueStart = quoteIndex + 1;
	const valueEnd = root.indexOf(quote, valueStart);

	if ((quote !== '"' && quote !== "'") || valueEnd === -1) {
		throw new Error(`Could not parse root version attribute in ${relativePath}`);
	}

	const currentVersion = root.slice(valueStart, valueEnd);
	if (currentVersion === version) {
		return xml;
	}

	const nextRoot = `${root.slice(0, valueStart)}${version}${root.slice(valueEnd)}`;
	return `${xml.slice(0, rootStart)}${nextRoot}${xml.slice(rootEnd + 1)}`;
}

export async function syncGitHubBundleXmlVersions(options = {}) {
	const bundleRoot = path.resolve(process.cwd(), options.bundleRoot || DEFAULT_BUNDLE_ROOT);
	const manifest = await readFile(path.join(bundleRoot, MANIFEST_FILE), 'utf8');
	const version = manifestVersion(manifest);
	const files = await xmlFiles(bundleRoot);
	const changed = [];

	for (const filePath of files) {
		const relativePath = normalise(path.relative(process.cwd(), filePath));
		const current = await readFile(filePath, 'utf8');
		const next = replaceRootVersion(current, version, relativePath);

		if (next !== current) {
			changed.push(relativePath);
			if (!options.check) {
				await writeFile(filePath, next, 'utf8');
			}
		}
	}

	if (changed.length && options.check) {
		for (const relativePath of changed) {
			console.error(`agent:bundle-xml-versions: ${relativePath} does not match ${MANIFEST_FILE} version ${version}`);
		}
		process.exitCode = 1;
	}

	console.log(`agent:bundle-xml-versions: ${changed.length ? changed.length : 'no'} XML module version change(s) for ${version}`);
	return { version, changed };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
	syncGitHubBundleXmlVersions(parseArgs(process.argv.slice(2))).catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
