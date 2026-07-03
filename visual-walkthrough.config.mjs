/* eslint-env node */

/**
 * @file visual-walkthrough.config.mjs
 * @summary Registry of application pages and states captured by the visual walkthrough report.
 */

import { SIGN_IN_EMAIL, signInMockRoutes } from './scripts/walkthrough-playwright.mjs';
import { incidentResponseEvidencePages } from './src/govuk/data/compliance-readiness.mjs';
import { repositoryStaticPages } from './src/govuk/data/repository-page.mjs';
import { sourcebookIndex, sourcebookPillarPages } from './src/govuk/data/sourcebook.mjs';
import { operationalPaths } from './visual-walkthrough.operational-fixtures.mjs';

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
				{ type: 'waitForSelector', selector: '#apply-ai-obj-rewrite' },
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

const addStudyPage = {
	...statefulPage(
		'project-dashboard-add-study',
		'Add study',
		'Projects',
		'/pages/study/new/index.html',
		'Create a study from the project dashboard action workflow.',
		'Add study with parent project context',
		'Add-study workflow captured with the parent project ID present.',
		operationalPaths.addStudy,
		'Assisted Digital Support Discovery'
	),
	states: [
		{
			id: 'missing-project-id-error',
			title: 'Missing project ID error',
			description: 'Validation state shown when the add-study route is opened without parent project context.',
			path: '/pages/study/new/index.html',
			actions: [{ type: 'waitForText', text: 'Missing project ID' }],
		},
	],
};

function journalStatePath(hash) {
	return `${operationalPaths.journals}${hash}`;
}

const journalAnalysisBaseActions = [
	{ type: 'waitForSelector', selector: '#analysis-panel', state: 'visible' },
	{ type: 'click', selector: '[data-analysis="co-occurrence"]' },
	{ type: 'waitForText', text: 'Code co-occurrence updated.' },
];

