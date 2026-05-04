/* eslint-env node */

/**
 * @file scripts/researchops-start-acceptance.mjs
 * @summary Generate start-page acceptance criteria from the current ResearchOps start-page source.
 */

import fs from 'node:fs';

const SOURCE = 'public/pages/start/index.html';
const ENTITIES = { amp: '&', copy: '©', lt: '<', gt: '>', middot: '·', nbsp: ' ', quot: '"', rsquo: '’' };
const VALIDATION_MESSAGES = {
	projectName: 'Enter a project name.',
	projectDescription: 'Enter a project description.',
	objectives: 'Enter at least one research objective.',
	userGroups: 'Enter at least one user group.',
};

function html() {
	try {
		return fs.readFileSync(SOURCE, 'utf8');
	} catch {
		return '';
	}
}

function decode(value = '') {
	return String(value).replace(/&(#\d+|#x[a-f0-9]+|[a-z]+);/gi, (entity, token) => {
		const key = token.toLowerCase();
		if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
		if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
		return ENTITIES[key] || entity;
	});
}

function text(value = '') {
	return decode(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function quote(value = '') {
	return String(value).replaceAll('"', '\\"');
}

function first(source = '', pattern, fallback = '') {
	const match = source.match(pattern);
	return match ? text(match[1]) : fallback;
}

function all(source = '', pattern) {
	return [...source.matchAll(pattern)].map(match => text(match[1])).filter(Boolean);
}

function byId(source = '', id = '') {
	const pattern = new RegExp(`<([a-z0-9-]+)\\b(?=[^>]*id=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
	return source.match(pattern)?.[0] || '';
}

function label(source = '', id = '', fallback = '') {
	return first(source, new RegExp(`<label\\b(?=[^>]*for=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/label>`, 'i'), fallback);
}

function hint(source = '', id = '', fallback = '') {
	return first(source, new RegExp(`<p\\b(?=[^>]*id=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/p>`, 'i'), fallback);
}

function step(source = '', id = '', fallback = []) {
	const section = byId(source, id);
	return [
		first(section, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-caption-l\b)[^>]*>([\s\S]*?)<\/p>/i, fallback[0]),
		first(section, /<h2\b[^>]*>([\s\S]*?)<\/h2>/i, fallback[1]),
		first(section, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/i, fallback[2]),
	];
}

function options(source = '', id = '', fallback = []) {
	const select = byId(source, id);
	const found = all(select, /<option\b[^>]*>([\s\S]*?)<\/option>/gi);
	return found.length ? found : fallback;
}

function rows(values = []) {
	return values.map(row => `      | ${row.map(item => quote(item)).join(' | ')} |`);
}

function model() {
	const source = html();
	const intro = source.match(/<header\b(?=[^>]*class=["'][^"']*\bpage-intro\b)[^>]*>([\s\S]*?)<\/header>/i)?.[0] || '';
	const nav = all(source, /<a\b(?=[^>]*class=["'][^"']*\bgovuk-service-navigation__link\b)[^>]*>([\s\S]*?)<\/a>/gi).filter(item => item !== 'ResearchOps Demo Suite');
	return {
		heading: first(source, /<h1\b(?=[^>]*id=["']start-title["'])[^>]*>([\s\S]*?)<\/h1>/i, 'Start a new research project'),
		lede: first(intro, /<p\b(?=[^>]*class=["'][^"']*\blede\b)[^>]*>([\s\S]*?)<\/p>/i, 'Define the project within a service phase and current status, then capture stakeholders and initial objectives.'),
		intro: first(intro, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/i, 'Use this guided process to create the project record that will later hold studies, participants, sessions, notes, evidence, insights and recommendations.'),
		prototype: first(source, /<span\b(?=[^>]*class=["'][^"']*\bgovuk-phase-banner__text\b)[^>]*>([\s\S]*?)<\/span>/i, 'This is a ResearchOps prototype. Do not enter real participant personal data.'),
		nav: nav.length ? nav : ['Home', 'Start research project', 'Projects'],
		steps: [
			step(source, 'step1', ['Step 1 of 4', 'Define the project', 'Give the project a name, description, service phase and current status.']),
			step(source, 'step2', ['Step 2 of 4', 'Add stakeholders, objectives and user groups', 'Add the people involved, what the research needs to learn and who the research should include.']),
			step(source, 'step3', ['Step 3 of 4', 'Add project ownership and notes', 'Add supplementary information about who owns the research and anything the team should know before the project is created.']),
			step(source, 'step4', ['Step 4 of 4', 'Check your answers before creating the project', 'Review the project setup before it is saved. You can go back to change anything that is missing or unclear.']),
		],
		projectFields: [
			[label(source, 'p_name', 'Project name'), hint(source, 'p_name_hint', 'Use a short name the research team and stakeholders will recognise.')],
			[label(source, 'p_desc', 'Description'), hint(source, 'p_desc_help', 'Write what you plan to research. Do not include participant personal data.')],
			[label(source, 'p_phase', 'Service phase'), 'No additional hint text.'],
			[label(source, 'p_status', 'Project status'), 'No additional hint text.'],
		],
		targetFields: [
			[label(source, 'p_stakeholders', 'Stakeholders'), hint(source, 'p_stakeholders_help', 'Enter one stakeholder per line using the format: name | role | work email.')],
			[label(source, 'p_objectives', 'Initial objectives'), hint(source, 'p_objectives_help', 'List at least one research objective.')],
			[label(source, 'p_usergroups', 'User groups'), hint(source, 'p_usergroups_help', 'Enter at least one user group as a comma-separated list.')],
		],
		ownershipFields: [
			[label(source, 'lead_name', 'Lead researcher'), 'No additional hint text.'],
			[label(source, 'lead_email', 'Researcher’s email'), hint(source, 'lead_email_hint', 'Use a work email address.')],
			[label(source, 'p_notes', 'Notes'), hint(source, 'p_notes_help', 'Add project notes that will help the team start the work.')],
		],
		phases: options(source, 'p_phase', ['Pre-Discovery', 'Discovery', 'Alpha', 'Beta', 'Live', 'Retired']),
		statuses: options(source, 'p_status', ['Goal setting & problem defining', 'Planning research', 'Conducting research', 'Synthesis & analysis', 'Shared & socialised research', 'Monitoring metrics']),
		descriptionAi: hint(source, 'ai-rewrite-help', 'This sends the description you entered to an AI service to suggest improvements. Do not include participant personal data.'),
		objectivesAi: hint(source, 'ai-objectives-help', 'This sends the objectives you entered to an AI service to suggest improvements. Do not include participant personal data.'),
		footer: first(source, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-footer__meta\b)[^>]*>([\s\S]*?)<\/p>/i, '© 2026 Home Office Biometrics · ResearchOps v1.0.0'),
	};
}

function fieldRows(fields = []) {
	return rows(fields.map(([field, guidance]) => [field, guidance || 'No additional hint text.']));
}

export function buildStartAcceptanceCriteriaFromSource() {
	const page = model();
	const reviewFields = [...page.projectFields, ...page.targetFields, ...page.ownershipFields].map(([field]) => [field]);
	return [
		'Feature: Start a new research project',
		'',
		'  As a user researcher',
		'  I want to define a research project with clear context, objectives and ownership',
		'  So that my team can start research work with shared intent and traceable setup information',
		'',
		'  Background:',
		'    Given I am a user researcher',
		'    When I visit the start research project service',
		'',
		'  Scenario: View the guided process identity',
		'    Then I should see the service name "ResearchOps Demo Suite"',
		`    And I should see the page heading "${quote(page.heading)}"`,
		`    And I should see introductory text that says "${quote(page.lede)}"`,
		`    And I should see supporting text that says "${quote(page.intro)}"`,
		'',
		'  Scenario: Understand that the service is a prototype',
		'    Then I should see a prototype banner',
		`    And the banner should say "${quote(page.prototype)}"`,
		'',
		'  Scenario: Navigate using the primary navigation',
		'    Then I should see primary navigation links for:',
		...rows(page.nav.map(item => [item])),
		'    And the "Start research project" navigation item should be shown as the current page',
		'',
		'  Scenario: Understand the steps in the guided process',
		'    Then I should be guided through these steps in order:',
		'      | Step | Heading | Purpose |',
		...rows(page.steps),
		'',
		'  Scenario: Define the project',
		`    Given I am on "${quote(page.steps[0][1])}"`,
		'    Then I should be asked for:',
		'      | Field | Guidance |',
		...fieldRows(page.projectFields),
		'    And I should be able to choose a service phase from:',
		...rows(page.phases.map(item => [item])),
		'    And I should be able to choose a project status from:',
		...rows(page.statuses.map(item => [item])),
		'',
		'  Scenario: Recover when required project definition fields are missing',
		`    Given I am on "${quote(page.steps[0][1])}"`,
		'    When I try to continue without a project name or description',
		'    Then I should see a GOV.UK error summary headed "There is a problem"',
		'    And the error summary should link to the fields that need attention',
		`    And I should see the error message "${quote(VALIDATION_MESSAGES.projectName)}"`,
		`    And I should see the error message "${quote(VALIDATION_MESSAGES.projectDescription)}"`,
		'    And each invalid field should expose its error message to assistive technology',
		'',
		'  Scenario: Use AI assistance for the project description deliberately',
		`    Given I have entered enough text in "${quote(page.projectFields[1][0])}"`,
		`    Then I should see AI disclosure text that says "${quote(page.descriptionAi)}"`,
		'    And AI rewrite should only run when I explicitly select "Try AI rewrite"',
		'',
		'  Scenario: Add stakeholders, objectives and user groups',
		`    Given I have completed "${quote(page.steps[0][1])}"`,
		`    When I continue to "${quote(page.steps[1][1])}"`,
		'    Then I should be asked for:',
		'      | Field | Guidance |',
		...fieldRows(page.targetFields),
		'',
		'  Scenario: Recover when required research framing fields are missing',
		`    Given I am on "${quote(page.steps[1][1])}"`,
		'    When I try to continue without objectives or user groups',
		'    Then I should see a GOV.UK error summary headed "There is a problem"',
		`    And the error summary should link to "${quote(page.targetFields[1][0])}"`,
		`    And the error summary should link to "${quote(page.targetFields[2][0])}"`,
		`    And I should see the error message "${quote(VALIDATION_MESSAGES.objectives)}"`,
		`    And I should see the error message "${quote(VALIDATION_MESSAGES.userGroups)}"`,
		'',
		'  Scenario: Use AI assistance for objectives deliberately',
		`    Given I have entered enough text in "${quote(page.targetFields[1][0])}"`,
		`    Then I should see AI disclosure text that says "${quote(page.objectivesAi)}"`,
		'    And AI rewrite should only run when I explicitly select "Try AI rewrite"',
		'',
		'  Scenario: Add project ownership and notes',
		`    Given I have completed "${quote(page.steps[1][1])}"`,
		`    When I continue to "${quote(page.steps[2][1])}"`,
		'    Then I should be asked for:',
		'      | Field | Guidance |',
		...fieldRows(page.ownershipFields),
		'',
		'  Scenario: Check answers before creating the project',
		`    Given I have completed "${quote(page.steps[2][1])}"`,
		`    When I continue to "${quote(page.steps[3][1])}"`,
		'    Then I should see a GOV.UK summary list containing:',
		...rows(reviewFields),
		'    And I should be able to go back and change any answer before creating the project',
		'',
		'  Scenario: Create the project',
		`    Given I have reviewed "${quote(page.steps[3][1])}"`,
		'    When I select "Create project"',
		'    Then the project should be submitted to ResearchOps',
		'    And I should be taken to the projects page when creation succeeds',
		'',
		'  Scenario: Recover from a project creation error',
		'    When project creation fails',
		'    Then I should see a GOV.UK error summary',
		'    And I should remain in the guided process so I can recover without losing my answers',
		'',
		'  Scenario: Complete the guided process using a keyboard',
		'    Given I am navigating with a keyboard',
		'    Then I should be able to move focus through each field and button in order',
		'    And I should be able to move forward and back through the steps without a mouse',
		'    And validation errors should move focus to the error summary',
		'',
		'  Scenario: Understand the guided process with assistive technology',
		'    Then the page should have one clear main heading',
		'    And each step should have a meaningful heading',
		'    And field labels, hints and error messages should be exposed in a logical reading order',
		'    And the check answers step should expose each answer as a summary list row',
		'',
		'  Scenario: Use the guided process on a mobile device',
		'    Then the fields, buttons, AI disclosure text and check answers list should remain readable',
		'    And no content should require horizontal scrolling',
		'',
		'  Scenario: View footer information',
		`    Then I should see the footer text "${quote(page.footer)}"`,
	].join('\n');
}
