/* eslint-env node */

/**
 * @file scripts/researchops-projects-acceptance.mjs
 * @summary Generate Projects-page acceptance criteria from the current ResearchOps Projects-page source.
 */

import fs from 'node:fs';

const PAGE_SOURCE = 'public/pages/projects/index.html';
const CONTROLLER_SOURCE = 'public/js/projects-page.js';
const ENTITIES = { amp: '&', copy: '©', gt: '>', lt: '<', middot: '·', nbsp: ' ', quot: '"', rsquo: '’' };
const FALLBACK = {
	serviceName: 'ResearchOps Demo Suite',
	heading: 'Projects',
	lede: 'Review research projects created in ResearchOps.',
	intro: 'Open a project dashboard to manage studies, participants, sessions, notes, evidence, insights and recommendations.',
	prototype: 'This is a ResearchOps prototype. Do not enter real participant personal data.',
	nav: ['Home', 'Start research project', 'Projects'],
	primaryAction: 'Start a research project',
	listTitle: 'Research projects',
	listDescription: 'Projects are shown with the newest created project first.',
	loadingText: 'Loading projects.',
	noScriptTitle: 'Project records need JavaScript to load',
	noScriptText: 'You can still start a new research project from this page.',
	emptyTitle: 'No projects yet',
	emptyText: 'Create a research project to hold studies, participants, sessions, notes, evidence, insights and recommendations.',
	errorTitle: 'Could not load projects',
	errorText: 'Project records could not be loaded. Try again, or start a new project if you need to continue setting up research work.',
	cardFields: [
		'Project organisation',
		'Project title',
		'Phase',
		'Status',
		'Description',
		'View dashboard',
		'User groups',
		'Stakeholders and objectives',
	],
	footer: '© 2026 Home Office Biometrics · ResearchOps v1.0.0',
};