const journalsPage = {
	id: 'journals',
	title: 'Project journals',
	group: 'Projects',
	path: '/pages/projects/journals/index.html',
	description: 'Reflexive journal page.',
	defaultState: {
		id: 'default',
		title: 'Journal entries with realistic reflexive data',
		description: 'Journal entries captured with project context and a full set of realistic reflections.',
		path: operationalPaths.journals,
		actions: [{ type: 'waitForText', text: 'The team is beginning to see research evidence' }],
	},
	states: [
		{
			id: 'codes-with-realistic-data',
			title: 'Codes with realistic data',
			description: 'Codebook captured with thematic, second-order and first-order reflexive analysis codes.',
			path: journalStatePath('#codes'),
			actions: [{ type: 'waitForText', text: 'Analysis confidence' }],
		},
		{
			id: 'memos-with-realistic-data',
			title: 'Memos with realistic data',
			description: 'Research memos captured with analytical, methodological, theoretical and reflexive memo types.',
			path: journalStatePath('#memos'),
			actions: [{ type: 'waitForText', text: 'Confidence threshold and evidence readiness' }],
		},
		{
			id: 'analysis-timeline',
			title: 'Analysis timeline with realistic journal entries',
			description: 'Analysis timeline captured with the same reflexive entries used by the journal list.',
			path: journalStatePath('#analysis'),
			actions: [
				{ type: 'waitForSelector', selector: '#analysis-panel', state: 'visible' },
				{ type: 'click', selector: '[data-analysis="timeline"]' },
				{ type: 'waitForText', text: 'Timeline view updated.' },
				{ type: 'waitForText', text: 'Procedures journal entry' },
			],
		},
		{
			id: 'analysis-cooccurrence-table',
			title: 'Analysis code co-occurrence table',
			description: 'Co-occurring code pairs captured as a GOV.UK table with realistic pair weights.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'waitForText', text: 'Code pairs by strength' },
			],
		},
		{
			id: 'analysis-cooccurrence-ranked-bar-chart',
			title: 'Analysis ranked co-occurrence bar chart',
			description: 'Highest weighted code pairs captured as a ranked bar chart.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'check', selector: '#cooccurrence-view-chart' },
				{ type: 'waitForText', text: 'Highest weighted code pairs' },
			],
		},
		{
			id: 'analysis-cooccurrence-matrix-heatmap',
			title: 'Analysis co-occurrence matrix heatmap',
			description: 'Code co-occurrence captured as a matrix heatmap.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'check', selector: '#cooccurrence-view-heatmap' },
				{ type: 'waitForText', text: 'Code co-occurrence matrix' },
			],
		},
		{
			id: 'analysis-cooccurrence-small-multiples',
			title: 'Analysis co-occurrence small multiples',
			description: 'Code co-occurrence captured as small multiple bar charts.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'check', selector: '#cooccurrence-view-small-multiples' },
				{ type: 'waitForText', text: 'Small multiple bar charts' },
			],
		},
		{
			id: 'analysis-cooccurrence-stacked-summary',
			title: 'Analysis co-occurrence stacked summary',
			description: 'Code co-occurrence captured as stacked bar summaries.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'check', selector: '#cooccurrence-view-stacked' },
				{ type: 'waitForText', text: 'Stacked bar summary' },
			],
		},
		{
			id: 'analysis-cooccurrence-clustered-summary',
			title: 'Analysis co-occurrence clustered summary',
			description: 'Code co-occurrence captured as clustered bar comparisons.',
			path: journalStatePath('#analysis'),
			actions: [
				...journalAnalysisBaseActions,
				{ type: 'check', selector: '#cooccurrence-view-clustered' },
				{ type: 'waitForText', text: 'Clustered bar comparison' },
			],
		},
		{
			id: 'analysis-code-retrieval',
			title: 'Analysis code retrieval',
			description: 'Code retrieval captured with a realistic search result backed by journal data.',
			path: journalStatePath('#analysis'),
			actions: [
				{ type: 'waitForSelector', selector: '#analysis-panel', state: 'visible' },
				{ type: 'click', selector: '[data-analysis="retrieval"]' },
				{ type: 'fill', selector: '#retrieval-q', value: 'confidence' },
				{ type: 'click', selector: '#retrieval-form button[type="submit"]' },
				{ type: 'waitForText', text: 'Code retrieval updated.' },
			],
		},
		{
			id: 'analysis-export',
			title: 'Analysis export',
			description: 'Analysis export captured with populated timeline and co-occurrence JSON.',
			path: journalStatePath('#analysis'),
			actions: [
				{ type: 'waitForSelector', selector: '#analysis-panel', state: 'visible' },
				{ type: 'click', selector: '[data-analysis="export"]' },
				{ type: 'waitForText', text: 'Export analysis is ready in the JSON panel.' },
			],
		},
	],
};

const journalEntryPage = {
	id: 'journal-entry',
	title: 'Journal entry',
	group: 'Projects',
	path: '/pages/journal/entry/index.html',
	description: 'Journal entry detail page.',
	defaultState: {
		id: 'default',
		title: 'Journal entry with saved content',
		description: 'Journal entry detail captured with deterministic project and entry context.',
		path: operationalPaths.journalEntry,
		actions: [{ type: 'waitForText', text: 'The team is beginning to see research evidence' }],
	},
	states: [
		{
			id: 'missing-journal-entry-id-error',
			title: 'Missing journal entry ID error',
			description: 'Error state shown when the journal detail route is opened without an entry ID.',
			path: '/pages/journal/entry/index.html',
			actions: [{ type: 'waitForText', text: 'Missing journal entry ID.' }],
		},
	],
};

