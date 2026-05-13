import { resolveAuthenticatedContext } from './access.js';
import { assertRoutePermission, routePermissionErrorResponse } from './route-permissions.js';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

const REQUESTED_ROLES = Object.freeze({
	user_researcher: 'Plan, run or analyse user research',
	research_lead: 'Plan, run or analyse user research',
	note_taker: 'Take notes in research sessions',
	session_observer: 'Observe research sessions',
	service_designer: 'Use research evidence to design or improve a service',
	content_designer: 'Use research evidence to design or improve a service',
	interaction_designer: 'Use research evidence to design or improve a service',
	team_admin: 'Manage team access',
	other: 'Something else',
});

class RegistrationRequestError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function dbFor(env = {}) {
	const db = env.RESEARCHOPS_D1;
	if (!db || typeof db.prepare !== 'function') {
		throw new RegistrationRequestError(
			503,
			'registration_request_store_unavailable',
			'Registration requests cannot be sent right now.',
		);
	}
	return db;
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function cleanText(value) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function normaliseEmail(value) {
	return cleanText(value).toLowerCase();
}

function emailFor(value) {
	const email = normaliseEmail(value);
	if (!email) throw new RegistrationRequestError(400, 'email_required', 'Enter your email address.');
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		throw new RegistrationRequestError(400, 'email_invalid', 'Enter an email address in the correct format, like name@example.com.');
	}
	return email;
}

function displayNameFor(value) {
	const displayName = cleanText(value);
	if (!displayName) throw new RegistrationRequestError(400, 'display_name_required', 'Enter your full name.');
	if (displayName.length < 2) throw new RegistrationRequestError(400, 'display_name_too_short', 'Enter your full name.');
	if (displayName.length > 120) throw new RegistrationRequestError(400, 'display_name_too_long', 'Full name must be 120 characters or fewer.');
	return displayName;
}

function teamOrServiceFor(value) {
	const teamOrService = cleanText(value);
	if (!teamOrService) throw new RegistrationRequestError(400, 'team_or_service_required', 'Enter the team or service you need access for.');
	if (teamOrService.length > 160) {
		throw new RegistrationRequestError(400, 'team_or_service_too_long', 'Team or service name must be 160 characters or fewer.');
	}
	return teamOrService;
}

function requestedReasonFor(value) {
	const requestedReason = cleanText(value);
	if (!requestedReason) throw new RegistrationRequestError(400, 'requested_reason_required', 'Enter why you need access.');
	if (requestedReason.length < 12) throw new RegistrationRequestError(400, 'requested_reason_too_short', 'Tell us a little more about why you need access.');
	if (requestedReason.length > 800) throw new RegistrationRequestError(400, 'requested_reason_too_long', 'Reason for access must be 800 characters or fewer.');
	return requestedReason;
}

function requestedRoleFor(body) {
	const key = cleanText(body.requestedRoleKey);
	if (!key) throw new RegistrationRequestError(400, 'requested_role_required', 'Select what you need to use ResearchOps for.');
	if (!REQUESTED_ROLES[key]) throw new RegistrationRequestError(400, 'requested_role_invalid', 'Select what you need to use ResearchOps for.');

	if (key !== 'other') return { key, label: REQUESTED_ROLES[key] };

	const otherRole = cleanText(body.otherRole);
	if (!otherRole) throw new RegistrationRequestError(400, 'other_role_required', 'Enter what you need to use ResearchOps for.');
	if (otherRole.length > 120) throw new RegistrationRequestError(400, 'other_role_too_long', 'Role name must be 120 characters or fewer.');
	return { key, label: otherRole };
}

async function readJson(request) {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
		return body;
	} catch {
		throw new RegistrationRequestError(400, 'invalid_request', 'Check the information you have entered.');
	}
}

async function findUserByEmail(db, email) {
	return db
		.prepare(`
			SELECT id, email, display_name, account_status
			FROM auth_users
			WHERE lower(email) = lower(?)
			LIMIT 1
		`)
		.bind(email)
		.first();
}

async function ensurePendingUser(db, email, displayName) {
	const existing = await findUserByEmail(db, email);
	if (existing) return existing;

	await db
		.prepare(`
			INSERT INTO auth_users (id, email, display_name, account_status)
			VALUES (?, ?, ?, 'pending')
		`)
		.bind(makeId('usr'), email, displayName)
		.run();

	return findUserByEmail(db, email);
}

async function readPendingRequest(db, email) {
	return db
		.prepare(`
			SELECT id, request_status, submitted_at
			FROM auth_registration_requests
			WHERE normalised_email = ? AND request_status = 'pending_review'
			LIMIT 1
		`)
		.bind(email)
		.first();
}

