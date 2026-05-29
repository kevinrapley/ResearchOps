/**
 * @file validate-bundle-version-consistency.mjs
 * @module ValidateBundleVersionConsistency
 * @summary Checks that bundle files which declare the current bundle version stay aligned with prompt.spec.yaml.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const REGISTRY_PATH = ".agent-operating-model/bundle-registry.json";

function fail(errors) {
	for (const error of errors) {
		console.error(`agent:bundle-versions: ${error}`);
	}

	process.exit(1);
}

function readText(relativePath) {
	return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function readJson(relativePath) {
	return JSON.parse(readText(relativePath));
}

function existsFile(relativePath) {
	const fullPath = path.join(ROOT_DIR, relativePath);

	return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}

function normaliseDirectory(relativePath) {
	return relativePath.endsWith("/") ? relativePath : `${relativePath}/`;
}

function parseVersionLine(line) {
	const match = line.match(/^\s*(?:version|bundle_version):\s*["']?([^"'\s]+)["']?\s*$/);

	return match ? match[1] : null;
}

function readBundleVersion(specPath) {
	const text = readText(specPath);
	const lines = text.split(/\r?\n/);
	let insideBundleBlock = false;

	for (const line of lines) {
		if (/^bundle:\s*$/.test(line)) {
			insideBundleBlock = true;
			continue;
		}

		if (insideBundleBlock && /^\S/.test(line)) {
			insideBundleBlock = false;
		}

		if (insideBundleBlock || /^(?:version|bundle_version):/.test(line)) {
			const version = parseVersionLine(line);

			if (version) {
				return version;
			}
		}
	}

	throw new Error(`Could not read bundle version from ${specPath}`);
}

function currentReleaseSection(text) {
	const start = text.indexOf("## Current release");

	if (start === -1) {
		return "";
	}

	const rest = text.slice(start);
	const nextHeading = rest.slice("## Current release".length).search(/\n##\s+/);

	if (nextHeading === -1) {
		return rest;
	}

	return rest.slice(0, "## Current release".length + nextHeading);
}

function validateReadme(bundleId, readmePath, version, errors) {
	if (!existsFile(readmePath)) {
		return;
	}

	const text = readText(readmePath);
	const versionLine = text.match(/^Version:\s*([^\s]+)\s*$/m);

	if (versionLine && versionLine[1] !== version) {
		errors.push(`${bundleId} README Version line is ${versionLine[1]}, expected ${version}`);
	}

	const currentRelease = currentReleaseSection(text);

	if (!currentRelease) {
		return;
	}

	const currentReleaseVersion = currentRelease.match(/\bVersion\s+([0-9]+\.[0-9]+\.[0-9]+(?:[+\-][A-Za-z0-9.-]+)?)/);

	if (!currentReleaseVersion) {
		errors.push(`${bundleId} README Current release section does not declare a Version ${version} reference`);
		return;
	}

	if (currentReleaseVersion[1] !== version) {
		errors.push(
			`${bundleId} README Current release version is ${currentReleaseVersion[1]}, expected ${version}`,
		);
	}
}

function validatePromptBody(bundleId, promptBodyPath, version, errors) {
	const text = readText(promptBodyPath);
	const match = text.match(/<[^!?\s>]+\b[^>]*\sversion="([^"]+)"/);

	if (!match) {
		errors.push(`${bundleId} prompt body does not declare a root XML version attribute`);
		return;
	}

	if (match[1] !== version) {
		errors.push(`${bundleId} prompt body version is ${match[1]}, expected ${version}`);
	}
}

function validateBundle(bundle) {
	const errors = [];
	const canonicalPath = normaliseDirectory(bundle.canonicalPath);
	const specPath = path.join(canonicalPath, bundle.promptSpec || "prompt.spec.yaml");
	const promptBodyPath = path.join(canonicalPath, bundle.promptBody || "prompt.body.xml");
	const readmePath = path.join(canonicalPath, "README.md");
	const version = readBundleVersion(specPath);

	validatePromptBody(bundle.id, promptBodyPath, version, errors);
	validateReadme(bundle.id, readmePath, version, errors);

	return errors;
}

const registry = readJson(REGISTRY_PATH);
const errors = registry.bundles.flatMap((bundle) => validateBundle(bundle));

if (errors.length) {
	fail(errors);
}

console.log(`agent:bundle-versions: validated ${registry.bundles.length} bundle version contract(s)`);
