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
		evidence: asArray(record.clause.evidence),
		pillarCode: record.pillar.code,
		pillarTitle: record.pillar.title,
		href: sourcebookClauseHref(record),
		route: normaliseRoute(mapping.route),
		conditionIds: conditions.map((condition) => condition.id),
		conditions,
		strength: mapping.strength || 'related',
	};
}

function evidenceLabel(evidenceId) {
	return String(evidenceId || '')
		.split(/[-_]+/)
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

function evidenceLedgerStatus(evidenceId, providedEvidence) {
	return providedEvidence.has(normaliseCondition(evidenceId)) ? 'present' : 'needed';
}

function sourcebookEvidenceLedgerItem({ evidenceId, clause, providedEvidence }) {
	const status = evidenceLedgerStatus(evidenceId, providedEvidence);
	return {
		id: normaliseCondition(evidenceId),
		label: evidenceLabel(evidenceId),
		status,
		statusLabel: status === 'present' ? 'Present' : 'Needed',
		clauses: [
			{
				id: clause.id,
				title: clause.title,
				href: clause.href,
				pillarTitle: clause.pillarTitle,
				strength: clause.strength,
			},
		],
	};
}

export function sourcebookContextForRoute({
	route,
	condition,
	id,
	classes = '',
	caption = 'Sourcebook',
	conditionLabel = 'Applies when:',
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
		id,
		classes,
		caption,
		conditionLabel,
		title,
		summary,
		route: routeValue,
		condition: conditionValue,
		items,
	};
}

export function sourcebookEvidenceLedgerForRoute({
	route,
	condition,
	id,
	sectionId,
	classes = '',
	caption = 'Evidence ledger',
	title = 'Sourcebook evidence ledger',
	summary = 'Evidence required by Sourcebook clauses for this task.',
	providedEvidence = [],
	limit = 3,
} = {}) {
	const context = sourcebookContextForRoute({ route, condition, limit });
	const provided = new Set(asArray(providedEvidence).map(normaliseCondition));
	const evidenceById = new Map();

	for (const clause of context.items) {
		for (const evidenceId of asArray(clause.evidence)) {
			const key = normaliseCondition(evidenceId);
			if (!key) continue;
			if (!evidenceById.has(key)) {
				evidenceById.set(
					key,
					sourcebookEvidenceLedgerItem({
						evidenceId,
						clause,
						providedEvidence: provided,
					})
				);
				continue;
			}
			evidenceById.get(key).clauses.push({
				id: clause.id,
				title: clause.title,
				href: clause.href,
				pillarTitle: clause.pillarTitle,
				strength: clause.strength,
			});
		}
	}

	const items = [...evidenceById.values()];
	return {
		id,
		sectionId,
		classes,
		caption,
		title,
		summary,
		route: context.route,
		condition: context.condition,
		status: items.every((item) => item.status === 'present') ? 'ready' : 'needs-evidence',
		items,
	};
}

function sourcebookGateChecks({ context, ledger }) {
	const hasContext = context.items.length > 0;
	const neededEvidence = ledger.items.filter((item) => item.status !== 'present');
	const hasEvidenceRequirements = ledger.items.length > 0;
	const evidenceReady = hasEvidenceRequirements && neededEvidence.length === 0;

	return [
		{
			id: 'sourcebook-context',
			label: 'Sourcebook context',
			status: hasContext ? 'met' : 'unmet',
			statusLabel: hasContext ? 'Matched' : 'No match',
			detail: hasContext
				? `${context.items.length} clause${context.items.length === 1 ? '' : 's'} matched this route.`
				: 'No Sourcebook clause is mapped to this route and condition.',
		},
		{
			id: 'evidence-readiness',
			label: 'Evidence readiness',
			status: evidenceReady ? 'met' : 'unmet',
			statusLabel: evidenceReady ? 'Ready' : 'Evidence needed',
			detail: hasEvidenceRequirements
				? `${neededEvidence.length} evidence item${neededEvidence.length === 1 ? '' : 's'} needed.`
				: 'No Sourcebook evidence requirements are mapped to this route and condition.',
		},
		{
			id: 'governance-action',
			label: 'Governance action',
			status: hasContext && evidenceReady ? 'met' : 'unmet',
			statusLabel: hasContext && evidenceReady ? 'Proceed with controls' : 'Pause for evidence',
			detail:
				hasContext && evidenceReady
					? 'The mapped Sourcebook clause and required evidence are present.'
					: 'Add the required evidence before treating this workflow as Sourcebook-ready.',
		},
	];
}

export function sourcebookGateForRoute({
	route,
	condition,
	id,
	classes = '',
	caption = 'Sourcebook gate',
	title = 'Sourcebook gate',
	summary = 'Checks whether this task has the Sourcebook context and evidence needed before it proceeds.',
	providedEvidence = [],
	readyStatusLabel = 'Ready to proceed',
	blockedStatusLabel = 'Evidence needed',
	notApplicableStatusLabel = 'No gate required',
	readyPrimaryAction = 'Proceed with controls',
	blockedPrimaryAction = 'Add evidence before continuing',
	notApplicablePrimaryAction = 'Check Sourcebook scope',
	limit = 3,
} = {}) {
	const context = sourcebookContextForRoute({ route, condition, limit });
	const evidenceLedger = sourcebookEvidenceLedgerForRoute({
		route,
		condition,
		providedEvidence,
		limit,
	});
	const checks = sourcebookGateChecks({ context, ledger: evidenceLedger });
	const hasContext = context.items.length > 0;
	const evidenceReady =
		evidenceLedger.items.length > 0 &&
		evidenceLedger.items.every((item) => item.status === 'present');
	const status = !hasContext ? 'not-applicable' : evidenceReady ? 'ready' : 'blocked';

	return {
		id,
		classes,
		caption,
		title,
		summary,
		route: context.route,
		condition: context.condition,
		status,
		statusLabel:
			status === 'ready'
				? readyStatusLabel
				: status === 'blocked'
					? blockedStatusLabel
					: notApplicableStatusLabel,
		decision:
			status === 'ready'
				? 'proceed-with-controls'
				: status === 'blocked'
					? 'pause-for-evidence'
					: 'check-sourcebook-scope',
		primaryAction:
			status === 'ready'
				? readyPrimaryAction
				: status === 'blocked'
					? blockedPrimaryAction
					: notApplicablePrimaryAction,
		checks,
		context,
		evidenceLedger,
	};
}