const journalEntryEditPage = {
	id: 'journal-entry-edit',
	title: 'Edit journal entry',
	group: 'Projects',
	path: '/pages/journal/edit/index.html',
	description: 'Journal entry edit page.',
	defaultState: {
		id: 'default',
		title: 'Edit journal entry with saved content',
		description: 'Journal entry edit form captured with deterministic project and entry context.',
		path: operationalPaths.journalEntryEdit,
		actions: [{ type: 'waitForSelector', selector: '#journal-entry-edit-form', state: 'visible' }],
	},
	states: [
		{
			id: 'missing-journal-entry-id-error',
			title: 'Missing journal entry ID error',
			description: 'Error state shown when the journal edit route is opened without an entry ID.',
			path: '/pages/journal/edit/index.html',
			actions: [{ type: 'waitForText', text: 'Missing journal entry ID.' }],
		},
	],
};

const studyGuidesPage = {
	...statefulPage(
		'study-guides',
		'Discussion guides',
		'Study',
		'/pages/study/guides/index.html',
		'Discussion guide list and editor page.',
		'Discussion guides with saved source',
		'Discussion guides page captured with the canonical Study record ID and opened guide source.',
		operationalPaths.studyGuides,
		'Opening and consent'
	),
	defaultState: {
		id: 'default',
		title: 'Discussion guides with saved source',
		description: 'Discussion guides page captured with the canonical Study record ID and opened guide source.',
		path: operationalPaths.studyGuides,
		actions: [{ type: 'waitForSelector', selector: '#guide-preview h2:first-of-type' }],
	},
	states: [
		{
			id: 'empty-guide-source-error',
			title: 'Empty guide source validation',
			description: 'Guide editor validation state shown when a publish action is attempted without guide source.',
			path: operationalPaths.studyGuides,
			actions: [
				{ type: 'waitForSelector', selector: '#guide-source', state: 'visible' },
				{ type: 'fill', selector: '#guide-source', value: '' },
				{ type: 'click', selector: '#btn-publish' },
				{ type: 'waitForText', text: 'Enter guide source' },
			],
		},
	],
};

const studySessionPage = {
	...statefulPage(
		'study-session',
		'Study session',
		'Study',
		'/pages/study/session/index.html',
		'Session running and note capture page.',
		'Study session with participant ready',
		'Session workspace captured with a selected participant and ready consent status.',
		operationalPaths.studySession,
		'Begin a session'
	),
	defaultState: {
		id: 'default',
		title: 'Study session with participant ready',
		description: 'Session workspace captured with a selected participant and ready consent status.',
		path: operationalPaths.studySession,
		actions: [
			{ type: 'waitForSelector', selector: '#participant-select option[value="recVisualParticipant001"]', state: 'attached' },
			{ type: 'select', selector: '#participant-select', value: 'recVisualParticipant001' },
			{ type: 'waitForText', text: 'Ready for session' },
		],
	},
	states: [
		{
			id: 'participant-consent-gate',
			title: 'Participant consent gate',
			description: 'Session warning state shown before a participant has been selected.',
			path: operationalPaths.studySession,
			actions: [{ type: 'waitForText', text: 'Choose a participant to review consent status before starting a session.' }],
		},
	],
};

const teamAccessRequestsPage = {
	id: 'team-access-requests',
	title: 'Review team access requests',
	group: 'Team administration',
	path: '/pages/team/access-requests/index.html',
	description: 'Team Admin review page for pending team access requests.',
	defaultState: {
		id: 'default',
		title: 'Pending team access requests',
		description: 'Team access review page captured with a deterministic pending request.',
		path: operationalPaths.teamAccessRequests,
		actions: [{ type: 'waitForText', text: 'Request from Morgan Lee' }],
	},
	states: [
		{
			id: 'decision-error',
			title: 'Team access decision error',
			description: 'Error state shown when a pending team access decision cannot be completed.',
			path: operationalPaths.teamAccessRequests,
			mockRoutes: [
				{
					url: /\/api\/team-access\/requests\/approve(?:\?.*)?$/,
					method: 'POST',
					status: 500,
					body: {
						ok: false,
						message: 'Team access request could not be completed.',
					},
				},
			],
			actions: [
				{ type: 'waitForSelector', selector: '[data-approve-request="tar_visual_001"]' },
				{ type: 'click', selector: '[data-approve-request="tar_visual_001"]' },
				{ type: 'waitForText', text: 'Team access request could not be completed.' },
			],
		},
	],
};

