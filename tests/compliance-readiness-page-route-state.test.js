import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
	complianceScopeSummary,
	controlMatrix,
	readinessEvidenceGaps,
} from '../src/govuk/data/compliance-readiness.mjs';

const page = fs.existsSync('public/pages/compliance-readiness/index.html')
	? fs.readFileSync('public/pages/compliance-readiness/index.html', 'utf8')
	: '';
const template = fs.readFileSync('src/govuk/templates/pages/compliance-readiness.njk', 'utf8');
const renderer = fs.readFileSync('scripts/govuk/render-govuk-pages.mjs', 'utf8');
const footer = fs.readFileSync('public/partials/footer.html', 'utf8');
const header = fs.readFileSync('public/partials/header.html', 'utf8');

test('compliance readiness page is registered as a GOV.UK page without main navigation exposure', () => {
	assert.match(renderer, /template: 'pages\/compliance-readiness\.njk'/);
	assert.match(renderer, /output: 'public\/pages\/compliance-readiness\/index\.html'/);
	assert.match(footer, /href="\/pages\/compliance-readiness\/">Compliance readiness<\/a>/);
	assert.doesNotMatch(header, /\/pages\/compliance-readiness\//);
});

test('compliance readiness source defines scope boundary and non-claim wording', () => {
	assert.equal(complianceScopeSummary.service, 'ResearchOps platform');
	assert.match(complianceScopeSummary.boundary, /web service, Worker API, data stores/);
	assert.match(complianceScopeSummary.nonClaim, /does not assert SOC 2 compliance or ISO\/IEC 27001 certification/);
	assert.match(template, /Compliance scope and system boundary/);
	assert.match(template, /Formal control matrix/);
	assert.match(template, /govukWarningText/);
});

test('control matrix maps readiness controls to SOC 2 and ISO Annex A', () => {
	assert.equal(controlMatrix.length >= 10, true);
	assert.equal(readinessEvidenceGaps.length >= 6, true);

	for (const row of controlMatrix) {
		assert.ok(row.controlArea, 'control row should have a control area');
		assert.ok(row.readinessExpectation, `${row.controlArea} should have a readiness expectation`);
		assert.ok(row.currentEvidence, `${row.controlArea} should identify current evidence`);
		assert.ok(row.gap, `${row.controlArea} should identify a gap`);
		assert.equal(Array.isArray(row.soc2Tsc), true, `${row.controlArea} should map SOC 2 TSC`);
		assert.equal(
			Array.isArray(row.iso27001AnnexA),
			true,
			`${row.controlArea} should map ISO/IEC 27001 Annex A`
		);
		assert.equal(row.soc2Tsc.length > 0, true, `${row.controlArea} should have SOC 2 mappings`);
		assert.equal(
			row.iso27001AnnexA.length > 0,
			true,
			`${row.controlArea} should have ISO Annex A mappings`
		);
	}

	assert.equal(
		controlMatrix.some((row) => row.soc2Tsc.includes('CC6')),
		true,
		'matrix should include SOC 2 logical access controls'
	);
	assert.equal(
		controlMatrix.some((row) => row.soc2Tsc.includes('P')),
		true,
		'matrix should include SOC 2 Privacy as a candidate scope'
	);
	assert.equal(
		controlMatrix.some((row) => row.iso27001AnnexA.includes('A.5.34')),
		true,
		'matrix should include ISO privacy and PII protection'
	);
	assert.equal(
		controlMatrix.some((row) => row.iso27001AnnexA.includes('A.8.25')),
		true,
		'matrix should include ISO secure development lifecycle'
	);
});

test('rendered compliance readiness page includes the expected public content', () => {
	assert.match(page, /SOC 2 and ISO 27001 readiness/);
	assert.match(page, /data-compliance-readiness-page/);
	assert.match(page, /data-compliance-control-matrix/);
	assert.match(page, /Compliance scope and system boundary/);
	assert.match(page, /Formal control matrix/);
	assert.match(page, /Governance, scope and accountability/);
	assert.match(page, /Privacy, retention and data minimisation/);
	assert.match(page, /CC6/);
	assert.match(page, /A\.5\.34/);
	assert.match(page, /A\.8\.25/);
	assert.doesNotMatch(page, /\bis SOC 2 compliant\b/i);
	assert.doesNotMatch(page, /\bis ISO\/IEC 27001 certified\b/i);
});

