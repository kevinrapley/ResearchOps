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
	await page.setContent('<main tabindex="-1"></main><div id="dynamic"></div>');
	await page.addScriptTag({ content: trackerSource });
	await page.evaluate(() => {
		annotateInteractiveElements(document);
		observeInteractiveElements();
		document.querySelector('#dynamic').innerHTML =
			'<a href="/pages/projects/">Projects</a><textarea name="objective"></textarea>';
	});

	await expect(page.locator('#dynamic a')).toHaveAttribute(
		'data-flux-key',
		'link.navigation.projects'
	);
	await expect(page.locator('#dynamic textarea')).toHaveAttribute(
		'data-flux-key',
		'field.project.objective'
	);
	await expect(page.locator('#dynamic a')).toHaveAttribute('data-flux-role', 'control');
	await expect(page.locator('#dynamic textarea')).toHaveAttribute('data-flux-role', 'field');
	await expect(page.locator('main')).not.toHaveAttribute('data-flux-key', /.+/);
	await expect(page.locator('[data-flux-key^="auto."]')).toHaveCount(0);
});