async function writeRegistrationRequest(db, request, user, payload) {
	const registrationRequestId = makeId('reg');
	await db
		.prepare(`
			INSERT INTO auth_registration_requests
				(id, user_id, email, normalised_email, display_name, requested_role_key, requested_role_label, team_or_service, requested_reason)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			registrationRequestId,
			user.id,
			payload.email,
			payload.email,
			payload.displayName,
			payload.requestedRole.key,
			payload.requestedRole.label,
			payload.teamOrService,
			payload.requestedReason,
		)
		.run();

	await recordRegistrationEvent(db, request, 'auth.registration_request.created', {
		userId: user.id,
		registrationRequestId,
		email: payload.email,
		requestedRoleKey: payload.requestedRole.key,
		teamOrService: payload.teamOrService,
	});

	return registrationRequestId;
}

async function recordRegistrationEvent(db, request, type, metadata = {}) {
	try {
		await db
			.prepare(`
				INSERT INTO auth_events (id, event_type, actor_user_id, provider, route_path, metadata_json)
				VALUES (?, ?, ?, 'researchops_registration', ?, ?)
			`)
			.bind(
				makeId('evt'),
				type,
				metadata.userId || null,
				new URL(request.url).pathname,
				JSON.stringify(metadata),
			)
			.run();
	} catch {
		// Registration should still succeed if the audit event cannot be recorded.
	}
}

async function submitRegistrationRequest(request, env) {
	const db = dbFor(env);
	const body = await readJson(request);
	const email = emailFor(body.email);
	const displayName = displayNameFor(body.displayName);
	const teamOrService = teamOrServiceFor(body.teamOrService);
	const requestedReason = requestedReasonFor(body.requestedReason);
	const requestedRole = requestedRoleFor(body);
	const user = await ensurePendingUser(db, email, displayName);
	const existingPendingRequest = await readPendingRequest(db, email);

	if (existingPendingRequest) {
		await recordRegistrationEvent(db, request, 'auth.registration_request.duplicate_pending', {
			userId: user.id,
			registrationRequestId: existingPendingRequest.id,
			email,
		});
		return {
			created: false,
			requestId: existingPendingRequest.id,
		};
	}

	return {
		created: true,
		requestId: await writeRegistrationRequest(db, request, user, {
			email,
			displayName,
			teamOrService,
			requestedReason,
			requestedRole,
		}),
	};
}

async function listRegistrationRequests(request, env) {
	const db = dbFor(env);
	const context = await resolveAuthenticatedContext(request, env);
	await assertRoutePermission(request, env, context);

	const result = await db
		.prepare(`
			SELECT
				id,
				email,
				display_name,
				requested_role_key,
				requested_role_label,
				team_or_service,
				requested_reason,
				request_status,
				submitted_at
			FROM auth_registration_requests
			WHERE request_status = 'pending_review'
			ORDER BY submitted_at ASC
			LIMIT 100
		`)
		.all();

	return (result.results || []).map((item) => ({
		id: item.id,
		email: item.email,
		displayName: item.display_name,
		requestedRole: {
			key: item.requested_role_key,
			label: item.requested_role_label,
		},
		teamOrService: item.team_or_service,
		requestedReason: item.requested_reason,
		status: item.request_status,
		submittedAt: item.submitted_at,
	}));
}

function registrationRequestErrorResponse(error) {
	if (!(error instanceof RegistrationRequestError)) throw error;
	return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
}

export async function handleRegistrationRequestsRoute(request, env, apiPath) {
	try {
		if (request.method === 'POST' && apiPath === '/api/auth/registration-requests') {
			const result = await submitRegistrationRequest(request, env);
			return jsonResponse(
				{
					ok: true,
					created: result.created,
					requestId: result.requestId,
					message: result.created ? 'Your request has been sent for review.' : 'Your request has already been sent for review.',
				},
				result.created ? 201 : 200,
			);
		}

		if (request.method === 'GET' && apiPath === '/api/auth/registration-requests') {
			return jsonResponse({ ok: true, requests: await listRegistrationRequests(request, env) });
		}

		return jsonResponse({ ok: false, error: 'not_found', message: 'Registration request route not found.' }, 404);
	} catch (error) {
		try {
			return registrationRequestErrorResponse(error);
		} catch {}

		try {
			return routePermissionErrorResponse(error);
		} catch {}

		return jsonResponse(
			{
				ok: false,
				error: 'registration_request_error',
				message: 'Registration request could not be completed.',
			},
			500,
		);
	}
}

export const registrationRequestRoles = REQUESTED_ROLES;
