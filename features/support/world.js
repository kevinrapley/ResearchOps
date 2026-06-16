// features/support/world.js
import { setWorldConstructor } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	registerLocalAssetRoutes,
	registerMockRoutes,
	walkthroughMockRoutes,
} from '../../scripts/walkthrough-playwright.mjs';

const SCREENSHOTS_DIR = join('reports-site', 'screenshots');

function slugify(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function pad(num) {
	return String(num).padStart(3, '0');
}

export class World {
	/** @type {import('playwright').Browser | undefined} */
	browser;

	/** @type {import('playwright').BrowserContext | undefined} */
	context;

	/** @type {import('playwright').Page | undefined} */
	page;

	/** @type {string} */
	baseURL;

	/** @type {boolean} */
	captureScreenshots;

	constructor({ parameters }) {
		this.baseURL = parameters?.baseURL || 'http://localhost:8788/';
		this.captureScreenshots = Boolean(parameters?.captureScreenshots);
	}

	url(pathname) {
		return new URL(pathname, this.baseURL).toString();
	}

	async createPage() {
		const { chromium } = await import('playwright');

		if (!this.browser) {
			this.browser = await chromium.launch({
				headless: true,
			});
		}

		this.context = await this.browser.newContext({
			ignoreHTTPSErrors: true,
			viewport: {
				width: 1440,
				height: 1200,
			},
			reducedMotion: 'reduce',
		});

		this.page = await this.context.newPage();

		return this.page;
	}

	async registerWalkthroughRoutes({ authenticated = true, extraRoutes = [] } = {}) {
		if (!this.page) return;
		await registerLocalAssetRoutes(this.page, { baseURL: this.baseURL, publicRoot: 'public' });
		await registerMockRoutes(this.page, walkthroughMockRoutes({ authenticated, extraRoutes }));
	}

	async captureEvidenceScreenshot(label) {
		if (!this.captureScreenshots || !this.page || !this.scenario) return;

		this.stepIndex = (this.stepIndex || 0) + 1;
		const shotFile = `${this.scenario.slug}__${pad(this.stepIndex)}--${slugify(label)}.png`;
		const shotPath = join(SCREENSHOTS_DIR, shotFile);
		mkdirSync(SCREENSHOTS_DIR, { recursive: true });
		await this.settlePageForEvidence();
		await this.page.screenshot({
			path: shotPath,
			fullPage: true,
			animations: 'disabled',
		});
		this.scenario.steps.push({
			idx: this.stepIndex,
			text: label,
			shotRel: `screenshots/${shotFile}`,
			status: 'captured',
		});
	}

	async settlePageForEvidence() {
		if (!this.page) return;

		await this.page.waitForLoadState('domcontentloaded');

		try {
			await this.page.waitForLoadState('networkidle', { timeout: 3000 });
		} catch {
			// Some pages keep connections open. Screenshot capture should not hang.
		}

		await this.page.locator('body').waitFor({
			state: 'visible',
			timeout: 3000,
		});

		await this.page.evaluate(async () => {
			if (document.fonts?.ready) {
				await document.fonts.ready;
			}
		});

		await this.page.waitForTimeout(150);
	}

	async dispose() {
		if (this.page && !this.page.isClosed()) {
			await this.page.close();
		}

		if (this.context) {
			await this.context.close();
		}

		this.page = undefined;
		this.context = undefined;
	}

	async destroy() {
		await this.dispose();

		if (this.browser) {
			await this.browser.close();
		}

		this.browser = undefined;
	}

	expectTruthy(val, msg) {
		assert.ok(val, msg);
	}
}

setWorldConstructor(World);
