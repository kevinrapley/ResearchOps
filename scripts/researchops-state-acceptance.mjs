/* eslint-env node */

/**
 * @file scripts/researchops-state-acceptance.mjs
 * @summary Build user-centred Gherkin acceptance criteria for ResearchOps visual walkthrough states.
 */

import { buildHomeAcceptanceCriteriaFromSource } from './researchops-home-acceptance.mjs';
import { buildStartAcceptanceCriteriaFromSource } from './researchops-start-acceptance.mjs';

const PAGE_STORIES = {
	home: {
		feature: 'Access the ResearchOps home page',
		context: 'ResearchOps home page',
		want: 'access the ResearchOps home page',
		so: 'I can choose the right ResearchOps journey for my work',
	},
	start: {
		feature: 'Start a new research project',
		context: 'start research project service',
		want: 'define a research project with clear context, objectives and ownership',
		so: 'my team can start research work with shared intent and traceable setup information',
	},
	projects: {
		feature: 'Review research projects',
		context: 'projects page',
		want: 'review existing research projects',
		so: 'I can find the right project and continue the right ResearchOps task',
	},
	'project-dashboard': {
		feature: 'Review a research project dashboard',
		context: 'project dashboard',
		want: 'review the status, evidence and next actions for a research project',
		so: 'I can coordinate research activity across the team',
	},
	outcomes: {
		feature: 'Manage project outcomes',
		context: 'project outcomes page',
		want: 'review findings, outputs and decisions for a project',
		so: 'I can keep research outcomes traceable to evidence and recommendations',
	},
	journals: {
		feature: 'Capture reflexive journal entries',
		context: 'project journals page',
		want: 'capture reflexive notes during a project',
		so: 'I can make assumptions, decisions and researcher influence visible',
	},
	study: {
		feature: 'Review study readiness',
		context: 'study overview page',
		want: 'review a study and its readiness controls',
		so: 'I can prepare research activity before sessions begin',
	},
	'study-guides': {
		feature: 'Manage discussion guides',
		context: 'discussion guides page',
		want: 'create, review and organise discussion guides for a study',
		so: 'sessions are run with consistent and purposeful research prompts',
	},
	'study-participants': {
		feature: 'Manage study participants',
		context: 'participants page',
		want: 'review and manage participants for a study',
		so: 'recruitment and session planning reflect the study needs',
	},
	'study-session': {
		feature: 'Run a research session',
		context: 'study session page',
		want: 'run a research session and capture notes',
		so: 'session evidence is recorded consistently and safely',
	},
	'study-consent-forms': {
		feature: 'Configure study consent forms',
		context: 'study consent forms page',
		want: 'configure the consent statements needed for a study',
		so: 'participants can give informed consent before research activity proceeds',
	},
	'study-participant-consent': {
		feature: 'Record participant consent',
		context: 'participant consent page',
		want: 'record and review participant consent for a study',
		so: 'research only proceeds where consent is clear, current and auditable',
	},
	search: {
		feature: 'Search ResearchOps evidence',
		context: 'search page',
		want: 'search across ResearchOps material',
		so: 'I can find relevant evidence, records and project information quickly',
	},
	notes: {
		feature: 'Capture research notes',
		context: 'notes page',
		want: 'capture and review research notes',
		so: 'evidence can be used later for synthesis and decisions',
	},
	consent: {
		feature: 'Review consent information',
		context: 'consent page',
		want: 'review consent information',
		so: 'I can understand what consent is needed before research activity continues',
	},
	sessions: {
		feature: 'Review research sessions',
		context: 'sessions page',
		want: 'review scheduled and completed research sessions',
		so: 'I can coordinate session delivery and follow-up activity',
	},
	synthesize: {
		feature: 'Synthesize research evidence',
		context: 'study synthesis page',
		want: 'group evidence and create traceable themes',
		so: 'insights and recommendations remain connected to source evidence',
	},
};

const SELECTOR_LABELS = {
	'#p_name': 'Project name',
	'#p_desc': 'Project description',
	'#p_phase': 'Service phase',
	'#p_status': 'Project status',
	'#p_stakeholders': 'Stakeholders',
	'#p_objectives': 'Research objectives',
	'#p_usergroups': 'User groups',
	'#lead_name': 'Lead researcher name',
	'#lead_email': 'Lead researcher email',
	'#p_notes': 'Project notes',
	'#next2': 'Continue to stakeholders, objectives and user groups',
	'#next3': 'Continue to project ownership and notes',
	'#next4': 'Continue to check your answers',
	'#finish': 'Create project',
	'#btn-obj-ai-rewrite': 'Improve objectives with AI',
	'#ai-objectives-tools:not(.hidden)': 'AI objectives support panel',
	'#step2': 'Stakeholders, objectives and user groups step',
	'#step3': 'Project ownership and notes step',
	'#step4': 'Check your answers step',
	'#cluster-label': 'Working cluster label',
	'#cluster-description': 'Working cluster description',
	'#create-cluster': 'Create working cluster grouping',
	'#target-cluster': 'Target working cluster grouping',
	'#add-selected-evidence': 'Add selected evidence to the working cluster grouping',
	'#theme-cluster': 'Working cluster grouping for the theme',
	'#theme-label': 'Theme label',
	'#theme-description': 'Theme description',
	'#create-theme': 'Create theme',
	'.theme-card .govuk-details__summary': 'theme traceability details',
};

