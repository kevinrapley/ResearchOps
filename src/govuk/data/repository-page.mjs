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
};
