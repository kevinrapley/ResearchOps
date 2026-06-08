import assert from 'node:assert/strict';
import {
	applyRepositoryReviewAction,
	listRepositoryReviewQueue,
} from '../infra/cloudflare/src/service/repository.js';

function createRepositoryMockD1({ artefacts = [], tags = [], audits = [] } = {}) {
	const state = {
		artefacts: artefacts.map((row) => ({ ...row })),
		tags: tags.map((row) => ({ ...row })),
		audits: audits.map((row) => ({ ...row })),
		runs: [],
	};

	function queueRows(sql) {
		if (/status = 'candidate' AND active = 1/i.test(sql)) {
			return state.artefacts
				.filter((row) => row.status === 'candidate' && Number(row.active) === 1)
				.sort(
					(a, b) =>
						String(b.updated_at || '').localeCompare(String(a.updated_at || '')) ||
						String(a.title || '').localeCompare(String(b.title || ''))
				);
		}
		if (/status = 'withdrawn' AND active = 1/i.test(sql)) {
			return state.artefacts
				.filter((row) => row.status === 'withdrawn' && Number(row.active) === 1)
				.sort(
					(a, b) =>
						String(b.updated_at || '').localeCompare(String(a.updated_at || '')) ||
						String(a.title || '').localeCompare(String(b.title || ''))
				);
		}
		if (/status = 'published' AND active = 1 AND review_due_at IS NOT NULL/i.test(sql)) {
			return state.artefacts
				.filter(
					(row) =>
						row.status === 'published' &&
						Number(row.active) === 1 &&
						row.review_due_at &&
						Date.parse(row.review_due_at) <= Date.now() + 30 * 24 * 60 * 60 * 1000
				)
				.sort(
					(a, b) =>
						String(a.review_due_at || '').localeCompare(String(b.review_due_at || '')) ||
						String(b.updated_at || '').localeCompare(String(a.updated_at || '')) ||
						String(a.title || '').localeCompare(String(b.title || ''))
				);
		}
		return [];
	}

	function queueCounts() {
		return {
			candidate_count: state.artefacts.filter(
				(row) => row.status === 'candidate' && Number(row.active) === 1
			).length,
			due_review_count: state.artefacts.filter(
				(row) =>
					row.status === 'published' &&
					Number(row.active) === 1 &&
					row.review_due_at &&
					Date.parse(row.review_due_at) <= Date.now() + 30 * 24 * 60 * 60 * 1000
			).length,
			withdrawn_count: state.artefacts.filter(
				(row) => row.status === 'withdrawn' && Number(row.active) === 1
			).length,
		};
	}

	function statement(sql, args = []) {
		return {
			bind(...nextArgs) {
				return statement(sql, nextArgs);
			},
			async run() {
				state.runs.push({ sql, args });

				if (/UPDATE rops_repository_artefacts/i.test(sql)) {
					const artefact = state.artefacts.find((row) => row.id === args[11]);
					if (artefact) {
						artefact.status = args[0];
						artefact.limitations = args[1];
						artefact.reuse_guidance = args[2];
						artefact.do_not_use_for = args[3];
						artefact.reviewed_by_user_id = args[4];
						artefact.pii_cleared = args[5];
						artefact.consent_scope_confirmed = args[6];
						artefact.updated_at = args[7];
						artefact.published_at = args[8];
						artefact.review_due_at = args[9];
						artefact.payload_json = args[10];
					}
				}

				if (/INSERT INTO rops_repository_audit/i.test(sql)) {
					state.audits.push({
						id: args[0],
						artefact_id: args[1],
						action: args[2],
						actor_user_id: args[3],
						created_at: args[4],
						payload_json: args[5],
					});
				}

				return { success: true, meta: { changes: 1 } };
			},
			async first() {
				if (
					/SELECT \*/i.test(sql) &&
					/FROM rops_repository_artefacts/i.test(sql) &&
					/WHERE id = \?/i.test(sql)
				) {
					return state.artefacts.find((row) => row.id === args[0]) || null;
				}

				if (/SUM\(CASE WHEN status = 'candidate'/i.test(sql)) {
					return queueCounts();
				}

				return null;
			},
			async all() {
				if (/SELECT \*/i.test(sql) && /FROM rops_repository_artefacts/i.test(sql)) {
					return { results: queueRows(sql) };
				}

				if (/FROM rops_repository_artefact_tags/i.test(sql)) {
					return {
						results: state.tags
							.filter((row) => args.includes(row.artefact_id))
							.sort(
								(a, b) =>
									String(a.tag_type || '').localeCompare(String(b.tag_type || '')) ||
									String(a.tag_label || '').localeCompare(String(b.tag_label || ''))
							),
					};
				}

				if (/FROM rops_repository_audit/i.test(sql)) {
					return {
						results: state.audits
							.filter((row) => args.includes(row.artefact_id))
							.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
					};
				}

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

function curatorAuth() {
	return {
		user: { id: 'user_research_lead' },
		permissions: [{ code: 'repository.curate' }],
	};
}

function baseArtefact(overrides = {}) {
	return {
		id: 'candidate-001',
		title: 'Candidate handoff language needs ownership clarity',
		summary: 'Teams need clearer handoff ownership language.',
		artefact_type: 'finding',
		status: 'candidate',
		confidence: 'medium',
		evidence_maturity: 'reviewed-evidence',
		service_area: 'assisted-digital-support',
		user_group: 'frontline-staff',
		method: 'service-review',
		risk_area: 'operational-risk',
		source_project_id: 'proj-1',
		source_study_id: 'study-1',
		source_method: 'service-review',
		sample_summary: 'Based on reviewed synthesis across assisted digital teams.',
		limitations: 'Needs publication review.',
		reuse_guidance: 'Use for assisted digital escalation journeys.',
		do_not_use_for: 'Do not use as the only evidence for staffing levels.',
		reviewed_by_user_id: '',
		pii_cleared: 0,
		consent_scope_confirmed: 0,
		active: 1,
		created_at: '2026-06-01T09:00:00Z',
		updated_at: '2026-06-07T09:00:00Z',
		published_at: null,
		review_due_at: null,
		payload_json: JSON.stringify({
			queueReason: 'Needs curator review before publication.',
			publicationGate: { reviewStatus: 'submitted' },
		}),
		...overrides,
	};
}

async function responseJson(response) {
	return response.json();
}

async function assertCandidateQueueIsCuratorOnlyAndHydrated() {
	const d1 = createRepositoryMockD1({
		artefacts: [
			...Array.from({ length: 12 }, (_, index) =>
				baseArtefact({
					id: `candidate-${String(index + 1).padStart(3, '0')}`,
					title: `Candidate queue item ${String(index + 1).padStart(3, '0')}`,
					updated_at: `2026-06-${String(20 - index).padStart(2, '0')}T09:00:00Z`,
				})
			),
			baseArtefact({
				id: 'published-001',
				status: 'published',
				title: 'Published reusable insight',
				review_due_at: '2026-06-20',
				published_at: '2026-05-31T09:00:00Z',
				payload_json: JSON.stringify({ queueReason: 'Due review within 30 days.' }),
			}),
			baseArtefact({
				id: 'withdrawn-001',
				status: 'withdrawn',
				title: 'Withdrawn outdated handoff rule',
				payload_json: JSON.stringify({ withdrawalReason: 'Superseded by newer evidence.' }),
			}),
		],
		tags: [
			{
				artefact_id: 'candidate-001',
				tag_slug: 'plain-language',
				tag_label: 'Plain language',
				tag_type: 'topic',
			},
		],
		audits: [
			{
				id: 'audit-1',
				artefact_id: 'candidate-001',
				action: 'candidate.submitted',
				actor_user_id: 'user_researcher',
				created_at: '2026-06-07T08:00:00Z',
				payload_json: JSON.stringify({ notes: 'Submitted for curator review.' }),
			},
		],
	});
	const svc = createService(d1);

	const denied = await listRepositoryReviewQueue(
		svc,
		'',
		'candidates',
		new URL('https://worker.test/api/repository/review/candidates'),
		{
			permissions: [{ code: 'repository.view' }],
		}
	);
	assert.equal(denied.status, 403);
	assert.equal((await responseJson(denied)).error, 'repository_curator_required');

	const response = await listRepositoryReviewQueue(
		svc,
		'',
		'candidates',
		new URL('https://worker.test/api/repository/review/candidates?page=2'),
		curatorAuth()
	);
	assert.equal(response.status, 200);
	const payload = await responseJson(response);

	assert.equal(payload.ok, true);
	assert.equal(payload.queue.key, 'candidates');
	assert.equal(payload.items.length, 2);
	assert.equal(payload.pagination.page, 2);
	assert.equal(payload.pagination.limit, 10);
	assert.equal(payload.pagination.total, 12);
	assert.equal(payload.items[0].id, 'candidate-011');
	assert.equal(payload.items[1].id, 'candidate-012');
	assert.deepEqual(
		payload.navigation.map((entry) => [entry.key, entry.count]),
		[
			['candidates', 12],
			['stale', 1],
			['withdrawn', 1],
		]
	);

	const firstPageResponse = await listRepositoryReviewQueue(
		svc,
		'',
		'candidates',
		new URL('https://worker.test/api/repository/review/candidates'),
		curatorAuth()
	);
	const firstPagePayload = await responseJson(firstPageResponse);
	assert.equal(firstPagePayload.items[0].id, 'candidate-001');
	assert.equal(firstPagePayload.items[0].queueReason, 'Needs curator review before publication.');
	assert.equal(
		firstPagePayload.items[0].tags.some((tag) => tag.text === 'Plain language'),
		true
	);
	assert.equal(firstPagePayload.items[0].history[0].action, 'candidate.submitted');
}

async function assertCandidatePublishWritesAuditAndReviewState() {
	const d1 = createRepositoryMockD1({ artefacts: [baseArtefact()] });
	const svc = createService(d1);

	const request = new Request('https://worker.test/api/repository/review/candidate-001/actions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			outcome: 'publish',
			notes: 'PII and consent scope confirmed. Publish now.',
			reviewDueAt: '2026-12-31',
			reuseGuidance: 'Use for assisted digital handoff design and content checks.',
		}),
	});

	const response = await applyRepositoryReviewAction(
		svc,
		request,
		'',
		'candidate-001',
		curatorAuth()
	);
	assert.equal(response.status, 200);
	const payload = await responseJson(response);
	assert.equal(payload.ok, true);
	assert.equal(payload.status, 'published');
	assert.equal(payload.outcome, 'publish');

	const artefact = d1.state.artefacts.find((row) => row.id === 'candidate-001');
	assert.equal(artefact.status, 'published');
	assert.equal(artefact.pii_cleared, 1);
	assert.equal(artefact.consent_scope_confirmed, 1);
	assert.equal(artefact.review_due_at, '2026-12-31');
	assert.equal(
		artefact.reuse_guidance,
		'Use for assisted digital handoff design and content checks.'
	);

	const persistedPayload = JSON.parse(artefact.payload_json);
	assert.equal(persistedPayload.publicationGate.reviewStatus, 'published');
	assert.equal(persistedPayload.reviewWorkflow.lastOutcome, 'publish');

	const audit = d1.state.audits.find((row) => row.action === 'repository.review.publish');
	assert.ok(audit, 'expected publish audit row');
	const auditPayload = JSON.parse(audit.payload_json);
	assert.equal(auditPayload.notes, 'PII and consent scope confirmed. Publish now.');
	assert.equal(auditPayload.reviewDueAt, '2026-12-31');
}

async function assertWithdrawnRecordsCanBeReinstated() {
	const d1 = createRepositoryMockD1({
		artefacts: [
			baseArtefact({
				id: 'withdrawn-001',
				status: 'withdrawn',
				title: 'Withdrawn channel preference rule',
				pii_cleared: 1,
				consent_scope_confirmed: 1,
				published_at: '2026-05-01T09:00:00Z',
				payload_json: JSON.stringify({ withdrawalReason: 'Superseded by newer evidence.' }),
			}),
		],
	});
	const svc = createService(d1);

	const request = new Request('https://worker.test/api/repository/review/withdrawn-001/actions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			outcome: 'reinstate',
			notes: 'New review confirms the record is still valid for reuse.',
			reviewDueAt: '2027-01-15',
		}),
	});

	const response = await applyRepositoryReviewAction(
		svc,
		request,
		'',
		'withdrawn-001',
		curatorAuth()
	);
	assert.equal(response.status, 200);
	assert.equal((await responseJson(response)).status, 'published');

	const artefact = d1.state.artefacts.find((row) => row.id === 'withdrawn-001');
	assert.equal(artefact.status, 'published');
	assert.equal(artefact.review_due_at, '2027-01-15');
	const payload = JSON.parse(artefact.payload_json);
	assert.equal(typeof payload.reinstatedAt, 'string');
	assert.equal(payload.reinstatedBy, 'user_research_lead');
}