function readFile(filePath = '') {
	try {
		return fs.readFileSync(filePath, 'utf8');
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
	return [...source.matchAll(pattern)].map((match) => text(match[1])).filter(Boolean);
}

function section(source = '', className = '') {
	const pattern = new RegExp(`<section\\b(?=[^>]*class=["'][^"']*\\b${className}\\b)[^>]*>([\\s\\S]*?)<\\/section>`, 'i');
	const match = source.match(pattern);
	return match ? match[0] : '';
}

function byId(source = '', id = '') {
	const pattern = new RegExp(`<([a-z0-9-]+)\\b(?=[^>]*id=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
	return source.match(pattern)?.[0] || '';
}

function byClass(source = '', className = '') {
	const pattern = new RegExp(`<([a-z0-9-]+)\\b(?=[^>]*class=["'][^"']*\\b${className}\\b)[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
	return source.match(pattern)?.[0] || '';
}

function paragraphWithClass(className) {
	return new RegExp(
		`<p\\b(?=[^>]*class=["'][^"']*(?:^|\\s)${className}(?:\\s|["']))[^>]*>([\\s\\S]*?)<\\/p>`,
		'i'
	);
}

function rows(values = []) {
	return values.map((row) => `      | ${row.map((item) => quote(item)).join(' | ')} |`);
}

function model() {
	const source = readFile(PAGE_SOURCE);
	const controller = readFile(CONTROLLER_SOURCE);
	const intro = source.match(/<header\b(?=[^>]*class=["'][^"']*\bpage-intro\b)[^>]*>([\s\S]*?)<\/header>/i)?.[0] || '';
	const listSection = section(source, 'projects-list-section');
	const list = byId(source, 'list');
	const noScriptState = byClass(source, 'projects-empty-state');
	const nav = all(source, /<a\b(?=[^>]*class=["'][^"']*\bgovuk-service-navigation__link\b)[^>]*>([\s\S]*?)<\/a>/gi).filter(
		(item) => item !== FALLBACK.serviceName
	);

	return {
		serviceName: first(source, /<span\b(?=[^>]*class=["'][^"']*\bgovuk-header__product-name\b)[^>]*>([\s\S]*?)<\/span>/i, FALLBACK.serviceName),
		heading: first(source, /<h1\b(?=[^>]*id=["']projects-title["'])[^>]*>([\s\S]*?)<\/h1>/i, FALLBACK.heading),
		lede: first(intro, paragraphWithClass('govuk-body-l'), FALLBACK.lede),
		intro: first(intro, paragraphWithClass('govuk-body'), FALLBACK.intro),
		prototype: first(source, /<span\b(?=[^>]*class=["'][^"']*\bgovuk-phase-banner__text\b)[^>]*>([\s\S]*?)<\/span>/i, FALLBACK.prototype),
		nav: nav.length ? nav : FALLBACK.nav,
		primaryAction: first(intro, /<a\b(?=[^>]*class=["'][^"']*\bgovuk-button\b)[^>]*>([\s\S]*?)<\/a>/i, FALLBACK.primaryAction),
		listTitle: first(listSection, /<h2\b(?=[^>]*id=["']projects-list-title["'])[^>]*>([\s\S]*?)<\/h2>/i, FALLBACK.listTitle),
		listDescription: first(listSection, paragraphWithClass('govuk-body'), FALLBACK.listDescription),
		loadingText: first(list, paragraphWithClass('govuk-body-l'), FALLBACK.loadingText),
		noScriptTitle: first(noScriptState, /<h3\b[^>]*>([\s\S]*?)<\/h3>/i, FALLBACK.noScriptTitle),
		noScriptText: first(noScriptState, paragraphWithClass('govuk-body'), FALLBACK.noScriptText),
		emptyTitle: first(controller, /<h3\b(?=[^>]*class=\"govuk-heading-m\")[^>]*>(No projects yet)<\/h3>/i, FALLBACK.emptyTitle),
		emptyText: first(controller, /<p\b(?=[^>]*class=\"govuk-body\")[^>]*>(Create a research project[\s\S]*?)<\/p>/i, FALLBACK.emptyText),
		errorTitle: first(controller, /<h3\b(?=[^>]*class=\"govuk-heading-m\")[^>]*>(Could not load projects)<\/h3>/i, FALLBACK.errorTitle),
		errorText: first(controller, /<p\b(?=[^>]*class=\"govuk-body\")[^>]*>(Project records could not be loaded[\s\S]*?)<\/p>/i, FALLBACK.errorText),
		cardFields: FALLBACK.cardFields,
		footer: first(source, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-footer__meta\b)[^>]*>([\s\S]*?)<\/p>/i, FALLBACK.footer),
	};
}

export function buildProjectsAcceptanceCriteriaFromSource() {
	const page = model();

	return [
		'Feature: Review research projects',
		'',
		'  As a user researcher',
		'  I want to review existing research projects',
		'  So that I can find the right project and continue the right ResearchOps task',
		'',
		'  Background:',
		'    Given I am a user researcher',
		'    When I visit the projects page',
		'',
		'  Scenario: View the Projects page identity',
		`    Then I should see the service name "${quote(page.serviceName)}"`,
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
		...rows(page.nav.map((item) => [item])),
		'    And the "Projects" navigation item should be shown as the current page',
		'',
		'  Scenario: Start a new project from the Projects page',
		`    Then I should see the primary action "${quote(page.primaryAction)}"`,
		`    When I select "${quote(page.primaryAction)}"`,
		'    Then I should be taken to the start research project service',
		'',
		'  Scenario: Understand the project list',
		`    Then I should see a section called "${quote(page.listTitle)}"`,
		`    And I should see text explaining that "${quote(page.listDescription)}"`,
		`    And I should see loading text that says "${quote(page.loadingText)}" until project records are ready`,
		'    And project records should be presented newest first when they load',
		'',
		'  Scenario: Review loaded project records',
		'    When project records load successfully',
		'    Then each project card should expose:',
		...rows(page.cardFields.map((item) => [item])),
		'    And each project card should provide a dashboard link for continuing work on that project',
		'',
		'  Scenario: Open a project dashboard',
		'    Given project records have loaded',
		'    When I select "View dashboard" for a project',
		'    Then I should be taken to that project dashboard',
		'    And the selected project should be identified by its project ID',
		'',
		'  Scenario: Recover when there are no projects yet',
		'    When no project records are available',
		`    Then I should see a status message headed "${quote(page.emptyTitle)}"`,
		`    And I should see text explaining that "${quote(page.emptyText)}"`,
		`    And I should be able to select "${quote(page.primaryAction)}"`,
		'',
		'  Scenario: Recover when project records cannot load',
		'    When project records cannot be loaded',
		`    Then I should see an alert headed "${quote(page.errorTitle)}"`,
		`    And I should see text explaining that "${quote(page.errorText)}"`,
		`    And I should be able to select "${quote(page.primaryAction)}" so I can continue setting up research work`,
		'',
		'  Scenario: Use the page without JavaScript',
		'    Given JavaScript is not available',
		`    Then I should see fallback guidance headed "${quote(page.noScriptTitle)}"`,
		`    And I should see text explaining that "${quote(page.noScriptText)}"`,
		`    And I should still be able to select "${quote(page.primaryAction)}"`,
		'',
		'  Scenario: Access the Projects page using a keyboard',
		'    Given I am navigating with a keyboard',
		'    Then I should be able to move focus to the main content',
		'    And I should be able to move focus through the primary navigation links',
		`    And I should be able to move focus to "${quote(page.primaryAction)}"`,
		'    And I should be able to activate project dashboard links without a mouse',
		'',
		'  Scenario: Understand the page structure with assistive technology',
		'    Then the page should have one clear main heading',
		`    And the project list should be labelled by "${quote(page.listTitle)}"`,
		'    And the project list should announce loading, empty and error-state changes politely or as an alert as appropriate',
		'    And the project list should expose when it is busy loading project records',
		'    And each project card should expose its heading, metadata, user groups, stakeholders and objectives in a logical reading order',
		'',
		'  Scenario: Use the Projects page on a mobile device',
		'    Then the page introduction, project list, project cards, empty state and error state should remain readable',
		'    And no content should require horizontal scrolling',
		'',
		'  Scenario: View footer information',
		`    Then I should see the footer text "${quote(page.footer)}"`,
	].join('\n');
}
