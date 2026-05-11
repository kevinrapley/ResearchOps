/**
 * @file validate-reports-site.mjs
 * @module ValidateReportsSite
 * @summary Validates the committed visual walkthrough reporting site artefacts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
	throw new Error(`reports-site: ${message}`);
}

function assertFile(filePath, label = filePath) {
	if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
		fail(`missing required file: ${label}`);
	}
}

function readJson(filePath, rootDir) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		fail(`invalid JSON in ${path.relative(rootDir, filePath)}: ${error.message}`);
	}
}

function isFailedStatus(status) {
	return Boolean(status && status !== "captured");
}

function countFailures(manifest) {
	if (Array.isArray(manifest.failures)) {
		return manifest.failures.length;
	}

	let failures = 0;

	for (const page of manifest.pages ?? []) {
		for (const state of page.states ?? []) {
			const failedCaptures = (state.captures ?? []).filter((capture) => isFailedStatus(capture.status));

			if (failedCaptures.length > 0) {
				failures += failedCaptures.length;
				continue;
			}

			if (isFailedStatus(state.status)) {
				failures += 1;
			}
		}
	}

	return failures;
}

function collectCaptures(manifest) {
	return (manifest.pages ?? []).flatMap((page) =>
		(page.states ?? []).flatMap((state) =>
			(state.captures ?? []).map((capture) => ({ page, state, capture })),
		),
	);
}

function collectFiles(directoryPath, rootPath = directoryPath) {
	if (!fs.existsSync(directoryPath)) {
		fail(`missing required directory: ${path.relative(ROOT_DIR, directoryPath)}`);
	}

	return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			return collectFiles(entryPath, rootPath);
		}

		if (!entry.isFile()) {
			return [];
		}

		return path.relative(rootPath, entryPath).replaceAll(path.sep, "/");
	});
}

function validateReportsSite({ rootDir = ROOT_DIR } = {}) {
	const reportsDir = path.join(rootDir, "reports-site");
	const manifestPath = path.join(reportsDir, "manifest.json");
	const indexPath = path.join(reportsDir, "index.html");

	assertFile(indexPath, "reports-site/index.html");
	assertFile(manifestPath, "reports-site/manifest.json");

	const indexHtml = fs.readFileSync(indexPath, "utf8");
	const manifest = readJson(manifestPath, rootDir);

	if (!indexHtml.includes("ResearchOps application visual walkthrough")) {
		fail("index.html does not contain the reporting site title");
	}

	if (!indexHtml.includes("screenshots/")) {
		fail("index.html does not contain screenshot references");
	}

	if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) {
		fail("manifest.pages must contain at least one page");
	}

	if (!Array.isArray(manifest.profiles) || manifest.profiles.length === 0) {
		fail("manifest.profiles must contain at least one profile");
	}

	const pages = manifest.pages;
	const states = pages.flatMap((page) => page.states ?? []);
	const captures = collectCaptures(manifest);

	if (manifest.pageCount !== pages.length) {
		fail(`pageCount mismatch: expected ${pages.length}, got ${manifest.pageCount}`);
	}

	if (manifest.stateCount !== states.length) {
		fail(`stateCount mismatch: expected ${states.length}, got ${manifest.stateCount}`);
	}

	if (manifest.captureCount !== captures.length) {
		fail(`captureCount mismatch: expected ${captures.length}, got ${manifest.captureCount}`);
	}

	const failureCount = countFailures(manifest);

	if (manifest.failureCount !== failureCount) {
		fail(`failureCount mismatch: expected ${failureCount}, got ${manifest.failureCount}`);
	}

	const profileIds = new Set(manifest.profiles.map((profile) => profile.id));
	const profileCaptureCounts = new Map([...profileIds].map((profileId) => [profileId, 0]));
	const screenshotPaths = new Set();

	for (const { page, state, capture } of captures) {
		if (!capture.profile || !profileIds.has(capture.profile)) {
			fail(`capture has unknown profile for page ${page.id}, state ${state.id}`);
		}

		profileCaptureCounts.set(capture.profile, (profileCaptureCounts.get(capture.profile) ?? 0) + 1);

		if (!capture.screenshot) {
			if (isFailedStatus(capture.status)) {
				continue;
			}

			fail(`capture is missing screenshot for page ${page.id}, state ${state.id}, profile ${capture.profile}`);
		}

		if (path.isAbsolute(capture.screenshot) || capture.screenshot.includes("..")) {
			fail(`unsafe screenshot path: ${capture.screenshot}`);
		}

		const screenshotPath = path.join(reportsDir, capture.screenshot);
		assertFile(screenshotPath, capture.screenshot);

		if (!indexHtml.includes(capture.screenshot)) {
			fail(`index.html does not reference screenshot from manifest: ${capture.screenshot}`);
		}

		screenshotPaths.add(capture.screenshot);
	}

	for (const profileId of profileIds) {
		const count = profileCaptureCounts.get(profileId) ?? 0;

		if (manifest.failureCount === 0 && count !== states.length) {
			fail(`profile ${profileId} has ${count} captures for ${states.length} states`);
		}
	}

	const screenshotFiles = collectFiles(path.join(reportsDir, "screenshots"), reportsDir);

	for (const screenshotFile of screenshotFiles) {
		if (!screenshotPaths.has(screenshotFile)) {
			fail(`screenshot file is not referenced by manifest captures: ${screenshotFile}`);
		}
	}

	return {
		captures: captures.length,
		pages: pages.length,
		profiles: [...profileIds],
		screenshots: screenshotPaths.size,
		states: states.length,
	};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const result = validateReportsSite();
	console.log(
		`reports-site: validated ${result.pages} pages, ${result.states} states, ${result.captures} captures`,
	);
}

export { validateReportsSite };
