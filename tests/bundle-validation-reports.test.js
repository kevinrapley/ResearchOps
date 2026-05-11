import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const BUNDLE_ROOT = '.agent-operating-model/bundles';

const REQUIRED_BUNDLES = [
	'airtable-public-api',
	'cloudflare',
	'github',
	'govuk-design-system',
	'multi-functional-team',
	'mural-public-api',
	'researchops-developer-control',
];

const REQUIRED_REPORT_SECTIONS = [
	'# Validation Report',
	'Validation status:',
	'Last checked:',
	'## Scope',
	'## Entrypoints checked',
	'## Structural checks',
	'## Evaluation coverage',
	'## Known gaps',
	'## Result',
];

test('canonical bundles provide validation reports', () => {
	for (const bundleId of REQUIRED_BUNDLES) {
		const reportPath = `${BUNDLE_ROOT}/${bundleId}/VALIDATION-REPORT.md`;

		assert.ok(fs.existsSync(reportPath), `${bundleId} should have a VALIDATION-REPORT.md`);
	}
});

test('validation reports use the standard section structure', () => {
	for (const bundleId of REQUIRED_BUNDLES) {
		const report = fs.readFileSync(`${BUNDLE_ROOT}/${bundleId}/VALIDATION-REPORT.md`, 'utf8');

		for (const section of REQUIRED_REPORT_SECTIONS) {
			assert.ok(report.includes(section), `${bundleId} report should include ${section}`);
		}
	}
});

test('bundle validation report template defines the standard', () => {
	const template = fs.readFileSync(
		'.agent-operating-model/templates/bundle-validation-report-template.md',
		'utf8'
	);

	for (const section of REQUIRED_REPORT_SECTIONS) {
		assert.ok(template.includes(section), `template should include ${section}`);
	}
});
