/* eslint-env node */

/**
 * @file features/support/hooks.js
 * @summary Cucumber hooks for browser cleanup, screenshot capture and walkthrough generation.
 */

import { Before, After, AfterAll, AfterStep } from '@cucumber/cucumber';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Escape characters for safe HTML text output. */
function escapeHtml(str = '') {
	return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Escape characters for safe HTML attribute values. */
function escapeAttr(str = '') {
	return escapeHtml(str).replaceAll('"', '&quot;');
}

/** Ensure directory exists recursively. */
function ensureDir(dir) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/** Pad step index for filenames. */
function pad(num) {
	return String(num).padStart(3, '0');
}

/** Convert text to a filesystem-safe slug. */
function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

const startedAt = new Date().toISOString();
const REPORTS_DIR = 'reports';
const SITE_DIR = 'reports-site';
const SCREENSHOTS_DIR = join(SITE_DIR, 'screenshots');

const runManifest = {
	startedAt,
	scenarios: [],
};

Before(function (scenario) {
	const scenarioName = scenario.pickle.name;
	const featureName = scenario.gherkinDocument.feature.name;
	const scenarioSlug = `${slugify(featureName)}-${slugify(scenarioName)}`;

	this.scenario = {
		name: scenarioName,
		feature: featureName,
		slug: scenarioSlug,
		steps: [],
	};

	this.stepIndex = 0;

	if (this.captureScreenshots) {
		runManifest.scenarios.push(this.scenario);
	}
});

AfterStep(async function ({ pickleStep, result }) {
	if (!this.captureScreenshots || !this.page || !pickleStep) return;

	this.stepIndex += 1;

	const stepText = pickleStep.text;
	const idx = pad(this.stepIndex);
	const status = result?.status ?? 'unknown';

	const shotFile = `${this.scenario.slug}__${idx}--${slugify(stepText)}.png`;
	const shotPath = join(SCREENSHOTS_DIR, shotFile);

	ensureDir(SCREENSHOTS_DIR);

	try {
		await this.settlePageForEvidence();

		await this.page.screenshot({
			path: shotPath,
			fullPage: true,
			animations: 'disabled',
		});

		this.scenario.steps.push({
			idx: this.stepIndex,
			text: stepText,
			shotRel: `screenshots/${shotFile}`,
			status,
		});
	} catch (err) {
		console.error(`[QA] Failed to capture screenshot for step "${stepText}": ${err.message}`);
	}
});

After(async function () {
	await this.destroy();
});

AfterAll(function () {
	ensureDir(REPORTS_DIR);
	ensureDir(SITE_DIR);

	if (runManifest.scenarios.length === 0) {
		return;
	}

	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>BDD Walkthrough</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body {
			font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			margin: 24px;
			line-height: 1.45;
			color: #111;
			background: #fff;
		}

		header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 16px;
			flex-wrap: wrap;
		}

		.badge {
			background: #eef;
			border: 1px solid #99c;
			border-radius: 6px;
			padding: 6px 10px;
		}

		h2 {
			margin-top: 32px;
			border-bottom: 1px solid #eee;
			padding-bottom: 6px;
		}

		.step {
			border: 1px solid #eee;
			border-radius: 8px;
			margin: 12px 0;
			overflow: hidden;
		}

		.step .meta {
			background: #fafafa;
			padding: 8px 12px;
			border-bottom: 1px solid #eee;
			font-size: 14px;
			color: #333;
		}

		.step img {
			display: block;
			width: 100%;
			max-width: 1200px;
			height: auto;
		}

		.links a {
			margin-right: 12px;
		}

		.empty {
			color: #667;
		}

		.scenario {
			margin-bottom: 36px;
		}
	</style>
</head>
<body>
	<header>
		<h1>BDD Visual Walkthrough</h1>
		<div class="links">
			<a class="badge" href="./cucumber-report.html">Open Cucumber HTML report</a>
		</div>
	</header>
	<p class="badge">Run started: ${escapeHtml(runManifest.startedAt)}</p>
	${
		runManifest.scenarios.length === 0
			? '<p class="empty">No scenarios captured.</p>'
			: runManifest.scenarios
					.map(
						(s) => `
	<section class="scenario" id="${escapeAttr(s.slug)}">
		<h2>${escapeHtml(s.feature)} — ${escapeHtml(s.name)}</h2>
		${s.steps
			.map(
				(st) => `
		<div class="step">
			<div class="meta">Step ${st.idx}: ${escapeHtml(st.text)} — ${escapeHtml(st.status)}</div>
			<img loading="lazy" src="${escapeAttr(st.shotRel)}" alt="Step ${st.idx}: ${escapeAttr(st.text)}" />
		</div>`
			)
			.join('')}
	</section>`
					)
					.join('\n')
	}
</body>
</html>`;

	writeFileSync(join(SITE_DIR, 'index.html'), html);
	console.log('[QA] ✅ BDD Visual Walkthrough generated');
});
