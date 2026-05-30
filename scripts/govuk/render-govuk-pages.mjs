import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import nunjucks from 'nunjucks';

const root = resolve(process.cwd());
const env = new nunjucks.Environment(
	[
		new nunjucks.FileSystemLoader(resolve(root, 'src/govuk/templates')),
		new nunjucks.FileSystemLoader(resolve(root, 'node_modules/govuk-frontend/dist')),
	],
	{
		autoescape: true,
		throwOnUndefined: true,
	},
);

const navigation = [
	{
		text: 'Home',
		href: '/',
		active: true,
	},
	{
		text: 'Start research project',
		href: '/pages/start/overview/',
	},
	{
		text: 'Projects',
		href: '/pages/projects/',
	},
];

const steps = [
	{
		title: 'Project',
		text: 'Define the research work, service phase, team context and objectives.',
	},
	{
		title: 'Study',
		text: 'Plan a specific round of research within the project.',
	},
	{
		title: 'Participants',
		text: 'Recruit and manage people taking part in the study.',
	},
	{
		title: 'Sessions',
		text: 'Schedule and run research sessions.',
	},
	{
		title: 'Notes',
		text: 'Capture observations and structured session notes.',
	},
	{
		title: 'Evidence',
		text: 'Organise what was seen, heard or recorded.',
	},
	{
		title: 'Insights',
		text: 'Analyse evidence into meaningful findings.',
	},
	{
		title: 'Recommendations',
		text: 'Turn findings into decisions, actions and service improvements.',
	},
];

const cards = [
	{
		category: 'Team alignment',
		title: 'Set clear research objectives',
		status: 'Available after project creation',
		question: 'How might we overcome the impact of unclear objectives in user research?',
		text: 'Use the project space to align stakeholder objectives with research, design and delivery work.',
	},
	{
		category: 'Recruitment',
		title: 'Recruit participants for user research studies',
		status: 'Available after study planning',
		question: 'How might we ensure that participant recruitment reflects the diversity and needs of the service’s real users?',
		text: 'Plan recruitment so findings are not biased, exclusionary or weakly connected to the service’s real users.',
	},
	{
		category: 'Evidence and analysis',
		title: 'Turn research evidence into recommendations',
		status: 'Available after sessions',
		question: 'How might we keep evidence, insights and recommendations connected?',
		text: 'Use structured notes and evidence trails to show how research findings lead to service decisions.',
	},
];

const projectNavigation = navigation.map((item) => ({
	...item,
	active: item.href === '/pages/projects/',
}));

const accountNavigation = navigation.map((item) => ({
	...item,
	active: false,
}));

const pages = [
	{
		template: 'pages/home.njk',
		output: 'public/index.html',
		context: {
			pageTitle: 'ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Home',
			navigation,
			steps,
			cards,
		},
	},
	{
		template: 'pages/start-overview.njk',
		output: 'public/pages/start/overview/index.html',
		context: {
			pageTitle: 'Start a research project - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Start Research Project',
			navigation: navigation.map((item) => ({
				...item,
				active: item.href === '/pages/start/overview/',
			})),
		},
	},
	{
		template: 'pages/account.njk',
		output: 'public/pages/account/index.html',
		context: {
			pageTitle: 'Your ResearchOps account - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: '',
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/account-team-access.njk',
		output: 'public/pages/account/team-access/index.html',
		context: {
			pageTitle: 'Request access to a team - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: '',
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/projects.njk',
		output: 'public/pages/projects/index.html',
		context: {
			pageTitle: 'Projects - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/project-dashboard.njk',
		output: 'public/pages/project-dashboard/index.html',
		context: {
			pageTitle: 'Project dashboard - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/projects-journals.njk',
		output: 'public/pages/projects/journals/index.html',
		context: {
			pageTitle: 'Reflexive Journal and Analysis - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
];

for (const page of pages) {
	const outputPath = resolve(root, page.output);
	const html = env.render(page.template, page.context);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${html}\n`, 'utf8');
	console.log(`Rendered ${page.output}`);
}
