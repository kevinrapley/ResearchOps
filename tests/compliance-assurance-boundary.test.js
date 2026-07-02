import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const readme = read('docs/compliance/soc2-iso27001-readiness/README.md');
const scope = read('docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md');
const evidenceIndex = read('docs/compliance/soc2-iso27001-readiness/evidence-index.md');
const combined = `${readme}\n${scope}\n${evidenceIndex}`;

test('compliance readiness pack avoids unsupported SOC 2 and ISO 27001 claims', () => {
	for (const document of [readme, scope, evidenceIndex]) {
		assert.match(document, /does not assert SOC 2 compliance or ISO\/IEC 27001 certification/);
	}

	assert.doesNotMatch(combined, /\bis SOC 2 compliant\b/i);
	assert.doesNotMatch(combined, /\bis ISO\/IEC 27001 certified\b/i);
	assert.doesNotMatch(combined, /\bis ISO 27001 certified\b/i);
});

test('scope document defines the ResearchOps platform boundary', () => {
	assert.match(scope, /# ResearchOps compliance scope and system boundary/);
	assert.match(scope, /ResearchOps platform/);
	assert.match(scope, /## Included in scope/);
	assert.match(scope, /## Out of scope/);
	assert.match(scope, /## Data boundary/);
	assert.match(scope, /## Main data flows/);
	assert.match(scope, /## Control boundary/);
});

test('scope document covers privacy and supplier boundary essentials', () => {
	for (const requiredTerm of [
		'PII',
		'GDPR',
		'DPIA',
		'ROPA',
		'Cloudflare',
		'GitHub',
		'Airtable',
		'Mural',
		'Statement of Applicability',
	]) {
		assert.match(combined, new RegExp(requiredTerm));
	}
});

test('evidence index keeps readiness gaps visible', () => {
	for (const requiredGap of [
		'Asset and data inventory',
		'Risk assessment and treatment plan',
		'Supplier assurance',
		'Incident response',
		'Secure development lifecycle',
		'ISMS scope, risk assessment, risk treatment plan and Statement of Applicability',
	]) {
		assert.match(evidenceIndex, new RegExp(requiredGap));
	}
});
