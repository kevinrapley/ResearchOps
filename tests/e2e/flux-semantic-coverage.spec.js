import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const trackerSource = fs.readFileSync('public/js/flux-researchops-tracker.1.2.0.js', 'utf8');
const semanticSelector = 'a,button,input,select,textarea,[role="button"],form,details';

test('annotates every rendered ResearchOps interactive element with semantic Flux context', async ({
	browser,
}) => {
	const pageFiles = [
		'public/index.html',
		...fs
			.readdirSync('public/pages', { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name === 'index.html')
			.map((entry) => path.join(entry.parentPath, entry.name)),
	];

	for (const pageFile of pageFiles) {
		const page = await browser.newPage();
		await page.setContent(fs.readFileSync(pageFile, 'utf8'));
		await page.addScriptTag({ content: trackerSource });
		await page.evaluate(() => annotateInteractiveElements(document));

		const coverage = await page.locator(semanticSelector).evaluateAll((elements) => ({
			missing: elements.filter(
				(element) =>
					!element.hasAttribute('data-flux-key') || !element.hasAttribute('data-flux-role')
			).length,
			weak: elements.filter((element) =>
				/^auto\.|\.(control|field|form)$/.test(element.dataset.fluxKey || '')
			).length,
		}));
		expect(coverage.missing, `${pageFile} should expose semantic Flux attributes`).toBe(0);
		expect(coverage.weak, `${pageFile} should expose purpose-led Flux keys`).toBe(0);
		await page.close();
	}
});

test('annotates controls inserted after page load without positional auto keys', async ({
	page,
}) => {
	await page.setContent(
		'<body data-flux-page="page.start"><main tabindex="-1"></main><div id="dynamic"></div></body>'
	);
	await page.addScriptTag({ content: trackerSource });
	await page.evaluate(() => {
		annotateInteractiveElements(document);
		observeInteractiveElements();
		document.querySelector('#dynamic').innerHTML =
			'<a href="/pages/projects/" data-govuk-button-init>Projects</a><a href="mailto:alice.person@example.com">Email</a><textarea name="objective"></textarea><button data-participants-page="previous">Previous</button><button data-participants-page="next">Next</button><button data-close-panel="add-objective-panel">Cancel objective</button><button data-close-panel="add-stakeholder-panel">Cancel stakeholder</button><button data-action="schedule">Schedule</button><input id="channel-email" name="channel_pref" type="checkbox" value="email"><input id="channel-sms" name="channel_pref" type="checkbox" value="sms">';
	});

	await expect(page.locator('#dynamic a[href="/pages/projects/"]')).toHaveAttribute(
		'data-flux-key',
		'link.navigation.projects'
	);
	await expect(page.locator('#dynamic textarea')).toHaveAttribute(
		'data-flux-key',
		'field.start.objective'
	);
	await expect(page.locator('#dynamic a[href^="mailto:"]')).toHaveAttribute(
		'data-flux-key',
		'link.navigation.contact-email'
	);
	await expect(page.locator('#dynamic button').nth(0)).toHaveAttribute(
		'data-flux-key',
		'button.start.participants-page-previous'
	);
	await expect(page.locator('#dynamic button').nth(1)).toHaveAttribute(
		'data-flux-key',
		'button.start.participants-page-next'
	);
	await expect(page.locator('[data-close-panel="add-objective-panel"]')).toHaveAttribute(
		'data-flux-key',
		'button.start.close-panel-add-objective-panel'
	);
	await expect(page.locator('[data-close-panel="add-stakeholder-panel"]')).toHaveAttribute(
		'data-flux-key',
		'button.start.close-panel-add-stakeholder-panel'
	);
	await expect(page.locator('[data-action="schedule"]')).toHaveAttribute(
		'data-flux-key',
		'button.start.schedule'
	);
	await expect(page.locator('#channel-email')).toHaveAttribute(
		'data-flux-key',
		'field.start.channel-pref-email'
	);
	await expect(page.locator('#channel-sms')).toHaveAttribute(
		'data-flux-key',
		'field.start.channel-pref-sms'
	);
	await expect(page.locator('#dynamic a[href="/pages/projects/"]')).toHaveAttribute(
		'data-flux-role',
		'control'
	);
	await expect(page.locator('#dynamic textarea')).toHaveAttribute('data-flux-role', 'field');
	await expect(page.locator('main')).not.toHaveAttribute('data-flux-key', /.+/);
	await expect(page.locator('[data-flux-key^="auto."]')).toHaveCount(0);
});

test('gives the production consent controls explicit semantic keys', async ({ page }) => {
	await page.route('https://research-operations.com/flux-consent-test', (route) =>
		route.fulfill({
			contentType: 'text/html',
			body: '<!doctype html><html><body data-flux-page="page.home"></body></html>',
		})
	);
	await page.goto('https://research-operations.com/flux-consent-test');
	await page.addScriptTag({ content: trackerSource });

	await expect(page.locator('[data-flux-consent="yes"]')).toHaveAttribute(
		'data-flux-key',
		'button.consent.accept-behavioural-analytics'
	);
	await expect(page.locator('[data-flux-consent="no"]')).toHaveAttribute(
		'data-flux-key',
		'button.consent.reject-behavioural-analytics'
	);
	await expect(page.locator('[data-flux-consent]')).toHaveCount(2);
	await expect(page.locator('[data-flux-consent]:not([data-flux-role="control"])')).toHaveCount(0);
});
