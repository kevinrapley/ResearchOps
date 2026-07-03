import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const macroSource = fs.readFileSync('src/govuk/templates/macros/sourcebook-context.njk', 'utf8');
const gateMacroSource = fs.readFileSync('src/govuk/templates/macros/sourcebook-gate.njk', 'utf8');
const ledgerMacroSource = fs.readFileSync(
	'src/govuk/templates/macros/sourcebook-evidence-ledger.njk',
	'utf8',
);
const dataSource = fs.readFileSync('src/govuk/data/sourcebook.mjs', 'utf8');
const serviceSource = fs.readFileSync('infra/cloudflare/src/service/sourcebook.js', 'utf8');
const routeMappings = JSON.parse(fs.readFileSync('sourcebook/sourcebook-route-mappings.json', 'utf8'));

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

test('SourcebookContext macro renders clause context from typed items', () => {
	for (const text of [
		'{% macro SourcebookContext(params) %}',
		'class="sourcebook-context{% if params.classes %} {{ params.classes }}{% endif %}"',
		'aria-labelledby="{{ params.id | default',
		"params.caption | default('Sourcebook')",
		'item.typeNotation',
		'item.typeLabel',
		'item.href',
		"params.conditionLabel | default('Applies when:')",
	]) {
		includes(macroSource, text, 'SourcebookContext macro');
	}
});

test('GOV.UK data layer resolves shared route mappings for pages', () => {
	for (const text of [
		'sourcebook/sourcebook-route-mappings.json',
		'export const sourcebookRouteMappings',
		'export function sourcebookContextForRoute',
		'export function sourcebookEvidenceLedgerForRoute',
		'export function sourcebookGateForRoute',
		'function mappingConditions',
		'function sourcebookClauseHref',
		'function sourcebookEvidenceLedgerItem',
		'function sourcebookGateChecks',
		'normaliseRoute(mapping.route) === routeValue',
		'normaliseCondition(item?.id || item) === conditionValue',
	]) {
		includes(dataSource, text, 'Sourcebook GOV.UK data layer');
	}
});

test('SourcebookEvidenceLedger macro renders evidence rows from clauses', () => {
	for (const text of [
		'{% macro SourcebookEvidenceLedger(params) %}',
		'class="sourcebook-evidence-ledger{% if params.classes %} {{ params.classes }}{% endif %}"',
		"params.caption | default('Evidence ledger')",
		'data-sourcebook-evidence-id',
		'item.detail',
		'item.statusLabel',
		'item.label',
		'item.id',
		'clause.href',
		'Sourcebook clause',
	]) {
		includes(ledgerMacroSource, text, 'SourcebookEvidenceLedger macro');
	}
});

test('SourcebookGate macro renders a decision from context and evidence checks', () => {
	for (const text of [
		'{% macro SourcebookGate(params) %}',
		'class="sourcebook-gate sourcebook-gate--{{ params.status }}{% if params.classes %} {{ params.classes }}{% endif %}"',
		"params.caption | default('Sourcebook gate')",
		'data-sourcebook-gate',
		'data-sourcebook-check',
		'params.statusLabel',
		'params.primaryAction',
		'params.checks',
		'check.statusLabel',
		'check.detail',
	]) {
		includes(gateMacroSource, text, 'SourcebookGate macro');
	}

	for (const text of [
		'const context = sourcebookContextForRoute({ route, condition, limit });',
		'const evidenceLedger = sourcebookEvidenceLedgerForRoute({',
		"status === 'blocked'",
		"'Evidence needed'",
		"'Add evidence before continuing'",
	]) {
		includes(dataSource, text, 'SourcebookGate data helper');
	}
});

test('API and Nunjucks use the same route-to-clause mapping source', () => {
	includes(serviceSource, 'sourcebook-route-mappings.json', 'Sourcebook API service');
	includes(serviceSource, 'routeClauseMappings', 'Sourcebook API service');

	for (const expectedMapping of [
		['/pages/consent/', 'REC-ADMN 3.1.1', 'consent-review'],
		['/pages/study/participant-consent/', 'REC-ADMN 3.1.1', 'participant-consent-recording'],
		['/pages/account/team-access/', 'INFRA-PROV 3.1.1', 'access-change'],
		['/pages/team/role-assignments/', 'INFRA-PROV 3.1.1', 'permission-model-change'],
	]) {
		const [route, clauseId, conditionId] = expectedMapping;
		const mapping = routeMappings.find(
			(candidate) =>
				candidate.route === route &&
				candidate.clauseId === clauseId &&
				candidate.condition?.id === conditionId,
		);
		assert.ok(mapping, `Expected route mapping for ${route} and ${clauseId}`);
	}
});
