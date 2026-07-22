import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nunjucks from 'nunjucks';

import {
	complianceEvidencePages,
	complianceReadinessContext,
} from '../../../src/govuk/data/compliance-readiness.mjs';
import { repositoryPageContext, repositoryStaticPages } from '../../../src/govuk/data/repository-page.mjs';
import {
	sourcebookContextForRoute,
	sourcebookEvidenceLedgerForRoute,
	sourcebookGateForRoute,
	sourcebookIndex,
	sourcebookPillarPages,
} from '../../../src/govuk/data/sourcebook.mjs';

const root = resolve(process.cwd());
export const generatedGovukChromeCacheKey = 'govuk-page-chrome-20260702-1';

function escapeHtmlAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

export function govukAttributes(attributes = {}) {
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

const complianceAbbreviations = [
	{
		pattern: /\bISO\/IEC\b/g,
		markup:
			'<abbr title="International Organization for Standardization / International Electrotechnical Commission">ISO/IEC</abbr>',
	},
	{
		pattern: /\bSOC\b/g,
		markup: '<abbr title="System and Organization Controls">SOC</abbr>',
	},
	{
		pattern: /\bTSC\b/g,
		markup: '<abbr title="Trust Services Criteria">TSC</abbr>',
	},
	{
		pattern: /\bGDPR\b/g,
		markup: '<abbr title="General Data Protection Regulation">GDPR</abbr>',
	},
	{
		pattern: /\bDPIA\b/g,
		markup: '<abbr title="Data Protection Impact Assessment">DPIA</abbr>',
	},
	{
		pattern: /\bROPA\b/g,
		markup: '<abbr title="Record of Processing Activities">ROPA</abbr>',
	},
	{
		pattern: /\bSLOs\b/g,
		markup: '<abbr title="Service level objectives">SLOs</abbr>',
	},
	{
		pattern: /\bRTO\/RPO\b/g,
		markup: '<abbr title="Recovery Time Objective / Recovery Point Objective">RTO/RPO</abbr>',
	},
];

export function complianceAbbreviationMarkup(value) {
	let html = String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');

	for (const abbreviation of complianceAbbreviations) {
		html = html.replace(abbreviation.pattern, abbreviation.markup);
	}

	return new nunjucks.runtime.SafeString(html);
}

function inlineMarkdown(value) {
	return escapeHtml(value)
		.replace(
			/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
			(_match, label, href) =>
				`<a class="govuk-link" href="${escapeHtmlAttribute(href)}">${label}</a>`,
		)
		.replace(/`([^`]+)`/g, '<code class="govuk-code">$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function markdownTable(lines, startIndex) {
	const rows = [];
	let index = startIndex;

	while (index < lines.length && /^\|.*\|$/.test(lines[index].trim())) {
		rows.push(
			lines[index]
				.trim()
				.slice(1, -1)
				.split('|')
				.map((cell) => cell.trim()),
		);
		index += 1;
	}

	if (rows.length < 2) return { html: '', nextIndex: startIndex };

	const header = rows[0];
	const body = rows.slice(2);
	const headerHtml = header
		.map((cell) => `<th scope="col" class="govuk-table__header">${inlineMarkdown(cell)}</th>`)
		.join('');
	const bodyHtml = body
		.map(
			(row) =>
				`<tr class="govuk-table__row">${row
					.map((cell) => `<td class="govuk-table__cell">${inlineMarkdown(cell)}</td>`)
					.join('')}</tr>`,
		)
		.join('');

	return {
		html:
			'<table class="govuk-table"><thead class="govuk-table__head"><tr class="govuk-table__row">' +
			headerHtml +
			'</tr></thead><tbody class="govuk-table__body">' +
			bodyHtml +
			'</tbody></table>',
		nextIndex: index,
	};
}

function isMarkdownTableStart(lines, index) {
	return (
		index + 1 < lines.length &&
		/^\|.*\|$/.test(lines[index].trim()) &&
		/^\|[\s:-]+\|/.test(lines[index + 1].trim())
	);
}

export function renderComplianceMarkdownDocument(markdown) {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const bodyLines = lines[0]?.startsWith('# ') ? lines.slice(1) : lines;
	const htmlParts = [];
	let listType = null;
	let orderedItemOpen = false;
	let nestedListType = null;

	function closeNestedList() {
		if (!nestedListType) return;
		htmlParts.push(`</${nestedListType}>`);
		nestedListType = null;
	}

	function closeOrderedItem() {
		if (!orderedItemOpen) return;
		closeNestedList();
		htmlParts.push('</li>');
		orderedItemOpen = false;
	}

	function closeList() {
		if (!listType) return;
		closeOrderedItem();
		htmlParts.push(`</${listType}>`);
		listType = null;
	}

	for (let index = 0; index < bodyLines.length; index += 1) {
		const rawLine = bodyLines[index];
		const line = rawLine.trim();

		if (!line) {
			if (listType !== 'ol') {
				closeList();
			}
			continue;
		}

		if (isMarkdownTableStart(bodyLines, index)) {
			closeList();
			const table = markdownTable(bodyLines, index);
			htmlParts.push(table.html);
			index = table.nextIndex - 1;
			continue;
		}

		const heading = line.match(/^(#{2,4})\s+(.+)$/);
		if (heading) {
			closeList();
			const level = heading[1].length;
			const className = level === 2 ? 'govuk-heading-l' : level === 3 ? 'govuk-heading-m' : 'govuk-heading-s';
			htmlParts.push(`<h${level} class="${className}">${inlineMarkdown(heading[2])}</h${level}>`);
			continue;
		}

		const orderedItem = line.match(/^\d+\.\s+(.+)$/);
		if (orderedItem) {
			if (listType !== 'ol') {
				closeList();
				htmlParts.push('<ol class="govuk-list govuk-list--number">');
				listType = 'ol';
			} else {
				closeOrderedItem();
			}
			htmlParts.push(`<li>${inlineMarkdown(orderedItem[1])}`);
			orderedItemOpen = true;
			continue;
		}

		const bulletItem = line.match(/^-\s+(.+)$/);
		if (bulletItem) {
			if (/^\s+-\s+/.test(rawLine) && listType === 'ol' && orderedItemOpen) {
				if (nestedListType !== 'ul') {
					htmlParts.push('<ul class="govuk-list govuk-list--bullet">');
					nestedListType = 'ul';
				}
				htmlParts.push(`<li>${inlineMarkdown(bulletItem[1])}</li>`);
				continue;
			}

			if (listType !== 'ul') {
				closeList();
				htmlParts.push('<ul class="govuk-list govuk-list--bullet">');
				listType = 'ul';
			}
			htmlParts.push(`<li>${inlineMarkdown(bulletItem[1])}</li>`);
			continue;
		}

		closeList();
		htmlParts.push(`<p class="govuk-body">${inlineMarkdown(line)}</p>`);
	}

	closeList();

	return new nunjucks.runtime.SafeString(htmlParts.join('\n'));
}

function complianceEvidencePageContext(page) {
	const markdown = readFileSync(resolve(root, page.sourcePath), 'utf8');

	return {
		...page,
		pageTitle: `${page.title} - ResearchOps Demo Suite`,
		serviceName: 'ResearchOps Demo Suite',
		activeNavigation: '',
		documentHtml: renderComplianceMarkdownDocument(markdown),
	};
}

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

export const pageCatalogue = [
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
	...complianceEvidencePages.map((page) => ({
		template: 'pages/compliance-evidence-document.njk',
		output: `public${page.route}index.html`,
		context: {
			...complianceEvidencePageContext(page),
			navigation: accountNavigation,
		},
	})),
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
			navigation: accountNavigation,
		},
	},
	{
		template: 'pages/account-sign-in.njk',
		output: 'public/pages/account/sign-in/index.html',
		context: {
			pageTitle: 'Sign in to ResearchOps - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: '',
			navigation: accountNavigation,
			fluxPageKey: 'page.account.sign-in',
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
			sourcebookGate: sourcebookGateForRoute({
				route: '/pages/account/team-access/',
				condition: 'access-change',
				title: 'Sourcebook gate for access requests',
				summary:
					'Do not widen access until the Sourcebook clause and required access evidence are in place.',
			}),
			sourcebookContext: sourcebookContextForRoute({
				route: '/pages/account/team-access/',
				condition: 'access-change',
				title: 'Sourcebook context for access requests',
				summary:
					'Use these clauses when access is requested, widened or reviewed against role and research need.',
			}),
			sourcebookEvidenceLedger: sourcebookEvidenceLedgerForRoute({
				route: '/pages/account/team-access/',
				condition: 'access-change',
				title: 'Evidence ledger for access requests',
				summary:
					'Track the evidence needed before access is widened or reviewed against role and research need.',
			}),
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
		template: 'pages/team-registration-requests.njk',
		output: 'public/pages/team/registration-requests/index.html',
		context: {
			pageTitle: 'Review account requests - ResearchOps Demo Suite',
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
			sourcebookGate: sourcebookGateForRoute({
				route: '/pages/team/role-assignments/',
				condition: 'permission-model-change',
				title: 'Sourcebook gate for role assignment',
				summary:
					'Do not assign role permissions until the Sourcebook clause and required access evidence are in place.',
			}),
			sourcebookContext: sourcebookContextForRoute({
				route: '/pages/team/role-assignments/',
				condition: 'permission-model-change',
				title: 'Sourcebook context for role assignment',
				summary:
					'Use these clauses when role permissions or admin access are assigned, changed or reviewed.',
			}),
			sourcebookEvidenceLedger: sourcebookEvidenceLedgerForRoute({
				route: '/pages/team/role-assignments/',
				condition: 'permission-model-change',
				title: 'Evidence ledger for role assignment',
				summary:
					'Track the evidence needed before role permissions or admin access are assigned, changed or reviewed.',
			}),
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
			sourcebookContext: sourcebookContextForRoute({
				route: '/pages/study/',
				condition: 'study-readiness',
				title: 'Why study readiness is governed',
				summary:
					'Sourcebook clauses require scope, consent, environment and governance checks before participant sessions begin.',
				caption: 'Sourcebook',
				classes: 'sourcebook-context--compact study-sourcebook-context',
				conditionLabel: 'Relevant to:',
				showText: false,
				showConditions: false,
				limit: 5,
			}),
			sourcebookEvidenceLedger: sourcebookEvidenceLedgerForRoute({
				route: '/pages/study/',
				condition: 'study-readiness',
				title: 'Evidence checked by Sourcebook',
				summary:
					'This audit record shows the evidence used by the Sourcebook readiness decision.',
				caption: 'Sourcebook evidence record',
				providedEvidence: ['research-intake'],
				limit: 5,
			}),
			sourcebookGate: sourcebookGateForRoute({
				route: '/pages/study/',
				condition: 'study-readiness',
				title: 'Sourcebook evidence check',
				summary:
					'Review Sourcebook evidence alongside the study setup tasks.',
				caption: 'Readiness check',
				classes: 'sourcebook-gate--attention',
				showChecks: false,
				blockedStatusLabel: 'Evidence record incomplete',
				blockedStatus: 'attention',
				blockedPrimaryAction: 'Review the Sourcebook evidence record.',
				readyStatusLabel: 'Sourcebook evidence complete',
				readyPrimaryAction: 'Continue to session with controls in place.',
				providedEvidence: ['research-intake'],
				limit: 5,
			}),
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
		template: 'pages/study-ethics-risk.njk',
		output: 'public/pages/study/ethics-risk/index.html',
		context: {
			pageTitle: 'Ethics and research risk - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-ethics-risk-next-steps.njk',
		output: 'public/pages/study/ethics-risk/next-steps/index.html',
		context: {
			pageTitle: 'Ethics risk next steps - ResearchOps Demo Suite',
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
			sourcebookContext: sourcebookContextForRoute({
				route: '/pages/study/participant-consent/',
				condition: 'participant-consent-recording',
				title: 'Why this page is governed',
				summary:
					'Before marking a participant ready, check that informed consent has been recorded against the current consent form.',
				caption: 'Sourcebook',
				conditionLabel: 'Relevant to:',
			}),
			sourcebookMobileContext: sourcebookContextForRoute({
				route: '/pages/study/participant-consent/',
				condition: 'participant-consent-recording',
				title: 'Why this page is governed',
				summary:
					'Before marking a participant ready, check that informed consent has been recorded against the current consent form.',
				id: 'sourcebook-context-mobile-title',
				classes: 'sourcebook-context--mobile',
				caption: 'Sourcebook',
				conditionLabel: 'Relevant to:',
			}),
			sourcebookEvidenceLedger: sourcebookEvidenceLedgerForRoute({
				route: '/pages/study/participant-consent/',
				condition: 'participant-consent-recording',
				title: 'Consent evidence',
				summary:
					'Check the evidence held for the selected participant before treating them as ready for research.',
				caption: 'Evidence',
				providedEvidence: ['consent-form'],
			}),
			sourcebookGate: sourcebookGateForRoute({
				route: '/pages/study/participant-consent/',
				condition: 'participant-consent-recording',
				title: 'Consent assurance requirements',
				summary:
					'A participant is ready only when a published consent form version is selected and all required consent statements are recorded.',
				caption: 'Readiness check',
				classes: 'sourcebook-gate--attention',
				blockedStatusLabel: 'Consent evidence incomplete',
				blockedPrimaryAction:
					'Complete required consent before treating this participant as ready.',
				readyStatusLabel: 'Consent evidence complete',
				readyPrimaryAction: 'Participant can be treated as ready for research.',
				providedEvidence: ['consent-form'],
			}),
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
		template: 'pages/study-card-sort.njk',
		output: 'public/pages/study/card-sort/index.html',
		context: {
			pageTitle: 'Card sort setup - ResearchOps Demo Suite',
			serviceName: 'ResearchOps Demo Suite',
			activeNavigation: 'Projects',
			navigation: projectNavigation,
		},
	},
	{
		template: 'pages/study-tree-test.njk',
		output: 'public/pages/study/tree-test/index.html',
		context: {
			pageTitle: 'Tree test setup - ResearchOps Demo Suite',
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
			sourcebookGate: sourcebookGateForRoute({
				route: '/pages/consent/',
				condition: 'consent-review',
				title: 'Sourcebook gate for consent',
				summary:
					'Do not treat consent as governed until the Sourcebook clause and required consent evidence are in place.',
			}),
			sourcebookContext: sourcebookContextForRoute({
				route: '/pages/consent/',
				condition: 'consent-review',
				title: 'Sourcebook context for consent',
				summary:
					'Use these clauses when consent wording, recording choices, retention or future-contact consent are being checked.',
			}),
			sourcebookEvidenceLedger: sourcebookEvidenceLedgerForRoute({
				route: '/pages/consent/',
				condition: 'consent-review',
				title: 'Evidence ledger for consent',
				summary:
					'Track the consent evidence needed before research participation is treated as recorded and auditable.',
			}),
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

export function pageKeyFromOutput(output) {
	const route = String(output)
		.replace(/^public\/?/, '')
		.replace(/(?:\/)?index\.html$/, '')
		.replace(/^pages\/?/, '')
		.replace(/[^A-Za-z0-9._:-]+/g, '-')
		.replace(/^-|-$/g, '');
	return `page.${route || 'home'}`;
}
