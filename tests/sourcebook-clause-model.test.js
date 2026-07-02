import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, resolve } from 'node:path';
import test from 'node:test';

import { govukPages } from '../scripts/govuk/render-govuk-pages.mjs';

const sourcebook = JSON.parse(fs.readFileSync('sourcebook/sourcebook-index.json', 'utf8'));
const clauseIdPattern = /^[A-Z]+(?:-[A-Z]+)* [0-9]+\.[0-9]+\.[0-9]+$/;
const isoDatePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function allClauses(pillar) {
	return pillar.sections.flatMap((section) => section.clauses);
}

test('sourcebook defines the 8 ResearchOps pillars as first-class concepts', () => {
	assert.equal(sourcebook.pillars.length, 8);

	const expectedCodes = [
		'ENVIRO',
		'SCOPE',
		'PEOP-COMM',
		'ORG-CONT',
		'REC-ADMN',
		'DATA-STO-ACC',
		'GOVERN',
		'INFRA-PROV',
	];

	assert.deepEqual(
		sourcebook.pillars.map((pillar) => pillar.code),
		expectedCodes
	);

	for (const pillar of sourcebook.pillars) {
		assert.match(pillar.route, /^\/pages\/sourcebook\/[a-z0-9-]+\/$/);
		assert.ok(pillar.slug, `${pillar.code} should have a slug`);
		assert.ok(pillar.title, `${pillar.code} should have a title`);
		assert.ok(pillar.owner, `${pillar.code} should have an owner`);
		assert.ok(pillar.definition, `${pillar.code} should have a definition`);
		assert.ok(pillar.operatingQuestion, `${pillar.code} should have an operating question`);
		assert.ok(pillar.valueFrame, `${pillar.code} should have a value frame`);
		assert.ok(pillar.sections.length >= 1, `${pillar.code} should have sections`);
		assert.ok(allClauses(pillar).length >= 3, `${pillar.code} should have clauses`);
	}
});

test('sourcebook clause model has handbook-style identifiers and required metadata', () => {
	const contentTypes = Object.keys(sourcebook.contentTypes);

	for (const pillar of sourcebook.pillars) {
		for (const section of pillar.sections) {
			assert.match(section.id, clauseIdPattern, `${section.id} should use sourcebook numbering`);
			assert.ok(section.definition, `${section.id} should have a definition`);

			for (const clause of section.clauses) {
				assert.match(clause.id, clauseIdPattern, `${clause.id} should use sourcebook numbering`);
				assert.equal(
					clause.id.startsWith(`${pillar.code} `),
					true,
					`${clause.id} should start with pillar code`
				);
				assert.equal(
					contentTypes.includes(clause.type),
					true,
					`${clause.id} should use a valid clause type`
				);
				assert.equal(
					sourcebook.clauseModel.statuses.includes(clause.status),
					true,
					`${clause.id} should use a valid status`
				);
				assert.match(
					clause.effectiveDate,
					isoDatePattern,
					`${clause.id} should have an ISO effective date`
				);
				assert.ok(clause.title, `${clause.id} should have a title`);
				assert.ok(clause.text, `${clause.id} should have text`);
				assert.ok(
					Array.isArray(clause.appliesTo) && clause.appliesTo.length > 0,
					`${clause.id} should have appliesTo`
				);
				assert.ok(
					Array.isArray(clause.evidence) && clause.evidence.length > 0,
					`${clause.id} should have evidence`
				);
			}
		}
	}
});

test('REC-ADMN is the reference-quality recruitment operations example', () => {
	const recAdmn = sourcebook.pillars.find((pillar) => pillar.code === 'REC-ADMN');
	assert.ok(recAdmn, 'REC-ADMN pillar should exist');

	const clauses = allClauses(recAdmn);
	assert.equal(
		recAdmn.sections.length >= 6,
		true,
		'REC-ADMN should cover the full recruitment lifecycle'
	);
	assert.equal(clauses.length >= 18, true, 'REC-ADMN should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Recruitment operating model',
		'Participant sourcing and screening',
		'Consent, privacy and participant records',
		'Incentives and participant care',
		'Scheduling and communications',
		'Reporting and operational learning',
	]) {
		assert.equal(
			recAdmn.sections.some((section) => section.title === expectedSection),
			true,
			`REC-ADMN should include ${expectedSection}`
		);
	}
});

