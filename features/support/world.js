// features/support/world.js
import { setWorldConstructor } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

export class World {
	/** @type {import('playwright').Browser} */ browser;
	/** @type {import('playwright').BrowserContext} */ context;
	/** @type {import('playwright').Page} */ page;
	/** @type {string} */ baseURL;

	constructor({ parameters }) {
		this.baseURL = parameters?.baseURL || 'http://localhost:8788/';
	}

	url(pathname) {
		return new URL(pathname, this.baseURL).toString();
	}

	async createPage() {
		const { chromium } = await import('playwright');
		if (!this.browser) this.browser = await chromium.launch();
		this.context = await this.browser.newContext({ ignoreHTTPSErrors: true });
		this.page = await this.context.newPage();
		return this.page;
	}

	async dispose() {
		if (this.context) await this.context.close();
		this.context = undefined;
		this.page = undefined;
	}

	async destroy() {
		await this.dispose();
		if (this.browser) await this.browser.close();
		this.browser = undefined;
	}

	expectTruthy(val, msg) {
		assert.ok(val, msg);
	}
}

setWorldConstructor(World);
