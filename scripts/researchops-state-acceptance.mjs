/* eslint-env node */

/**
 * @file scripts/researchops-state-acceptance.mjs
 * @summary Build user-centred Gherkin acceptance criteria for ResearchOps visual walkthrough states.
 */

const PAGE_STORIES = {
	home: {
		feature: 'Access the ResearchOps home page',
		context: 'ResearchOps home page',
		want: 'access the ResearchOps home page',
		so: 'I can choose the right ResearchOps journey for my work',
	},
	start: {
		feature: 'Define a research project',
		context: 'start research project service',
		want: 'define a research project with objectives, stakeholders and ownership',
		so: 'my team can start research work with shared context and traceable intent',
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
	'#next2': 'Continue to stakeholders and objectives',
	'#next3': 'Continue to lead researcher and notes',
	'#btn-obj-ai-rewrite': 'Improve objectives with AI',
	'#ai-objectives-tools:not(.hidden)': 'AI objectives support panel',
	'#step2': 'Stakeholders, objectives and user groups step',
	'#step3': 'Lead researcher and notes step',
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

function buildHomeAcceptanceCriteria() {
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
		'    Then I should see the service name "ResearchOps Demo Suite"',
		'    And I should see the tagline "Objective orientated applied user research done well."',
		'    And I should see the page heading "ResearchOps Demo Suite"',
		'    And I should see introductory text explaining that the service supports applied user research with operations, governance and accessibility baked in',
		'',
		'  Scenario: Understand that the service is a prototype',
		'    Then I should see a prototype banner',
		'    And the banner should warn me not to enter real participant personal data',
		'',
		'  Scenario: Navigate using the primary navigation',
		'    Then I should see primary navigation links for:',
		'      | Home                   |',
		'      | Start research project |',
		'      | Projects               |',
		'    And the "Home" navigation item should be shown as the current page',
		'',
		'  Scenario: View the available research journeys',
		'    Then I should see the section heading "Choose a journey to explore"',
		'    And I should see journey cards for:',
		'      | Journey title                                      | Category        |',
		'      | Start a new research project                       | Getting started |',
		'      | Set clear research objectives                      | Team alignment  |',
		'      | Recruit participants for user research studies     | Recruitment     |',
		'',
		'  Scenario: Start a new research project journey',
		'    Given I can see the "Start a new research project" journey card',
		'    Then I should see the question "How might we define the research project?"',
		'    And I should see a description explaining that the project will be defined with its service phase and project status before adding stakeholders and objectives',
		'    When I select "Go to start research project service"',
		'    Then I should be taken to the start research project service',
		'',
		'  Scenario: Open the research objectives journey',
		'    Given I can see the "Set clear research objectives" journey card',
		'    Then I should see the question "How might we overcome the impact of unclear objectives in user research?"',
		'    And I should see a description explaining that misaligned objectives can affect research, design and delivery teams',
		'    When I select "Go to objective definition service"',
		'    Then I should be taken to the objective definition service',
		'',
		'  Scenario: Open the participant recruitment journey',
		'    Given I can see the "Recruit participants for user research studies" journey card',
		'    Then I should see the question "How might we ensure that participant recruitment reflects the diversity and needs of the service\'s real users?"',
		'    And I should see a description explaining the risk of biased, exclusionary or ineffective findings when recruitment is poorly planned',
		'    When I select "Go to participant management service"',
		'    Then I should be taken to the participant management service',
		'',
		'  Scenario: Access the home page using a keyboard',
		'    Given I am navigating with a keyboard',
		'    Then I should be able to move focus through the primary navigation links',
		'    And I should be able to move focus through each journey call-to-action',
		'    And I should be able to activate each link using the keyboard',
		'',
		'  Scenario: Understand the page structure with assistive technology',
		'    Then the page should have one clear main heading',
		'    And the journey section should have a meaningful heading',
		'    And each journey card should expose its title, supporting text and call-to-action in a logical reading order',
		'',
		'  Scenario: View footer information',
		'    Then I should see the footer text "© 2026 Home Office Biometrics · ResearchOps v1.0.0"',
	].join('\n');
}

export function buildStateAcceptanceGherkin(page = {}, state = {}, sourceState = null) {
	if (page.id === 'home') return buildHomeAcceptanceCriteria();

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
