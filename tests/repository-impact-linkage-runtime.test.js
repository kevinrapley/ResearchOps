import assert from 'node:assert/strict';
import test from 'node:test';
import {
	createRepositoryCandidate,
	readRepositoryArtefact,
} from '../infra/cloudflare/src/service/repository.js';

function createRepositoryMockD1(rows = []) {
	const state = {
		artefacts: rows.map((row) => ({ ...row })),
		tags: [],
		runs: [],
	};

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async run() {
				state.runs.push({ sql, args });
				if (/INSERT INTO rops_repository_artefacts/i.test(sql)) {
					state.artefacts.push({
						id: args[0],
						title: args[1],
						summary: args[2],
						artefact_type: args[3],
						status: 'candidate',
						confidence: args[4],
						evidence_maturity: args[5],
						service_area: args[6],
						user_group: args[7],
						method: args[8],
						risk_area: args[9],
						source_project_id: args[10],
						source_study_id: args[11],
						source_method: args[12],
						sample_summary: args[13],
						limitations: args[14],
						reuse_guidance: args[15],
						do_not_use_for: args[16],
						owner_user_id: args[17],
						reviewed_by_user_id: null,
						pii_cleared: 0,
						consent_scope_confirmed: 0,
						active: 1,
						created_at: args[18],
						updated_at: args[19],
						published_at: null,
						review_due_at: args[20],
						payload_json: args[21],
					});
				}
				return { success: true, meta: { changes: 1 } };
			},
			async first() {
				return null;
			},
			async all() {
				if (/FROM rops_repository_artefacts/i.test(sql) && /status = 'published'/i.test(sql)) {
					return {
						results: state.artefacts.filter(
							(row) =>
								row.status === 'published' &&
								Number(row.active) === 1 &&
								Number(row.pii_cleared) === 1 &&
								Number(row.consent_scope_confirmed) === 1
						),
					};
				}
				if (/FROM rops_repository_artefact_tags/i.test(sql)) return { results: state.tags };
				return { results: [] };
			},
		};
	}

	return {
		state,
		prepare(sql) {
			return statement(sql);
		},
	};
}

function createService(d1) {
	return {
		env: { RESEARCHOPS_D1: d1 },
		log: { warn() {}, error() {}, info() {} },
		corsHeaders() {
			return { 'content-type': 'application/json; charset=utf-8' };
		},
		json(payload, status = 200, headers = {}) {
			return new Response(JSON.stringify(payload), { status, headers });
		},
	};
}

test('candidate payload stores optional summarised impact source metadata without decision links', async () => {
	const d1 = createRepositoryMockD1();
	const service = createService(d1);
	const response = await createRepositoryCandidate(
		service,
		new Request('https://researchops.test/api/repository/artefacts', {
			method: 'POST',
			body: JSON.stringify({
				title: 'Escalation guidance improved onboarding decisions',
				summary: 'Published guidance changed onboarding triage decisions.',
				impactRecordId: 'IMPCT-RCD-123456789abc',
				impactSummary: 'Reduced avoidable support escalations after publication.',
				decisionSummary: 'Service owner used the evidence to change the onboarding triage policy.',
				outcomeSummary: 'Earlier routing to assisted digital support for high-risk users.',
				decisionLink: 'https://internal.example/secret-decision',
			}),
		}),
		'https://researchops.test',
		{ user: { id: 'user_researcher' }, permissions: [{ code: 'repository.view' }] }
	);

	assert.equal(response.status, 201);
	const stored = d1.state.artefacts[0];
	const payload = JSON.parse(stored.payload_json);
	assert.deepEqual(payload.impactSource, {
		impactRecordId: 'IMPCT-RCD-123456789abc',
		impactSummary: 'Reduced avoidable support escalations after publication.',
		decisionSummary: 'Service owner used the evidence to change the onboarding triage policy.',
		outcomeSummary: 'Earlier routing to assisted digital support for high-risk users.',
	});
	assert.equal(JSON.stringify(payload).includes('secret-decision'), false);
});

test('published artefact detail includes impact context summaries', async () => {
	const d1 = createRepositoryMockD1([
		{
			id: 'published-impact-001',
			title: 'Published impact-linked artefact',
			summary: 'Reusable evidence with outcome context.',
			artefact_type: 'finding',
			status: 'published',
			confidence: 'high',
			evidence_maturity: 'reviewed-evidence',
			service_area: 'assisted-digital-support',
			user_group: 'frontline-staff',
			method: 'service-review',
			risk_area: 'workflow-friction',
			source_project_id: 'proj-1',
			source_study_id: 'study-1',
			source_method: 'service-review',
			sample_summary: 'Reviewed synthesis from support teams.',
			limitations: 'Use with current policy context only.',
			reuse_guidance: 'Use when improving support routing.',
			do_not_use_for: 'Do not use as a volume forecast.',
			active: 1,
			pii_cleared: 1,
			consent_scope_confirmed: 1,
			created_at: '2026-06-01T09:00:00Z',
			updated_at: '2026-06-07T09:00:00Z',
			published_at: '2026-06-07T09:00:00Z',
			review_due_at: '2026-12-07',
			payload_json: JSON.stringify({
				impactSource: {
					impactRecordId: 'IMPCT-RCD-123456789abc',
					impactSummary: 'Reduced repeat support contacts.',
					decisionSummary: 'Decision summary suitable for repository reuse.',
					outcomeSummary: 'Outcome summary suitable for repository reuse.',
				},
			}),
		},
	]);
	const service = createService(d1);
	const response = await readRepositoryArtefact(
		service,
		'https://researchops.test',
		'published-impact-001'
	);
	const payload = await response.json();

	assert.equal(response.status, 200);
	assert.equal(payload.artefact.impactSource.impactRecordId, 'IMPCT-RCD-123456789abc');
	assert.equal(
		payload.artefact.impactSource.decisionSummary,
		'Decision summary suitable for repository reuse.'
	);
});
