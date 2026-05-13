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
	{ type: 'fill', selector: '#p_name', value: 'ResearchOps access review' },
	{ type: 'fill', selector: '#p_desc', value: 'Review the current ResearchOps access journey.' },
];

const stepTwoActions = [
	...projectDefinitionActions,
	{ type: 'click', selector: '#next2' },
	{ type: 'waitForSelector', selector: '#step2', state: 'visible' },
];

const stepTwoFilledActions = [
	...stepTwoActions,
	{ type: 'fill', selector: '#p_stakeholders', value: 'Team Admin | Platform owner | admin@example.gov.uk' },
	{ type: 'fill', selector: '#p_objectives', value: 'Check that the platform supports the required access journey.' },
	{ type: 'fill', selector: '#p_usergroups', value: 'Team Admins, researchers, approvers' },
];

const stepThreeActions = [
	...stepTwoFilledActions,
	{ type: 'click', selector: '#next3' },
	{ type: 'waitForSelector', selector: '#step3', state: 'visible' },
];

const stepThreeFilledActions = [
	...stepThreeActions,
	{ type: 'fill', selector: '#lead_name', value: 'Alex Morgan' },
	{ type: 'fill', selector: '#lead_email', value: 'alex.morgan@example.gov.uk' },
	{ type: 'fill', selector: '#p_notes', value: 'Initial setup check for ResearchOps access.' },
];

const checkAnswersActions = [
	...stepThreeFilledActions,
	{ type: 'click', selector: '#next4' },
	{ type: 'waitForSelector', selector: '#step4', state: 'visible' },
];

const accountSignInDefaultState = {
	id: 'default',
	title: 'Passwordless sign-in code request',
	description: 'Sign-in page captured before a one-time code is requested.',
	path: operationalPaths.accountSignIn,
	mockRoutes: [
		{
			url: /\/api\/me(?:\?.*)?$/,
			method: 'GET',
			status: 401,
			body: {
				ok: false,
				authenticated: false,
				error: 'not_authenticated',
				message: 'Sign in required.',
			},
		},
	],
	actions: [
		{
			type: 'waitForText',
			text: 'Use your work email address to continue',
		},
	],
};

function page({ id, title, group, path, description, designRisk, defaultState, states }) {
	return {
		id,
		title,
		group,
		path,
		description,
		designRisk,
		...(defaultState ? { defaultState } : {}),
		...(states ? { states } : {}),
	};
}

function registeredPage(id, title, group, path, description, designRisk) {
	return page({ id, title, group, path, description, designRisk });
}

