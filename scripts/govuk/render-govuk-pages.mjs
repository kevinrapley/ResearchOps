import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import prettier from 'prettier';

import { complianceReadinessContext } from '../../src/govuk/data/compliance-readiness.mjs';
import { repositoryPageContext, repositoryStaticPages } from '../../src/govuk/data/repository-page.mjs';
import { sourcebookIndex, sourcebookPillarPages } from '../../src/govuk/data/sourcebook.mjs';

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

function escapeHtmlAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function govukAttributes(attributes = {}) {
	if (!attributes || typeof attributes !== 'object') return '';

	const html = Object.entries(attributes)
		.filter(([, value]) => value !== false && value !== null && value !== undefined)
		.map(([name, value]) => {
			if (value === true) return ` ${name}`;
			return ` ${name}="${escapeHtmlAttribute(value)}"`;
		})
		.join('');

	return new nunjucks.runtime.SafeString(html);
}

async function formatRenderedHtml(html) {
	return prettier.format(html, {
		parser: 'html',
		printWidth: 120,
		useTabs: true,
		tabWidth: 2,
		htmlWhitespaceSensitivity: 'ignore',
	});
}

env.addFilter('govukAttributes', govukAttributes);
env.addGlobal('govukAttributes', govukAttributes);

export const outcomesScriptVersion = '20260603-form-interactions';

const outcomesPageOutput = 'public/pages/projects/outcomes/index.html';
const outcomesPageScriptPaths = ['/js/project-context.js', '/js/outcomes-page.js', '/components/impact-tracker.js'];
const outcomesPageScriptUrlAttributes = ['href', 'src'];

