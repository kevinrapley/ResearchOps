export const repositoryPageContext = {
	hero: {
		caption: 'ResearchOps',
		title: 'Research repository',
		lead: 'Find published research evidence that has been reviewed, classified and cleared for reuse across services.',
		body: 'Use the repository to understand what teams already know, where the evidence is strong, and what still needs testing.',
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
};

export const repositoryStaticPages = [
	{
		slug: 'service-areas',
		title: 'Browse evidence by service area',
		lead: 'Find published research artefacts connected to a directorate, product family, operational area or cross-agency service.',
		body: 'Service area pages help teams avoid repeating discovery work and understand where reusable evidence already exists.',
		apiPath: '/api/repository?service_area=',
		backHref: '/pages/repository/',
		backText: 'Back to research repository',
		browseType: 'service_area',
		browseLabel: 'Service area',
		browseHint:
			'Choose the operational context that best matches the service decision you are making.',
		sections: [
			{
				heading: 'How to use this route',
				items: [
					'Start with a service area when the team knows the operational context.',
					'Check confidence, limitations and where not to reuse the evidence before applying it.',
				],
			},
			{
				heading: 'Publication boundary',
				items: [
					'Only published, active, PII-cleared and consent-confirmed artefacts appear in service area results.',
				],
			},
		],
	},
	{
		slug: 'user-groups',
		title: 'Browse evidence by user group',
		lead: 'Find reusable evidence about citizens, staff, researchers, decision-makers and operational partners.',
		body: 'Use this route when the user group is the strongest starting point for comparison across services.',
		apiPath: '/api/repository?user_group=',
		backHref: '/pages/repository/',
		backText: 'Back to research repository',
		browseType: 'user_group',
		browseLabel: 'User group',
		browseHint: 'Choose the group whose needs, constraints or behaviours you need to understand.',
		sections: [
			{
				heading: 'How to use this route',
				items: [
					'Compare evidence across projects before starting new recruitment.',
					'Check whether the user group definition matches the service context.',
				],
			},
			{
				heading: 'Publication boundary',
				items: [
					'Participant records, consent records, contact details, recordings and transcripts are not repository artefacts.',
				],
			},
		],
	},
	{
		slug: 'methods',
		title: 'Browse evidence by research method',
		lead: 'Compare evidence from interviews, usability testing, contextual research, surveys and desk research.',
		body: 'Method browsing helps teams understand the strength and limits of evidence before reusing findings.',
		apiPath: '/api/repository?method=',
		backHref: '/pages/repository/',
		backText: 'Back to research repository',
		browseType: 'method',
		browseLabel: 'Research method',
		browseHint: 'Choose the method used to produce the evidence.',
		sections: [
			{
				heading: 'How to use this route',
				items: [
					'Use method filters to understand how evidence was gathered.',
					'Review limitations before treating evidence as transferable.',
				],
			},
			{
				heading: 'Publication boundary',
				items: [
					'A method label does not make evidence reusable on its own. Artefacts still need provenance, confidence and review state.',
				],
			},
		],
	},
	{
		slug: 'risks',
		title: 'Browse evidence by risk or constraint',
		lead: 'Find evidence about inclusion, accessibility, safeguarding, policy, operational risk and confidence gaps.',
		body: 'Risk browsing helps teams find relevant evidence before making decisions that could affect users or service delivery.',
		apiPath: '/api/repository?risk_area=',
		backHref: '/pages/repository/',
		backText: 'Back to research repository',
		browseType: 'risk_area',
		browseLabel: 'Risk or constraint',
		browseHint: 'Choose the constraint or risk theme that could affect reuse.',
		sections: [
			{
				heading: 'How to use this route',
				items: [
					'Start here when risk, inclusion or operational constraints shape the decision.',
					'Check where evidence must not be reused before applying it.',
				],
			},
			{
				heading: 'Publication boundary',
				items: [
					'Sensitive operational detail should be summarised safely and linked to provenance without exposing raw material.',
				],
			},
		],
	},
	{
		slug: 'artefacts',
		title: 'Repository artefact',
		lead: 'View a published repository artefact with provenance, confidence, limitations and reuse guidance.',
		body: 'This route loads the selected published artefact from the repository API using the artefact ID in the page URL.',
		apiPath: '/api/repository/artefacts',
		backHref: '/pages/repository/',
		backText: 'Back to published artefacts',
		detailRoute: true,
		sections: [
			{
				heading: 'Publication boundary',
				items: [
					'Only published, active, PII-cleared and consent-confirmed artefacts can be loaded on this route.',
					'Participant records, consent records, contact details, recordings and transcripts stay outside the repository publication layer.',
				],
			},
		],
	},
	{
		slug: 'artefacts/staff-evidence-boundaries',
		title: 'Staff need clearer evidence boundaries before accepting recommendations',
		lead: 'Published artefact detail pages show provenance, confidence, limitations and reuse guidance for a single repository artefact.',
		body: 'This page is backed by the repository artefact API when available. Static structure keeps the route usable while data loads.',
		apiPath: '/api/repository/artefacts/staff-evidence-boundaries',
		backHref: '/pages/repository/',
		backText: 'Back to published artefacts',
		sections: [
			{
				heading: 'What this artefact must show',
				items: [
					'Source project and study',
					'Evidence basis and method',
					'Confidence, limitations and where not to reuse the evidence',
				],
			},
			{
				heading: 'Publication boundary',
				items: [
					'No participant names, contact details, consent records, session notes, recordings or transcripts are shown.',
				],
			},
		],
	},
	{
		slug: 'artefacts/check-answers-review-anxiety',
		title: 'Check answers pages reduce review anxiety when change links are explicit',
		lead: 'Published pattern evidence for form journeys where users must verify operational or research planning details.',
		body: 'The artefact detail route uses the same publication boundary as repository search.',
		apiPath: '/api/repository/artefacts/check-answers-review-anxiety',
		backHref: '/pages/repository/',
		backText: 'Back to published artefacts',
		sections: [
			{
				heading: 'What this artefact must show',
				items: [
					'Pattern evidence provenance',
					'Evidence confidence',
					'Reuse guidance and limitations',
				],
			},
		],
	},
	{
		slug: 'artefacts/consent-state-workarounds',
		title: 'Operational teams rely on local workarounds when consent states are unclear',
		lead: 'Published evidence pack connecting consent handling, scheduling pressure and cross-team handoff risk.',
		body: 'This route is safe for repository users because raw consent records and participant details stay outside the publication layer.',
		apiPath: '/api/repository/artefacts/consent-state-workarounds',
		backHref: '/pages/repository/',
		backText: 'Back to published artefacts',
		sections: [
			{
				heading: 'What this artefact must show',
				items: [
					'Consent-scope confirmation',
					'Limitations',
					'Where this evidence must not be applied',
				],
			},
		],
	},
	{
		slug: 'artefacts/lightweight-capture-before-tagging',
		title: 'Researchers need lightweight capture before structured tagging',
		lead: 'Published method learning from session note capture and synthesis workflow feedback.',
		body: 'The repository presents reusable learning without exposing raw notes or unreleased synthesis.',
		apiPath: '/api/repository/artefacts/lightweight-capture-before-tagging',
		backHref: '/pages/repository/',
		backText: 'Back to published artefacts',
		sections: [
			{
				heading: 'What this artefact must show',
				items: ['Source study context', 'Method learning', 'Reuse guidance and confidence'],
			},
		],
	},
	{
		slug: 'review/candidates/new',
		title: 'Create candidate artefact',
		lead: 'Create a candidate artefact from reviewed synthesis when it is safe and useful to reuse.',
		body: 'Candidate artefacts are not visible in repository search until review, PII clearance and consent-scope checks are complete.',
		apiPath: '/api/repository/artefacts',
		backHref: '/pages/repository/',
		backText: 'Back to research repository',
		candidateRoute: true,
		sections: [
			{
				heading: 'Publication gates',
				items: [
					'PII check passed',
					'Consent scope confirmed',
					'Evidence linked',
					'Confidence and limitations recorded',
					'Owner and review date assigned',
				],
			},
		],
	},
	{
		slug: 'review/candidates',
		title: 'Candidate artefacts',
		lead: 'Review candidate artefacts before they are published to the repository.',
		body: 'This queue is for users with repository curation permission. Ordinary repository users only see published artefacts.',
		apiPath: '/api/repository',
		backHref: '/pages/repository/',
		backText: 'Back to curator workbench',
		sections: [
			{
				heading: 'Review checks',
				items: [
					'Confirm publication purpose',
					'Check source evidence links',
					'Record limitations and where not to reuse the evidence',
				],
			},
		],
	},
	{
		slug: 'review/stale',
		title: 'Due review',
		lead: 'Check published artefacts that are due for scheduled review.',
		body: 'Review keeps repository evidence trustworthy and prevents stale findings being reused without context.',
		apiPath: '/api/repository',
		backHref: '/pages/repository/',
		backText: 'Back to curator workbench',
		sections: [
			{
				heading: 'Review outcomes',
				items: [
					'Keep published',
					'Update limitations or reuse guidance',
					'Withdraw from repository search',
				],
			},
		],
	},
	{
		slug: 'review/withdrawn',
		title: 'Withdrawn artefacts',
		lead: 'Inspect artefacts that have been withdrawn from repository search.',
		body: 'Withdrawn artefacts remain governed records but are not shown to ordinary repository users.',
		apiPath: '/api/repository',
		backHref: '/pages/repository/',
		backText: 'Back to curator workbench',
		sections: [
			{
				heading: 'Withdrawal reasons',
				items: ['Evidence is stale', 'Consent scope changed', 'Reuse guidance no longer applies'],
			},
		],
	},
];
