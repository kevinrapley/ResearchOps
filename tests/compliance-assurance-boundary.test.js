import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const readme = read('docs/compliance/soc2-iso27001-readiness/README.md');
const scope = read('docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md');
const evidenceIndex = read('docs/compliance/soc2-iso27001-readiness/evidence-index.md');
const incidentReadiness = read(
	'docs/compliance/soc2-iso27001-readiness/incident-response/README.md'
);
const supplierReadiness = read(
	'docs/compliance/soc2-iso27001-readiness/supplier-assurance/README.md'
);
const supplierRegister = read(
	'docs/compliance/soc2-iso27001-readiness/supplier-assurance/supplier-assurance-register.md'
);
const supplierRegisterPage = read(
	'public/pages/compliance-readiness/supplier-assurance/register/index.html'
);
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
		'Completed incident response test evidence and breach handling sign-off',
	]) {
		assert.match(evidenceIndex, new RegExp(requiredGap));
	}
});

test('incident response readiness remains framed as partial evidence', () => {
	assert.match(incidentReadiness, /Partially evidenced|partially evidenced/);
	assert.match(
		incidentReadiness,
		/must not be described as an exercised or independently assured incident response control/
	);
	assert.match(evidenceIndex, /Incident response \| Partially evidenced/);
});

test('supplier assurance readiness records named provider dependencies', () => {
	for (const provider of [
		'Cloudflare',
		'GitHub',
		'Airtable',
		'Mural',
		'Resend',
		'future communications provider',
		'Cloudflare Workers AI',
		'OpenAI or other external AI provider',
	]) {
		assert.match(`${supplierReadiness}\n${supplierRegister}`, new RegExp(provider));
	}

	assert.match(supplierReadiness, /does not assert supplier approval/);
	assert.match(supplierRegister, /Not approved/);
	assert.match(evidenceIndex, /Supplier assurance \| Partially evidenced/);
	assert.doesNotMatch(supplierRegisterPage, /<table class="govuk-table"/);
	assert.match(supplierRegisterPage, /<h3 class="govuk-heading-m">Cloudflare<\/h3>/);
	assert.match(supplierRegisterPage, /<strong>ResearchOps role:<\/strong>/);
});
