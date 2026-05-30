import { resolveAuthenticatedContext } from './access-scoped.js';
import { assertRoutePermission, routePermissionErrorResponse } from './route-permissions.js';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

class TeamAccessRequestError extends Error {
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
		throw new TeamAccessRequestError(503, 'team_access_store_unavailable', 'Team access requests cannot be sent right now.');
	}
	return db;
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function cleanText(value) {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function normaliseReference(value) {
	return cleanText(value).toLowerCase();
}

function teamReferenceFor(value) {
	const reference = cleanText(value);
	if (!reference) throw new TeamAccessRequestError(400, 'team_reference_required', 'Enter a team name or invitation code.');
	if (reference.length > 160) {
		throw new TeamAccessRequestError(400, 'team_reference_too_long', 'Team name or invitation code must be 160 characters or fewer.');
	}
	return reference;
}

function requestMessageFor(value) {
	const message = cleanText(value);
	if (message.length > 500) {
		throw new TeamAccessRequestError(400, 'request_message_too_long', 'Message must be 500 characters or fewer.');
	}
	return message;
}

async function readJson(request) {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
		return body;
	} catch {
		throw new TeamAccessRequestError(400, 'invalid_request', 'Check the information you have entered.');
	}
}

async function findDiscoverableTeam(db, reference) {
	const normalised = normaliseReference(reference);
	return db
		.prepare(`
			SELECT id, name
			FROM auth_teams
			WHERE team_status = 'active'
				AND (lower(id) = ? OR lower(name) = ?)
			LIMIT 1
		`)
		.bind(normalised, normalised)
		.first();
}

async function readActiveMembership(db, userId, teamId) {
	if (!teamId) return null;
	return db
		.prepare(`
			SELECT id
			FROM auth_team_memberships
			WHERE user_id = ?
				AND team_id = ?
				AND membership_status = 'active'
			LIMIT 1
		`)
		.bind(userId, teamId)
		.first();
}

async function readPendingRequest(db, userId, normalisedReference, teamId = null) {
	if (teamId) {
		const teamRequest = await db
			.prepare(`
				SELECT id, request_status, requested_at, submitted_team_reference, team_id
				FROM auth_team_access_requests
				WHERE requester_user_id = ?
					AND request_status = 'pending'
					AND team_id = ?
				LIMIT 1
			`)
			.bind(userId, teamId)
			.first();
		if (teamRequest) return teamRequest;
	}

	return db
		.prepare(`
			SELECT id, request_status, requested_at, submitted_team_reference, team_id
			FROM auth_team_access_requests
			WHERE requester_user_id = ?
				AND request_status = 'pending'
				AND normalised_team_reference = ?
			LIMIT 1
		`)
		.bind(userId, normalisedReference)
		.first();
}

async function recordTeamAccessEvent(db, request, type, context, metadata = {}) {
	try {
		await db
			.prepare(`
				INSERT INTO auth_events (id, event_type, actor_user_id, team_id, provider, route_path, metadata_json)
				VALUES (?, ?, ?, ?, 'researchops_team_access', ?, ?)
			`)
			.bind(
				makeId('evt'),
				type,
				context?.user?.id || null,
				metadata.teamId || null,
				new URL(request.url).pathname,
				JSON.stringify(metadata),
			)
			.run();
	} catch {
		// Access requests should still complete if the audit event cannot be recorded.
	}
}

function mapTeamAccessRequest(row) {
	return {
		id: row.id,
		teamId: row.team_id || null,
		teamName: row.team_name || null,
		teamReference: row.submitted_team_reference,
		message: row.request_message || '',
		status: row.request_status,
		requestedAt: row.requested_at,
		cancelledAt: row.cancelled_at || null,
	};
}

async function listTeamAccessRequests(request, env, context) {
	const db = dbFor(env);
	await assertRoutePermission(request, env, context);

	const result = await db
		.prepare(`
			SELECT
				r.id,
				r.team_id,
				t.name AS team_name,
				r.submitted_team_reference,
				r.request_message,
				r.request_status,
				r.requested_at,
				r.cancelled_at
			FROM auth_team_access_requests r
			LEFT JOIN auth_teams t ON t.id = r.team_id
			WHERE r.requester_user_id = ?
				AND r.request_status = 'pending'
			ORDER BY r.requested_at DESC
			LIMIT 50
		`)
		.bind(context.user.id)
		.all();

	return (result.results || []).map(mapTeamAccessRequest);
}

