// features/support/world.js
import { setWorldConstructor } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

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
