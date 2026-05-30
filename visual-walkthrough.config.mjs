/* eslint-env node */

/**
 * @file visual-walkthrough.config.mjs
 * @summary Registry of application pages and states captured by the visual walkthrough report.
 */

const desktopProfile = {
	id: 'desktop',
	title: 'Desktop',
	description: 'Desktop Chromium viewport, 1440 × 1200.',
	contextOptions: { viewport: { width: 1440, height: 1200 } },
};

const mobileProfile = {
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
};

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

function registeredPage(id, title, group, path, description) {
	return { id, title, group, path, description };
}

function statefulPage(id, title, group, path, description, stateTitle, stateDescription, statePath, waitForText) {
	return {
		id,
		title,
		group,
		path,
		description,
		defaultState: {
			id: 'default',
			title: stateTitle,
			description: stateDescription,
			path: statePath,
			actions: waitForText ? [{ type: 'waitForText', text: waitForText }] : [],
		},
	};
}

const startPage = {
	id: 'start',
	title: 'Start research project',
	group: 'Core',
	path: '/pages/start/index.html',
	description: 'Start page for creating or beginning research project work.',
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
};

const teamRoleAssignmentsPage = {
	id: 'team-role-assignments',
	title: 'Assign a role to a team member',
	group: 'Team administration',
	path: '/pages/team/role-assignments/index.html',
	description: 'Team Admin role assignment page.',
	defaultState: {
		id: 'default',
		title: 'Role assignment form with Team Admin scope',
		description: 'Role assignment page captured with a deterministic Team Admin context.',
		path: '/pages/team/role-assignments/index.html',
		actions: [{ type: 'waitForText', text: 'You can assign roles in teams you manage' }],
	},
};

