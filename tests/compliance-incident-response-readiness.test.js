import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { publishedGovukPage } from './helpers/published-govuk-pages.mjs';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const incidentRoot = 'docs/compliance/soc2-iso27001-readiness/incident-response';
const readme = read(`${incidentRoot}/README.md`);
const runbooks = read(`${incidentRoot}/incident-response-runbooks.md`);
const breachHandling = read(`${incidentRoot}/personal-data-breach-handling.md`);
const testEvidence = read(`${incidentRoot}/incident-response-test-evidence.md`);
const combined = `${readme}\n${runbooks}\n${breachHandling}\n${testEvidence}`;

const generatedPages = [
	{
		filePath: 'public/pages/compliance-readiness/incident-response/runbooks/index.html',
		slug: 'runbooks',
		title: 'Incident response runbooks',
		expectedContent: ['Severity model', 'Runbook: suspected PII exposure'],
	},
	{
		filePath:
			'public/pages/compliance-readiness/incident-response/personal-data-breach-handling/index.html',
		slug: 'personal-data-breach-handling',
		title: 'Personal data breach handling',
		expectedContent: [
			'within 72 hours',
			'without undue delay',
			'https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/',
			'https://ico.org.uk/for-organisations/advice-and-services/audits/data-protection-audit-framework/toolkits/personal-data-breach-management/reporting-processes/',
		],
	},
	{
		filePath: 'public/pages/compliance-readiness/incident-response/test-evidence/index.html',
		slug: 'test-evidence',
		title: 'Incident response test evidence',
		expectedContent: ['Exercise status: planned, not yet completed', 'Passing criteria'],
	},
];

test('incident response readiness pack defines the required artefacts', () => {
	for (const fileName of [
		'incident-response-runbooks.md',
		'personal-data-breach-handling.md',
		'incident-response-test-evidence.md',
	]) {
		assert.match(readme, new RegExp(fileName));
	}

	assert.match(readme, /does not assert SOC 2 compliance or ISO\/IEC 27001 certification/);
	assert.match(
		readme,
		/must not be described as an exercised or independently assured incident response control/
	);
});

test('incident runbooks cover ResearchOps-specific incident scenarios', () => {
	for (const requiredScenario of [
		'suspected PII exposure',
		'unauthorised access or broken permission',
		'leaked integration token, OAuth state or production secret',
		'production data corruption or failed retention deletion',
		'supplier or integration incident',
		'unavailable service or degraded access',
	]) {
		assert.match(runbooks, new RegExp(requiredScenario));
	}

	assert.match(runbooks, /preserve evidence/i);
	assert.match(runbooks, /personal data breach handling process/i);
});

test('breach handling process protects UK GDPR decision points', () => {
	for (const requiredText of [
		'rights and freedoms',
		'within 72 hours',
		'without undue delay',
		'decisions not to report',
		'Data Protection Officer',
		'ICO notification decision',
		'affected-person notification decision',
	]) {
		assert.match(breachHandling, new RegExp(requiredText));
	}

	assert.match(
		breachHandling,
		/https:\/\/ico\.org\.uk\/for-organisations\/report-a-breach\/personal-data-breach\//
	);
	assert.match(
		breachHandling,
		/https:\/\/ico\.org\.uk\/for-organisations\/advice-and-services\/audits\/data-protection-audit-framework\/toolkits\/personal-data-breach-management\/reporting-processes\//
	);
});

test('incident response test evidence stays honest until an exercise is completed', () => {
	assert.match(testEvidence, /# ResearchOps incident response test evidence/);
	assert.match(testEvidence, /Exercise status: planned, not yet completed/);
	assert.match(testEvidence, /This document is not completed test evidence/);
	assert.match(testEvidence, /Minimum exercise scenario/);
	assert.match(testEvidence, /Passing criteria/);
	assert.match(testEvidence, /Current gap/);

	assert.doesNotMatch(combined, /\bexercise has been completed\b/i);
	assert.doesNotMatch(combined, /\bincident response control is tested and effective\b/i);
});

test('incident response evidence is rendered as visible GOV.UK pages', async () => {
	for (const page of generatedPages) {
		const html = await publishedGovukPage(page.filePath);

		assert.match(html, new RegExp(`data-compliance-evidence-document="${page.slug}"`));
		assert.match(html, new RegExp(`<h1 class="govuk-heading-xl">\\s*${page.title}\\s*</h1>`));
		assert.match(html, /href="\/pages\/compliance-readiness\/">Back to compliance readiness<\/a>/);
		assert.match(html, /This page is readiness evidence/);
		assert.match(html, /govuk-warning-text/);

		for (const expectedContent of page.expectedContent) {
			assert.equal(
				html.includes(expectedContent),
				true,
				`Expected ${page.filePath} to include ${expectedContent}`
			);
		}
	}

	const testEvidenceHtml = await publishedGovukPage(
		'public/pages/compliance-readiness/incident-response/test-evidence/index.html'
	);
	assert.doesNotMatch(testEvidenceHtml, /\bexercise has been completed\b/i);
});

test('personal data breach decision route renders nested bullet lists inside one ordered list', async () => {
	const html = await publishedGovukPage(
		'public/pages/compliance-readiness/incident-response/personal-data-breach-handling/index.html'
	);
	const [, decisionRoute] = html.match(
		/<h2 class="govuk-heading-l">Decision route<\/h2>([\s\S]*?)<h2 class="govuk-heading-l">Minimum breach record<\/h2>/
	);

	assert.equal(
		(decisionRoute.match(/<ol class="govuk-list govuk-list--number">/g) || []).length,
		1
	);
	assert.equal(
		(decisionRoute.match(/<ul class="govuk-list govuk-list--bullet">/g) || []).length,
		8
	);
	assert.match(
		decisionRoute,
		/<li>\s*<strong>Start the timer<\/strong>\s*<ul class="govuk-list govuk-list--bullet">\s*<li>Record when ResearchOps became aware of the suspected breach\.<\/li>/
	);
	assert.match(
		decisionRoute,
		/<\/ul>\s*<\/li>\s*<li>\s*<strong>Contain first, but preserve evidence<\/strong>/
	);
	assert.doesNotMatch(decisionRoute, /<\/ol>\s*<ul class="govuk-list govuk-list--bullet">/);
});
