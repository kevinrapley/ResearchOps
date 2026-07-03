import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const macroSource = fs.readFileSync('src/govuk/templates/macros/sourcebook-context.njk', 'utf8');
const dataSource = fs.readFileSync('src/govuk/data/sourcebook.mjs', 'utf8');
const serviceSource = fs.readFileSync('infra/cloudflare/src/service/sourcebook.js', 'utf8');
const routeMappings = JSON.parse(fs.readFileSync('sourcebook/sourcebook-route-mappings.json', 'utf8'));

function includes(source, text, label) {
	assert.equal(source.includes(text), true, `Expected ${label} to include: ${text}`);
}

test('SourcebookContext macro renders clause context from typed items', () => {
	for (const text of [
		'{% macro SourcebookContext(params) %}',
		'class="sourcebook-context"',
		'aria-labelledby="{{ params.id | default',
		'Sourcebook',
		'item.typeNotation',
		'item.typeLabel',
		'item.href',
		'Applies when:',
	]) {
		includes(macroSource, text, 'SourcebookContext macro');
	}
});

test('GOV.UK data layer resolves shared route mappings for pages', () => {
	for (const text of [
		'sourcebook/sourcebook-route-mappings.json',
		'export const sourcebookRouteMappings',
		'export function sourcebookContextForRoute',
		'function mappingConditions',
		'function sourcebookClauseHref',
		'normaliseRoute(mapping.route) === routeValue',
		'normaliseCondition(item?.id || item) === conditionValue',
	]) {
		includes(dataSource, text, 'Sourcebook GOV.UK data layer');
	}
});

test('API and Nunjucks use the same route-to-clause mapping source', () => {
	includes(serviceSource, 'sourcebook-route-mappings.json', 'Sourcebook API service');
	includes(serviceSource, 'routeClauseMappings', 'Sourcebook API service');

	for (const expectedMapping of [
		['/pages/consent/', 'REC-ADMN 3.1.1', 'consent-review'],
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