function operationalPage({ id, title, group, path, description, designRisk, stateTitle, stateDescription, statePath, waitForText }) {
	return page({
		id,
		title,
		group,
		path,
		description,
		designRisk,
		defaultState: operationalDefaultState({
			title: stateTitle,
			description: stateDescription,
			path: statePath,
			waitForText,
		}),
	});
}

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
			contextOptions: { viewport: { width: 1440, height: 1200 } },
		},
		{
			id: 'mobile',
			title: 'Mobile',
			description: 'Mobile Chromium emulation, 412 × 915, touch enabled.',
			contextOptions: {
				viewport: { width: 412, height: 915 },
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
		registeredPage('home', 'Home', 'Core', '/', 'ResearchOps landing page.', operationalDesignRisks.home),
		page({
			id: 'account-sign-in',
			title: 'Sign in to ResearchOps',
			group: 'Account',
			path: '/pages/account/sign-in/index.html',
			description: 'First Team Admin sign-in and one-time code request page.',
			designRisk: operationalDesignRisks.accountSignIn,
			defaultState: accountSignInDefaultState,
		}),
		operationalPage({
			id: 'account-registration',
			title: 'Request a ResearchOps account',
			group: 'Account',
			path: '/pages/account/register/index.html',
			description: 'Public account request page for people who need ResearchOps access.',
			designRisk: operationalDesignRisks.accountRegistration,
			stateTitle: 'Account request form',
			stateDescription: 'Registration request page captured before answers are entered.',
			statePath: operationalPaths.accountRegistration,
			waitForText: 'Request a ResearchOps account',
		}),
		operationalPage({
			id: 'account-dashboard',
			title: 'Your ResearchOps account',
			group: 'Account',
			path: '/pages/account/index.html',
			description: 'Signed-in account dashboard showing active team, roles, permissions and actions.',
			designRisk: operationalDesignRisks.accountSignIn,
			stateTitle: 'Signed-in account dashboard',
			stateDescription: 'Account dashboard captured with deterministic Team Admin context.',
			statePath: '/pages/account/index.html',
			waitForText: 'Welcome, Team Admin. Here is your account dashboard',
		}),
		registeredPage(
			'start-overview',
			'Start a research project',
			'Core',
			'/pages/start/overview/index.html',
			'Overview page for creating a research project.',
			operationalDesignRisks.start
		),
		page({
			id: 'start',
			title: 'Start research project',
			group: 'Core',
			path: '/pages/start/index.html',
			description: 'Start page for creating or beginning research project work.',
			designRisk: operationalDesignRisks.start,
			states: [
				{ id: 'step-1-filled', title: 'Step 1 completed', description: 'Project definition entered.', actions: projectDefinitionActions },
				{ id: 'step-2-default', title: 'Step 2 default state', description: 'Second wizard step.', actions: stepTwoActions },
				{ id: 'step-2-filled-no-ai', title: 'Step 2 completed', description: 'Research context entered.', actions: stepTwoFilledActions },
				{
					id: 'step-2-ai-rewrite-shown',
					title: 'Step 2 AI rewrite shown',
					description: 'AI rewrite panel is shown using a deterministic mocked response.',
					mockRoutes: [
						{
							url: '**/api/ai-rewrite**',
							method: 'POST',
							body: {
								summary: 'The objective can be made clearer.',
								suggestions: [],
								rewrite: 'Check whether the access journey is clear.',
								flags: { possible_personal_data: false },
							},
						},
					],
					actions: [
						...stepTwoFilledActions,
						{ type: 'waitForSelector', selector: '#ai-objectives-tools:not(.hidden)' },
						{ type: 'click', selector: '#btn-obj-ai-rewrite' },
						{ type: 'waitForText', text: 'Concise rewrite (optional):' },
					],
				},
				{ id: 'step-3-default', title: 'Step 3 default state', description: 'Final data-entry step.', actions: stepThreeActions },
				{ id: 'step-3-filled', title: 'Step 3 completed', description: 'Owner details entered.', actions: stepThreeFilledActions },
				{ id: 'step-4-check-answers', title: 'Step 4 check your answers', description: 'Check-your-answers step.', actions: checkAnswersActions },
			],
		}),
		registeredPage('projects', 'Projects', 'Projects', '/pages/projects/index.html', 'Project list page.', operationalDesignRisks.projects),
		operationalPage({
			id: 'project-dashboard',
			title: 'Project dashboard',
			group: 'Projects',
			path: '/pages/project-dashboard/index.html',
			description: 'Project dashboard page.',
			designRisk: operationalDesignRisks.projectDashboard,
			stateTitle: 'Project dashboard with operational project context',
			stateDescription: 'Dashboard captured with a deterministic project ID.',
			statePath: operationalPaths.projectDashboard,
			waitForText: 'Assisted Digital Support Discovery',
		}),
		operationalPage({
			id: 'project-dashboard-add-study',
			title: 'Add study',
			group: 'Projects',
			path: '/pages/study/new/index.html',
			description: 'Create a study from the project dashboard action workflow.',
			designRisk: operationalDesignRisks.addStudy,
			stateTitle: 'Add study with parent project context',
			stateDescription: 'Add-study workflow captured with the parent project ID present.',
			statePath: operationalPaths.addStudy,
			waitForText: 'Add study',
		}),
		operationalPage({
			id: 'project-dashboard-add-participant',
			title: 'Add participant',
			group: 'Projects',
			path: '/pages/project-dashboard/participants/index.html',
			description: 'Add a study-linked participant from the project dashboard action workflow.',
			designRisk: operationalDesignRisks.addParticipant,
			stateTitle: 'Add participant with parent project context',
			stateDescription: 'Participant workflow captured with the project ID present.',
			statePath: operationalPaths.addParticipant,
			waitForText: 'Add participant',
		}),
		operationalPage({
			id: 'project-dashboard-import-participants',
			title: 'Import participants',
			group: 'Projects',
			path: '/pages/project-dashboard/participants/import/index.html',
			description: 'Import study-linked participants from CSV.',
			designRisk: operationalDesignRisks.importParticipants,
			stateTitle: 'Import participants with parent project context',
			stateDescription: 'CSV import workflow captured with the project ID present.',
			statePath: operationalPaths.importParticipants,
			waitForText: 'Import participants',
		}),
		operationalPage({
			id: 'outcomes',
			title: 'Project outcomes',
			group: 'Projects',
			path: '/pages/projects/outcomes/index.html',
			description: 'Outcomes page for project-level findings and outputs.',
			designRisk: operationalDesignRisks.outcomes,
			stateTitle: 'Project outcomes with project context',
			stateDescription: 'Outcomes page captured with a deterministic project ID.',
			statePath: operationalPaths.outcomes,
			waitForText: 'Impact & ROI',
		}),
		operationalPage({
			id: 'journals',
			title: 'Project journals',
			group: 'Projects',
			path: '/pages/projects/journals/index.html',
			description: 'Reflexive journal page.',
			designRisk: operationalDesignRisks.journals,
			stateTitle: 'Project journals with project context',
			stateDescription: 'Reflexive journal page captured with project context.',
			statePath: operationalPaths.journals,
			waitForText: 'Reflexive Journal & Analysis',
		}),
		operationalPage({
			id: 'study',
			title: 'Study overview',
			group: 'Study',
			path: '/pages/study/index.html',
			description: 'Study overview and readiness controls.',
			designRisk: operationalDesignRisks.study,
			stateTitle: 'Study overview with readiness context',
			stateDescription: 'Study overview captured with project and study IDs.',
			statePath: operationalPaths.study,
			waitForText: 'Assisted digital support interview round 1',
		}),
		operationalPage({
			id: 'study-guides',
			title: 'Discussion guides',
			group: 'Study',
			path: '/pages/study/guides/index.html',
			description: 'Discussion guide list and editor page.',
			designRisk: operationalDesignRisks.studyGuides,
			stateTitle: 'Discussion guides with study context',
			stateDescription: 'Discussion guides page captured with project and study IDs.',
			statePath: operationalPaths.studyGuides,
			waitForText: 'Guides for this study',
		}),
		operationalPage({
			id: 'study-participants',
			title: 'Participants',
			group: 'Study',
			path: '/pages/study/participants/index.html',
			description: 'Participants page for a study.',
			designRisk: operationalDesignRisks.studyParticipants,
			stateTitle: 'Study participants with participant records',
			stateDescription: 'Participants page captured with study-scoped participant records.',
			statePath: operationalPaths.studyParticipants,
			waitForText: 'Participants',
		}),
		operationalPage({
			id: 'study-session',
			title: 'Study session',
			group: 'Study',
			path: '/pages/study/session/index.html',
			description: 'Session running and note capture page.',
			designRisk: operationalDesignRisks.studySession,
			stateTitle: 'Study session with project and study context',
			stateDescription: 'Session workspace captured with project and study IDs.',
			statePath: operationalPaths.studySession,
			waitForText: 'Begin a session',
		}),
		operationalPage({
			id: 'study-consent-forms',
			title: 'Study consent forms',
			group: 'Study',
			path: '/pages/study/consent-forms/index.html',
			description: 'Study-specific consent form configuration page.',
			designRisk: operationalDesignRisks.studyConsentForms,
			stateTitle: 'Study consent forms with study context',
			stateDescription: 'Consent form configuration captured with project and study IDs.',
			statePath: operationalPaths.studyConsentForms,
			waitForText: 'Consent forms',
		}),
		page({
			id: 'study-participant-consent',
			title: 'Participant consent',
			group: 'Study',
			path: '/pages/study/participant-consent/index.html',
			description: 'Study-scoped participant consent recording and review page.',
			designRisk: operationalDesignRisks.participantConsent,
			defaultState: participantConsentDefaultState,
			states: participantConsentVisualStates,
		}),
		operationalPage({
			id: 'team-registration-requests',
			title: 'Review account requests',
			group: 'Team administration',
			path: '/pages/team/registration-requests/index.html',
			description: 'Team Admin review page for pending account registration requests.',
			designRisk: operationalDesignRisks.teamRegistrationRequests,
			stateTitle: 'Pending account requests',
			stateDescription: 'Registration request review page captured with a deterministic pending request.',
			statePath: operationalPaths.teamRegistrationRequests,
			waitForText: 'Pending account requests',
		}),
		operationalPage({
			id: 'team-role-assignments',
			title: 'Assign a role to a team member',
			group: 'Team administration',
			path: '/pages/team/role-assignments/index.html',
			description: 'Team Admin role assignment page.',
			designRisk: operationalDesignRisks.teamRoleAssignments,
			stateTitle: 'Role assignment form with Team Admin scope',
			stateDescription: 'Role assignment page captured with a deterministic Team Admin context.',
			statePath: operationalPaths.teamRoleAssignments,
			waitForText: 'You can assign roles in teams you manage',
		}),
		registeredPage('search', 'Search', 'Utilities', '/pages/search/index.html', 'Search page.', operationalDesignRisks.search),
		registeredPage('notes', 'Notes', 'Utilities', '/pages/notes/index.html', 'Notes page.', operationalDesignRisks.notes),
		registeredPage('consent', 'Consent', 'Utilities', '/pages/consent/index.html', 'Consent page.', operationalDesignRisks.consent),
		registeredPage('sessions', 'Sessions', 'Utilities', '/pages/sessions/index.html', 'Sessions list page.', operationalDesignRisks.sessions),
		registeredPage('synthesize', 'Synthesize', 'Analysis', '/pages/synthesize/index.html', 'Synthesis page.', operationalDesignRisks.synthesize),
	],
};

export default visualWalkthroughConfig;
