/* eslint-env node */

/**
 * @file visual-walkthrough.config.mjs
 * @summary Registry of application pages and states captured by the visual walkthrough report.
 */

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