test('ENVIRO covers the end-to-end research environment lifecycle', () => {
	const environment = sourcebook.pillars.find((pillar) => pillar.code === 'ENVIRO');
	assert.ok(environment, 'ENVIRO pillar should exist');

	const clauses = allClauses(environment);
	assert.equal(
		environment.sections.length >= 7,
		true,
		'ENVIRO should cover the full environment lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'ENVIRO should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Environment operating model',
		'Accessibility, inclusion and reasonable adjustments',
		'Physical spaces and controlled research settings',
		'Remote and digital research settings',
		'Fieldwork, community and high-variability settings',
		'Researcher safety, wellbeing and session support',
		'Environment review and operating learning',
	]) {
		assert.equal(
			environment.sections.some((section) => section.title === expectedSection),
			true,
			`ENVIRO should include ${expectedSection}`
		);
	}

	assert.equal(
		environment.glossary.some((item) => item.term === 'Research environment'),
		true,
		'ENVIRO should define environment-specific terms'
	);
	assert.equal(
		environment.changeHistory.some((item) =>
			item.summary.includes('end-to-end environment lifecycle')
		),
		true,
		'ENVIRO should record its lifecycle expansion in change history'
	);
});

test('SCOPE covers the end-to-end research scope lifecycle', () => {
	const scope = sourcebook.pillars.find((pillar) => pillar.code === 'SCOPE');
	assert.ok(scope, 'SCOPE pillar should exist');

	const clauses = allClauses(scope);
	assert.equal(scope.sections.length >= 7, true, 'SCOPE should cover the full scope lifecycle');
	assert.equal(clauses.length >= 20, true, 'SCOPE should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Scope operating model',
		'Research intake and problem framing',
		'Prioritisation and capacity',
		'Risk, review and support levels',
		'Method boundaries and evidence standards',
		'Self-service, coaching and non-researcher activity',
		'Roadmap, portfolio and scope learning',
	]) {
		assert.equal(
			scope.sections.some((section) => section.title === expectedSection),
			true,
			`SCOPE should include ${expectedSection}`
		);
	}

	assert.equal(
		scope.glossary.some((item) => item.term === 'Decision need'),
		true,
		'SCOPE should define scope-specific terms'
	);
	assert.equal(
		scope.changeHistory.some((item) => item.summary.includes('end-to-end scope lifecycle')),
		true,
		'SCOPE should record its lifecycle expansion in change history'
	);
});

test('PEOP-COMM covers the end-to-end research people lifecycle', () => {
	const people = sourcebook.pillars.find((pillar) => pillar.code === 'PEOP-COMM');
	assert.ok(people, 'PEOP-COMM pillar should exist');

	const clauses = allClauses(people);
	assert.equal(
		people.sections.length >= 7,
		true,
		'PEOP-COMM should cover the full people lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'PEOP-COMM should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'People operating model',
		'Capability, competence and permission',
		'Community of practice and professional standards',
		'Coaching, mentoring and supervision',
		'Research wellbeing and psychological safety',
		'Collaboration, observers and communication',
		'Practice learning and capability planning',
	]) {
		assert.equal(
			people.sections.some((section) => section.title === expectedSection),
			true,
			`PEOP-COMM should include ${expectedSection}`
		);
	}

	assert.equal(
		people.glossary.some((item) => item.term === 'Capability'),
		true,
		'PEOP-COMM should define people-specific terms'
	);
	assert.equal(
		people.changeHistory.some((item) => item.summary.includes('end-to-end people lifecycle')),
		true,
		'PEOP-COMM should record its lifecycle expansion in change history'
	);
});

