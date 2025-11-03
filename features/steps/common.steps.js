import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

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

When(/^I visit "([^"]+)"$/, async function (path) {
	const url = this.url(path);
	const resp = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
	this.expectTruthy(resp, `no response for ${url}`);
	expect(resp.ok(), `HTTP not OK for ${url}: ${resp && resp.status()}`).toBeTruthy();
});

Then(/^the page should contain "([^"]+)" within 5s$/, async function (text) {
	await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
});

Then(/^the page should have a <title> containing "([^"]+)"$/, async function (text) {
	await expect(this.page).toHaveTitle(new RegExp(text, 'i'));
});

Then(/^I should see an element "([^"]+)"$/, async function (selector) {
	await expect(this.page.locator(selector)).toBeVisible({ timeout: 5000 });
});
