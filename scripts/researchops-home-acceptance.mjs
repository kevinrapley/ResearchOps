/* eslint-env node */

/**
 * @file scripts/researchops-home-acceptance.mjs
 * @summary Generate home-page acceptance criteria from the current ResearchOps home-page source.
 */

import fs from 'node:fs';

const HOME_PAGE_SOURCE = 'public/index.html';

const FALLBACK = {
	serviceName: 'ResearchOps Demo Suite',
	heading: 'ResearchOps Demo Suite',
	tagline: 'Objective orientated applied user research done well.',
	intro: 'Use ResearchOps to structure applied user research with operations, governance and accessibility baked in.',
	prototype: 'This is a ResearchOps prototype. Do not enter real participant personal data.',
	nav: ['Home', 'Start research project', 'Projects'],
	startTitle: 'Start by creating a research project',
	startText: [
		'A project gives you somewhere to hold studies, participants, sessions, notes, evidence, insights and recommendations.',
		'Create the project first. Later parts of the service become useful once the research work has somewhere to live.',
	],
	startAction: 'Start a research project',
	lifecycleTitle: 'How ResearchOps supports a research project',
	lifecycleText: [
		'ResearchOps follows the shape of a user research project. Start by creating a project. Then add studies, participants, sessions, notes, evidence, insights and recommendations as the work develops.',
		'This sequence is a mental model, not a set of first-visit shortcuts. It shows how the work becomes connected over time.',
	],
	stages: [
		['Step 1 of 8', 'Project', 'Define the research work, service phase, team context and objectives.'],
		['Step 2 of 8', 'Study', 'Plan a specific round of research within the project.'],
		['Step 3 of 8', 'Participants', 'Recruit and manage people taking part in the study.'],
		['Step 4 of 8', 'Sessions', 'Schedule and run research sessions.'],
		['Step 5 of 8', 'Notes', 'Capture observations and structured session notes.'],
		['Step 6 of 8', 'Evidence', 'Organise what was seen, heard or recorded.'],
		['Step 7 of 8', 'Insights', 'Analyse evidence into meaningful findings.'],
		['Step 8 of 8', 'Recommendations', 'Turn findings into decisions, actions and service improvements.'],
	],
	orientationTitle: 'What you can do after creating a project',
	orientationText:
		'These parts of ResearchOps are shown as orientation. They make more sense after a project record has been created.',
	cards: [
		[
			'Set clear research objectives',
			'Team alignment',
			'Available after project creation',
			'How might we overcome the impact of unclear objectives in user research?',
			'Use the project space to align stakeholder objectives with research, design and delivery work.',
		],
		[
			'Recruit participants for user research studies',
			'Recruitment',
			'Available after study planning',
			'How might we ensure that participant recruitment reflects the diversity and needs of the service’s real users?',
			'Plan recruitment so findings are not biased, exclusionary or weakly connected to the service’s real users.',
		],
		[
			'Turn research evidence into recommendations',
			'Evidence and analysis',
			'Available after sessions',
			'How might we keep evidence, insights and recommendations connected?',
			'Use structured notes and evidence trails to show how research findings lead to service decisions.',
		],
	],
	footer: '© 2026 Home Office Biometrics · ResearchOps v1.0.0',
};

const ENTITIES = {
	amp: '&',
	copy: '©',
	gt: '>',
	lt: '<',
	middot: '·',
	nbsp: ' ',
	quot: '"',
	rsquo: '’',
};

function readHomeHtml() {
	try {
		return fs.readFileSync(HOME_PAGE_SOURCE, 'utf8');
	} catch {
		return '';
	}
}

function decodeEntities(value = '') {
	return String(value).replace(/&(#\d+|#x[a-f0-9]+|[a-z]+);/gi, (entity, token) => {
		const key = token.toLowerCase();
		if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
		if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
		return ENTITIES[key] || entity;
	});
}

