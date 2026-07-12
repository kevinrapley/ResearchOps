import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const semanticSelector = '[data-flux-key]';

test('keeps authored ResearchOps Flux attributes purpose-led and complete', async ({ browser }) => {
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
		const coverage = await page.locator(semanticSelector).evaluateAll((elements) => ({
			missing: elements.filter(
				(element) =>
					!element.hasAttribute('data-flux-key') || !element.hasAttribute('data-flux-role')
			).length,
			weak: elements.filter((element) =>
				/^auto\.|\.(control|field|form)$/.test(element.dataset.fluxKey || '')
			).length,
		}));
		expect(coverage.missing, `${pageFile} should pair every Flux key with a role`).toBe(0);
		expect(coverage.weak, `${pageFile} should expose purpose-led Flux keys`).toBe(0);
		await page.close();
	}
});
