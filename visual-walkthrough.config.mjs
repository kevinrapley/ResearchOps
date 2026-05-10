/* eslint-env node */

import {
	operationalDefaultState,
	operationalDesignRisks,
	operationalPaths,
} from './visual-walkthrough.operational-fixtures.mjs';
import {
	participantConsentDefaultState,
	participantConsentVisualStates,
} from './visual-walkthrough.participant-consent-states.mjs';

/**
 * @file visual-walkthrough.config.mjs
 * @summary Registry of application pages and states captured by the visual walkthrough report.
 */

const projectDefinitionActions = [
	{
		type: 'fill',
		selector: '#p_name',
		value: 'Assisted Digital Support Discovery',
	},
	{
		type: 'fill',
		selector: '#p_desc',
		value:
			'This discovery examines how caseworkers and support staff help people who cannot complete a digital application without assistance. The research will focus on confidence, evidence expectations, safeguarding, accessibility and language support needs.',
	},
];

const stepTwoActions = [
	...projectDefinitionActions,
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

const stepTwoFilledActions = [
	...stepTwoActions,
	{
		type: 'fill',
		selector: '#p_stakeholders',
		value: [
			'Priya Shah | Service owner | priya.shah@example.gov.uk',
			'Mark Evans | Operations lead | mark.evans@example.gov.uk',
			'Amelia Brown | Policy adviser | amelia.brown@example.gov.uk',
		].join('\n'),
	},
	{
		type: 'fill',
		selector: '#p_objectives',
		value: [
			'Understand where users need assisted digital support before, during and after the application journey.',
			'Identify operational signals that help staff recognise accessibility, safeguarding, language support and confidence-related needs without collecting unnecessary personal data.',
			'Assess whether existing content and contact routes give users enough confidence to complete the service or seek support at the right time.',
		].join('\n'),
	},
	{
		type: 'fill',
		selector: '#p_usergroups',
		value:
			'Applicants with low digital confidence, support workers, caseworkers, users with accessibility needs, users who need language support',
	},
];

const stepThreeActions = [
	...stepTwoFilledActions,
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

const stepThreeFilledActions = [
	...stepThreeActions,
	{
		type: 'fill',
		selector: '#lead_name',
		value: 'Alex Morgan',
	},
	{
		type: 'fill',
		selector: '#lead_email',
		value: 'alex.morgan@example.gov.uk',
	},
	{
		type: 'fill',
		selector: '#p_notes',
		value:
			'Initial recruitment should include users with different levels of digital confidence and staff who handle assisted digital requests.',
	},
];

const checkAnswersActions = [
	...stepThreeFilledActions,
	{
		type: 'click',
		selector: '#next4',
	},
	{
		type: 'waitForSelector',
		selector: '#step4',
		state: 'visible',
	},
];

export const visualWalkthroughConfig = {
	title: 'ResearchOps application visual walkthrough',
	description:
		'Generated evidence of the current application build, covering registered pages and important interaction states.',
	publicRoot: 'public',
	profiles: [
		{
			id: 'desktop',
			title: 'Desktop',
			description: 'Desktop Chromium viewport, 1440 × 1200.',
			contextOptions: {
				viewport: {
					width: 1440,
					height: 1200,
				},
			},
		},
		{
			id: 'mobile',
			title: 'Mobile',
			description: 'Mobile Chromium emulation, 412 × 915, touch enabled.',
			contextOptions: {
				viewport: {
					width: 412,
					height: 915,
				},
				deviceScaleFactor: 2.625,
				hasTouch: true,
				isMobile: true,
				userAgent:
					'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
			},
		},
	],
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
			designRisk: operationalDesignRisks.home,
		},
		{
			id: 'start-overview',
			title: 'Start a research project',
			group: 'Core',
			path: '/pages/start/overview/index.html',
			description: 'Overview page for creating a research project.',
			designRisk: operationalDesignRisks.start,
		},
		{
			id: 'start',
			title: 'Start research project',
			group: 'Core',
			path: '/pages/start/index.html',
			description: 'Start page for creating or beginning research project work.',
			designRisk: operationalDesignRisks.start,
			states: [
				{
					id: 'step-1-filled',
					title: 'Step 1 completed with essential project definition',
					description:
						'Project name and description entered using believable discovery-stage dummy data, with phase and status set by default.',
					actions: projectDefinitionActions,
				},
				{
					id: 'step-2-default',
					title: 'Step 2 default state',
					description:
						'Second wizard step after a valid project name and description have been entered on step 1.',
					actions: stepTwoActions,
				},
				{
					id: 'step-2-filled-no-ai',
					title: 'Step 2 completed with researcher-authored context',
					description:
						'Stakeholders, objectives and user groups entered with realistic planning data before continuing to the next step.',
					actions: stepTwoFilledActions,
				},
				{
					id: 'step-2-ai-rewrite-shown',
					title: 'Step 2 AI rewrite shown',
					description:
						'Objectives meet the AI assistance threshold and the objectives AI rewrite panel is shown using a deterministic mocked response.',
					mockRoutes: [
						{
							url: '**/api/ai-rewrite**',
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
								],
								rewrite:
									'1. Understand where applicants lose confidence or need support during the application journey.\n2. Identify operational signals for accessibility, safeguarding and language support needs.\n3. Assess whether content and contact routes help users decide what to do next.',
								flags: {
									possible_personal_data: false,
								},
							},
						},
					],
					actions: [
						...stepTwoFilledActions,
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
						'Final data-entry step after the project definition, stakeholders, objectives and user groups have been entered.',
					actions: stepThreeActions,
				},
				{
					id: 'step-3-filled',
					title: 'Step 3 completed before check answers',
					description:
						'Lead researcher, email and project notes entered on the final data-entry step before the check-your-answers review.',
					actions: stepThreeFilledActions,
				},
				{
					id: 'step-4-check-answers',
					title: 'Step 4 check your answers before create project',
					description:
						'Check-your-answers step summarising the project definition, default phase and status, research framing, ownership and notes before project creation is submitted.',
					actions: checkAnswersActions,
				},
			],
		},
		{
			id: 'projects',
			title: 'Projects',
			group: 'Projects',
			path: '/pages/projects/index.html',
			description: 'Project list page.',
			designRisk: operationalDesignRisks.projects,
		},
		{
			id: 'project-dashboard',
			title: 'Project dashboard',
			group: 'Projects',
			path: '/pages/project-dashboard/index.html',
			description: 'Project dashboard page.',
			designRisk: operationalDesignRisks.projectDashboard,
			defaultState: operationalDefaultState({
				title: 'Project dashboard with operational project context',
				description:
					'Dashboard captured with a deterministic project ID, project metadata, linked stakeholders and study context.',
				path: operationalPaths.projectDashboard,
				waitForText: 'Assisted Digital Support Discovery',
			}),
		},
		{
			id: 'project-dashboard-add-study',
			title: 'Add study',
			group: 'Projects',
			path: '/pages/study/new/index.html',
			description: 'Create a study from the project dashboard action workflow.',
			designRisk: operationalDesignRisks.addStudy,
			defaultState: operationalDefaultState({
				title: 'Add study with parent project context',
				description:
					'Add-study workflow captured with the parent project ID present in the URL so project relationship and return routes can be reviewed.',
				path: operationalPaths.addStudy,
				waitForText: 'Add study',
			}),
		},
		{
			id: 'project-dashboard-add-participant',
			title: 'Add participant',
			group: 'Projects',
			path: '/pages/project-dashboard/participants/index.html',
			description: 'Add a study-linked participant from the project dashboard action workflow.',
			designRisk: operationalDesignRisks.addParticipant,
			defaultState: operationalDefaultState({
				title: 'Add participant with parent project context',
				description:
					'Participant workflow captured with the project ID present so privacy copy, project ownership and study-linking context can be evaluated.',
				path: operationalPaths.addParticipant,
				waitForText: 'Add participant',
			}),
		},
		{
			id: 'project-dashboard-import-participants',
			title: 'Import participants',
			group: 'Projects',
			path: '/pages/project-dashboard/participants/import/index.html',
			description:
				'Import study-linked participants from CSV from the project dashboard action workflow.',
			designRisk: operationalDesignRisks.importParticipants,
			defaultState: operationalDefaultState({
				title: 'Import participants with parent project context',
				description:
					'CSV import workflow captured with the project ID present so file-upload guidance, privacy warnings and bulk-error recovery can be reviewed.',
				path: operationalPaths.importParticipants,
				waitForText: 'Import participants',
			}),
		},
		{
			id: 'outcomes',
			title: 'Project outcomes',
			group: 'Projects',
			path: '/pages/projects/outcomes/index.html',
			description: 'Outcomes page for project-level findings and outputs.',
			designRisk: operationalDesignRisks.outcomes,
			defaultState: operationalDefaultState({
				title: 'Project outcomes with project context',
				description:
					'Outcomes page captured with a deterministic project ID so traceability from evidence to recommendations can be evaluated.',
				path: operationalPaths.outcomes,
				waitForText: 'Impact & ROI',
			}),
		},
		{
			id: 'journals',
			title: 'Project journals',
			group: 'Projects',
			path: '/pages/projects/journals/index.html',
			description: 'Reflexive journal page.',
			designRisk: operationalDesignRisks.journals,
			defaultState: operationalDefaultState({
				title: 'Project journals with project context',
				description:
					'Reflexive journal page captured with project context so assumptions, decisions and researcher influence can be reviewed against project work.',
				path: operationalPaths.journals,
				waitForText: 'Reflexive Journal & Analysis',
			}),
		},
		{
			id: 'study',
			title: 'Study overview',
			group: 'Study',
			path: '/pages/study/index.html',
			description: 'Study overview and readiness controls.',
			designRisk: operationalDesignRisks.study,
			defaultState: operationalDefaultState({
				title: 'Study overview with readiness context',
				description:
					'Study overview captured with project and study IDs, participants, guides, consent forms and consent records present.',
				path: operationalPaths.study,
				waitForText: 'Assisted digital support interview round 1',
			}),
		},
		{
			id: 'study-guides',
			title: 'Discussion guides',
			group: 'Study',
			path: '/pages/study/guides/index.html',
			description: 'Discussion guide list and editor page.',
			designRisk: operationalDesignRisks.studyGuides,
			defaultState: operationalDefaultState({
				title: 'Discussion guides with study context',
				description:
					'Discussion guides page captured with project and study IDs so list, editor and publication context can be reviewed.',
				path: operationalPaths.studyGuides,
				waitForText: 'Guides for this study',
			}),
		},
		{
			id: 'study-participants',
			title: 'Participants',
			group: 'Study',
			path: '/pages/study/participants/index.html',
			description: 'Participants page for a study.',
			designRisk: operationalDesignRisks.studyParticipants,
			defaultState: operationalDefaultState({
				title: 'Study participants with participant records',
				description:
					'Participants page captured with study-scoped participant records so recruitment, scheduling and consent readiness can be reviewed.',
				path: operationalPaths.studyParticipants,
				waitForText: 'Participants',
			}),
		},
		{
			id: 'study-session',
			title: 'Study session',
			group: 'Study',
			path: '/pages/study/session/index.html',
			description: 'Session running and note capture page.',
			designRisk: operationalDesignRisks.studySession,
			defaultState: operationalDefaultState({
				title: 'Study session with project and study context',
				description:
					'Session workspace captured with project and study IDs so participant, consent and note-capture readiness can be reviewed.',
				path: operationalPaths.studySession,
				waitForText: 'Begin a session',
			}),
		},
		{
			id: 'study-consent-forms',
			title: 'Study consent forms',
			group: 'Study',
			path: '/pages/study/consent-forms/index.html',
			description: 'Study-specific consent form configuration page.',
			designRisk: operationalDesignRisks.studyConsentForms,
			defaultState: operationalDefaultState({
				title: 'Study consent forms with study context',
				description:
					'Consent form configuration captured with project and study IDs so publishing state and consent wording can be reviewed.',
				path: operationalPaths.studyConsentForms,
				waitForText: 'Consent forms',
			}),
		},
		{
			id: 'study-participant-consent',
			title: 'Participant consent',
			group: 'Study',
			path: '/pages/study/participant-consent/index.html',
			description: 'Study-scoped participant consent recording and review page.',
			designRisk: operationalDesignRisks.participantConsent,
			defaultState: participantConsentDefaultState,
			states: participantConsentVisualStates,
		},
		{
			id: 'team-role-assignments',
			title: 'Assign a role to a team member',
			group: 'Team administration',
			path: '/pages/team/role-assignments/index.html',
			description: 'Team Admin role assignment page.',
			designRisk: operationalDesignRisks.teamRoleAssignments,
			defaultState: operationalDefaultState({
				title: 'Role assignment form with Team Admin scope',
				description:
					'Role assignment page captured with a deterministic Team Admin context so team scope, role.assign gating, role radios, duration choices, sensitive-role copy and audit-reason fields can be reviewed.',
				path: operationalPaths.teamRoleAssignments,
				waitForText: 'You are assigning roles in',
			}),
		},
		{
			id: 'search',
			title: 'Search',
			group: 'Utilities',
			path: '/pages/search/index.html',
			description: 'Search page.',
			designRisk: operationalDesignRisks.search,
		},
		{
			id: 'notes',
			title: 'Notes',
			group: 'Utilities',
			path: '/pages/notes/index.html',
			description: 'Notes page.',
			designRisk: operationalDesignRisks.notes,
		},
		{
			id: 'consent',
			title: 'Consent',
			group: 'Utilities',
			path: '/pages/consent/index.html',
			description: 'Consent page.',
			designRisk: operationalDesignRisks.consent,
		},
		{
			id: 'sessions',
			title: 'Sessions',
			group: 'Utilities',
			path: '/pages/sessions/index.html',
			description: 'Sessions list page.',
			designRisk: operationalDesignRisks.sessions,
		},
		{
			id: 'synthesize',
			title: 'Synthesize',
			group: 'Analysis',
			path: '/pages/synthesize/index.html',
			description: 'Synthesis page.',
			designRisk: operationalDesignRisks.synthesize,
		},
	],
};

export default visualWalkthroughConfig;
