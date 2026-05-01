/* eslint-env node */

/**
 * @file visual-walkthrough.synthesis-fixtures.mjs
 * @summary Deterministic mocked states for the study synthesis visual walkthrough.
 */

export const synthesisProjectId = 'recVisualProject001';
export const synthesisStudyId = 'recVisualStudy001';
export const synthesisPath = `/pages/synthesize/?pid=${synthesisProjectId}&sid=${synthesisStudyId}`;

const synthesisEvidenceRoute = /\/api\/synthesis\/evidence(?:\?.*)?$/;
const synthesisSummaryRoute = /\/api\/synthesis(?:\?.*)?$/;
const synthesisClusterCreateRoute = /\/api\/synthesis\/clusters(?:\?.*)?$/;
const synthesisClusterUpdateRoute =
	/\/api\/synthesis\/clusters\/cluster-confidence-start(?:\?.*)?$/;
const synthesisThemeCreateRoute = /\/api\/synthesis\/themes(?:\?.*)?$/;

export const synthesisStudy = {
	id: synthesisStudyId,
	studyId: 'STUDY-ADS-001',
	projectId: synthesisProjectId,
	projectName: 'Assisted Digital Support Discovery',
	title: 'Assisted digital support interview round 1',
	method: 'Moderated interview',
	status: 'Analysis',
};

export const synthesisEvidence = [
	{
		id: 'ev-confidence-before-start',
		sessionId: 'session-assisted-digital-01',
		sourceLabel: 'Session 1 · Applicant with low digital confidence',
		excerpt:
			'I was not sure whether I had the right documents before I started, so I nearly called the helpline instead of continuing online.',
		tags: ['confidence', 'before-start', 'assisted-digital'],
	},
	{
		id: 'ev-language-support',
		sessionId: 'session-assisted-digital-02',
		sourceLabel: 'Session 2 · Support worker',
		excerpt:
			'People often need to understand what evidence is being asked for before they feel ready to enter anything into the form.',
		tags: ['language-support', 'evidence', 'trust'],
	},
	{
		id: 'ev-operational-handoff',
		sessionId: 'session-assisted-digital-03',
		sourceLabel: 'Session 3 · Caseworker',
		excerpt:
			'Staff need a clear way to recognise when a user cannot complete the journey without a supported handoff.',
		tags: ['handoff', 'operations', 'support'],
	},
];

export const synthesisEmptyCluster = {
	id: 'cluster-confidence-start',
	label: 'Confidence before the form starts',
	description: 'Evidence about how users judge whether they are ready to begin the service.',
	evidenceIds: [],
};

export const synthesisClusterWithEvidence = {
	...synthesisEmptyCluster,
	evidenceIds: ['ev-confidence-before-start', 'ev-language-support'],
};

export const synthesisTheme = {
	id: 'theme-confidence-before-start',
	clusterId: 'cluster-confidence-start',
	label: 'Digital confidence is shaped before the form starts',
	description:
		'Users decide whether to continue based on evidence expectations, support routes and confidence before they begin entering details.',
	evidenceIds: ['ev-confidence-before-start', 'ev-language-support'],
};

export function synthesisMockRoutes({
	evidence = synthesisEvidence,
	clusters = [],
	themes = [],
	extraRoutes = [],
} = {}) {
	return [
		{
			url: synthesisEvidenceRoute,
			method: 'GET',
			body: {
				ok: true,
				study: synthesisStudy,
				evidence,
			},
		},
		{
			url: synthesisSummaryRoute,
			method: 'GET',
			body: {
				ok: true,
				study: synthesisStudy,
				clusters,
				themes,
			},
		},
		...extraRoutes,
	];
}

export function clusterCreateMockRoute() {
	return {
		url: synthesisClusterCreateRoute,
		method: 'POST',
		body: {
			ok: true,
			cluster: synthesisEmptyCluster,
		},
	};
}

export function clusterUpdateMockRoute() {
	return {
		url: synthesisClusterUpdateRoute,
		method: 'PATCH',
		body: {
			ok: true,
			cluster: synthesisClusterWithEvidence,
		},
	};
}

export function themeCreateMockRoute() {
	return {
		url: synthesisThemeCreateRoute,
		method: 'POST',
		body: {
			ok: true,
			theme: synthesisTheme,
		},
	};
}
