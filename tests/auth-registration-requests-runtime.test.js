import assert from 'node:assert/strict';
import { handleRegistrationRequestsRoute } from '../infra/cloudflare/src/core/auth/registration-requests.js';

class FakeStatement {
	constructor(db, sql) {
		this.db = db;
		this.sql = sql;
		this.values = [];
	}

	bind(...values) {
		this.values = values;
		return this;
	}

	async first() {
		return this.db.first(this.sql, this.values);
	}

	async run() {
		return this.db.run(this.sql, this.values);
	}

	async all() {
		return this.db.all(this.sql, this.values);
	}
}

class FakeD1 {
	constructor() {
		this.users = [];
		this.registrationRequests = [];
		this.authEvents = [];
		this.statements = [];
	}

	prepare(sql) {
		this.statements.push(sql);
		return new FakeStatement(this, sql);
	}

	async first(sql, values) {
		if (sql.includes('FROM auth_users') && sql.includes('lower(email) = lower(?)')) {
			const email = String(values[0] || '').toLowerCase();
			return this.users.find((user) => user.email.toLowerCase() === email) || null;
		}

		if (sql.includes('FROM auth_registration_requests') && sql.includes("request_status = 'pending_review'")) {
			const email = String(values[0] || '').toLowerCase();
			return this.registrationRequests.find((request) => request.normalised_email === email && request.request_status === 'pending_review') || null;
		}

		throw new Error(`Unhandled first statement: ${sql}`);
	}

	async run(sql, values) {
		if (sql.includes('INSERT INTO auth_users')) {
			const [id, email, displayName] = values;
			this.users.push({
				id,
				email,
				display_name: displayName,
				account_status: 'pending',
			});
			return { success: true };
		}

		if (sql.includes('INSERT INTO auth_registration_requests')) {
			const [id, userId, email, normalisedEmail, displayName, requestedRoleKey, requestedRoleLabel, teamOrService, requestedReason] = values;
			this.registrationRequests.push({
				id,
				user_id: userId,
				email,
				normalised_email: normalisedEmail,
				display_name: displayName,
				requested_role_key: requestedRoleKey,
				requested_role_label: requestedRoleLabel,
				team_or_service: teamOrService,
				requested_reason: requestedReason,
				request_status: 'pending_review',
				submitted_at: '2026-05-12T09:00:00.000Z',
			});
			return { success: true };
		}

		if (sql.includes('INSERT INTO auth_events')) {
			const [id, eventType, actorUserId, routePath, metadataJson] = values;
			this.authEvents.push({
				id,
				event_type: eventType,
				actor_user_id: actorUserId,
				route_path: routePath,
				metadata_json: metadataJson,
			});
			return { success: true };
		}

		throw new Error(`Unhandled run statement: ${sql}`);
	}

	async all(sql) {
		if (sql.includes('FROM auth_registration_requests') && sql.includes("WHERE request_status = 'pending_review'")) {
			return {
				results: this.registrationRequests
					.filter((request) => request.request_status === 'pending_review')
					.map((request) => ({
						id: request.id,
						email: request.email,
						display_name: request.display_name,
						requested_role_key: request.requested_role_key,
						requested_role_label: request.requested_role_label,
						team_or_service: request.team_or_service,
						requested_reason: request.requested_reason,
						request_status: request.request_status,
						submitted_at: request.submitted_at,
					})),
			};
		}

		throw new Error(`Unhandled all statement: ${sql}`);
	}
}

function registrationRequest(body) {
	return new Request('https://worker.test/api/auth/registration-requests', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

async function json(response) {
	return response.json();
}

async function assertValidRequestCreatesPendingUserAndRequest() {
	const db = new FakeD1();
	const response = await handleRegistrationRequestsRoute(
		registrationRequest({
			displayName: 'Alex Morgan',
			email: 'Alex.Morgan@example.gov.uk',
			teamOrService: 'ResearchOps Core',
			requestedRoleKey: 'user_researcher',
			requestedReason: 'Planning and analysing the assisted digital support study.',
		}),
		{ RESEARCHOPS_D1: db },
		'/api/auth/registration-requests',
	);

	assert.equal(response.status, 201);
	assert.equal(db.users.length, 1);
	assert.equal(db.registrationRequests.length, 1);
	assert.equal(db.registrationRequests[0].email, 'alex.morgan@example.gov.uk');
	assert.equal(db.registrationRequests[0].requested_role_label, 'Plan, run or analyse user research');
	assert.equal(db.authEvents.some((event) => event.event_type === 'auth.registration_request.created'), true);
	assert.equal(db.statements.some((statement) => statement.includes('auth_role_assignments')), false);

	const payload = await json(response);
	assert.equal(payload.ok, true);
	assert.equal(payload.created, true);
}

async function assertDuplicatePendingRequestReturnsExistingRequest() {
	const db = new FakeD1();
	const body = {
		displayName: 'Alex Morgan',
		email: 'alex.morgan@example.gov.uk',
		teamOrService: 'ResearchOps Core',
		requestedRoleKey: 'note_taker',
		requestedReason: 'Taking notes for moderated research sessions.',
	};

	const firstResponse = await handleRegistrationRequestsRoute(registrationRequest(body), { RESEARCHOPS_D1: db }, '/api/auth/registration-requests');
	const secondResponse = await handleRegistrationRequestsRoute(registrationRequest(body), { RESEARCHOPS_D1: db }, '/api/auth/registration-requests');

	assert.equal(firstResponse.status, 201);
	assert.equal(secondResponse.status, 200);
	assert.equal(db.registrationRequests.length, 1);
	assert.equal(db.authEvents.some((event) => event.event_type === 'auth.registration_request.duplicate_pending'), true);

	const payload = await json(secondResponse);
	assert.equal(payload.ok, true);
	assert.equal(payload.created, false);
	assert.equal(payload.message, 'Your request has already been sent for review.');
}

async function assertInvalidEmailReturnsUserFacingError() {
	const db = new FakeD1();
	const response = await handleRegistrationRequestsRoute(
		registrationRequest({
			displayName: 'Alex Morgan',
			email: 'not-an-email',
			teamOrService: 'ResearchOps Core',
			requestedRoleKey: 'user_researcher',
			requestedReason: 'Planning and analysing the assisted digital support study.',
		}),
		{ RESEARCHOPS_D1: db },
		'/api/auth/registration-requests',
	);

	assert.equal(response.status, 400);
	assert.equal(db.registrationRequests.length, 0);

	const payload = await json(response);
	assert.equal(payload.error, 'email_invalid');
	assert.equal(payload.message, 'Enter an email address in the correct format, like name@example.com.');
}

await assertValidRequestCreatesPendingUserAndRequest();
await assertDuplicatePendingRequestReturnsExistingRequest();
await assertInvalidEmailReturnsUserFacingError();