test('GOVERN covers the end-to-end research governance lifecycle', () => {
	const governance = sourcebook.pillars.find((pillar) => pillar.code === 'GOVERN');
	assert.ok(governance, 'GOVERN pillar should exist');

	const clauses = allClauses(governance);
	assert.equal(
		governance.sections.length >= 7,
		true,
		'GOVERN should cover the full governance lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'GOVERN should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Governance operating model',
		'Study initiation and risk triage',
		'Ethics, consent and safeguarding',
		'Privacy, data protection and evidence governance',
		'Findings quality and decision assurance',
		'Incidents, exceptions and escalation',
		'Continuous governance and operating learning',
	]) {
		assert.equal(
			governance.sections.some((section) => section.title === expectedSection),
			true,
			`GOVERN should include ${expectedSection}`
		);
	}

	assert.equal(
		governance.glossary.some((item) => item.term === 'Governance triage'),
		true,
		'GOVERN should define governance-specific terms'
	);
	assert.equal(
		governance.changeHistory.some((item) =>
			item.summary.includes('end-to-end governance lifecycle')
		),
		true,
		'GOVERN should record its lifecycle expansion in change history'
	);
});

test('ORG-CONT covers the end-to-end organisational context lifecycle', () => {
	const organisationalContext = sourcebook.pillars.find((pillar) => pillar.code === 'ORG-CONT');
	assert.ok(organisationalContext, 'ORG-CONT pillar should exist');

	const clauses = allClauses(organisationalContext);
	assert.equal(
		organisationalContext.sections.length >= 7,
		true,
		'ORG-CONT should cover the full organisational context lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'ORG-CONT should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Strategy and value connection',
		'Research operating model',
		'Funding, capacity and resource planning',
		'Decision rights and governance integration',
		'Stakeholder alignment and organisational trust',
		'Portfolio rhythm and organisational learning',
		'Value measurement and operating review',
	]) {
		assert.equal(
			organisationalContext.sections.some((section) => section.title === expectedSection),
			true,
			`ORG-CONT should include ${expectedSection}`
		);
	}

	assert.equal(
		organisationalContext.glossary.some((item) => item.term === 'Operating model'),
		true,
		'ORG-CONT should define organisational context-specific terms'
	);
	assert.equal(
		organisationalContext.changeHistory.some((item) =>
			item.summary.includes('end-to-end organisational context lifecycle')
		),
		true,
		'ORG-CONT should record its lifecycle expansion in change history'
	);
});

test('DATA-STO-ACC covers the end-to-end data and knowledge lifecycle', () => {
	const dataKnowledge = sourcebook.pillars.find((pillar) => pillar.code === 'DATA-STO-ACC');
	assert.ok(dataKnowledge, 'DATA-STO-ACC pillar should exist');

	const clauses = allClauses(dataKnowledge);
	assert.equal(
		dataKnowledge.sections.length >= 7,
		true,
		'DATA-STO-ACC should cover the full data and knowledge lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'DATA-STO-ACC should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Data and knowledge operating model',
		'Evidence capture and repository entry',
		'Metadata, taxonomy and findability',
		'Access, privacy and permission',
		'Retention, disposal and auditability',
		'Reuse, synthesis and decision trace',
		'Repository health and knowledge learning',
	]) {
		assert.equal(
			dataKnowledge.sections.some((section) => section.title === expectedSection),
			true,
			`DATA-STO-ACC should include ${expectedSection}`
		);
	}

	assert.equal(
		dataKnowledge.glossary.some((item) => item.term === 'Evidence trace'),
		true,
		'DATA-STO-ACC should define data and knowledge-specific terms'
	);
	assert.equal(
		dataKnowledge.changeHistory.some((item) =>
			item.summary.includes('end-to-end data and knowledge lifecycle')
		),
		true,
		'DATA-STO-ACC should record its lifecycle expansion in change history'
	);
});

test('INFRA-PROV covers the end-to-end tools and infrastructure lifecycle', () => {
	const infrastructure = sourcebook.pillars.find((pillar) => pillar.code === 'INFRA-PROV');
	assert.ok(infrastructure, 'INFRA-PROV pillar should exist');

	const clauses = allClauses(infrastructure);
	assert.equal(
		infrastructure.sections.length >= 7,
		true,
		'INFRA-PROV should cover the full tools and infrastructure lifecycle'
	);
	assert.equal(clauses.length >= 20, true, 'INFRA-PROV should have a deep clause set');
	assert.deepEqual(
		new Set(clauses.map((clause) => clause.type)),
		new Set(['principle', 'rule', 'guidance', 'conduct'])
	);

	for (const expectedSection of [
		'Tools and infrastructure operating model',
		'Tool evaluation, procurement and adoption',
		'Access, identity and permission management',
		'Integration, automation and workflow reliability',
		'Support, service health and incident response',
		'Security, compliance and resilience',
		'Lifecycle review, retirement and improvement',
	]) {
		assert.equal(
			infrastructure.sections.some((section) => section.title === expectedSection),
			true,
			`INFRA-PROV should include ${expectedSection}`
		);
	}

	assert.equal(
		infrastructure.glossary.some((item) => item.term === 'Tool owner'),
		true,
		'INFRA-PROV should define tools and infrastructure-specific terms'
	);
	assert.equal(
		infrastructure.changeHistory.some((item) =>
			item.summary.includes('end-to-end tools and infrastructure lifecycle')
		),
		true,
		'INFRA-PROV should record its lifecycle expansion in change history'
	);
});