async function assertStaleConfirmCurrentRenewsOverdueReviewDate() {
	const d1 = createRepositoryMockD1({
		artefacts: [
			baseArtefact({
				id: 'stale-002',
				status: 'published',
				title: 'Renew review date when keeping published',
				pii_cleared: 1,
				consent_scope_confirmed: 1,
				review_due_at: '2026-06-15',
				published_at: '2026-05-01T09:00:00Z',
				payload_json: JSON.stringify({ queueReason: 'Review due.' }),
			}),
		],
	});
	const svc = createService(d1);

	const request = new Request('https://worker.test/api/repository/review/stale-002/actions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			outcome: 'confirm_current',
			notes: 'Evidence still stands. Keep published.',
			reviewDueAt: '2026-06-15',
		}),
	});

	const response = await applyRepositoryReviewAction(svc, request, '', 'stale-002', curatorAuth());
	assert.equal(response.status, 200);
	assert.equal((await responseJson(response)).status, 'published');

	const artefact = d1.state.artefacts.find((row) => row.id === 'stale-002');
	assert.notEqual(artefact.review_due_at, '2026-06-15');
	assert.equal(Date.parse(artefact.review_due_at) > Date.now() + 30 * 24 * 60 * 60 * 1000, true);
}

async function assertWithdrawRequiresReasonAndNotes() {
	const d1 = createRepositoryMockD1({
		artefacts: [
			baseArtefact({
				id: 'stale-001',
				status: 'published',
				title: 'Due review artefact',
				pii_cleared: 1,
				consent_scope_confirmed: 1,
				review_due_at: '2026-06-15',
				published_at: '2026-05-01T09:00:00Z',
				payload_json: JSON.stringify({ queueReason: 'Review due.' }),
			}),
		],
	});
	const svc = createService(d1);

	const missingReason = new Request('https://worker.test/api/repository/review/stale-001/actions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			outcome: 'withdraw',
			notes: 'This should be withdrawn.',
		}),
	});
	const missingReasonResponse = await applyRepositoryReviewAction(
		svc,
		missingReason,
		'',
		'stale-001',
		curatorAuth()
	);
	assert.equal(missingReasonResponse.status, 400);
	assert.equal(
		(await responseJson(missingReasonResponse)).error,
		'repository_withdrawal_reason_required'
	);

	const missingNotes = new Request('https://worker.test/api/repository/review/stale-001/actions', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			outcome: 'withdraw',
			withdrawalReason: 'Superseded by newer service flow evidence.',
		}),
	});
	const missingNotesResponse = await applyRepositoryReviewAction(
		svc,
		missingNotes,
		'',
		'stale-001',
		curatorAuth()
	);
	assert.equal(missingNotesResponse.status, 400);
	assert.equal(
		(await responseJson(missingNotesResponse)).error,
		'repository_review_notes_required'
	);
}

await assertCandidateQueueIsCuratorOnlyAndHydrated();
await assertCandidatePublishWritesAuditAndReviewState();
await assertWithdrawnRecordsCanBeReinstated();
await assertStaleConfirmCurrentRenewsOverdueReviewDate();
await assertWithdrawRequiresReasonAndNotes();