function text(value = '') {
	return decodeEntities(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function quote(value = '') {
	return String(value).replaceAll('"', '\\"');
}

function first(html = '', pattern, fallback = '') {
	const match = html.match(pattern);
	return match ? text(match[1]) : fallback;
}

function all(html = '', pattern) {
	return [...html.matchAll(pattern)].map((match) => text(match[1])).filter(Boolean);
}

function section(html = '', className = '') {
	const pattern = new RegExp(`<section\\b(?=[^>]*class=["'][^"']*\\b${className}\\b)[^>]*>([\\s\\S]*?)<\\/section>`, 'i');
	const match = html.match(pattern);
	return match ? match[0] : '';
}

function modelFromSource() {
	const html = readHomeHtml();
	if (!html) return FALLBACK;

	const intro = html.match(/<header\b(?=[^>]*class=["'][^"']*\bpage-intro\b)[^>]*>([\s\S]*?)<\/header>/i)?.[0] || '';
	const start = section(html, 'app-start-guidance');
	const lifecycle = section(html, 'app-lifecycle-map');
	const orientation = section(html, 'card-section');
	const nav = all(html, /<a\b(?=[^>]*class=["'][^"']*\bgovuk-service-navigation__link\b)[^>]*>([\s\S]*?)<\/a>/gi).filter(
		(label) => label !== FALLBACK.serviceName
	);
	const startText = all(start, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/gi);
	const lifecycleText = all(lifecycle, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/gi);
	const stages = [...lifecycle.matchAll(/<li\b[^>]*class=["'][^"']*\bapp-lifecycle-sequence__item\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)].map(
		(match) => {
			const item = match[1];
			return [
				first(item, /<p\b(?=[^>]*class=["'][^"']*\bapp-lifecycle-sequence__step\b)[^>]*>([\s\S]*?)<\/p>/i, 'Lifecycle step'),
				first(item, /<h3\b(?=[^>]*class=["'][^"']*\bapp-lifecycle-sequence__heading\b)[^>]*>([\s\S]*?)<\/h3>/i, 'Lifecycle stage'),
				first(item, /<p\b(?=[^>]*class=["'][^"']*\bapp-lifecycle-sequence__body\b)[^>]*>([\s\S]*?)<\/p>/i, 'ResearchOps activity at this stage.'),
			];
		}
	);
	const cards = [...orientation.matchAll(/<article\b(?=[^>]*class=["'][^"']*\bcard\b)[^>]*>([\s\S]*?)<\/article>/gi)].map(
		(match) => {
			const item = match[1];
			return [
				first(item, /<h3\b(?=[^>]*class=["'][^"']*\bcard__heading\b)[^>]*>([\s\S]*?)<\/h3>/i, 'ResearchOps task'),
				first(item, /<p\b(?=[^>]*class=["'][^"']*\beyebrow\b)[^>]*>([\s\S]*?)<\/p>/i, 'ResearchOps task'),
				first(item, /<p\b(?=[^>]*class=["'][^"']*\btag\b)[^>]*>([\s\S]*?)<\/p>/i, 'Available after project creation'),
				first(item, /<h4\b(?=[^>]*class=["'][^"']*\bcard__question\b)[^>]*>([\s\S]*?)<\/h4>/i, ''),
				first(item, /<p\b(?=[^>]*class=["'][^"']*\blede\b)[^>]*>([\s\S]*?)<\/p>/i, ''),
			];
		}
	);

	return {
		serviceName: first(html, /<title>([\s\S]*?)<\/title>/i, FALLBACK.serviceName),
		heading: first(html, /<h1\b(?=[^>]*id=["']home-title["'])[^>]*>([\s\S]*?)<\/h1>/i, FALLBACK.heading),
		tagline: first(intro, /<p\b(?=[^>]*class=["'][^"']*\blede\b)[^>]*>([\s\S]*?)<\/p>/i, FALLBACK.tagline),
		intro: first(intro, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/i, FALLBACK.intro),
		prototype: first(html, /<span\b(?=[^>]*class=["'][^"']*\bgovuk-phase-banner__text\b)[^>]*>([\s\S]*?)<\/span>/i, FALLBACK.prototype),
		nav: nav.length > 0 ? nav : FALLBACK.nav,
		startTitle: first(start, /<h2\b(?=[^>]*id=["']start-guidance-title["'])[^>]*>([\s\S]*?)<\/h2>/i, FALLBACK.startTitle),
		startText: startText.length > 0 ? startText : FALLBACK.startText,
		startAction: first(start, /<a\b(?=[^>]*class=["'][^"']*\bgovuk-button\b)[^>]*>([\s\S]*?)<\/a>/i, FALLBACK.startAction),
		lifecycleTitle: first(lifecycle, /<h2\b(?=[^>]*id=["']lifecycle-map-title["'])[^>]*>([\s\S]*?)<\/h2>/i, FALLBACK.lifecycleTitle),
		lifecycleText: lifecycleText.length > 0 ? lifecycleText : FALLBACK.lifecycleText,
		stages: stages.length > 0 ? stages : FALLBACK.stages,
		orientationTitle: first(orientation, /<h2\b(?=[^>]*id=["']card-section-title["'])[^>]*>([\s\S]*?)<\/h2>/i, FALLBACK.orientationTitle),
		orientationText: first(orientation, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-body\b)[^>]*>([\s\S]*?)<\/p>/i, FALLBACK.orientationText),
		cards: cards.length > 0 ? cards : FALLBACK.cards,
		footer: first(html, /<p\b(?=[^>]*class=["'][^"']*\bgovuk-footer__meta\b)[^>]*>([\s\S]*?)<\/p>/i, FALLBACK.footer),
	};
}

function rows(items = []) {
	return items.map((item) => `      | ${item.map((value) => quote(value)).join(' | ')} |`);
}

export function buildHomeAcceptanceCriteriaFromSource() {
	const model = modelFromSource();

	return [
		'Feature: Access the ResearchOps home page',
		'',
		'  As a user researcher',
		'  I want to access the ResearchOps home page',
		'  So that I can choose the right ResearchOps journey for my work',
		'',
		'  Background:',
		'    Given I am a user researcher',
		'    When I visit the ResearchOps home page',
		'',
		'  Scenario: View the ResearchOps service identity',
		`    Then I should see the service name "${quote(model.serviceName)}"`,
		`    And I should see the tagline "${quote(model.tagline)}"`,
		`    And I should see the page heading "${quote(model.heading)}"`,
		`    And I should see introductory text that says "${quote(model.intro)}"`,
		'',
		'  Scenario: Understand that the service is a prototype',
		'    Then I should see a prototype banner',
		`    And the banner should say "${quote(model.prototype)}"`,
		'',
		'  Scenario: Navigate using the primary navigation',
		'    Then I should see primary navigation links for:',
		...rows(model.nav.map((item) => [item])),
		'    And the "Home" navigation item should be shown as the current page',
		'',
		'  Scenario: Start with a research project',
		`    Then I should see guidance headed "${quote(model.startTitle)}"`,
		...model.startText.map((item) => `    And I should see text explaining that "${quote(item)}"`),
		`    And the primary call to action should be "${quote(model.startAction)}"`,
		'',
		'  Scenario: Move to project creation',
		`    Given I can see the "${quote(model.startAction)}" call to action`,
		`    When I select "${quote(model.startAction)}"`,
		'    Then I should be taken to the start research project service',
		'',
		'  Scenario: Understand the ResearchOps lifecycle',
		`    Then I should see a section called "${quote(model.lifecycleTitle)}"`,
		...model.lifecycleText.map((item) => `    And I should see text explaining that "${quote(item)}"`),
		'',
		'  Scenario: View the lifecycle sequence as a mental model',
		'    Then I should see the lifecycle stages in this order:',
		'      | Step | Stage | Purpose |',
		...rows(model.stages),
		'    And each stage should include a short explanation of what happens at that point',
		'',
		'  Scenario: Avoid misleading lifecycle links',
		'    Then lifecycle stages should be presented as orientation rather than as a menu',
		'    And later lifecycle stages should not be presented as first-visit shortcuts',
		'    And the page should make it clear that later work becomes useful after a project has been created',
		'',
		'  Scenario: Review later ResearchOps tasks',
		`    Then I should see a section called "${quote(model.orientationTitle)}"`,
		`    And I should see text explaining that "${quote(model.orientationText)}"`,
		'    And I should see orientation cards for:',
		'      | Task | Category | Availability |',
		...rows(model.cards.map(([title, category, availability]) => [title, category, availability])),
		'',
		...model.cards.flatMap(([title, , availability, question, description]) =>
			[
				`  Scenario: Understand the "${quote(title)}" task`,
				`    Given I can see the "${quote(title)}" orientation card`,
				`    Then I should see that it is "${quote(availability)}"`,
				question ? `    And I should see the question "${quote(question)}"` : null,
				description ? `    And I should see supporting text that says "${quote(description)}"` : null,
				'',
			].filter(Boolean)
		),
		'  Scenario: Use the lifecycle sequence on a mobile device',
		'    Given I am viewing the home page on a mobile device',
		'    Then the lifecycle sequence should remain readable',
		'    And the stages should appear in the correct order',
		'    And no content should require horizontal scrolling',
		'',
		'  Scenario: Access the home page using a keyboard',
		'    Given I am navigating with a keyboard',
		'    Then I should be able to move focus through the primary navigation links',
		`    And I should be able to move focus to "${quote(model.startAction)}"`,
		'    And I should be able to activate links, buttons and form controls without a mouse',
		'',
		'  Scenario: Understand the page structure with assistive technology',
		'    Then the page should have one clear main heading',
		'    And the start guidance section should have a meaningful heading',
		'    And the lifecycle should be marked up as an ordered sequence',
		'    And each lifecycle stage should expose its name and explanation in a logical reading order',
		'    And each orientation card should expose its title, supporting text and availability in a logical reading order',
		'',
		'  Scenario: View footer information',
		`    Then I should see the footer text "${quote(model.footer)}"`,
	].join('\n');
}
