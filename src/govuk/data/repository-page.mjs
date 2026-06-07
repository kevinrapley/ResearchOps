export const repositoryPageContext = {
	hero: {
		caption: 'ResearchOps',
		title: 'Research repository',
		lead: 'Find published research evidence that has been reviewed, classified and cleared for reuse across services.',
		body: 'Use the repository to understand what teams already know, where the evidence is strong, and what still needs testing.',
		assurance: {
			title: 'Repository status',
			items: [
				{ term: 'Auth', description: 'required' },
				{ term: 'PII', description: 'excluded' },
				{ term: 'Review', description: 'required' },
			],
			body: 'Draft studies, consent records, recruitment records, session notes and recordings are not part of the repository index.',
		},
		search: {
			action: '/pages/repository/',
			label: 'Search published research',
			hint: 'Search by service area, user group, method, risk, journey stage, tag or recommendation.',
			id: 'repository-search-query',
			name: 'q',
			buttonText: 'Search',
			scope: 'Search only covers published artefacts that you have permission to view.',
		},
	},
	metrics: [
		{ value: '248', label: 'published artefacts' },
		{ value: '37', label: 'linked recommendations' },
		{ value: '12', label: 'due review this month' },
	],
	browseRoutes: [
		{
			title: 'Browse evidence by service area',
			href: '/pages/repository/service-areas/',
			text: 'Find research connected to a directorate, product family, operational area or cross-agency service.',
		},
		{
			title: 'Browse by user group',
			href: '/pages/repository/user-groups/',
			text: 'Find reusable evidence about citizens, staff, researchers, decision-makers and operational partners.',
		},
		{
			title: 'Browse by research method',
			href: '/pages/repository/methods/',
			text: 'Compare evidence from interviews, usability testing, contextual research, surveys and mixed-methods studies.',
		},
		{
			title: 'Browse by risk or constraint',
			href: '/pages/repository/risks/',
			text: 'Find evidence about inclusion, accessibility, safeguarding, policy, operational risk and confidence gaps.',
		},
	],
	artefacts: [
		{
			title: 'Staff need clearer evidence boundaries before accepting recommendations',
			href: '/pages/repository/artefacts/staff-evidence-boundaries/',
			text: 'Synthesis from three studies on how product and delivery teams interpret research findings during planning.',
			tags: [
				{ text: 'High confidence', classes: 'govuk-tag--green' },
				{ text: 'Validated insight', classes: 'govuk-tag--blue' },
				{ text: 'Interviews', classes: 'govuk-tag--grey' },
			],
		},
		{
			title: 'Check answers pages reduce review anxiety when change links are explicit',
			href: '/pages/repository/artefacts/check-answers-review-anxiety/',
			text: 'Reusable pattern evidence from form journeys where users must verify operational or research planning details.',
			tags: [
				{ text: 'High confidence', classes: 'govuk-tag--green' },
				{ text: 'Pattern evidence', classes: 'govuk-tag--blue' },
				{ text: 'Usability testing', classes: 'govuk-tag--grey' },
			],
		},
		{
			title: 'Operational teams rely on local workarounds when consent states are unclear',
			href: '/pages/repository/artefacts/consent-state-workarounds/',
			text: 'Evidence pack connecting consent handling, scheduling pressure and cross-team handoff risk.',
			tags: [
				{ text: 'Medium confidence', classes: 'govuk-tag--yellow' },
				{ text: 'Evidence pack', classes: 'govuk-tag--blue' },
				{ text: 'Contextual research', classes: 'govuk-tag--grey' },
			],
		},
		{
			title: 'Researchers need lightweight capture before structured tagging',
			href: '/pages/repository/artefacts/lightweight-capture-before-tagging/',
			text: 'Emerging method learning from session note capture and synthesis workflow feedback.',
			tags: [
				{ text: 'Medium confidence', classes: 'govuk-tag--yellow' },
				{ text: 'Method learning', classes: 'govuk-tag--grey' },
				{ text: 'Survey', classes: 'govuk-tag--grey' },
			],
		},
	],
	filters: [
		{
			name: 'method',
			legend: 'Method',
			items: [
				{ value: 'interviews', text: 'Interviews', id: 'repository-method-interviews' },
				{ value: 'usability', text: 'Usability testing', id: 'repository-method-usability' },
				{ value: 'contextual', text: 'Contextual research', id: 'repository-method-contextual' },
			],
		},
		{
			name: 'maturity',
			legend: 'Evidence maturity',
			items: [
				{ value: 'validated', text: 'Validated insight', id: 'repository-maturity-validated' },
				{ value: 'reviewed', text: 'Reviewed evidence', id: 'repository-maturity-reviewed' },
				{ value: 'emerging', text: 'Emerging learning', id: 'repository-maturity-emerging' },
			],
		},
	],
	publication: {
		title: 'Publish to the repository',
		body: 'Create a candidate artefact from study synthesis when it is safe and useful to reuse.',
		actionText: 'Create candidate artefact',
		actionHref: '/pages/repository/review/candidates/new/',
		gates: [
			'PII check passed',
			'Consent scope confirmed',
			'Evidence linked',
			'Confidence and limitations recorded',
			'Owner and review date assigned',
		],
	},
	qualityRows: [
		{
			key: { text: 'Provenance' },
			value: { text: 'Source project, study, method, date range and linked evidence.' },
		},
		{
			key: { text: 'Confidence' },
			value: { text: 'Evidence strength, sample coverage, limitations and known gaps.' },
		},
		{
			key: { text: 'Reuse guidance' },
			value: { text: 'Where this evidence can be reused and where it must not be applied.' },
		},
		{
			key: { text: 'Review state' },
			value: { text: 'Published, due review, stale or withdrawn.' },
		},
	],
	queueRows: [
		{ queue: 'Candidate artefacts', count: '8', action: 'Review', href: '/pages/repository/review/candidates/' },
		{ queue: 'Due review', count: '12', action: 'Check', href: '/pages/repository/review/stale/' },
		{ queue: 'Taxonomy suggestions', count: '5', action: 'Resolve', href: '/pages/repository/review/taxonomy/' },
	],
	teamDecisions: [
		{
			title: 'Information architecture',
			text: 'Lead with findability. The page starts with search, then offers controlled routes by service area, user group, method and risk.',
		},
		{
			title: 'Service design',
			text: 'Make backstage governance visible. Users need to know why repository evidence is trustworthy before they reuse it.',
		},
		{
			title: 'Research Operations',
			text: 'Keep curation separate from creation. Only reviewed artefacts appear in the repository; candidates move through a queue.',
		},
	],
};
