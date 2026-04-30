/* eslint-env node */

/**
 * @file visual-walkthrough.config.mjs
 * @summary Registry of application pages and states captured by the visual walkthrough report.
 */

const startWizardProjectName = 'Assisted Digital Support Discovery';
const startWizardProjectDescription =
	'This discovery will examine how caseworkers and support staff help people who cannot complete a digital application without assistance. The research will focus on where users lose confidence, what information they need before starting, and how staff currently identify safeguarding, accessibility and language support needs.';
const startWizardStakeholders = [
	'Priya Shah | Service owner | priya.shah@example.gov.uk',
	'Mark Evans | Operations lead | mark.evans@example.gov.uk',
	'Amelia Brown | Policy adviser | amelia.brown@example.gov.uk',
].join('\n');
const startWizardObjectives = [
	'Understand where users need assisted digital support during the application journey, including before they start, while completing evidence tasks, and after submission.',
	'Identify the operational signals that help staff recognise accessibility, safeguarding, language and confidence-related needs without collecting unnecessary personal data.',
	'Assess whether existing content and contact routes give users enough confidence to complete the service or seek support at the right time.',
].join('\n');
const startWizardUserGroups =
	'Applicants with low digital confidence, support workers, caseworkers, users with accessibility needs, users who need language support';
const startWizardLeadName = 'Alex Morgan';
const startWizardLeadEmail = 'alex.morgan@example.gov.uk';
const startWizardNotes =
	'Initial recruitment should include users with different levels of digital confidence and staff who handle assisted digital requests. The team should review safeguarding and consent wording before moderated sessions begin.';

const startWizardStepOneActions = [
	{
		type: 'fill',
		selector: '#p_name',
		value: startWizardProjectName,
	},
	{
		type: 'fill',
		selector: '#p_desc',
		value: startWizardProjectDescription,
	},
	{
		type: 'select',
		selector: '#p_phase',
		value: 'discovery',
	},
	{
		type: 'select',
		selector: '#p_status',
		value: 'planning',
	},
];

const startWizardStepTwoActions = [
	...startWizardStepOneActions,
	{
		type: 'click',
		selector: '#next2',
	},
	{
		type: 'waitForSelector',
		selector: '#step2',
		state: 'visible',
	},
];

const startWizardStepTwoFilledActions = [
	...startWizardStepTwoActions,
	{
		type: 'fill',
		selector: '#p_stakeholders',
		value: startWizardStakeholders,
	},
	{
		type: 'fill',
		selector: '#p_objectives',
		value: startWizardObjectives,
	},
	{
		type: 'fill',
		selector: '#p_usergroups',
		value: startWizardUserGroups,
	},
];

const startWizardStepThreeActions = [
	...startWizardStepTwoFilledActions,
	{
		type: 'click',
		selector: '#next3',
	},
	{
		type: 'waitForSelector',
		selector: '#step3',
		state: 'visible',
	},
];