export function cacheBustOutcomesPageScripts(html, page) {
	if (page.output !== outcomesPageOutput) return html;

	let updatedHtml = html;
	for (const scriptPath of outcomesPageScriptPaths) {
		for (const attribute of outcomesPageScriptUrlAttributes) {
			updatedHtml = updatedHtml.replaceAll(
				`${attribute}="${scriptPath}"`,
				`${attribute}="${scriptPath}?v=${outcomesScriptVersion}"`,
			);
		}
	}

	return updatedHtml;
}

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
	{
		text: 'Research repository',
		href: '/pages/repository/',
	},
	{
		text: 'Sourcebook',
		href: '/pages/sourcebook/',
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

const repositoryNavigation = navigation.map((item) => ({
	...item,
	active: item.href === '/pages/repository/',
}));

const sourcebookNavigation = navigation.map((item) => ({
	...item,
	active: item.href === '/pages/sourcebook/',
}));

const accountNavigation = navigation.map((item) => ({
	...item,
	active: false,
}));

export const govukPages = [
	{
		template: 'pages/home.njk',
		output: 'public/index.html',
		context: {
			pageTitle: 'ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Home',
			navigation,
			bodyClass: 'researchops-home-front-page',
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
		template: 'pages/product-proof.njk',
		output: 'public/pages/product-proof/index.html',
		context: {
			pageTitle: 'ResearchOps Product Proof - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: '',
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/compliance-readiness.njk',
		output: 'public/pages/compliance-readiness/index.html',
		context: {
			...complianceReadinessContext,
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/start.njk',
		output: 'public/pages/start/index.html',
		context: {
			pageTitle: 'Start a new research project - ResearchOps Demo Suite',
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
			layoutCacheKey: 'header-account-links-20260623-1',
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/account-register.njk',
		output: 'public/pages/account/register/index.html',
		context: {
			pageTitle: 'Request a ResearchOps account - ResearchOps Demo Suite',
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
		template: 'pages/team-access-requests.njk',
		output: 'public/pages/team/access-requests/index.html',
		context: {
			pageTitle: 'Review team access requests - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: '',
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/role-assignments.njk',
		output: 'public/pages/team/role-assignments/index.html',
		context: {
			pageTitle: 'Assign a role to a team member - ResearchOps Demo Suite',
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
		template: 'pages/repository.njk',
		output: 'public/pages/repository/index.html',
		context: {
			pageTitle: 'Research repository - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Research Repository',
			navigation: repositoryNavigation,
			bodyClass: 'researchops-repository-front-page',
			...repositoryPageContext,
		},
	},
	...repositoryStaticPages.map((page) => ({
		template: 'pages/repository-static.njk',
		output: `public/pages/repository/${page.slug}/index.html`,
		context: {
			pageTitle: `${page.title} - ResearchOps Demo Suite`,
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Research Repository',
			navigation: repositoryNavigation,
			...page,
		},
	})),
	{
		template: 'sourcebook/index.njk',
		output: 'public/pages/sourcebook/index.html',
		context: {
			pageTitle: 'Research Operations Sourcebook - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Sourcebook',
			navigation: sourcebookNavigation,
			bodyClass: 'researchops-sourcebook-page',
			sourcebook: sourcebookIndex,
		},
	},
	...sourcebookPillarPages.map((pillar) => ({
		template: 'sourcebook/pillar.njk',
		output: `public/pages/sourcebook/${pillar.slug}/index.html`,
		context: {
			pageTitle: `${pillar.title} - Research Operations Sourcebook - ResearchOps Demo Suite`,
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Sourcebook',
			navigation: sourcebookNavigation,
			bodyClass: 'researchops-sourcebook-page',
			pillar,
			sourcebookTitle: sourcebookIndex.title,
			metadata: sourcebookIndex.metadata,
			contentTypes: sourcebookIndex.contentTypes,
		},
	})),
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
		template: 'pages/study-new.njk',
		output: 'public/pages/study/new/index.html',
		context: {
			pageTitle: 'Add study - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study.njk',
		output: 'public/pages/study/index.html',
		context: {
			pageTitle: 'Study - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-consent-forms.njk',
		output: 'public/pages/study/consent-forms/index.html',
		context: {
			pageTitle: 'Consent forms - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-participant-consent.njk',
		output: 'public/pages/study/participant-consent/index.html',
		context: {
			pageTitle: 'Participant consent - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-participants.njk',
		output: 'public/pages/study/participants/index.html',
		context: {
			pageTitle: 'Study participants - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-note-takers-observers.njk',
		output: 'public/pages/study/note-takers-observers/index.html',
		context: {
			pageTitle: 'Note takers and observers - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-guides.njk',
		output: 'public/pages/study/guides/index.html',
		context: {
			pageTitle: 'Discussion guides - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-synthesis.njk',
		output: 'public/pages/study/synthesis/index.html',
		context: {
			pageTitle: 'Study synthesis - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-session.njk',
		output: 'public/pages/study/session/index.html',
		context: {
			pageTitle: 'Research session - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/project-dashboard-participants.njk',
		output: 'public/pages/project-dashboard/participants/index.html',
		context: {
			pageTitle: 'Add participant - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/project-dashboard-participants-import.njk',
		output: 'public/pages/project-dashboard/participants/import/index.html',
		context: {
			pageTitle: 'Import participants - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/projects-outcomes.njk',
		output: 'public/pages/projects/outcomes/index.html',
		context: {
			pageTitle: 'Research outcomes - ResearchOps Demo Suite',
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
	{
		template: 'pages/journal-entry.njk',
		output: 'public/pages/journal/entry/index.html',
		context: {
			pageTitle: 'Journal entry - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/journal-edit.njk',
		output: 'public/pages/journal/edit/index.html',
		context: {
			pageTitle: 'Edit journal entry - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/search.njk',
		output: 'public/pages/search/index.html',
		context: {
			pageTitle: 'Search - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Research Repository',
			navigation: repositoryNavigation,
		},
	},
	{
		template: 'pages/notes.njk',
		output: 'public/pages/notes/index.html',
		context: {
			pageTitle: 'Notes - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/consent.njk',
		output: 'public/pages/consent/index.html',
		context: {
			pageTitle: 'Consent - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/sessions.njk',
		output: 'public/pages/sessions/index.html',
		context: {
			pageTitle: 'Sessions - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
];

export async function renderGovukPage(page) {
	const outputPath = resolve(root, page.output);
	const rawHtml = cacheBustOutcomesPageScripts(env.render(page.template, page.context), page);
	const html = await formatRenderedHtml(rawHtml);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, html.endsWith('\n') ? html : `${html}\n`, 'utf8');
	console.log('Rendered ' + page.output);
	return page.output;
}

export async function renderGovukPages(pagesToRender = govukPages) {
	const outputs = [];
	for (const page of pagesToRender) {
		outputs.push(await renderGovukPage(page));
	}
	return outputs;
}

export async function renderAllGovukPages() {
	return renderGovukPages(govukPages);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
	await renderAllGovukPages();
}
