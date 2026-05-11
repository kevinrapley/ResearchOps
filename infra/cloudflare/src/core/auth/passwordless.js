const PROVIDER = 'researchops_email';
const COOKIE_NAME = 'rops_session';
const CODE_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 43200;
const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
	'x-content-type-options': 'nosniff',
};

class AuthFlowError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function dbFor(env) {
	if (!env.RESEARCHOPS_D1?.prepare) throw new AuthFlowError(503, 'd1_missing', 'Sign in is not available right now.');
	return env.RESEARCHOPS_D1;
}

function secretFor(env) {
	const secret = env.RESEARCHOPS_AUTH_SECRET || env.AUTH_SECRET || '';
	if (!secret) throw new AuthFlowError(503, 'auth_secret_missing', 'Sign in is not configured yet.');
	return secret;
}

function id(prefix) {
	return `${prefix}_${crypto.randomUUID()}`;
}

function emailOf(value) {
	const email = String(value || '').trim().toLowerCase();
	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
		throw new AuthFlowError(400, 'email_invalid', 'Enter an email address in the correct format.');
	}
	return email;
}

function codeOf(value) {
	const code = String(value || '').replace(/\s+/g, '');
	if (!/^\d{6}$/.test(code)) throw new AuthFlowError(400, 'code_invalid', 'Enter the 6 digit code.');
	return code;
}

function makeCode() {
	const bytes = new Uint8Array(4);
	crypto.getRandomValues(bytes);
	return String(new DataView(bytes.buffer).getUint32(0) % 1000000).padStart(6, '0');
}