export const visualWalkthroughConfig = {
	title: 'ResearchOps application visual walkthrough',
	description:
		'Generated evidence of the current application build, covering registered pages and important interaction states.',
	publicRoot: 'public',
	excludedRoutes: [
		'/clear.html',
		'/partials/debug-boot.html',
		'/partials/debug.html',
		'/partials/footer.html',
		'/partials/header.html',
		'/partials/html-head.html',
		'/partials/project-tabs.html',
	],
	pages: [
		{
			id: 'home',
			title: 'Home',
			group: 'Core',
			path: '/',
			description: 'ResearchOps landing page.',
		},
		{
			id: 'start',
			title: 'Start research project',
			group: 'Core',
			path: '/pages/start/index.html',
			description: 'Start page for creating or beginning research project work.',
			states: [
				{
					id: 'step-1-filled',
					title: 'Step 1 completed with project definition',
					description:
						'Project name, description, phase and status entered using believable discovery-stage dummy data.',
					actions: startWizardStepOneActions,
				},
				{
					id: 'step-2-default',
					title: 'Step 2 default state',
					description:
						'Second wizard step after a valid project definition has been entered on step 1.',
					actions: startWizardStepTwoActions,
				},
				{
					id: 'step-2-filled-no-ai',
					title: 'Step 2 completed without AI rewrite invoked',
					description:
						'Stakeholders, objectives and user groups entered with realistic planning data before the AI rewrite is requested.',
					actions: startWizardStepTwoFilledActions,
				},
				{
					id: 'step-2-ai-rewrite-shown',
					title: 'Step 2 AI rewrite shown',
					description:
						'Objectives meet the AI assistance threshold and the objectives AI rewrite panel is shown using a deterministic mocked response.',
					mockRoutes: [
						{
							url: '**/api/ai-rewrite?mode=objectives',
							method: 'POST',
							body: {
								summary:
									'The objectives are clear and researchable. They could be tightened by separating user confidence, operational triage and content assurance into distinct learning goals.',
								suggestions: [
									{
										category: 'Focus',
										severity: 'medium',
										tip: 'Make each objective test one decision or assumption.',
										why: 'This helps the team trace findings back to specific service decisions.',
									},
									{
										category: 'Inclusion',
										severity: 'high',
										tip: 'Include users with low digital confidence and users who need accessibility or language support.',
										why: 'Assisted digital services can otherwise optimise for confident users and miss support needs.',
									},
								],
								rewrite:
									'1. Understand where applicants lose confidence or need assisted digital support during the application journey.\n2. Identify operational signals that help staff recognise accessibility, safeguarding and language support needs without collecting unnecessary personal data.\n3. Assess whether content and contact routes help users decide what to do next and seek support at the right time.',
								flags: {
									possible_personal_data: false,
								},
							},
						},
					],
					actions: [
						...startWizardStepTwoFilledActions,
						{
							type: 'waitForSelector',
							selector: '#ai-objectives-tools:not(.hidden)',
						},
						{
							type: 'click',
							selector: '#btn-obj-ai-rewrite',
						},
						{
							type: 'waitForText',
							text: 'Concise rewrite (optional):',
						},
					],
				},
				{
					id: 'step-3-default',
					title: 'Step 3 default state',
					description:
						'Final wizard step after the project definition, stakeholders, objectives and user groups have been entered.',
					actions: startWizardStepThreeActions,
				},
				{
					id: 'step-3-filled',
					title: 'Step 3 completed before create project',
					description:
						'Lead researcher, email and project notes entered on the final wizard step before project creation is submitted.',
					actions: [
						...startWizardStepThreeActions,
						{
							type: 'fill',
							selector: '#lead_name',
							value: startWizardLeadName,
						},
						{
							type: 'fill',
							selector: '#lead_email',
							value: startWizardLeadEmail,
						},
						{
							type: 'fill',
							selector: '#p_notes',
							value: startWizardNotes,
						},
					],
				},
			],
		},
		{
			id: 'projects',
			title: 'Projects',
			group: 'Projects',
			path: '/pages/projects/index.html',
			description: 'Project list page.',
		},
		{
			id: 'project-dashboard',
			title: 'Project dashboard',
			group: 'Projects',
			path: '/pages/project-dashboard/index.html',
			description: 'Project dashboard page.',
		},
		{
			id: 'outcomes',
			title: 'Project outcomes',
			group: 'Projects',
			path: '/pages/projects/outcomes/index.html',
			description: 'Outcomes page for project-level findings and outputs.',
		},
		{
			id: 'journals',
			title: 'Project journals',
			group: 'Projects',
			path: '/pages/projects/journals/index.html',
			description: 'Reflexive journal page.',
		},
		{
			id: 'study',
			title: 'Study overview',
			group: 'Study',
			path: '/pages/study/index.html',
			description: 'Study overview and readiness controls.',
		},
		{
			id: 'study-guides',
			title: 'Discussion guides',
			group: 'Study',
			path: '/pages/study/guides/index.html',
			description: 'Discussion guide list and editor page.',
		},
		{
			id: 'study-participants',
			title: 'Participants',
			group: 'Study',
			path: '/pages/study/participants/index.html',
			description: 'Participants page for a study.',
		},
		{
			id: 'study-session',
			title: 'Study session',
			group: 'Study',
			path: '/pages/study/session/index.html',
			description: 'Session running and note capture page.',
		},
		{
			id: 'study-consent-forms',
			title: 'Study consent forms',
			group: 'Study',
			path: '/pages/study/consent-forms/index.html',
			description: 'Study-specific consent form configuration page.',
		},
		{
			id: 'search',
			title: 'Search',
			group: 'Utilities',
			path: '/pages/search/index.html',
			description: 'Search page.',
		},
		{
			id: 'notes',
			title: 'Notes',
			group: 'Utilities',
			path: '/pages/notes/index.html',
			description: 'Notes page.',
		},
		{
			id: 'consent',
			title: 'Consent',
			group: 'Utilities',
			path: '/pages/consent/index.html',
			description: 'Consent page.',
		},
		{
			id: 'sessions',
			title: 'Sessions',
			group: 'Utilities',
			path: '/pages/sessions/index.html',
			description: 'Sessions list page.',
		},
		{
			id: 'synthesize',
			title: 'Synthesize',
			group: 'Analysis',
			path: '/pages/synthesize/index.html',
			description: 'Synthesis page.',
		},
	],
};

export default visualWalkthroughConfig;
