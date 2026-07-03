import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const readme = read('docs/compliance/soc2-iso27001-readiness/README.md');
const scope = read('docs/compliance/soc2-iso27001-readiness/scope-and-system-boundary.md');
const evidenceIndex = read('docs/compliance/soc2-iso27001-readiness/evidence-index.md');
const availabilityReadiness = read(
	'docs/compliance/soc2-iso27001-readiness/availability-and-monitoring/README.md'
);
const availabilityEvidence = read(
	'docs/compliance/soc2-iso27001-readiness/availability-and-monitoring/backup-restore-availability-monitoring.md'
);
const availabilityEvidencePage = read(
	'public/pages/compliance-readiness/availability-and-monitoring/backup-restore-availability-monitoring/index.html'
);
const incidentReadiness = read(
	'docs/compliance/soc2-iso27001-readiness/incident-response/README.md'
);
const privacyReadiness = read(
	'docs/compliance/soc2-iso27001-readiness/privacy-and-data-protection/README.md'
);
const privacyEvidence = read(
	'docs/compliance/soc2-iso27001-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis.md'
);
const privacyEvidencePage = read(
	'public/pages/compliance-readiness/privacy-and-data-protection/dpia-data-map-ropa-lawful-basis/index.html'
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
		'Completed restore test evidence and approved monitoring evidence',
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

test('privacy readiness records DPIA, data map, ROPA and lawful-basis gaps', () => {
	for (const requiredTerm of [
		'DPIA',
		'data map',
		'ROPA',
		'lawful basis',
		'special-category',
		'consent',
		'participant contact details',
		'Article 9 condition',
	]) {
		assert.match(`${privacyReadiness}\n${privacyEvidence}`, new RegExp(requiredTerm));
	}

	assert.match(privacyReadiness, /does not assert DPIA approval/);
	assert.match(privacyEvidence, /Status: draft, not approved/);
	assert.match(evidenceIndex, /DPIA and GDPR records \| Partially evidenced/);
	assert.match(privacyEvidencePage, /Privacy and data protection evidence/);
	assert.match(privacyEvidencePage, /This page is readiness evidence/);
	assert.doesNotMatch(privacyEvidencePage, /DPIA is approved/i);
	assert.doesNotMatch(privacyEvidencePage, /ROPA is complete/i);
});

test('availability readiness records backup, restore and monitoring gaps', () => {
	for (const requiredTerm of [
		'Cloudflare Pages',
		'Cloudflare Worker',
		'D1',
		'KV',
		'SLOs',
		'RTO/RPO',
		'backup schedule',
		'restore tests',
		'monitoring',
		'alert thresholds',
	]) {
		assert.match(`${availabilityReadiness}\n${availabilityEvidence}`, new RegExp(requiredTerm));
	}

	assert.match(availabilityReadiness, /does not assert that availability is in SOC 2 scope/);
	assert.match(availabilityEvidence, /Status: draft, not approved/);
	assert.match(evidenceIndex, /Business continuity and availability \| Partially evidenced/);
	assert.match(availabilityEvidencePage, /Availability and monitoring evidence/);
	assert.match(availabilityEvidencePage, /This page is readiness evidence/);
	assert.doesNotMatch(availabilityEvidencePage, /restore testing is complete/i);
	assert.doesNotMatch(availabilityEvidencePage, /availability is approved/i);
});