test('sourcebook has sourcebook-specific quality gates and ReOps attribution', () => {
	assert.equal(sourcebook.qualityGates.length >= 5, true);
	assert.equal(
		sourcebook.qualityGates.some(
			(gate) => gate.id === 'SB-QG-005' && gate.rule.includes('REC-ADMN')
		),
		true
	);

	assert.equal(
		sourcebook.attribution.some(
			(item) =>
				item.name === 'ResearchOps Community' &&
				item.licence === 'Creative Commons Attribution-ShareAlike 4.0 International'
		),
		true
	);

	assert.equal(
		sourcebook.attribution.some(
			(item) => item.name === 'researchops/consentform' && item.licence === 'MIT License'
		),
		true
	);
});

test('sourcebook includes the Pace Layers Matrix adoption method', () => {
	const method = sourcebook.adoptionMethod;
	assert.equal(method.id, 'SB-AM-001');
	assert.equal(method.title, 'Pace Layers Matrix');
	assert.equal(method.source, 'researchops/pace_layers_matrix');
	assert.deepEqual(method.relatedTemplates, ['TPL-PACE-LAYERS-MATRIX']);
	assert.equal(method.steps.length >= 5, true);
	assert.equal(method.layers.length, 5);

	const coveredPillars = new Set(method.layers.flatMap((layer) => layer.pillarCodes));
	for (const pillar of sourcebook.pillars) {
		assert.equal(
			coveredPillars.has(pillar.code),
			true,
			`${pillar.code} should be covered by the adoption method`
		);
	}
});

test('sourcebook positions itself as the formal codification layer', () => {
	const positioning = sourcebook.positioning;
	assert.equal(positioning.id, 'SB-POS-001');
	assert.equal(positioning.title, 'Formal codification layer');
	assert.equal(
		positioning.summary.includes('formal layer on top of existing ReOps community assets'),
		true
	);
	assert.equal(positioning.foundation.includes('8 pillars of ResearchOps'), true);
	assert.equal(positioning.foundation.includes('templates and reusable artefacts'), true);
	assert.equal(positioning.foundation.includes('maturity and capability approaches'), true);
	assert.equal(positioning.sourcebookContribution.includes('stable provision identifiers'), true);
	assert.equal(
		positioning.sourcebookContribution.includes('rule, principle, guidance and conduct types'),
		true
	);
	assert.equal(positioning.sourcebookContribution.includes('evidence expectations'), true);
	assert.equal(
		positioning.sourcebookContribution.includes('change history and metadata continuity'),
		true
	);
});

test('sourcebook includes the consent and privacy operating pattern', () => {
	const pattern = sourcebook.operatingPatterns.find((item) => item.id === 'SB-OP-001');
	assert.ok(pattern, 'Consent and privacy operating pattern should exist');
	assert.equal(pattern.title, 'Consent and privacy statement generator');
	assert.equal(pattern.source, 'researchops/consentform');
	assert.deepEqual(pattern.relatedPillars, ['GOVERN', 'REC-ADMN', 'DATA-STO-ACC']);
	assert.deepEqual(pattern.relatedTemplates, ['TPL-CONSENT-PRIVACY-STATEMENT']);
	assert.equal(pattern.minimumQuestions.length >= 5, true);
	assert.equal(
		pattern.operatingIntent.includes('faster without weakening human accountability'),
		true
	);
});

