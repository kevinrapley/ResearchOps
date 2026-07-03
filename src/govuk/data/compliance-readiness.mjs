export const complianceScopeSummary = {
	status: 'Readiness artefact',
	service: 'ResearchOps platform',
	boundary:
		'The scoped service is the ResearchOps web service, Worker API, data stores, deployment pipeline, integrations and operating controls used to plan, run, evidence, reuse and govern research operations.',
	assuranceScope:
		'SOC 2 readiness starts with Security, with Confidentiality and Privacy treated as expected candidates because the service can process participant consent records, session notes, research artefacts and other personal data. ISO/IEC 27001 readiness covers the ISMS boundary for the platform and the governance, risk, access, supplier, incident, retention and monitoring processes that support it.',
	nonClaim:
		'This page does not assert SOC 2 compliance or ISO/IEC 27001 certification. It records readiness evidence and gaps for review by security, privacy and service-owner roles.',
};

export const complianceBoundaryItems = [
	{
		title: 'Included systems',
		items: [
			'ResearchOps GOV.UK-rendered pages and authenticated workflows',
			'Cloudflare Pages Functions and Workers API routes',
			'Cloudflare D1 and KV stores used by ResearchOps',
			'GitHub repository controls, CI, release and deployment workflows',
			'Mural, Airtable, email and AI integrations where production data is used',
		],
	},
	{
		title: 'Included data',
		items: [
			'user identifiers, email addresses, team roles and route permissions',
			'participant identifiers, contact details, access needs and consent state',
			'projects, studies, session notes, journals, synthesis outputs and repository records',
			'audit events, security events, retention state and deployment evidence',
			'integration tokens, OAuth state and provider object identifiers',
		],
	},
	{
		title: 'Explicit exclusions',
		items: [
			'wider Home Office enterprise identity, device, HR, finance and network controls',
			'supplier internal control environments beyond supplier-assurance evidence',
			'local developer endpoints except for secure-development access and secret-handling expectations',
			'external research tools unless integrated, imported, exported or synchronised through ResearchOps',
		],
	},
];

