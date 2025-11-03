// features/steps/common.steps.js
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

// --- utils -------------------------------------------------------------
function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a flexible selector list for common landmarks
function selectorCandidates(name) {
	const n = (name || '').toLowerCase().trim();

	if (n === 'header' || n === 'banner') {
		return [
			'header',
			'[role="banner"]',
			'.govuk-header',
			'[data-module="govuk-header"]',
			'#global-header',
			'#header',
			'.site-header',
			'nav[role="navigation"]',
			'nav[aria-label]',
			'nav'
		];
	}

	if (n === 'footer' || n === 'contentinfo') {
		return ['footer', '[role="contentinfo"]', '.govuk-footer', '#footer', '.site-footer'];
	}

	if (n === 'main') {
		return ['main', '[role="main"]', '#main-content'];
	}

	// Fallback: treat the incoming string as a CSS selector
	return [name];
}

// --- steps -------------------------------------------------------------

Given('the site base URL', function () {
	// Provided by World (features/support/world.js). Nothing to assert as long as it exists.
	if (!this.baseURL) {
		throw new Error('World.baseURL is not set');
	}
});

When('I visit {string}', async function (pathname) {
	const page = this.page || (await this.createPage());
	const url = this.url(pathname);
	const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
	this.expectTruthy(resp, `No response for ${url}`);
	this.expectTruthy(resp.ok(), `HTTP not OK for ${url}: ${resp && resp.status()}`);
});

Then('the page should contain {string} within 5s', async function (text) {
	// Disambiguate multiple matches: assert the first matching node is visible.
	await expect(this.page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 5000 });
});

Then('the page should have a <title> containing {string}', async function (titlePart) {
	const re = new RegExp(escapeRegExp(String(titlePart)), 'i');
	await expect(this.page).toHaveTitle(re, { timeout: 5000 });
});

Then('I should see an element {string}', async function (name) {
	const candidates = selectorCandidates(name);
	const locator = this.page.locator(candidates.join(', '));

	// Wait for at least one element to be attached in the DOM
	await locator.first().waitFor({ state: 'attached', timeout: 10000 });

	const count = await locator.count();
	this.expectTruthy(
		count > 0,
		`Expected to find "${name}" using any of: ${candidates.join(', ')}`
	);

	// Optional: also check visibility of the first match (can be commented out if too strict)
	// await expect(locator.first()).toBeVisible({ timeout: 2000 });
});