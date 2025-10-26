/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Service part that encapsulates Mural routes logic (OAuth + provisioning).
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,      // NEW
	verifyHomeOfficeByCompany,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	getMe,
	getActiveWorkspaceIdFromMe
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/**
 * @typedef {import("../index.js").ResearchOpsService} ResearchOpsService
 */

export class MuralServicePart {
	/** @param {ResearchOpsService} root */
	constructor(root) {
		this.root = root;
	}

	kvKey(uid) { return `mural:${uid}:tokens`; }

	async saveTokens(uid, tokens) {
		const enriched = {
			...tokens,
			_obtained_at: Date.now()
		};
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(enriched), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	// Helper: call a function with a token, refresh once on 401/invalid_token
	async withToken(uid, fn) {
		let tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			const e = new Error("no_access_token");
			e.status = 401;
			throw e;
		}

		try {
			return await fn(tokens.access_token);
		} catch (err) {
			const status = Number(err?.status) || 0;
			const body = err?.body || {};
			const isTokenErr = status === 401 || /invalid[_-]?token/i.test(String(body?.error || body?.message || ""));

			if (!isTokenErr || !tokens.refresh_token) throw err;

			// Try refresh once
			const newTokens = await refreshAccessToken(this.root.env, tokens.refresh_token);
			const merged = { ...tokens, ...newTokens, _obtained_at: Date.now() };
			await this.saveTokens(uid, merged);

			// Retry once with the new access token
			return fn(merged.access_token);
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Routes
	// ─────────────────────────────────────────────────────────────────

	/** GET /api/mural/auth?uid=:uid[&return=:url] */
	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && /^\/[^\s]*$/.test(ret)) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	/** GET /api/mural/callback?code=&state= */
	async muralCallback(origin, url) {
		const { env } = this.root;

		if (!env.MURAL_CLIENT_SECRET) {
			return this.root.json(
				{ ok: false, error: "missing_secret", message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets." },
				500,
				this.root.corsHeaders(origin)
			);
		}

		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) {
			return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));
		}

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch { /* ignore */ }

		// code → tokens (includes refresh_token)
		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (err) {
			return this.root.json(
				{ ok: false, error: "token_exchange_failed", message: err?.message || "Unable to exchange OAuth code" },
				500,
				this.root.corsHeaders(origin)
			);
		}

		await this.saveTokens(uid, tokens);

		// Return to the page we came from, append mural=connected
		const safeReturn = (stateObj?.return && /^\/[^\s]*$/.test(stateObj.return)) ?
			stateObj.return :
			"/pages/projects/";
		const back = new URL(safeReturn, url);
		const sp = new URLSearchParams(back.search);
		sp.set("mural", "connected");
		back.search = sp.toString();

		return Response.redirect(back.toString(), 302);
	}

	/** GET /api/mural/verify?uid=:uid */
	async muralVerify(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";

		try {
			// Gate by company membership (with automatic token refresh)
			const inCompany = await this.withToken(uid, (access) =>
				verifyHomeOfficeByCompany(this.root.env, access)
			);
			if (!inCompany) {
				return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
			}

			const me = await this.withToken(uid, (access) =>
				getMe(this.root.env, access)
			);
			const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);

			return this.root.json({ ok: true, me, activeWorkspaceId }, 200, cors);
		} catch (err) {
			const status = Number(err?.status) || 500;
			if (status === 401) {
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}
			return this.root.json({ ok: false, reason: "error", message: String(err?.message || "verify_failed") }, status, cors);
		}
	}

	/** POST /api/mural/setup  body: { uid, projectName } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";
		let uid = "anon";

		try {
			const body = await request.json().catch(() => ({}));
			uid = body?.uid || "anon";
			const projectName = body?.projectName;
			if (!projectName || !String(projectName).trim()) {
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}

			// Gate by company (with token refresh)
			step = "verify_company";
			const inCompany = await this.withToken(uid, (access) =>
				verifyHomeOfficeByCompany(this.root.env, access)
			);
			if (!inCompany) {
				return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
			}

			// Resolve workspace id
			step = "get_me";
			const me = await this.withToken(uid, (access) => getMe(this.root.env, access));
			const configuredWsId = (this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID || "").trim();
			const activeWsId = getActiveWorkspaceIdFromMe(me);
			const workspaceId = configuredWsId || activeWsId;
			if (!workspaceId) {
				return this.root.json(
					{ ok: false, error: "no_workspace_id", message: "Could not resolve a workspace id (set MURAL_HOME_OFFICE_WORKSPACE_ID or ensure lastActiveWorkspace is present)" },
					400,
					cors
				);
			}

			const username =
				me?.value?.firstName ||
				me?.value?.name ||
				me?.name ||
				"Private";

			// Ensure room / folder / mural (each auto-refreshes token if needed)
			step = "ensure_room";
			const room = await this.withToken(uid, (access) =>
				ensureUserRoom(this.root.env, access, workspaceId, username)
			);

			step = "ensure_folder";
			const folder = await this.withToken(uid, (access) =>
				ensureProjectFolder(this.root.env, access, room.id, String(projectName).trim())
			);

			step = "create_mural";
			const muralResp = await this.withToken(uid, (access) =>
				createMural(this.root.env, access, {
					title: "Reflexive Journal",
					roomId: room.id,
					folderId: folder.id
				})
			);

			// Normalize links
			const mv = muralResp?.value || muralResp || {};
			const memberUrl =
				mv._canvasLink ||
				(mv.workspaceId && mv.id && mv.state
					? `https://app.mural.co/t/${mv.workspaceId}/m/${mv.workspaceId}/${String(mv.id).split(".").pop()}/${mv.state}`
					: null);
			const visitorUrl = mv?.visitorsSettings?.link || null;

			return this.root.json({
				ok: true,
				workspace: { id: workspaceId },
				room,
				folder,
				mural: {
					id: mv.id,
					url: memberUrl,
					visitorLink: visitorUrl,
					title: mv.title || "Reflexive Journal",
					thumbnailUrl: mv.thumbnailUrl || null
				}
			}, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");

			return this.root.json({
				ok: false,
				error: "setup_failed",
				step,
				message,
				upstream: body
			}, status, cors);
		}
	}

	/** GET /api/mural/debug-env (TEMP) */
	async muralDebugEnv(origin) {
		const env = this.root.env || {};
		return this.root.json({
			ok: true,
			has_CLIENT_ID: Boolean(env.MURAL_CLIENT_ID),
			has_CLIENT_SECRET: Boolean(env.MURAL_CLIENT_SECRET),
			redirect_uri: env.MURAL_REDIRECT_URI || "(unset)",
			scopes: env.MURAL_SCOPES || "(default)",
			company_id: env.MURAL_COMPANY_ID || "(unset)",
			workspace_id: env.MURAL_HOME_OFFICE_WORKSPACE_ID || "(unset)"
		}, 200, this.root.corsHeaders(origin));
	}

	/** GET /api/mural/debug-auth (TEMP) */
	async muralDebugAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && /^\/[^\s]*$/.test(ret)) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const authUrl = buildAuthUrl(this.root.env, state);
		return this.root.json({
			redirect_uri: this.root.env.MURAL_REDIRECT_URI,
			scopes: this.root.env.MURAL_SCOPES || "(default)",
			auth_url: authUrl
		}, 200, this.root.corsHeaders(origin));
	}
}
