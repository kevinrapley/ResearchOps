// tests/e2e/smoke.spec.js
import { test, expect } from '@playwright/test';

const paths = ['/', '/index.html', '/pages/start/index.html', '/pages/projects/index.html'];

for (const p of paths) {
	test(`smoke: GET ${p} should render`, async ({ page, baseURL }) => {
		// Build URL from Playwright baseURL if set; otherwise fall back to env or prod site.
		const origin =
			baseURL ||
			process.env.BASE_URL ||
			process.env.PAGES_URL ||
			process.env.PREVIEW_URL ||
			'https://researchops.pages.dev/';
		const url = new URL(p, origin).toString();

		const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });

		// Network + status sanity
		expect(resp, `no response for ${url}`).toBeTruthy();
		expect(resp && resp.ok(), `HTTP not OK for ${url}: ${resp && resp.status()}`).toBeTruthy();

		// DOM sanity: body should exist and be visible enough to interact with.
		await expect(page.locator('body')).toBeVisible();

		// Optional: very light content sanity per route
		if (p === '/pages/projects/index.html') {
			await expect(page).toHaveTitle(/projects/i);
		}
		if (p === '/' || p === '/index.html') {
			// Expect some hallmark text on the homepage without being brittle.
			await expect(page.getByText(/research/i).first()).toBeVisible();
		}
		if (p === '/pages/start/index.html') {
			await expect(page.locator('main')).toBeVisible();
			await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
		}
	});
}