const accountSignInPage = {
	id: 'account-sign-in',
	title: 'Sign in to ResearchOps',
	group: 'Account',
	path: '/pages/account/sign-in/index.html',
	description: 'Sign-in and one-time code request page.',
	authenticated: false,
	defaultState: {
		id: 'default',
		title: 'Email address requested',
		description: 'Sign-in page before a code has been requested.',
		mockRoutes: signInMockRoutes(),
		actions: [{ type: 'waitForText', text: 'Enter your email address to get a sign-in code.' }],
	},
	states: [
		{
			id: 'code-requested',
			title: '6 digit code requested',
			description: 'Sign-in page after the QA walkthrough email address has requested a one-time code.',
			mockRoutes: signInMockRoutes({ email: SIGN_IN_EMAIL }),
			actions: [
				{ type: 'fill', selector: '#sign-in-email', value: SIGN_IN_EMAIL },
				{ type: 'click', selector: '#email-code-start-form button[type="submit"]' },
				{ type: 'waitForSelector', selector: '#email-code-verify-form', state: 'visible' },
				{ type: 'waitForText', text: `We sent a 6 digit code to ${SIGN_IN_EMAIL}` },
			],
		},
	],
};

function repositoryStaticPageEntry(page) {
	const pageId = `repository-${page.slug.replaceAll('/', '-')}`;
	const selectedBrowseValues = {
		service_area: 'assisted-digital-support',
		user_group: 'frontline-staff',
		method: 'interviews',
		risk_area: 'evidence-boundaries',
	};
	const statePath = page.browseType
		? `/pages/repository/${page.slug}/?${page.browseType}=${selectedBrowseValues[page.browseType]}`
		: `/pages/repository/${page.slug}/`;
	const waitForText = page.browseType || page.reviewRoute
		? 'Staff need clearer evidence boundaries before accepting recommendations'
		: page.candidateRoute
			? page.title
			: page.title;

	return statefulPage(
		pageId,
		page.title,
		'Research repository',
		`/pages/repository/${page.slug}/index.html`,
		page.lead || page.body || 'Cloudflare-generated research repository page.',
		page.title,
		page.body || page.lead || 'Repository route captured from the deployed generated page.',
		statePath,
		waitForText
	);
}

const repositoryPages = [
	{
		id: 'repository',
		title: 'Research repository',
		group: 'Research repository',
		path: '/pages/repository/index.html',
		description: 'Cloudflare-generated research repository front page.',
		defaultState: {
			id: 'default',
			title: 'Repository front page with published artefacts',
			description:
				'Repository front page captured from the deployed generated page after the server-rendered repository shell is available.',
			path: '/pages/repository/',
			actions: [{ type: 'waitForSelector', selector: '[data-repository-page]' }],
		},
	},
	...repositoryStaticPages.map(repositoryStaticPageEntry),
];

function routeToGeneratedHtmlPath(route) {
	return `${route.replace(/\/$/, '')}/index.html`;
}

function sourcebookStaticPageEntry(page) {
	return {
		id: `sourcebook-${page.slug}`,
		title: page.title,
		group: 'Sourcebook',
		path: routeToGeneratedHtmlPath(page.route),
		description: page.operatingQuestion || page.definition,
		authenticated: false,
		defaultState: {
			id: 'default',
			title: `${page.title} sourcebook pillar`,
			description: `Sourcebook pillar page captured for ${page.code}.`,
			path: page.route,
			actions: [{ type: 'waitForText', text: page.title }],
		},
	};
}

