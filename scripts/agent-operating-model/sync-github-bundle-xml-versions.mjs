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

function normaliseXmlDeclaration(xml) {
	if (!xml.startsWith('<?xml ')) {
		return xml;
	}

	const declarationEnd = xml.indexOf('?>');
	if (declarationEnd === -1) {
		return xml;
	}

	const declaration = xml.slice(0, declarationEnd + 2);
	const nextDeclaration = declaration.replace(/version=(['"])[^'"]+\1/, 'version="1.0"');
	return `${nextDeclaration}${xml.slice(declarationEnd + 2)}`;
}

function rootBounds(xml, relativePath) {
	const declarationEnd = xml.indexOf('?>');
	const searchFrom = declarationEnd === -1 ? 0 : declarationEnd + 2;
	const rootStart = xml.indexOf('<', searchFrom);

	if (rootStart === -1) {
		throw new Error(`Could not find XML root in ${relativePath}`);
	}

	let quote = '';
	for (let index = rootStart + 1; index < xml.length; index += 1) {
		const character = xml[index];

		if (quote) {
			if (character === quote) quote = '';
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}

		if (character === '>') {
			return { start: rootStart, end: index + 1 };
		}
	}

	throw new Error(`Could not find XML root closing bracket in ${relativePath}`);
}

function rootName(root) {
	const match = root.match(/^<\s*([^\s/>]+)/);
	return match ? match[1] : '';
}

function syncRootVersion(root, version, relativePath) {
	const name = rootName(root);
	if (!name) {
		throw new Error(`Could not parse XML root name in ${relativePath}`);
	}

	let seen = false;
	let nextRoot = root.replace(/\s+version=(['"])[^'"]*\1/g, (attribute) => {
		if (seen) return '';
		seen = true;
		const quote = attribute.includes("'") ? "'" : '"';
		return ` version=${quote}${version}${quote}`;
	});

	if (!seen) {
		nextRoot = nextRoot.replace(new RegExp(`^<\\s*${name}`), `<${name} version="${version}"`);
	}

	return nextRoot;
}

function replaceRootVersion(xml, version, relativePath) {
	const declarationSafeXml = normaliseXmlDeclaration(xml);
	const bounds = rootBounds(declarationSafeXml, relativePath);
	const root = declarationSafeXml.slice(bounds.start, bounds.end);
	const nextRoot = syncRootVersion(root, version, relativePath);

	if (root === nextRoot && xml === declarationSafeXml) {
		return xml;
	}

	return `${declarationSafeXml.slice(0, bounds.start)}${nextRoot}${declarationSafeXml.slice(bounds.end)}`;
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
