import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateReportsSite } from '../scripts/validate-reports-site.mjs';

test('committed reporting site manifest and screenshots are coherent', () => {
	const result = validateReportsSite();

	assert.equal(result.pages, 24);
	assert.equal(result.states, 41);
	assert.equal(result.captures, 82);
	assert.deepEqual(result.profiles.sort(), ['desktop', 'mobile']);
	assert.equal(result.screenshots, 82);
});

test('failed capture reports match visual walkthrough failure semantics', () => {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-site-validation-'));
	const reportsDir = path.join(rootDir, 'reports-site');
	const screenshotsDir = path.join(reportsDir, 'screenshots', 'desktop');
	const screenshotPath = path.join(screenshotsDir, 'home__default.png');
	const relativeScreenshotPath = 'screenshots/desktop/home__default.png';
	const indexHtml = [
		'<!doctype html>',
		'<title>ResearchOps application visual walkthrough</title>',
		`<img src="${relativeScreenshotPath}" />`,
	].join('');
	const manifest = {
		captureCount: 2,
		failureCount: 1,
		failures: [
			{
				message: 'HTTP 500 for test route',
				page: 'home',
				profile: 'mobile',
				state: 'default',
			},
		],
		pageCount: 1,
		pages: [
			{
				id: 'home',
				states: [
					{
						captures: [
							{
								profile: 'desktop',
								screenshot: relativeScreenshotPath,
								status: 'captured',
							},
							{
								profile: 'mobile',
								status: 'failed',
							},
						],
						id: 'default',
						status: 'failed',
					},
				],
			},
		],
		profiles: [
			{
				id: 'desktop',
			},
			{
				id: 'mobile',
			},
		],
		stateCount: 1,
	};

	fs.mkdirSync(screenshotsDir, { recursive: true });
	fs.writeFileSync(screenshotPath, 'fake screenshot bytes');
	fs.writeFileSync(path.join(reportsDir, 'index.html'), indexHtml);
	fs.writeFileSync(path.join(reportsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

	const result = validateReportsSite({ rootDir });

	assert.equal(result.pages, 1);
	assert.equal(result.states, 1);
	assert.equal(result.captures, 2);
	assert.equal(result.screenshots, 1);
});