const sourcebookPages = [
	{
		id: 'sourcebook',
		title: sourcebookIndex.title,
		group: 'Sourcebook',
		path: routeToGeneratedHtmlPath(sourcebookIndex.canonicalRoute),
		description: sourcebookIndex.description,
		authenticated: false,
		defaultState: {
			id: 'default',
			title: 'Sourcebook index',
			description: 'Research Operations Sourcebook index captured as the public operating manual.',
			path: sourcebookIndex.canonicalRoute,
			actions: [{ type: 'waitForText', text: 'The 8 pillars' }],
		},
	},
	...sourcebookPillarPages.map(sourcebookStaticPageEntry),
];

function complianceIncidentEvidencePageEntry(page) {
	return {
		id: `compliance-incident-response-${page.slug}`,
		title: page.title,
		group: 'Assurance',
		path: routeToGeneratedHtmlPath(page.route),
		description: page.summary,
		authenticated: false,
		defaultState: {
			id: 'default',
			title: `${page.title} evidence page`,
			description: page.summary,
			path: page.route,
			actions: [{ type: 'waitForText', text: page.title }],
		},
	};
}

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
		{
			...registeredPage(
				'product-proof',
				'ResearchOps Product Proof',
				'Core',
				'/pages/product-proof/index.html',
				'Public static proof page showing the ResearchOps lifecycle before sign-in.'
			),
			authenticated: false,
			defaultState: {
				id: 'default',
				title: 'Lifecycle proof before sign-in',
				description: 'Public product proof page captured without authenticated data.',
				path: '/pages/product-proof/index.html',
				actions: [{ type: 'waitForText', text: 'Walk through how the product works' }],
			},
		},
		accountSignInPage,
		{
			...statefulPage('account-registration', 'Request a ResearchOps account', 'Account', '/pages/account/register/index.html', 'Public account request page for people who need ResearchOps access.', 'Account request form', 'Registration request page captured before answers are entered.', '/pages/account/register/index.html', 'Request a ResearchOps account'),
			authenticated: false,
		},
		registeredPage('account-team-access', 'Request access to a team', 'Account', '/pages/account/team-access/index.html', 'Request-access form for signed-in users who need team access.'),
		{
			id: 'account-dashboard',
			title: 'Your ResearchOps account',
			group: 'Account',
			path: '/pages/account/index.html',
			description: 'Signed-in account dashboard showing active team, roles, permissions and actions.',
			defaultState: {
				id: 'default',
				title: 'Signed-in account dashboard',
				description: 'Account dashboard captured with deterministic Team Admin context.',
				path: '/pages/account/index.html',
				actions: [{ type: 'waitForSelector', selector: '#account-dashboard:not([hidden])' }],
			},
		},
		registeredPage('start-overview', 'Start a research project', 'Core', '/pages/start/overview/index.html', 'Overview page for creating a research project.'),
		startPage,
		{
			...registeredPage('projects', 'Projects', 'Projects', '/pages/projects/index.html', 'Project list page.'),
			defaultState: {
				id: 'default',
				title: 'Projects list with authenticated project context',
				description: 'Projects page captured through the Worker-protected route.',
				path: '/pages/projects/',
				actions: [{ type: 'waitForText', text: 'Assisted Digital Support Discovery' }],
			},
		},
		statefulPage('project-dashboard', 'Project dashboard', 'Projects', '/pages/project-dashboard/index.html', 'Project dashboard page.', 'Project dashboard with operational project context', 'Dashboard captured with a deterministic project ID.', operationalPaths.projectDashboard, 'Assisted Digital Support Discovery'),
		addStudyPage,
		statefulPage('project-dashboard-add-participant', 'Add participant', 'Projects', '/pages/project-dashboard/participants/index.html', 'Add a study-linked participant from the project dashboard action workflow.', 'Add participant with parent context', 'Participant workflow captured with the project ID present.', operationalPaths.addParticipant, 'Add participant'),
		statefulPage('project-dashboard-import-participants', 'Import participants', 'Projects', '/pages/project-dashboard/participants/import/index.html', 'Import study-linked participants from CSV.', 'Import participants with parent context', 'CSV import workflow captured with the project ID present.', operationalPaths.importParticipants, 'Import participants'),
		statefulPage('outcomes', 'Project outcomes', 'Projects', '/pages/projects/outcomes/index.html', 'Outcomes page for project-level findings and outputs.', 'Project outcomes with project context', 'Outcomes page captured with a deterministic project ID.', operationalPaths.outcomes, 'Impact & ROI'),
		journalsPage,
		journalEntryPage,
		journalEntryEditPage,
		statefulPage('study', 'Study overview', 'Study', '/pages/study/index.html', 'Study overview and readiness controls.', 'Study overview with readiness context', 'Study overview captured with the canonical Study record ID.', operationalPaths.study, 'Assisted digital support interview round 1'),
		studyGuidesPage,
		statefulPage('study-note-takers-observers', 'Note takers and observers', 'Study', '/pages/study/note-takers-observers/index.html', 'Study support roles setup page.', 'Note takers and observers with study context', 'Support roles setup captured with the canonical Study record ID.', operationalPaths.studyNoteTakersObservers, 'Note takers and observers'),
		statefulPage('study-participants', 'Participants', 'Study', '/pages/study/participants/index.html', 'Participants page for a study.', 'Study participants with records', 'Participants page captured with the canonical Study record ID.', operationalPaths.studyParticipants, 'Participants'),
		studySessionPage,
		statefulPage('study-consent-forms', 'Study consent forms', 'Study', '/pages/study/consent-forms/index.html', 'Study-specific consent form configuration page.', 'Study consent forms with study context', 'Consent form configuration captured with the canonical Study record ID.', operationalPaths.studyConsentForms, 'Consent forms'),
		registeredPage('study-participant-consent', 'Participant consent', 'Study', '/pages/study/participant-consent/index.html', 'Study-scoped participant consent recording and review page.'),
		registeredPage('synthesize', 'Study synthesis', 'Study', '/pages/study/synthesis/index.html', 'Study-scoped evidence grouping and theme creation page.'),
		statefulPage('team-registration-requests', 'Review account requests', 'Team administration', '/pages/team/registration-requests/index.html', 'Team Admin review page for pending account registration requests.', 'Pending account requests', 'Registration request review page captured with a deterministic pending request.', operationalPaths.teamRegistrationRequests, 'Pending account requests'),
		teamAccessRequestsPage,
		teamRoleAssignmentsPage,
		registeredPage('search', 'Search', 'Utilities', '/pages/search/index.html', 'Search page.'),
		registeredPage('notes', 'Notes', 'Utilities', '/pages/notes/index.html', 'Notes page.'),
		registeredPage('consent', 'Consent', 'Utilities', '/pages/consent/index.html', 'Consent page.'),
		registeredPage('sessions', 'Sessions', 'Utilities', '/pages/sessions/index.html', 'Sessions list page.'),
		{
			...registeredPage(
				'compliance-readiness',
				'SOC 2 and ISO 27001 readiness',
				'Assurance',
				'/pages/compliance-readiness/index.html',
				'Footer-linked readiness page defining the platform boundary and control matrix.'
			),
			authenticated: false,
			defaultState: {
				id: 'default',
				title: 'Compliance readiness boundary and control matrix',
				description: 'Compliance readiness page captured as a public assurance support page.',
				path: '/pages/compliance-readiness/',
				actions: [{ type: 'waitForText', text: 'This page does not assert SOC 2 compliance' }],
			},
		},
		...incidentResponseEvidencePages.map(complianceIncidentEvidencePageEntry),
		...repositoryPages,
		...sourcebookPages,
	],
};

export default visualWalkthroughConfig;
