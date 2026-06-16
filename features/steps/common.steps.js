// features/steps/common.steps.js
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { visualWalkthroughConfig } from '../../visual-walkthrough.config.mjs';
import { pageCaptureConfig, runAction } from '../../scripts/visual-walkthrough.mjs';
import { SIGN_IN_EMAIL } from '../../scripts/walkthrough-playwright.mjs';

Given('the site base URL', async function () {
	this.baseURL =
		process.env.BASE_URL ||
		process.env.PAGES_URL ||
		process.env.PREVIEW_URL ||
		this.baseURL ||
		'http://localhost:8788';

	console.log(`[QA] Using BASE_URL: ${this.baseURL}`);
	if (!this.page) await this.createPage();
});

When('I visit {string}', async function (path) {
	const url = this.url(path);
	const resp = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
	this.expectTruthy(resp, `no response for ${url}`);
	expect(resp.ok(), `HTTP not OK for ${url}: ${resp && resp.status()}`).toBeTruthy();
});

// Generic text check — pick the first match to satisfy strict mode
Then('the page should contain {string} within 5s', async function (text) {
	await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 5000 });
});

Then('the page should have a heading containing {string}', async function (text) {
	await expect(this.page.getByRole('heading', { name: new RegExp(text, 'i') })).toBeVisible({
		timeout: 5000,
	});
});

Then('the page should have a <title> containing {string}', async function (text) {
	await expect(this.page).toHaveTitle(new RegExp(text, 'i'));
});

Then('I should see an element {string}', async function (selector) {
	await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
});

Given('the QA walkthrough uses deterministic application state', async function () {
	if (!this.page) await this.createPage();
	await this.registerWalkthroughRoutes({ authenticated: true });
});

When('I request a ResearchOps sign-in code for the QA walkthrough user', async function () {
	if (!this.page) await this.createPage();
	await this.registerWalkthroughRoutes({ authenticated: false });
	const response = await this.page.goto(this.url('/pages/account/sign-in/index.html'), {
		waitUntil: 'domcontentloaded',
	});
	this.expectTruthy(response, 'no response for sign-in page');
	expect(
		response.ok(),
		`HTTP not OK for sign-in page: ${response && response.status()}`
	).toBeTruthy();
	await this.settlePageForEvidence();
	await this.page.locator('#sign-in-email').fill(SIGN_IN_EMAIL);
	await this.page.locator('#email-code-start-form button[type="submit"]').click();
	await expect(this.page.locator('#email-code-verify-form')).toBeVisible({ timeout: 5000 });
	await this.captureEvidenceScreenshot('Sign-in code requested for QA walkthrough user');
});

Then('the sign-in page should ask for the 6 digit code', async function () {
	await expect(this.page.locator('#sign-in-code')).toBeVisible({ timeout: 5000 });
	await expect(
		this.page.getByText(`We sent a 6 digit code to ${SIGN_IN_EMAIL}`, { exact: false })
	).toBeVisible({
		timeout: 5000,
	});
});

When('I capture every registered ResearchOps page with authenticated QA state', async function () {
	this.walkthroughCapturedStates = 0;

	for (const rawPageConfig of visualWalkthroughConfig.pages) {
		const pageConfig = pageCaptureConfig(rawPageConfig);
		const defaultState = pageConfig.defaultState || {
			id: 'default',
			title: 'Default state',
			description: 'Initial loaded page state.',
		};
		const states = [defaultState, ...(pageConfig.states || [])];

		for (const stateConfig of states) {
			await this.dispose();
			await this.createPage();
			await this.registerWalkthroughRoutes({
				authenticated: pageConfig.authenticated !== false,
				extraRoutes: stateConfig.mockRoutes || [],
			});

			const statePath = stateConfig.path || pageConfig.path;
			const url = this.url(statePath);
			const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
			this.expectTruthy(response, `no response for ${url}`);
			expect(
				response.ok(),
				`HTTP not OK for ${url}: ${response && response.status()}`
			).toBeTruthy();
			await this.settlePageForEvidence();

			for (const action of stateConfig.actions || []) {
				await runAction(this.page, action);
				await this.settlePageForEvidence();
			}

			await this.captureEvidenceScreenshot(`${pageConfig.id} ${stateConfig.id || 'default'}`);
			this.walkthroughCapturedStates += 1;
		}
	}
});

Then(
	'the authenticated QA walkthrough should have captured every registered state',
	async function () {
		const expectedStateCount = visualWalkthroughConfig.pages.reduce((total, rawPageConfig) => {
			const pageConfig = pageCaptureConfig(rawPageConfig);
			return total + 1 + (pageConfig.states || []).length;
		}, 0);
		expect(this.walkthroughCapturedStates).toBe(expectedStateCount);
	}
);
