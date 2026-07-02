import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcebookPath = resolve(process.cwd(), 'sourcebook/sourcebook-index.json');

export const sourcebookIndex = JSON.parse(readFileSync(sourcebookPath, 'utf8'));

export const sourcebookNavigation = [
	{
		text: 'Sourcebook home',
		href: sourcebookIndex.canonicalRoute,
	},
	...sourcebookIndex.pillars.map((pillar) => ({
		text: pillar.title,
		href: pillar.route,
		code: pillar.code,
	})),
];

export const sourcebookPillarPages = sourcebookIndex.pillars.map((pillar) => ({
	...pillar,
	sourcebookTitle: sourcebookIndex.title,
	metadata: sourcebookIndex.metadata,
	contentTypes: sourcebookIndex.contentTypes,
	qualityGates: sourcebookIndex.qualityGates,
	templates: sourcebookIndex.templates,
	attribution: sourcebookIndex.attribution,
}));

export function sourcebookClauseType(type) {
	return (
		sourcebookIndex.contentTypes[type] || {
			notation: '?',
			label: type,
			definition: '',
		}
	);
}
