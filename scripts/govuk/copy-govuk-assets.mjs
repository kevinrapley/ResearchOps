import { cp, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const packageRoot = resolve(root, 'node_modules/govuk-frontend/dist/govuk');
const publicRoot = resolve(root, 'public/assets/govuk');

const copyTargets = [
	['assets', 'assets'],
	['govuk-frontend.min.js', 'govuk-frontend.min.js'],
	['govuk-frontend.min.js.map', 'govuk-frontend.min.js.map'],
];

await mkdir(publicRoot, { recursive: true });

for (const [source, target] of copyTargets) {
	const sourcePath = resolve(packageRoot, source);
	const targetPath = resolve(publicRoot, target);
	await mkdir(dirname(targetPath), { recursive: true });

	if (source.endsWith('.js') || source.endsWith('.map')) {
		await copyFile(sourcePath, targetPath);
		continue;
	}

	await cp(sourcePath, targetPath, { recursive: true, force: true });
}

console.log('Copied GOV.UK Frontend assets to public/assets/govuk');
