import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { normaliseGovukPageHtml } from './page-publisher/normalise.mjs';

const root = resolve(process.cwd());
const legacyRoutes = [
	'/pages/account/sign-in/index.html',
	'/pages/team/registration-requests/index.html',
];

function routeToFile(route) {
	return resolve(root, 'public', route.replace(/^\//, ''));
}

async function fileExists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

for (const route of legacyRoutes) {
	const filePath = routeToFile(route);
	if (!(await fileExists(filePath))) {
		console.warn(`Skipped missing legacy page ${route}`);
		continue;
	}

	const current = await readFile(filePath, 'utf8');
	const next = normaliseGovukPageHtml(current, route);

	if (next !== current) {
		await writeFile(filePath, next, 'utf8');
		console.log(`Normalised ${filePath.replace(`${root}/`, '')}`);
	}
}
