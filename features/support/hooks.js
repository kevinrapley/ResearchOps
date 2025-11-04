/* eslint-env node */

/**
 * @file features/support/hooks.js
 * @summary Cucumber hooks for screenshot capture and HTML walkthrough generation.
 */

import { Before, After, AfterAll } from '@cucumber/cucumber';
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

/** Timestamp for the run. */
const startedAt = new Date().toISOString();

/** Directory for screenshots and reports. */
const SCREENSHOTS_DIR = 'reports-site/screenshots';

/** Run manifest — collected data for walkthrough HTML generation. */
const runManifest = {
	startedAt,
	scenarios: [],
};

/** Ensure directory exists recursively. */
function ensureDir(dir) {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/** Pad step index for filenames (001, 002, etc.). */
function pad(num) {
	return String(num).padStart(3, '0');
}

/**
 * Record screenshots and step metadata.
 */
Before(function (scenario) {
	this.scenario = {
		name: scenario.pickle.name,
		feature: scenario.gherkinDocument.feature.name,
		slug: scenario.pickle.name.toLowerCase().replace(/\s+/g, '-'),
		steps: [],
	};
	this.stepIndex = 0;
	runManifest.scenarios.push(this.scenario);
});

After(async function (scenario) {
	if (this.page) {
		await this.page.close();
	}
});

/**
 * Capture screenshot after each step for visual walkthrough.
 */
After(async function ({ pickleStep, result }) {
	if (!this.page || !pickleStep) return;

	this.stepIndex += 1;
	const stepText = pickleStep.text;
	const idx = pad(this.stepIndex);

	const scenarioSlug = this.scenario.slug;
	const shotFile = `${scenarioSlug}__${idx}--${stepText
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')}.png`;

	const shotPath = join(SCREENSHOTS_DIR, shotFile);
	ensureDir(SCREENSHOTS_DIR);

	try {
		await this.page.screenshot({ path: shotPath, fullPage: true });
		this.scenario.steps.push({
			idx: this.stepIndex,
			text: stepText,
			shotRel: `screenshots/${shotFile}`,
			status: result?.status ?? 'unknown',
		});
	} catch (err) {
		console.error(`[QA] Failed to capture screenshot: ${err.message}`);
	}
});

/**
 * Generate the walkthrough HTML at the end of the run.
 */
AfterAll(function () {
	ensureDir('reports-site');

	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<title>BDD Walkthrough</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		body {
			font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
			margin: 24px;
			line-height: 1.45;
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
			color: #889;
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
			<div class="meta">Step ${st.idx}: ${escapeHtml(st.text)}</div>
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

	writeFileSync(join('reports-site', 'index.html'), html);
	console.log('[QA] ✅ BDD Visual Walkthrough generated');
});