test('GOV.UK renderer exposes sourcebook routes for the index and every pillar', () => {
	const outputs = new Set(govukPages.map((page) => normalize(resolve(page.output))));

	assert.equal(outputs.has(normalize(resolve('public/pages/sourcebook/index.html'))), true);

	for (const pillar of sourcebook.pillars) {
		assert.equal(
			outputs.has(normalize(resolve(`public/pages/sourcebook/${pillar.slug}/index.html`))),
			true,
			`${pillar.code} should have a generated GOV.UK page`
		);
	}
});

test('rendered sourcebook pages keep Dublin Core, RDFa and SKOS metadata', () => {
	const index = fs.readFileSync('public/pages/sourcebook/index.html', 'utf8');
	const recAdmn = fs.readFileSync(
		'public/pages/sourcebook/recruitment-and-administration/index.html',
		'utf8'
	);
	const environment = fs.readFileSync('public/pages/sourcebook/environment/index.html', 'utf8');
	const scope = fs.readFileSync('public/pages/sourcebook/scope/index.html', 'utf8');
	const people = fs.readFileSync('public/pages/sourcebook/people/index.html', 'utf8');
	const organisationalContext = fs.readFileSync(
		'public/pages/sourcebook/organisational-context/index.html',
		'utf8'
	);
	const dataKnowledge = fs.readFileSync(
		'public/pages/sourcebook/data-and-knowledge-management/index.html',
		'utf8'
	);
	const governance = fs.readFileSync('public/pages/sourcebook/governance/index.html', 'utf8');
	const infrastructure = fs.readFileSync(
		'public/pages/sourcebook/tools-and-infrastructure/index.html',
		'utf8'
	);

	for (const html of [
		index,
		recAdmn,
		environment,
		scope,
		people,
		organisationalContext,
		dataKnowledge,
		governance,
		infrastructure,
	]) {
		assert.equal(html.includes('property="dc:title"'), true);
		assert.equal(html.includes('property="dc:description"'), true);
		assert.equal(html.includes('typeof="skos:Concept'), true);
		assert.equal(html.includes('property="skos:notation"'), true);
	}

	assert.equal(index.includes('The 8 pillars'), true);
	assert.equal(index.includes('Formal codification layer'), true);
	assert.equal(index.includes('Community foundation'), true);
	assert.equal(index.includes('Sourcebook contribution'), true);
	assert.equal(index.includes('stable provision identifiers'), true);
	assert.equal(index.includes('Pace Layers Matrix'), true);
	assert.equal(index.includes('How to prioritise sourcebook adoption'), true);
	assert.equal(index.includes('Purpose and strategic intent'), true);
	assert.equal(index.includes('Practice, support and habits'), true);
	assert.equal(index.includes('Operating patterns'), true);
	assert.equal(index.includes('Consent and privacy statement generator'), true);
	assert.equal(index.includes('researchops/consentform'), true);
	assert.equal(recAdmn.includes('REC-ADMN 6.1.3'), true);
	assert.equal(recAdmn.includes('Measure recruitment by quality and care, not only speed'), true);
	assert.equal(environment.includes('ENVIRO 7.1.3'), true);
	assert.equal(
		environment.includes('Good environments make research safer, fairer and easier to repeat'),
		true
	);
	assert.equal(scope.includes('SCOPE 7.1.3'), true);
	assert.equal(scope.includes('Good scope increases focus and trust'), true);
	assert.equal(people.includes('PEOP-COMM 7.1.3'), true);
	assert.equal(
		people.includes('Good people systems increase research quality and resilience'),
		true
	);
	assert.equal(organisationalContext.includes('ORG-CONT 7.1.3'), true);
	assert.equal(
		organisationalContext.includes('Good organisational context makes research usable'),
		true
	);
	assert.equal(dataKnowledge.includes('DATA-STO-ACC 7.1.3'), true);
	assert.equal(
		dataKnowledge.includes(
			'Good knowledge systems make evidence reusable without making it unsafe'
		),
		true
	);
	assert.equal(governance.includes('GOVERN 7.1.3'), true);
	assert.equal(governance.includes('Good governance should increase trust and pace'), true);
	assert.equal(infrastructure.includes('INFRA-PROV 7.1.3'), true);
	assert.equal(
		infrastructure.includes('Good infrastructure makes responsible research easier to run'),
		true
	);
});