function makeToken() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value) {
	const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(data)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hash(env, ...parts) {
	return digest([secretFor(env), ...parts].join(':'));
}

function after(seconds) {
	return new Date(Date.now() + seconds * 1000).toISOString();
}

async function readBody(request) {
	try {
		const body = await request.json();
		if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('bad body');
		return body;
	} catch {
		throw new AuthFlowError(400, 'invalid_json', 'Request body must be valid JSON.');
	}
}

function cookieValue(request) {
	const cookie = request.headers.get('cookie') || '';
	const found = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
	return found ? decodeURIComponent(found.slice(COOKIE_NAME.length + 1)) : '';
}

function sessionCookie(request, token, maxAge = SESSION_TTL_SECONDS) {
	const secure = new URL(request.url).protocol === 'https:' ? 'Secure; ' : '';
	return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secure}SameSite=None; Max-Age=${maxAge}`;
}

async function sendCode(env, email, code) {
	if (env.RESEARCHOPS_AUTH_DEBUG_CODE === 'true') return;
	if (env.RESEARCHOPS_EMAIL_WEBHOOK_URL) {
		const response = await fetch(env.RESEARCHOPS_EMAIL_WEBHOOK_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ to: email, subject: 'Your ResearchOps sign-in code', text: `Your code is ${code}. It expires in 10 minutes.` }),
		});
		if (response.ok) return;
	}
	if (env.RESEND_API_KEY && env.RESEARCHOPS_EMAIL_FROM) {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
			body: JSON.stringify({ from: env.RESEARCHOPS_EMAIL_FROM, to: [email], subject: 'Your ResearchOps sign-in code', text: `Your code is ${code}. It expires in 10 minutes.` }),
		});
		if (response.ok) return;
	}
	throw new AuthFlowError(503, 'email_delivery_missing', 'Sign-in email delivery is not configured yet.');
}

async function authEvent(db, request, type, metadata = {}) {
	await db.prepare(`
		INSERT INTO auth_events (id, event_type, actor_user_id, provider, route_path, metadata_json)
		VALUES (?, ?, ?, ?, ?, ?)
	`).bind(id('evt'), type, metadata.userId || null, PROVIDER, new URL(request.url).pathname, JSON.stringify(metadata)).run();
}

async function start(request, env) {
	const db = dbFor(env);
	const body = await readBody(request);
	const email = emailOf(body.email);
	const code = makeCode();
	const challengeId = id('chl');
	await db.prepare(`
		INSERT INTO auth_login_challenges (id, email, code_hash, attempts_remaining, expires_at)
		VALUES (?, ?, ?, 5, ?)
	`).bind(challengeId, email, await hash(env, 'code', challengeId, email, code), after(CODE_TTL_SECONDS)).run();
	await sendCode(env, email, code);
	await db.prepare("UPDATE auth_login_challenges SET delivery_status = 'sent' WHERE id = ?").bind(challengeId).run();
	await authEvent(db, request, 'auth.email_code.requested', { email, challengeId });
	return json({ ok: true, challengeId, expiresInSeconds: CODE_TTL_SECONDS, ...(env.RESEARCHOPS_AUTH_DEBUG_CODE === 'true' ? { debugCode: code } : {}) });
}

async function userForEmail(db, email) {
	let user = await db.prepare('SELECT id, email, display_name, account_status FROM auth_users WHERE lower(email) = lower(?) LIMIT 1').bind(email).first();
	if (user) return user;
	await db.prepare("INSERT INTO auth_users (id, email, display_name, account_status) VALUES (?, ?, ?, 'pending')").bind(id('usr'), email, email).run();
	return db.prepare('SELECT id, email, display_name, account_status FROM auth_users WHERE lower(email) = lower(?) LIMIT 1').bind(email).first();
}

async function ensureIdentity(db, user, email) {
	await db.prepare(`
		INSERT OR IGNORE INTO auth_identities (id, user_id, provider, provider_subject, email, email_verified, mfa_claim, last_seen_at)
		VALUES (?, ?, ?, ?, ?, 1, 'email_code', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	`).bind(id('idn'), user.id, PROVIDER, email, email).run();
}

async function verify(request, env) {
	const db = dbFor(env);
	const body = await readBody(request);
	const challengeId = String(body.challengeId || '').trim();
	const code = codeOf(body.code);
	const challenge = await db.prepare(`
		SELECT id, email, code_hash, challenge_status, attempts_remaining, expires_at
		FROM auth_login_challenges WHERE id = ? LIMIT 1
	`).bind(challengeId).first();
	if (!challenge || challenge.challenge_status !== 'pending' || Date.parse(challenge.expires_at) <= Date.now()) {
		throw new AuthFlowError(400, 'code_expired', 'The code is no longer valid.');
	}
	const codeHash = await hash(env, 'code', challenge.id, challenge.email, code);
	if (codeHash !== challenge.code_hash) {
		await db.prepare('UPDATE auth_login_challenges SET attempts_remaining = attempts_remaining - 1 WHERE id = ?').bind(challenge.id).run();
		await authEvent(db, request, 'auth.email_code.failed', { email: challenge.email, challengeId });
		throw new AuthFlowError(400, 'code_invalid', 'The code is not valid.');
	}
	const user = await userForEmail(db, challenge.email);
	await ensureIdentity(db, user, challenge.email);
	await db.prepare("UPDATE auth_login_challenges SET challenge_status = 'verified', verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(challenge.id).run();
	const token = makeToken();
	await db.prepare(`
		INSERT INTO auth_sessions (id, user_id, session_token_hash, expires_at, last_seen_at)
		VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	`).bind(id('ses'), user.id, await hash(env, 'session', token), after(SESSION_TTL_SECONDS)).run();
	await authEvent(db, request, 'auth.sign_in.succeeded', { userId: user.id, email: challenge.email, challengeId });
	return json({ ok: true, authenticated: true }, 200, { 'set-cookie': sessionCookie(request, token) });
}

async function sessionUser(db, env, request) {
	const token = cookieValue(request);
	if (!token) return null;
	return db.prepare(`
		SELECT s.id AS session_id, u.id, u.email, u.display_name, u.account_status
		FROM auth_sessions s INNER JOIN auth_users u ON u.id = s.user_id
		WHERE s.session_token_hash = ? AND s.session_status = 'active' AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		LIMIT 1
	`).bind(await hash(env, 'session', token)).first();
}

async function teams(db, userId) {
	const result = await db.prepare(`
		SELECT t.id, t.name FROM auth_team_memberships m INNER JOIN auth_teams t ON t.id = m.team_id
		WHERE m.user_id = ? AND m.membership_status = 'active' AND t.team_status = 'active' ORDER BY t.name ASC
	`).bind(userId).all();
	return result.results || [];
}

async function roles(db, userId, teamId) {
	if (!teamId) return [];
	const result = await db.prepare(`
		SELECT r.role_key, r.label, r.description, r.is_sensitive, ra.scope_type, ra.scope_id, ra.expires_at
		FROM auth_role_assignments ra INNER JOIN auth_roles r ON r.id = ra.role_id
		WHERE ra.user_id = ? AND ra.scope_type = 'team' AND ra.scope_id = ? AND ra.assignment_status = 'active'
		ORDER BY r.label ASC
	`).bind(userId, teamId).all();
	return result.results || [];
}

async function permissions(db, userId, teamId) {
	if (!teamId) return [];
	const result = await db.prepare(`
		SELECT DISTINCT p.code, p.label, p.description, p.is_sensitive, p.is_reserved
		FROM auth_role_assignments ra INNER JOIN auth_role_permissions rp ON rp.role_id = ra.role_id INNER JOIN auth_permissions p ON p.code = rp.permission_code
		WHERE ra.user_id = ? AND ra.scope_type = 'team' AND ra.scope_id = ? AND ra.assignment_status = 'active'
		ORDER BY p.code ASC
	`).bind(userId, teamId).all();
	return result.results || [];
}

export async function resolvePasswordlessSessionContext(request, env) {
	const db = dbFor(env);
	const user = await sessionUser(db, env, request);
	if (!user) return null;
	const userTeams = await teams(db, user.id);
	const activeTeam = userTeams[0] || null;
	const userRoles = await roles(db, user.id, activeTeam?.id);
	const userPermissions = await permissions(db, user.id, activeTeam?.id);
	return {
		authenticated: true,
		provider: PROVIDER,
		user: { id: user.id, email: user.email, displayName: user.display_name, accountStatus: user.account_status },
		activeTeam,
		teams: userTeams,
		roles: userRoles.map((role) => ({ key: role.role_key, label: role.label, description: role.description, sensitive: role.is_sensitive === 1, scopeType: role.scope_type, scopeId: role.scope_id, expiresAt: role.expires_at })),
		permissions: userPermissions.map((permission) => ({ code: permission.code, label: permission.label, description: permission.description, sensitive: permission.is_sensitive === 1, reserved: permission.is_reserved === 1 })),
	};
}

async function logout(request, env) {
	const token = cookieValue(request);
	if (token) await dbFor(env).prepare("UPDATE auth_sessions SET session_status = 'revoked', revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE session_token_hash = ?").bind(await hash(env, 'session', token)).run();
	return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, '', 0) });
}

export async function handlePasswordlessAuthRoute(request, env, apiPath) {
	try {
		if (request.method === 'POST' && apiPath === '/api/auth/email/start') return start(request, env);
		if (request.method === 'POST' && apiPath === '/api/auth/email/verify') return verify(request, env);
		if (request.method === 'POST' && apiPath === '/api/auth/logout') return logout(request, env);
		return json({ ok: false, error: 'not_found', message: 'Authentication route not found.' }, 404);
	} catch (error) {
		if (error instanceof AuthFlowError) return json({ ok: false, error: error.code, message: error.message }, error.status);
		return json({ ok: false, error: 'authentication_error', message: 'Authentication could not be completed.' }, 500);
	}
}