export const controlMatrix = [
	{
		controlArea: 'Governance, scope and accountability',
		readinessExpectation:
			'Service ownership, risk ownership, ISMS accountability, scope approval and policy responsibilities are documented and reviewed.',
		soc2Tsc: ['CC1', 'CC2', 'CC3', 'CC5'],
		iso27001AnnexA: ['A.5.1', 'A.5.2', 'A.5.31', 'A.5.35', 'A.5.36'],
		currentEvidence: 'Scope and system boundary, agent trace, repository governance rules.',
		gap: 'Needs named Home Office service owner, information asset owner, senior risk owner and security sign-off.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Risk assessment and treatment',
		readinessExpectation:
			'Information-security risks are identified, assessed, treated, reviewed and connected to control selection.',
		soc2Tsc: ['CC3', 'CC4', 'CC9'],
		iso27001AnnexA: ['A.5.7', 'A.5.8', 'A.5.30', 'A.5.31'],
		currentEvidence:
			'Gap register, security audit triage, release assurance and readiness evidence index.',
		gap: 'Create a service-specific risk register and treatment plan before a SOC 2 or ISO/IEC 27001 claim.',
		status: 'Gap identified',
	},
	{
		controlArea: 'Asset, data and classification inventory',
		readinessExpectation:
			'Systems, stores, bindings, secrets, suppliers and data classes are inventoried, owned and classified.',
		soc2Tsc: ['CC2', 'CC3', 'CC6'],
		iso27001AnnexA: ['A.5.9', 'A.5.12', 'A.5.13', 'A.5.34'],
		currentEvidence:
			'Boundary document identifies service components, data classes and integrations.',
		gap: 'Produce an owned asset and data inventory with data classification, retention and supplier roles.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Identity, access and privileged actions',
		readinessExpectation:
			'Authentication, active-account state, team membership, route permissions and privileged actions are enforced and reviewable.',
		soc2Tsc: ['CC6'],
		iso27001AnnexA: ['A.5.15', 'A.5.16', 'A.5.17', 'A.5.18', 'A.8.2', 'A.8.3', 'A.8.5'],
		currentEvidence:
			'Passwordless auth, active-account checks, route permissions, team roles and auth route tests.',
		gap: 'Define access-review cadence, privileged-access evidence and joiner, mover and leaver control evidence.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Secure development and change management',
		readinessExpectation:
			'Code, infrastructure and content changes are reviewed, tested, traceable and deployed through controlled workflows.',
		soc2Tsc: ['CC7', 'CC8'],
		iso27001AnnexA: ['A.5.8', 'A.8.25', 'A.8.26', 'A.8.27', 'A.8.28', 'A.8.29', 'A.8.31', 'A.8.32'],
		currentEvidence:
			'Pull-request workflow, CI, route-state tests, trace policy, linting, build and validation gates.',
		gap: 'Document formal SDLC control ownership, release approval evidence and emergency-change handling.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Application, network and cryptographic protection',
		readinessExpectation:
			'The application is protected against unauthorised access, unsafe browser behaviour, weak configuration and exposed secrets.',
		soc2Tsc: ['CC6', 'CC7'],
		iso27001AnnexA: ['A.8.8', 'A.8.9', 'A.8.20', 'A.8.21', 'A.8.22', 'A.8.24', 'A.8.26', 'A.8.29'],
		currentEvidence:
			'Security headers, CSRF controls, rate limits, secret-name checks and Worker hardening from PR #460.',
		gap: 'Add recurring vulnerability-management evidence and configuration review evidence for production.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Logging, monitoring and audit evidence',
		readinessExpectation:
			'Security, auth, deployment and operational events are logged with PII minimisation and reviewed through agreed monitoring routines.',
		soc2Tsc: ['CC4', 'CC7'],
		iso27001AnnexA: ['A.5.28', 'A.8.15', 'A.8.16', 'A.8.17', 'A.8.34'],
		currentEvidence:
			'Audit event implementation, log-minimisation hardening and validation traces.',
		gap: 'Define log retention, alert thresholds, review cadence and evidence collection responsibilities.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Incident response and learning',
		readinessExpectation:
			'Security events are reported, assessed, escalated, resolved, evidenced and reviewed for learning.',
		soc2Tsc: ['CC7'],
		iso27001AnnexA: ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27', 'A.5.28', 'A.6.8'],
		currentEvidence:
			'Research operations incident templates, service-specific runbooks, personal data breach handling process and planned exercise record.',
		gap: 'Complete a tabletop or simulated incident exercise, record outcomes and obtain service-owner, security and privacy sign-off.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Supplier and integration assurance',
		readinessExpectation:
			'Cloudflare, GitHub, Airtable, Mural, email and AI providers are assessed for role, data flow, contract, location and assurance evidence.',
		soc2Tsc: ['CC2', 'CC3', 'CC9'],
		iso27001AnnexA: ['A.5.19', 'A.5.20', 'A.5.21', 'A.5.22', 'A.5.23'],
		currentEvidence:
			'Boundary document identifies supplier integrations and inherited-control assumptions.',
		gap: 'Create a supplier and subprocessor register with assurance evidence, review cadence and data-processing terms.',
		status: 'Gap identified',
	},
	{
		controlArea: 'Privacy, retention and data minimisation',
		readinessExpectation:
			'Personal data is minimised, retained only as needed, protected in logs and handled under agreed GDPR and DPIA controls.',
		soc2Tsc: ['CC6', 'P'],
		iso27001AnnexA: ['A.5.33', 'A.5.34', 'A.8.10', 'A.8.11', 'A.8.12'],
		currentEvidence:
			'Retention policy, retention enforcement, PII warnings, audit-log minimisation and consent workflows.',
		gap: 'Confirm DPIA, ROPA references, lawful basis, data-sharing positions and special-category handling.',
		status: 'Partially evidenced',
	},
	{
		controlArea: 'Availability, continuity and recovery',
		readinessExpectation:
			'Availability commitments, backup, recovery, continuity and resilience controls are defined and tested if in assurance scope.',
		soc2Tsc: ['A', 'CC7'],
		iso27001AnnexA: ['A.5.29', 'A.5.30', 'A.8.13', 'A.8.14'],
		currentEvidence: 'Cloudflare deployment model, validation gates and release assurance.',
		gap: 'Decide whether Availability is in SOC 2 scope, then define SLOs, RTO/RPO, backup and restore evidence.',
		status: 'Open decision',
	},
	{
		controlArea: 'Compliance evidence and independent review',
		readinessExpectation:
			'Control evidence is versioned, reviewed, approved and available for internal assurance and external assessment.',
		soc2Tsc: ['CC4', 'CC5'],
		iso27001AnnexA: ['A.5.35', 'A.5.36', 'A.5.37'],
		currentEvidence:
			'Evidence index, trace artefacts, validation summaries and release assurance documents.',
		gap: 'Create a Statement of Applicability and a SOC 2 control-to-evidence mapping with owners and frequencies.',
		status: 'Gap identified',
	},
];

export const readinessEvidenceGaps = [
	'Service owner, information asset owner, senior risk owner and security representative sign-off',
	'asset and data inventory',
	'DPIA, ROPA and lawful-basis references',
	'ISMS scope, risk assessment, risk treatment plan and Statement of Applicability',
	'information security risk register and treatment plan',
	'SOC 2 control-to-evidence mapping at criteria level',
	'ISO/IEC 27001 Statement of Applicability',
	'supplier and subprocessor register',
	'access review, completed incident response test evidence, backup and monitoring evidence',
];

export const standardsReferences = [
	{
		title: 'AICPA SOC suite of services',
		href: 'https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services',
	},
	{
		title: 'ISO/IEC 27001 information security management systems',
		href: 'https://www.iso.org/standard/27001',
	},
];

export const complianceReadinessContext = {
	pageTitle: 'SOC 2 and ISO 27001 readiness - ResearchOps Demo Suite',
	serviceName: 'ResearchOps Demo Suite',
	activeNavigation: '',
	complianceScopeSummary,
	complianceBoundaryItems,
	controlMatrix,
	readinessEvidenceGaps,
	standardsReferences,
};
