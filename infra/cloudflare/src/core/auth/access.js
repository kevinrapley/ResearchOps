import {
	assertRoutePermission,
	routePermissionErrorResponse,
} from './route-permissions.js';

const PROVIDER = 'cloudflare_access';

const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

class AuthError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function decodeBase64Url(value) {
	const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
	const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJsonSegment(value) {
	return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

function getAccessJwt(request) {
	const token = request.headers.get('Cf-Access-Jwt-Assertion');
	if (!token) {
		throw new AuthError(
			401,
			'authentication_required',
			'Sign in is required to use this part of ResearchOps.',
		);
	}
	return token;
}

function getAudience(env) {
	return env.CLOUDFLARE_ACCESS_AUD || env.CF_ACCESS_AUD || env.CF_ACCESS_AUD_TAG || '';
}

function getCertsUrl(env) {
	if (env.CLOUDFLARE_ACCESS_CERTS_URL) return env.CLOUDFLARE_ACCESS_CERTS_URL;
	if (env.CF_ACCESS_CERTS_URL) return env.CF_ACCESS_CERTS_URL;
	if (env.CLOUDFLARE_ACCESS_TEAM_DOMAIN) {
		return `https://${env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
	}
	return '';
}

async function verifyJwtSignature(token, header, env) {
	if (header.alg !== 'RS256') {
		throw new AuthError(
			401,
			'unsupported_access_token_algorithm',
			'The sign-in token uses an unsupported algorithm.',
		);
	}

	const certsUrl = getCertsUrl(env);
	if (!certsUrl) {
		throw new AuthError(
			503,
			'access_configuration_missing',
			'Cloudflare Access certificate configuration is missing.',
		);
	}

	const response = await fetch(certsUrl, { headers: { accept: 'application/json' } });
	if (!response.ok) {
		throw new AuthError(
			503,
			'access_certs_unavailable',
			'Cloudflare Access certificates could not be loaded.',
		);
	}

	const body = await response.json();
	const key = (body.keys || []).find((candidate) => candidate.kid === header.kid);
	if (!key) {
		throw new AuthError(
			401,
			'access_key_not_found',
			'The sign-in token could not be matched to a trusted key.',
		);
	}

	const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
	const cryptoKey = await crypto.subtle.importKey(
		'jwk',
		key,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify'],
	);
	const ok = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		cryptoKey,
		decodeBase64Url(encodedSignature),
		new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
	);

	if (!ok) {
		throw new AuthError(
			401,
			'access_signature_invalid',
			'The sign-in token signature is invalid.',
		);
	}
}

async function validateAccessToken(request, env) {
	const token = getAccessJwt(request);
	const parts = token.split('.');
	if (parts.length !== 3) {
		throw new AuthError(401, 'access_token_malformed', 'The sign-in token is malformed.');
	}

	const header = decodeJsonSegment(parts[0]);
	const payload = decodeJsonSegment(parts[1]);
	await verifyJwtSignature(token, header, env);

	const now = Math.floor(Date.now() / 1000);
	if (payload.exp && payload.exp <= now) {
		throw new AuthError(401, 'access_token_expired', 'The sign-in token has expired.');
	}
	if (payload.nbf && payload.nbf > now) {
		throw new AuthError(401, 'access_token_not_yet_valid', 'The sign-in token is not yet valid.');
	}

	const expectedAud = getAudience(env);
	if (!expectedAud) {
		throw new AuthError(
			503,
			'access_audience_missing',
			'Cloudflare Access audience configuration is missing.',
		);
	}

	const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
	if (!audiences.includes(expectedAud)) {
		throw new AuthError(401, 'access_audience_invalid', 'The sign-in token audience is invalid.');
	}

	if (!payload.sub || !payload.email) {
		throw new AuthError(
			401,
			'access_identity_incomplete',
			'The sign-in token does not include the required identity claims.',
		);
	}

	return payload;
}

function dbFor(env) {
	const db = env.RESEARCHOPS_D1;
	if (!db || typeof db.prepare !== 'function') {
		throw new AuthError(503, 'd1_binding_missing', 'The ResearchOps identity database is not available.');
	}
	return db;
}

function makeId(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function normaliseEmail(email) {
	return String(email || '')
		.trim()
		.toLowerCase();
}

async function findUserByIdentity(db, subject) {
	return db
		.prepare(`
			SELECT u.id, u.email, u.display_name, u.account_status
			FROM auth_identities i
			INNER JOIN auth_users u ON u.id = i.user_id
			WHERE i.provider = ? AND i.provider_subject = ?
			LIMIT 1
		`)
		.bind(PROVIDER, subject)
		.first();
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

async function linkAccessIdentityToUser(db, user, payload) {
	const identityId = makeId('idn');
	const email = normaliseEmail(payload.email);
	const mfaClaim = Array.isArray(payload.amr) ? payload.amr.join(',') : payload.amr || null;

	await db
		.prepare(`
			INSERT OR IGNORE INTO auth_identities
				(id, user_id, provider, provider_subject, email, email_verified, mfa_claim, last_seen_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		`)
		.bind(identityId, user.id, PROVIDER, payload.sub, email, payload.email_verified ? 1 : 0, mfaClaim)
		.run();

	return findUserByIdentity(db, payload.sub);
}

async function createPendingUserForAccessPayload(db, payload) {
	const userId = makeId('usr');
	const email = normaliseEmail(payload.email);
	const displayName = payload.name || email;

	await db
		.prepare("INSERT INTO auth_users (id, email, display_name, account_status) VALUES (?, ?, ?, 'pending')")
		.bind(userId, email, displayName)
		.run();

	return findUserByEmail(db, email);
}

async function ensureUserForAccessPayload(db, payload) {
	const existing = await findUserByIdentity(db, payload.sub);
	if (existing) return existing;

	const email = normaliseEmail(payload.email);
	const seededUser = await findUserByEmail(db, email);
	if (seededUser) {
		return linkAccessIdentityToUser(db, seededUser, payload);
	}

	const pendingUser = await createPendingUserForAccessPayload(db, payload);
	return linkAccessIdentityToUser(db, pendingUser, payload);
}

async function updateLastSeen(db, subject) {
	await db
		.prepare(`
			UPDATE auth_identities
			SET last_seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			WHERE provider = ? AND provider_subject = ?
		`)
		.bind(PROVIDER, subject)
		.run();
}

async function listTeams(db, userId) {
	const result = await db
		.prepare(`
			SELECT t.id, t.name
			FROM auth_team_memberships m
			INNER JOIN auth_teams t ON t.id = m.team_id
			WHERE m.user_id = ? AND m.membership_status = 'active' AND t.team_status = 'active'
			ORDER BY t.name ASC
		`)
		.bind(userId)
		.all();
	return result.results || [];
}

function selectActiveTeam(request, teams) {
	const requestedTeamId = request.headers.get('X-ResearchOps-Team-Id');
	return teams.find((team) => team.id === requestedTeamId) || teams[0] || null;
}

async function listRoles(db, userId, teamId) {
	if (!teamId) return [];
	const result = await db
		.prepare(`
			SELECT r.role_key, r.label, r.description, r.is_sensitive, ra.scope_type, ra.scope_id, ra.expires_at
			FROM auth_role_assignments ra
			INNER JOIN auth_roles r ON r.id = ra.role_id
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.scope_id = ?
				AND ra.assignment_status = 'active'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			ORDER BY r.label ASC
		`)
		.bind(userId, teamId)
		.all();
	return result.results || [];
}

async function listPermissions(db, userId, teamId) {
	if (!teamId) return [];
	const result = await db
		.prepare(`
			SELECT DISTINCT p.code, p.label, p.description, p.is_sensitive, p.is_reserved
			FROM auth_role_assignments ra
			INNER JOIN auth_role_permissions rp ON rp.role_id = ra.role_id
			INNER JOIN auth_permissions p ON p.code = rp.permission_code
			WHERE ra.user_id = ?
				AND ra.scope_type = 'team'
				AND ra.scope_id = ?
				AND ra.assignment_status = 'active'
				AND (ra.expires_at IS NULL OR ra.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			UNION
			SELECT DISTINCT p.code, p.label, p.description, p.is_sensitive, p.is_reserved
			FROM auth_permission_exceptions e
			INNER JOIN auth_permissions p ON p.code = e.permission_code
			WHERE e.user_id = ?
				AND e.scope_type = 'team'
				AND e.scope_id = ?
				AND e.exception_status = 'active'
				AND e.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			ORDER BY code ASC
		`)
		.bind(userId, teamId, userId, teamId)
		.all();
	return result.results || [];
}

export async function resolveAuthenticatedContext(request, env) {
	const accessPayload = await validateAccessToken(request, env);
	const db = dbFor(env);
	const user = await ensureUserForAccessPayload(db, accessPayload);
	await updateLastSeen(db, accessPayload.sub);

	const teams = await listTeams(db, user.id);
	const activeTeam = selectActiveTeam(request, teams);
	const roles = await listRoles(db, user.id, activeTeam?.id);
	const permissions = await listPermissions(db, user.id, activeTeam?.id);

	return {
		authenticated: true,
		provider: PROVIDER,
		user: {
			id: user.id,
			email: user.email,
			displayName: user.display_name,
			accountStatus: user.account_status,
		},
		activeTeam,
		teams,
		roles: roles.map((role) => ({
			key: role.role_key,
			label: role.label,
			description: role.description,
			sensitive: role.is_sensitive === 1,
			scopeType: role.scope_type,
			scopeId: role.scope_id,
			expiresAt: role.expires_at,
		})),
		permissions: permissions.map((permission) => ({
			code: permission.code,
			label: permission.label,
			description: permission.description,
			sensitive: permission.is_sensitive === 1,
			reserved: permission.is_reserved === 1,
		})),
	};
}

export async function handleMeRoute(request, env, apiPath) {
	try {
		const context = await resolveAuthenticatedContext(request, env);
		await assertRoutePermission(request, env, context);

		if (apiPath === '/api/me/permissions') {
			return jsonResponse({
				ok: true,
				authenticated: true,
				user: context.user,
				activeTeam: context.activeTeam,
				permissions: context.permissions,
			});
		}
		return jsonResponse({ ok: true, ...context });
	} catch (error) {
		if (error instanceof AuthError) {
			return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
		}

		try {
			return routePermissionErrorResponse(error);
		} catch {
			return jsonResponse(
				{
					ok: false,
					error: 'authentication_error',
					message: 'Authentication could not be completed.',
				},
				500,
			);
		}
	}
}