export const visualWalkthroughConfig = {
	title: 'ResearchOps application visual walkthrough',
	description: 'Generated evidence of the current application build, covering registered pages and important interaction states.',
	publicRoot: 'public',
	profiles: [desktopProfile, mobileProfile],
	excludedRoutes: [
		'/clear.html',
		'/pages/synthesize/index.html',
		'/partials/debug-boot.html',
		'/partials/debug.html',
		'/partials/footer.html',
		'/partials/header.html',
		'/partials/html-head.html',
		'/partials/project-tabs.html',
	],
	excludedRouteReasons: {
		'/clear.html': 'Utility page used for local storage/session reset; not a user-facing ResearchOps route.',
		'/pages/synthesize/index.html': 'Legacy synthesis redirect route. Canonical visual coverage is /pages/study/synthesis/index.html.',
		'/partials/debug-boot.html': 'Partial include only; rendered inside host pages when debugging is enabled.',
		'/partials/debug.html': 'Partial include only; not a standalone route.',
		'/partials/footer.html': 'Partial include only; not a standalone route.',
		'/partials/header.html': 'Partial include only; not a standalone route.',
		'/partials/html-head.html': 'Partial include only; not a standalone route.',
		'/partials/project-tabs.html': 'Partial include only; not a standalone route.',
	},
	pages: [
		registeredPage('home', 'Home', 'Core', '/', 'ResearchOps landing page.'),
		registeredPage('account-sign-in', 'Sign in to ResearchOps', 'Account', '/pages/account/sign-in/index.html', 'Sign-in and one-time code request page.'),
		statefulPage('account-registration', 'Request a ResearchOps account', 'Account', '/pages/account/register/index.html', 'Public account request page for people who need ResearchOps access.', 'Account request form', 'Registration request page captured before answers are entered.', '/pages/account/register/index.html', 'Request a ResearchOps account'),
		registeredPage('account-team-access', 'Request access to a team', 'Account', '/pages/account/team-access/index.html', 'Request-access form for signed-in users who need team access.'),
		statefulPage('account-dashboard', 'Your ResearchOps account', 'Account', '/pages/account/index.html', 'Signed-in account dashboard showing active team, roles, permissions and actions.', 'Signed-in account dashboard', 'Account dashboard captured with deterministic Team Admin context.', '/pages/account/index.html', 'Welcome, Team Admin. Here is your account dashboard'),
		registeredPage('start-overview', 'Start a research project', 'Core', '/pages/start/overview/index.html', 'Overview page for creating a research project.'),
		startPage,
		registeredPage('projects', 'Projects', 'Projects', '/pages/projects/index.html', 'Project list page.'),
		statefulPage('project-dashboard', 'Project dashboard', 'Projects', '/pages/project-dashboard/index.html', 'Project dashboard page.', 'Project dashboard with operational project context', 'Dashboard captured with a deterministic project ID.', '/pages/project-dashboard/index.html', 'Assisted Digital Support Discovery'),
		statefulPage('project-dashboard-add-study', 'Add study', 'Projects', '/pages/study/new/index.html', 'Create a study from the project dashboard action workflow.', 'Add study with parent project context', 'Add-study workflow captured with the parent project ID present.', '/pages/study/new/index.html', 'Add study'),
		statefulPage('project-dashboard-add-participant', 'Add participant', 'Projects', '/pages/project-dashboard/participants/index.html', 'Add a study-linked participant from the project dashboard action workflow.', 'Add participant with parent context', 'Participant workflow captured with the project ID present.', '/pages/project-dashboard/participants/index.html', 'Add participant'),
		statefulPage('project-dashboard-import-participants', 'Import participants', 'Projects', '/pages/project-dashboard/participants/import/index.html', 'Import study-linked participants from CSV.', 'Import participants with parent context', 'CSV import workflow captured with the project ID present.', '/pages/project-dashboard/participants/import/index.html', 'Import participants'),
		statefulPage('outcomes', 'Project outcomes', 'Projects', '/pages/projects/outcomes/index.html', 'Outcomes page for project-level findings and outputs.', 'Project outcomes with project context', 'Outcomes page captured with a deterministic project ID.', '/pages/projects/outcomes/index.html', 'Impact & ROI'),
		statefulPage('journals', 'Project journals', 'Projects', '/pages/projects/journals/index.html', 'Reflexive journal page.', 'Project journals with project context', 'Reflexive journal page captured with project context.', '/pages/projects/journals/index.html', 'Reflexive Journal & Analysis'),
		statefulPage('study', 'Study overview', 'Study', '/pages/study/index.html', 'Study overview and readiness controls.', 'Study overview with readiness context', 'Study overview captured with the canonical Study record ID.', '/pages/study/index.html', 'Assisted digital support interview round 1'),
		statefulPage('study-guides', 'Discussion guides', 'Study', '/pages/study/guides/index.html', 'Discussion guide list and editor page.', 'Discussion guides with study context', 'Discussion guides page captured with the canonical Study record ID.', '/pages/study/guides/index.html', 'Guides for this study'),
		statefulPage('study-participants', 'Participants', 'Study', '/pages/study/participants/index.html', 'Participants page for a study.', 'Study participants with records', 'Participants page captured with the canonical Study record ID.', '/pages/study/participants/index.html', 'Participants'),
		statefulPage('study-session', 'Study session', 'Study', '/pages/study/session/index.html', 'Session running and note capture page.', 'Study session with study context', 'Session workspace captured with the canonical Study record ID.', '/pages/study/session/index.html', 'Begin a session'),
		statefulPage('study-consent-forms', 'Study consent forms', 'Study', '/pages/study/consent-forms/index.html', 'Study-specific consent form configuration page.', 'Study consent forms with study context', 'Consent form configuration captured with the canonical Study record ID.', '/pages/study/consent-forms/index.html', 'Consent forms'),
		registeredPage('study-participant-consent', 'Participant consent', 'Study', '/pages/study/participant-consent/index.html', 'Study-scoped participant consent recording and review page.'),
		registeredPage('synthesize', 'Study synthesis', 'Study', '/pages/study/synthesis/index.html', 'Study-scoped evidence grouping and theme creation page.'),
		statefulPage('team-registration-requests', 'Review account requests', 'Team administration', '/pages/team/registration-requests/index.html', 'Team Admin review page for pending account registration requests.', 'Pending account requests', 'Registration request review page captured with a deterministic pending request.', '/pages/team/registration-requests/index.html', 'Pending account requests'),
		teamRoleAssignmentsPage,
		registeredPage('search', 'Search', 'Utilities', '/pages/search/index.html', 'Search page.'),
		registeredPage('notes', 'Notes', 'Utilities', '/pages/notes/index.html', 'Notes page.'),
		registeredPage('consent', 'Consent', 'Utilities', '/pages/consent/index.html', 'Consent page.'),
		registeredPage('sessions', 'Sessions', 'Utilities', '/pages/sessions/index.html', 'Sessions list page.'),
	],
};

export default visualWalkthroughConfig;
