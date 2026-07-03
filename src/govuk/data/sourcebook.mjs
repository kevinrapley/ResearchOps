import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcebookPath = resolve(process.cwd(), 'sourcebook/sourcebook-index.json');
const sourcebookRouteMappingsPath = resolve(
	process.cwd(),
	'sourcebook/sourcebook-route-mappings.json'
);

export const sourcebookIndex = JSON.parse(readFileSync(sourcebookPath, 'utf8'));
export const sourcebookRouteMappings = JSON.parse(
	readFileSync(sourcebookRouteMappingsPath, 'utf8')
);

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

function normaliseLookup(value) {
	return String(value || '')
		.trim()
		.toLowerCase();
}

function normaliseRoute(value) {
	const route = String(value || '').trim();
	if (!route) return '';
	const [pathname] = route.split(/[?#]/);
	const collapsed = pathname.replace(/\/{2,}/g, '/');
	if (collapsed === '/') return collapsed;
	return collapsed.endsWith('/') ? collapsed : `${collapsed}/`;
}

function normaliseCondition(value) {
	return normaliseLookup(value).replace(/[\s_]+/g, '-');
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function mappingConditions(mapping) {
	const conditions = mapping.conditions ?? mapping.condition;
	if (!conditions) return [];
	return Array.isArray(conditions) ? conditions : [conditions];
}

function allClauses() {
	return sourcebookIndex.pillars.flatMap((pillar) =>
		asArray(pillar.sections).flatMap((section) =>
			asArray(section.clauses).map((clause) => ({
				pillar,
				section,
				clause,
			}))
		)
	);
}

function sourcebookClauseHref(record) {
	return `${record.pillar.route}#${record.clause.id.toLowerCase().replaceAll(' ', '-').replaceAll('.', '-')}`;
}

function sourcebookContextItem(record, mapping) {
	const clauseType = sourcebookClauseType(record.clause.type);
	const conditions = mappingConditions(mapping).map((condition) => ({
		id: normaliseCondition(condition?.id || condition),
		label: String(condition?.label || condition?.id || condition || ''),
		description: String(condition?.description || ''),
	}));

	return {
		id: record.clause.id,
		title: record.clause.title,
		text: record.clause.text,
		type: record.clause.type,
		typeLabel: clauseType.label,
		typeNotation: clauseType.notation,
		pillarCode: record.pillar.code,
		pillarTitle: record.pillar.title,
		href: sourcebookClauseHref(record),
		route: normaliseRoute(mapping.route),
		conditionIds: conditions.map((condition) => condition.id),
		conditions,
		strength: mapping.strength || 'related',
	};
}

export function sourcebookContextForRoute({
	route,
	condition,
	title = 'Sourcebook context',
	summary = 'Relevant Sourcebook clauses for this task.',
	limit = 3,
} = {}) {
	const routeValue = normaliseRoute(route);
	const conditionValue = normaliseCondition(condition);
	const recordsByClauseId = new Map(
		allClauses().map((record) => [normaliseLookup(record.clause.id), record])
	);
	const items = sourcebookRouteMappings
		.filter((mapping) => normaliseRoute(mapping.route) === routeValue)
		.filter((mapping) => {
			if (!conditionValue) return true;
			return mappingConditions(mapping).some(
				(item) => normaliseCondition(item?.id || item) === conditionValue
			);
		})
		.map((mapping) => {
			const record = recordsByClauseId.get(normaliseLookup(mapping.clauseId));
			return record ? sourcebookContextItem(record, mapping) : null;
		})
		.filter(Boolean)
		.slice(0, limit);

	return {
		title,
		summary,
		route: routeValue,
		condition: conditionValue,
		items,
	};
}