function normaliseText(value = '') {
	return String(value).replace(/\s+/g, ' ').trim();
}

function truncateForGherkin(value = '', maxLength = 180) {
	const text = normaliseText(value);
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1)}…`;
}

function quoteGherkin(value = '') {
	return String(value).replaceAll('"', '\\"');
}

function lowerFirst(value = '') {
	const text = String(value || '').trim();
	if (!text) return text;
	return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function storyForPage(page = {}) {
	return (
		PAGE_STORIES[page.id] || {
			feature: `Use the ${page.title || 'ResearchOps'} page`,
			context: `${lowerFirst(page.title || 'ResearchOps')} page`,
			want: `use the ${lowerFirst(page.title || 'ResearchOps')} page`,
			so: 'I can continue the right ResearchOps task with confidence',
		}
	);
}

function labelForSelector(selector = '') {
	const raw = String(selector || '').trim();
	if (SELECTOR_LABELS[raw]) return SELECTOR_LABELS[raw];

	if (/^\[data-record-consent=/.test(raw)) return 'Record consent';
	if (/^\[data-cluster-id=/.test(raw)) return 'working cluster grouping';
	if (/^#evidence-/.test(raw)) return 'evidence item';
	if (raw.startsWith('#')) return raw.slice(1).replace(/[-_]+/g, ' ');

	return raw || 'the relevant control';
}

function valueForAction(action = {}) {
	return quoteGherkin(truncateForGherkin(action.value ?? action.text ?? ''));
}

function buildActionStep(action = {}, index = 0) {
	const keyword = index === 0 ? 'When' : 'And';
	const label = quoteGherkin(labelForSelector(action.selector));

	if (action.type === 'fill') {
		return `  ${keyword} I enter "${valueForAction(action)}" into the "${label}" field`;
	}

	if (action.type === 'select') {
		return `  ${keyword} I choose "${valueForAction(action)}" from the "${label}" field`;
	}

	if (action.type === 'click') {
		return `  ${keyword} I select "${label}"`;
	}

	if (action.type === 'check') {
		return `  ${keyword} I select the "${label}" checkbox`;
	}

	if (action.type === 'uncheck') {
		return `  ${keyword} I clear the "${label}" checkbox`;
	}

	if (action.type === 'press') {
		return `  ${keyword} I press "${quoteGherkin(action.key || '')}" while focused on "${label}"`;
	}

	if (action.type === 'waitForText') {
		return `  Then I should see "${quoteGherkin(truncateForGherkin(action.text))}"`;
	}

	if (action.type === 'waitForSelector') {
		return `  Then the "${label}" section should be available`;
	}

	return `  ${keyword} I continue until the interface is ready for the next ResearchOps action`;
}

function buildActionScenario(sourceActions = []) {
	const relevantActions = sourceActions.filter((action) => action.type !== 'wait');

	if (relevantActions.length === 0) {
		return [
			'Scenario: Use the default view',
			'  Then I should understand what ResearchOps task this page supports',
			'  And I should be able to choose an appropriate next action',
		];
	}

	return [
		'Scenario: Complete the interaction needed for this state',
		'  Given I am ready to work with this ResearchOps state',
		...relevantActions.map(buildActionStep),
		'  Then I should be able to continue the ResearchOps journey with confidence',
	];
}

export function buildStateAcceptanceGherkin(page = {}, state = {}, sourceState = null) {
	if (page.id === 'home') return buildHomeAcceptanceCriteriaFromSource();
	if (page.id === 'start') return buildStartAcceptanceCriteriaFromSource();

	const story = storyForPage(page);
	const statePurpose = state.description
		? truncateForGherkin(state.description, 220)
		: `the ${lowerFirst(state.title || 'current')} state`;
	const sourceActions = Array.isArray(sourceState?.actions) ? sourceState.actions : [];

	return [
		`Feature: ${story.feature}`,
		'',
		'  As a user researcher',
		`  I want to ${story.want}`,
		`  So that ${story.so}`,
		'',
		'  Background:',
		'    Given I am a user researcher',
		`    When I visit the ${story.context}`,
		'',
		'  Scenario: Understand the page purpose',
		`    Then I should see content that supports ${lowerFirst(page.description || story.want)}`,
		'    And I should understand what ResearchOps task I can complete from this page',
		'',
		`  Scenario: Work with the "${quoteGherkin(state.title || 'Default')}" state`,
		`    Given I am using the ${story.context}`,
		`    Then the interface should make it clear that this state is for ${lowerFirst(statePurpose)}`,
		'    And I should be given enough context to decide what to do next',
		'',
		...buildActionScenario(sourceActions).map((line) => `  ${line}`),
		'',
		'  Scenario: Use the state accessibly',
		'    Then the page should have one clear main heading',
		'    And headings, labels and controls should be exposed in a logical reading order',
		'    And I should be able to move through the available controls using a keyboard',
		'    And I should be able to activate links, buttons and form controls without a mouse',
	].join('\n');
}