async function createTeamAccessRequest(request, env, context) {
	const db = dbFor(env);
	await assertRoutePermission(request, env, context);

	const body = await readJson(request);
	const teamReference = teamReferenceFor(body.teamReference || body.teamName || body.teamCode || body.invitationCode);
	const normalisedReference = normaliseReference(teamReference);
	const requestMessage = requestMessageFor(body.message || body.requestMessage);
	const team = await findDiscoverableTeam(db, teamReference);

	if (!team) {
		throw new TeamAccessRequestError(
			404,
			'team_not_found',
			'We could not find a team you can request access to with those details. Check the team name or ask a Team Admin for an invitation.',
		);
	}

	const activeMembership = await readActiveMembership(db, context.user.id, team.id);
	if (activeMembership) {
		return {
			created: false,
			alreadyMember: true,
			message: 'You are already a member of this team.',
		};
	}

	const existingPendingRequest = await readPendingRequest(db, context.user.id, normalisedReference, team.id);
	if (existingPendingRequest) {
		return {
			created: false,
			requestId: existingPendingRequest.id,
			status: existingPendingRequest.request_status,
			message: 'You have already requested access to this team. A Team Admin needs to review your request.',
		};
	}

	const requestId = makeId('tar');
	await db
		.prepare(`
			INSERT INTO auth_team_access_requests
				(id, requester_user_id, team_id, submitted_team_reference, normalised_team_reference, request_message)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		.bind(requestId, context.user.id, team.id, teamReference, normalisedReference, requestMessage)
		.run();

	await recordTeamAccessEvent(db, request, 'team.access.requested', context, {
		requestId,
		teamId: team.id,
		teamReference,
	});

	return {
		created: true,
		requestId,
		status: 'pending',
		message: 'Your request has been sent. A Team Admin needs to approve your request before you can use this team in ResearchOps.',
	};
}

async function cancelTeamAccessRequest(request, env, context) {
	const db = dbFor(env);
	await assertRoutePermission(request, env, context);

	const body = await readJson(request);
	const requestId = cleanText(body.requestId);
	if (!requestId) throw new TeamAccessRequestError(400, 'request_id_required', 'Choose a team access request to cancel.');

	const existing = await db
		.prepare(`
			SELECT id, team_id, request_status
			FROM auth_team_access_requests
			WHERE id = ?
				AND requester_user_id = ?
				AND request_status = 'pending'
			LIMIT 1
		`)
		.bind(requestId, context.user.id)
		.first();

	if (!existing) {
		throw new TeamAccessRequestError(404, 'team_access_request_not_found', 'We could not find a pending request to cancel.');
	}

	await db
		.prepare(`
			UPDATE auth_team_access_requests
			SET request_status = 'cancelled', cancelled_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE id = ?
				AND requester_user_id = ?
				AND request_status = 'pending'
		`)
		.bind(requestId, context.user.id)
		.run();

	await recordTeamAccessEvent(db, request, 'team.access.cancelled', context, {
		requestId,
		teamId: existing.team_id,
	});

	return {
		cancelled: true,
		requestId,
		message: 'Your team access request has been cancelled.',
	};
}

function teamAccessRequestErrorResponse(error) {
	if (!(error instanceof TeamAccessRequestError)) throw error;
	return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
}

export async function handleTeamAccessRequestsRoute(request, env, apiPath) {
	try {
		const context = await resolveAuthenticatedContext(request, env);

		if (request.method === 'GET' && apiPath === '/api/team-access/requests') {
			return jsonResponse({ ok: true, requests: await listTeamAccessRequests(request, env, context) });
		}

		if (request.method === 'POST' && apiPath === '/api/team-access/requests') {
			const result = await createTeamAccessRequest(request, env, context);
			return jsonResponse({ ok: true, ...result }, result.created ? 201 : 200);
		}

		if (request.method === 'POST' && apiPath === '/api/team-access/requests/cancel') {
			const result = await cancelTeamAccessRequest(request, env, context);
			return jsonResponse({ ok: true, ...result });
		}

		return jsonResponse({ ok: false, error: 'not_found', message: 'Team access request route not found.' }, 404);
	} catch (error) {
		try {
			return teamAccessRequestErrorResponse(error);
		} catch {}

		try {
			return routePermissionErrorResponse(error);
		} catch {}

		return jsonResponse(
			{
				ok: false,
				error: 'team_access_request_error',
				message: 'Team access request could not be completed.',
			},
			500,
		);
	}
}
