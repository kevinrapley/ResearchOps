/* eslint-env node */

/**
 * @file visual-walkthrough.operational-fixtures.mjs
 * @summary Deterministic operational context for visual walkthrough states that need project or study scope.
 */

export const operationalProjectId = 'recVisualProject001';
export const operationalStudyId = 'recVisualStudy001';
export const operationalParticipantId = 'recVisualParticipant001';
export const operationalJournalEntryId = 'recVisualJournal001';
export const operationalAuthUserId = 'usr_visual_team_admin';
export const operationalAuthTeamId = 'team_researchops_core';
export const operationalAuthTeamName = 'ResearchOps Core';

export const operationalPaths = {
	accountSignIn: '/pages/account/sign-in/index.html',
	accountRegistration: '/pages/account/register/index.html',
	projectDashboard: `/pages/project-dashboard/?id=${operationalProjectId}`,
	addStudy: `/pages/study/new/?id=${operationalProjectId}`,
	addParticipant: `/pages/project-dashboard/participants/?id=${operationalProjectId}`,
	importParticipants: `/pages/project-dashboard/participants/import/?id=${operationalProjectId}`,
	outcomes: `/pages/projects/outcomes/?id=${operationalProjectId}`,
	journals: `/pages/projects/journals/?id=${operationalProjectId}`,
	journalEntry: `/pages/journal/entry/?id=${operationalJournalEntryId}&project=${operationalProjectId}`,
	journalEntryEdit: `/pages/journal/edit/?id=${operationalJournalEntryId}&project=${operationalProjectId}`,
	study: `/pages/study/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	studyGuides: `/pages/study/guides/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	studyNoteTakersObservers: `/pages/study/note-takers-observers/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	studyParticipants: `/pages/study/participants/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	studySession: `/pages/study/session/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	studyConsentForms: `/pages/study/consent-forms/?pid=${operationalProjectId}&sid=${operationalStudyId}`,
	teamRegistrationRequests: '/pages/team/registration-requests/',
	teamAccessRequests: '/pages/team/access-requests/',
	teamRoleAssignments: '/pages/team/role-assignments/',
};

export const operationalProject = {
	id: operationalProjectId,
	LocalId: operationalProjectId,
	localId: operationalProjectId,
	name: 'Assisted Digital Support Discovery',
	Name: 'Assisted Digital Support Discovery',
	description:
		'This discovery examines how caseworkers and support staff help people who cannot complete a digital application without assistance.',
	Description:
		'This discovery examines how caseworkers and support staff help people who cannot complete a digital application without assistance.',
	Org: operationalAuthTeamName,
	org: operationalAuthTeamName,
	teamName: operationalAuthTeamName,
	team_name: operationalAuthTeamName,
	team: operationalAuthTeamName,
	teamNames: [operationalAuthTeamName],
	teamIds: [operationalAuthTeamId],
	team_ids: [operationalAuthTeamId],
	Phase: 'Discovery',
	Status: 'Planning research',
	'rops:servicePhase': 'Discovery',
	'rops:projectStatus': 'Planning research',
	objectives: [
		'Understand where users need assisted digital support before, during and after the application journey.',
		'Identify operational signals for accessibility, safeguarding, language support and confidence-related needs.',
		'Assess whether content and contact routes help users decide what to do next.',
	],
	user_groups: [
		'Applicants with low digital confidence',
		'Support workers',
		'Caseworkers',
		'Users with accessibility needs',
	],
	stakeholders: [
		{
			name: 'Priya Shah',
			role: 'Service owner',
			email: 'priya.shah@example.gov.uk',
		},
		{
			name: 'Mark Evans',
			role: 'Operations lead',
			email: 'mark.evans@example.gov.uk',
		},
	],
	createdAt: '2026-04-21T09:30:00.000Z',
	lead_researcher: 'Alex Morgan',
	lead_researcher_email: 'alex.morgan@example.gov.uk',
};

export const operationalStudy = {
	id: operationalStudyId,
	studyId: 'STUDY-ADS-001',
	projectId: operationalProjectId,
	project: operationalProjectId,
	Project: operationalProjectId,
	projects: [operationalProjectId],
	projectName: operationalProject.name,
	title: 'Assisted digital support interview round 1',
	Title: 'Assisted digital support interview round 1',
	method: 'Moderated interview',
	status: 'Planning',
	description:
		'Round 1 interviews exploring confidence, evidence expectations, assisted digital handoffs and support routes before users begin a high-stakes application.',
	createdAt: '2026-04-24T10:00:00.000Z',
};

export const operationalParticipants = [
	{
		id: operationalParticipantId,
		participantId: 'P-ADS-001',
		studyId: operationalStudyId,
		pseudonym: 'Participant A',
		name: 'Participant A',
		userType: 'Applicant with low digital confidence',
		status: 'Scheduled',
		consentStatus: 'Ready for session',
		sessionDate: '2026-05-14',
		sessionTime: '10:30',
	},
	{
		id: 'recVisualParticipant002',
		participantId: 'P-ADS-002',
		studyId: operationalStudyId,
		pseudonym: 'Participant B',
		name: 'Participant B',
		userType: 'Support worker',
		status: 'Screening',
		consentStatus: 'Consent outstanding',
		sessionDate: '2026-05-16',
		sessionTime: '14:00',
	},
];

export const operationalGuides = [
	{
		id: 'recVisualGuide001',
		studyId: operationalStudyId,
		title: 'Assisted digital support discussion guide',
		status: 'Published',
		version: 0,
		updatedAt: '2026-04-26T11:00:00.000Z',
		createdBy: {
			name: 'Alex Morgan',
		},
		sourceMarkdown: `# Assisted digital support discussion guide

## Opening and consent
Confirm the participant understands the research purpose, recording choices and how their contribution will be used.

## Current journey
Ask the participant to describe the last time they needed help with a digital service.

## Support handoff
Explore where they expected support, where they found it and what would have reduced uncertainty.

## Wrap-up
Check whether there is anything else they expected from the service before, during or after the handoff.`,
		variables: {
			study: {
				title: 'Assisted digital support interview round 1',
			},
		},
	},
];

export const operationalJournalEntries = [
	{
		id: operationalJournalEntryId,
		project: operationalProjectId,
		projectId: operationalProjectId,
		localProjectId: operationalProjectId,
		local_project_id: operationalProjectId,
		category: 'perceptions',
		content:
			'Reflection on support handoffs: participants may see assisted digital support as part of the main service rather than a separate channel.',
		tags: ['assisted-digital', 'handoff', 'researcher-reflection'],
		createdAt: '2026-05-07T13:20:00.000Z',
	},
];

export const operationalConsentForms = [
	{
		id: 'recVisualConsentForm001',
		studyId: operationalStudyId,
		title: 'Assisted digital support consent form',
		status: 'Published',
		statements: [
			'I understand what the research is about.',
			'I understand that taking part is voluntary.',
			'I agree that anonymous notes may be used for synthesis.',
		],
	},
];

export const operationalParticipantConsentRecords = [
	{
		id: 'recVisualParticipantConsent001',
		studyId: operationalStudyId,
		participantId: operationalParticipantId,
		status: 'Ready for session',
		withdrawn: false,
		updatedAt: '2026-05-01T09:45:00.000Z',
	},
	{
		id: 'recVisualParticipantConsentSession001',
		studyId: operationalStudyId,
		participantId: 'recPARTICIPANT001',
		status: 'Ready for session',
		withdrawn: false,
		captureMethod: 'Recorded in ResearchOps',
		consentFormVersion: 1,
		responses: {
			recording: 'agreed',
			observers: 'agreed',
			transcription: 'agreed',
		},
		updatedAt: '2026-05-01T10:15:00.000Z',
	},
];

export const operationalSessions = [
	{
		id: 'recVisualSession001',
		studyId: operationalStudyId,
		participantId: operationalParticipantId,
		startsAt: '2026-05-14T09:30:00.000Z',
		status: 'Scheduled',
		type: 'Remote',
	},
];

export const operationalAuthContext = {
	ok: true,
	authenticated: true,
	provider: 'cloudflare_access',
	isResearchOpsCoreTeamAdmin: true,
	user: {
		id: operationalAuthUserId,
		email: 'team.admin@example.gov.uk',
		displayName: 'Team Admin',
		accountStatus: 'active',
	},
	activeTeam: {
		id: operationalAuthTeamId,
		name: operationalAuthTeamName,
	},
	teams: [
		{
			id: operationalAuthTeamId,
			name: operationalAuthTeamName,
		},
	],
	memberTeams: [
		{
			id: operationalAuthTeamId,
			name: operationalAuthTeamName,
		},
	],
	teamMemberships: [
		{
			teamId: operationalAuthTeamId,
			teamName: operationalAuthTeamName,
			roles: [
				{
					key: 'team_admin',
					label: 'Team Admin',
				},
			],
		},
	],
	roles: [
		{
			key: 'team_admin',
			label: 'Team Admin',
			description: 'Can manage team membership, roles and general audit oversight.',
			sensitive: true,
			scopeType: 'team',
			scopeId: operationalAuthTeamId,
		},
	],
	permissions: [
		{
			code: 'team.manage',
			label: 'Manage team membership',
			description: 'Can manage team members and team settings.',
			sensitive: true,
			reserved: false,
		},
		{
			code: 'role.assign',
			label: 'Assign roles',
			description: 'Can assign or approve role access where policy permits.',
			sensitive: true,
			reserved: false,
		},
		{
			code: 'audit.view',
			label: 'View audit events',
			description: 'Can view general audit events.',
			sensitive: true,
			reserved: false,
		},
	],
};

export const operationalRegistrationRequests = [
	{
		id: 'reg_visual_001',
		email: 'alex.morgan@example.gov.uk',
		displayName: 'Alex Morgan',
		requestedRole: {
			key: 'user_researcher',
			label: 'Plan, run or analyse user research',
		},
		teamOrService: operationalAuthTeamName,
		requestedReason: 'Planning and analysing the assisted digital support study.',
		status: 'pending_review',
		submittedAt: '2026-05-13T09:00:00.000Z',
	},
];

export const operationalTeamAccessReviewRequests = [
	{
		id: 'tar_visual_001',
		requesterUserId: 'usr_visual_researcher',
		requesterName: 'Morgan Lee',
		requesterEmail: 'morgan.lee@example.gov.uk',
		teamId: operationalAuthTeamId,
		teamName: operationalAuthTeamName,
		message:
			'I need to contribute to the assisted digital support discovery and review repository evidence.',
		status: 'pending',
		requestedAt: '2026-05-14T08:45:00.000Z',
	},
];

const operationalRepositoryArtefacts = [
	{
		id: 'staff-evidence-boundaries',
		title: 'Staff need clearer evidence boundaries before accepting recommendations',
		summary:
			'Staff need to understand the source, confidence and limits of research evidence before applying recommendations.',
		href: '/pages/repository/artefacts/staff-evidence-boundaries/',
		confidence: 'high',
		evidenceMaturity: 'validated-learning',
		method: 'interviews',
		serviceArea: 'assisted-digital-support',
		userGroup: 'frontline-staff',
		riskArea: 'evidence-boundaries',
		reviewDueAt: '2026-08-31',
		provenance: {
			method: 'Moderated interviews',
			sample: 'Assisted digital support discovery',
		},
		limits: {
			limitations: 'Evidence is strongest for staff-facing journeys with clear handoff points.',
			reuseGuidance: 'Use when shaping recommendation review and check-answers journeys.',
			doNotUseFor: 'Do not use as evidence for public-facing eligibility decisions.',
		},
		tags: [
			{ text: 'Assisted digital support', classes: 'govuk-tag--blue' },
			{ text: 'High confidence', classes: 'govuk-tag--green' },
		],
	},
	{
		id: 'check-answers-review-anxiety',
		title: 'Check answers pages reduce review anxiety when change links are explicit',
		summary:
			'Clear change links help users understand what they can safely amend before submitting research planning details.',
		href: '/pages/repository/artefacts/check-answers-review-anxiety/',
		confidence: 'medium',
		evidenceMaturity: 'reviewed-evidence',
		method: 'usability-testing',
		serviceArea: 'research-operations',
		userGroup: 'researchers',
		riskArea: 'decision-confidence',
		reviewDueAt: '2026-09-15',
		provenance: {
			method: 'Usability testing',
			sample: 'Research planning prototype sessions',
		},
		limits: {
			limitations: 'Evidence covers form review journeys, not policy approvals.',
			reuseGuidance: 'Use for check-answers pages and route-back interactions.',
			doNotUseFor: 'Do not use as evidence for legal declaration journeys.',
		},
		tags: [
			{ text: 'Check answers', classes: 'govuk-tag--purple' },
			{ text: 'Reviewed evidence', classes: 'govuk-tag--green' },
		],
	},
];

const operationalRepositoryFilters = [
	{
		name: 'service_area',
		label: 'Service area',
		items: [
			{ value: 'assisted-digital-support', label: 'Assisted digital support', count: 1 },
			{ value: 'research-operations', label: 'Research operations', count: 1 },
		],
	},
	{
		name: 'user_group',
		label: 'User group',
		items: [
			{ value: 'frontline-staff', label: 'Frontline staff', count: 1 },
			{ value: 'researchers', label: 'Researchers', count: 1 },
		],
	},
	{
		name: 'method',
		label: 'Method',
		items: [
			{ value: 'interviews', label: 'Moderated interviews', count: 1 },
			{ value: 'usability-testing', label: 'Usability testing', count: 1 },
		],
	},
	{
		name: 'risk_area',
		label: 'Risk or constraint',
		items: [
			{ value: 'evidence-boundaries', label: 'Evidence boundaries', count: 1 },
			{ value: 'decision-confidence', label: 'Decision confidence', count: 1 },
		],
	},
	{
		name: 'maturity',
		label: 'Evidence maturity',
		items: [
			{ value: 'validated-learning', label: 'Validated learning', count: 1 },
			{ value: 'reviewed-evidence', label: 'Reviewed evidence', count: 1 },
		],
	},
];

const operationalRepositoryQueues = [
	{
		queue: 'Candidate artefacts',
		key: 'candidates',
		label: 'Candidate artefacts',
		count: '1',
		href: '/pages/repository/review/candidates/',
		action: 'Review',
		current: true,
	},
	{
		queue: 'Due review',
		key: 'stale',
		label: 'Due review',
		count: '1',
		href: '/pages/repository/review/stale/',
		action: 'Check',
		current: false,
	},
	{
		queue: 'Withdrawn artefacts',
		key: 'withdrawn',
		label: 'Withdrawn artefacts',
		count: '0',
		href: '/pages/repository/review/withdrawn/',
		action: 'Inspect',
		current: false,
	},
];

function selectedRepositoryFacet(url) {
	for (const key of ['service_area', 'user_group', 'method', 'risk_area', 'maturity']) {
		const value = url.searchParams.get(key);
		if (!value) continue;
		const filter = operationalRepositoryFilters.find((entry) => entry.name === key);
		const item = filter?.items.find((entry) => entry.value === value);
		return { name: key, value, label: item?.label || value };
	}

	return {};
}

function repositoryArtefactsFor(url) {
	const selected = selectedRepositoryFacet(url);
	if (!selected.value) return operationalRepositoryArtefacts;

	const keyMap = {
		service_area: 'serviceArea',
		user_group: 'userGroup',
		method: 'method',
		risk_area: 'riskArea',
		maturity: 'evidenceMaturity',
	};

	return operationalRepositoryArtefacts.filter(
		(artefact) => artefact[keyMap[selected.name]] === selected.value
	);
}

function operationalRepositoryResponse(requestUrl) {
	const url = new URL(requestUrl);
	const artefacts = repositoryArtefactsFor(url);

	return {
		ok: true,
		source: 'qa-bdd-walkthrough',
		artefacts,
		pagination: {
			page: 1,
			limit: Number(url.searchParams.get('limit') || 10),
			total: artefacts.length,
		},
		selected: selectedRepositoryFacet(url),
		metrics: [
			{ value: String(operationalRepositoryArtefacts.length), label: 'published artefacts' },
			{ value: '2', label: 'linked recommendations' },
			{ value: '1', label: 'due review in 30 days' },
		],
		filters: operationalRepositoryFilters,
		queues: operationalRepositoryQueues,
		catalogue:
			url.searchParams.get('hydrate') === 'full'
				? { artefacts: operationalRepositoryArtefacts }
				: undefined,
	};
}

function operationalRepositoryReviewResponse(queueKey) {
	const queue =
		operationalRepositoryQueues.find((entry) => entry.key === queueKey) ||
		operationalRepositoryQueues[0];
	const item = {
		...operationalRepositoryArtefacts[0],
		id: `${queueKey}-walkthrough-001`,
		queueReason: queue.label,
		updatedAt: '2026-06-16T09:30:00.000Z',
		audit: [
			{
				action: 'queued_for_review',
				actor: 'Repository curator',
				createdAt: '2026-06-16T09:30:00.000Z',
				notes: `${queue.label} walkthrough state.`,
			},
		],
	};

	return {
		ok: true,
		queue: {
			...queue,
			emptyMessage: `No ${queue.label.toLowerCase()} are available.`,
		},
		navigation: operationalRepositoryQueues.map((entry) => ({
			...entry,
			current: entry.key === queueKey,
		})),
		pagination: { page: 1, limit: 10, total: 1 },
		items: [item],
	};
}

export function operationalMockRoutes() {
	return [
		{
			url: /\/api\/me(?:\?.*)?$/,
			method: 'GET',
			body: operationalAuthContext,
		},
		{
			url: /\/api\/auth\/registration-requests(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				requests: operationalRegistrationRequests,
			},
		},
		{
			url: /\/api\/team-access\/requests(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				requests: [],
			},
		},
		{
			url: /\/api\/team-access\/requests\/review(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				requests: operationalTeamAccessReviewRequests,
			},
		},
		{
			url: /\/api\/projects(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				projects: [operationalProject],
				canStartProject: true,
			},
		},
		{
			url: /\/api\/projects\/[^/?]+(?:\?.*)?$/,
			method: 'GET',
			body: operationalProject,
		},
		{
			url: /\/api\/studies(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				study: operationalStudy,
				studies: [operationalStudy],
			},
		},
		{
			url: /\/api\/study-support(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				setup: {
					decision: 'yes',
					saved: true,
				},
				people: [
					{
						name: 'Sam Taylor',
						role: 'Note taker',
						email: 'sam.taylor@example.gov.uk',
					},
				],
			},
		},
		{
			url: /\/api\/participants(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				participants: operationalParticipants,
			},
		},
		{
			url: /\/api\/guides(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				guides: operationalGuides,
			},
		},
		{
			url: /\/api\/guides\/[^/?]+(?:\?.*)?$/,
			method: 'GET',
			body: ({ url }) => {
				const guideId = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
				const guide =
					operationalGuides.find((entry) => entry.id === guideId) || operationalGuides[0];
				return {
					ok: true,
					guide,
				};
			},
		},
		{
			url: /\/api\/journal-entries\/[^/?]+(?:\?.*)?$/,
			method: 'GET',
			body: ({ url }) => {
				const entryId = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
				const entry =
					operationalJournalEntries.find((item) => item.id === entryId) ||
					operationalJournalEntries[0];
				return {
					ok: true,
					entry,
				};
			},
		},
		{
			url: /\/api\/journal-entries(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				entries: operationalJournalEntries,
			},
		},
		{
			url: /\/api\/consent-forms(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				consentForms: operationalConsentForms,
			},
		},
		{
			url: /\/api\/participant-consent(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				participantConsentRecords: operationalParticipantConsentRecords,
			},
		},
		{
			url: /\/api\/sessions(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				sessions: operationalSessions,
			},
		},
		{
			url: /\/api\/repository\/review\/candidates(?:\?.*)?$/,
			method: 'GET',
			body: operationalRepositoryReviewResponse('candidates'),
		},
		{
			url: /\/api\/repository\/review\/stale(?:\?.*)?$/,
			method: 'GET',
			body: operationalRepositoryReviewResponse('stale'),
		},
		{
			url: /\/api\/repository\/review\/withdrawn(?:\?.*)?$/,
			method: 'GET',
			body: operationalRepositoryReviewResponse('withdrawn'),
		},
		{
			url: /\/api\/repository\/artefacts\/[^/?]+(?:\?.*)?$/,
			method: 'GET',
			body: {
				ok: true,
				artefact: operationalRepositoryArtefacts[0],
			},
		},
		{
			url: /\/api\/repository(?:\?.*)?$/,
			method: 'GET',
			body: ({ url }) => operationalRepositoryResponse(url),
		},
	];
}

export function operationalDefaultState({ title, description, path, waitForText }) {
	const actions = waitForText
		? [
				{
					type: 'waitForText',
					text: waitForText,
				},
			]
		: [];

	return {
		id: 'default',
		title,
		description,
		path,
		mockRoutes: operationalMockRoutes(),
		actions,
	};
}

function risk(riskText, impact, recommendedChange, owner = 'UCD team') {
	return {
		risk: riskText,
		impact,
		recommendedChange,
		owner,
		status: 'Needs UCD review',
	};
}

export const operationalDesignRisks = {
	home: risk(
		'The landing page may look visually complete while failing to explain the safest route into research setup, evidence review or synthesis work.',
		'User researchers could choose the wrong workflow, duplicate records or miss the intended evidence-to-insight traceability model.',
		'Review the page against GOV.UK start-point conventions, link purpose, visible service identity and keyboard-accessible navigation.'
	),
	accountSignIn: risk(
		'The sign-in page may make access look complete without explaining that identity, team membership and role permission are checked separately.',
		'The first Team Admin may sign in successfully but not understand whether D1 role bootstrap, team membership or Cloudflare Access caused a blocked state.',
		'Review the page for clear Cloudflare Access sign-in language, account-state recovery, active team context and a visible route to Team Admin tasks.'
	),
	accountRegistration: risk(
		'The account request page may look like a self-service role selection route rather than a reviewed access request.',
		'Requesters could believe that choosing an activity grants access, while team admins may receive weak evidence for an access decision.',
		'Review the page for purpose-of-use language, check-answers behaviour, field affordance and clear confirmation that no access is granted until review.'
	),
	start: risk(
		'The guided project setup could collect plausible project metadata without making privacy boundaries, required fields and AI-assistance disclosure clear enough.',
		'Poor framing at project creation can create weak objectives, unsafe notes or project records that are difficult to use later.',
		'Evaluate the journey against GOV.UK form, error-summary, hint, button and check-answers patterns before accepting the walkthrough state.'
	),
	projects: risk(
		'The project list may not make project status, ownership and next actions clear enough for a user researcher returning to active work.',
		'Users may open the wrong project or miss whether a project is ready for study, participant or synthesis activity.',
		'Check that the list uses GOV.UK table/list conventions, meaningful link text, visible status language and realistic project records.'
	),
	projectDashboard: risk(
		'The dashboard can appear operational while actions, study readiness and project context are not grounded in a real project ID.',
		'Users may create studies, participants or outcomes against the wrong project or lose confidence in the platform state.',
		'Capture this page with a deterministic project ID, linked studies and operational content, then review action routing and GOV.UK component use.'
	),
	addStudy: risk(
		'The add-study workflow may not preserve the parent project context clearly enough through the form.',
		'A study could be created without a traceable project relationship, weakening downstream planning and synthesis.',
		'Validate the form with a project-scoped URL, clear heading context, GOV.UK form groups, accessible errors and a safe return route.'
	),
	addParticipant: risk(
		'The participant workflow may invite participant data entry without enough study and project context.',
		'Participant records could be attached to the wrong research activity or collect more personal data than the prototype stance allows.',
		'Capture with a project-scoped URL and review labels, privacy copy, required-field errors and navigation back to the owning project.'
	),
	importParticipants: risk(
		'The import workflow may make bulk participant upload look safer or more complete than it is.',
		'Bulk upload mistakes can create consent, scheduling and data-minimisation risks at scale.',
		'Review file-upload markup, CSV guidance, error recovery, privacy warnings and project context before treating the state as acceptable.'
	),
	outcomes: risk(
		'Outcomes can be presented as conclusions without enough visible connection to evidence, insights and recommendations.',
		'Teams may over-trust weak findings or lose the audit trail between evidence and delivery decisions.',
		'Evaluate whether outcomes use GOV.UK summary/list patterns and make evidence provenance, status and next actions visible.'
	),
	journals: risk(
		'Reflexive journal states may look like generic notes rather than a deliberate record of assumptions, decisions and researcher influence.',
		'The team may miss bias, decision provenance or safeguarding reflections that should inform synthesis.',
		'Review category labels, empty states, entry creation, privacy guidance and traceability back to project context.'
	),
	study: risk(
		'The study overview may show readiness controls without enough realistic setup data to prove the session gate works.',
		'Researchers could start sessions before guides, consent materials, participants or participant consent are ready.',
		'Capture with project and study IDs, mocked readiness data and visible links to guides, participants, consent and synthesis.'
	),
	studyGuides: risk(
		'Discussion guide management may not make draft, published and reusable guide states clear enough.',
		'Inconsistent or unapproved guides can affect research quality and comparability across sessions.',
		'Review editor/list structure, heading hierarchy, save/publish affordances and GOV.UK button/link treatment.'
	),
	studyParticipants: risk(
		'The participants view may not distinguish recruitment, scheduling and consent readiness clearly.',
		'Research teams may invite or schedule participants before consent or safeguarding requirements are understood.',
		'Capture with study-scoped participant fixtures and review table/list semantics, status tags, filters and keyboard access.'
	),
	studySession: risk(
		'The session workspace may imply that a session can start without clear participant, consent and study readiness context.',
		'Unsafe session starts can create consent, safeguarding and evidence-quality risks.',
		'Review session controls, timing, note structure, consent visibility and keyboard operation against GOV.UK and WCAG expectations.'
	),
	studyConsentForms: risk(
		'Consent form configuration may not make publishing status, wording and participant comprehension clear enough.',
		'Researchers may rely on incomplete consent statements before participant activity begins.',
		'Review fieldsets, checkboxes, summary content, publication state and error handling using GOV.UK form patterns.'
	),
	participantConsent: risk(
		'Participant consent screens may not separate setup blockers, participant selection and auditable consent recording clearly enough.',
		'Research may proceed without clear, current and reviewable consent evidence.',
		'Capture both blocker and ready states with deterministic study fixtures and review accessible status messaging.'
	),
	teamRegistrationRequests: risk(
		'The account request review page may show pending requests without making the distinction between review evidence and access assignment clear enough.',
		'Team admins could treat requested use as an approved role or fail to understand the next step required to add the person to the active team.',
		'Review the page for read-only request evidence, clear assignment handoff and safe handling of pending account requests.'
	),
	teamRoleAssignments: risk(
		'The role-assignment UI may make sensitive access changes feel routine without enough target-user certainty, permission visibility or audit-ready justification.',
		'Team Admins could grant powerful roles to the wrong person or miss the consequences of Safeguarding Lead and Team Admin access.',
		'Review target identifier behaviour, sensitive-role confirmations, error recovery, visible permission codes and audit-reason copy with the seeded Team Admin context.'
	),
	search: risk(
		'Search may return visually plausible results without making scope, result type and relevance clear.',
		'Users may treat weak or unrelated results as evidence for a project decision.',
		'Review search input labelling, result summaries, empty states, keyboard access and provenance cues.'
	),
	notes: risk(
		'Notes may be captured without enough context about session, study, source and later synthesis use.',
		'Evidence can become hard to trace, compare or safely reuse.',
		'Review note metadata, source context, privacy guidance, save feedback and accessible form behaviour.'
	),
	consent: risk(
		'Generic consent information may not be clearly connected to the specific study and participant workflow.',
		'Users may misunderstand what consent must be configured, recorded or reviewed before a session.',
		'Review the content against informed consent, plain English, GOV.UK typography and accessible link behaviour.'
	),
	sessions: risk(
		'Sessions may look schedulable without showing readiness, consent and follow-up obligations.',
		'Research activity could be coordinated from incomplete or misleading operational data.',
		'Review status language, date/time presentation, participant context, and links into the session workspace.'
	),
	synthesize: risk(
		'Synthesis states may make clusters and themes look authoritative before evidence quantity, provenance and confidence are clear.',
		'Insights and recommendations could be accepted without sufficient traceability to source evidence.',
		'Review evidence grouping, theme creation, disabled states, provenance details and GOV.UK component conformance.'
	),
};
