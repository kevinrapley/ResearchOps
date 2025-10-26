/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Service part that encapsulates Mural routes logic (OAuth + provisioning).
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
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
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	// ─────────────────────────────────────────────────────────────────
	// Routes
	// ─────────────────────────────────────────────────────────────────

	/** GET /api/mural/auth?uid=:uid[&return=:url] */
	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");

		// Only allow relative paths to avoid open-redirects
		const safeReturn = (ret && /^\/[^\s]*$/.test(ret)) ? ret : "/pages/projects/";

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	/** GET /api/mural/callback?code=&state= */
	async muralCallback(origin, url) {
		const { env } = this.root;

		if (!env.MURAL_CLIENT_SECRET) {
			return this.root.json({ ok: false, error: "missing_secret", message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets." },
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

		// code → tokens
		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (err) {
			return this.root.json({ ok: false, error: "token_exchange_failed", message: err?.message || "Unable to exchange OAuth code" },
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
		const uid = url.searchParams.get("uid") || "anon";
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
		}

		// Single gate: company/tenant membership
		const inCompany = await verifyHomeOfficeByCompany(this.root.env, tokens.access_token).catch(() => false);
		if (!inCompany) {
			return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
		}

		// Provide useful context back to UI
		const me = await getMe(this.root.env, tokens.access_token).catch(() => null);
		const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);

		return this.root.json({ ok: true, me, activeWorkspaceId },
			200,
			this.root.corsHeaders(origin)
		);
	}

	/** POST /api/mural/setup  body: { uid, projectName } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const { uid = "anon", projectName } = await request.json().catch(() => ({}));
			if (!projectName || !String(projectName).trim()) {
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			// Gate by company/tenant (NOT by workspace listing)
			step = "verify_company";
			const inCompany = await verifyHomeOfficeByCompany(this.root.env, tokens.access_token);
			if (!inCompany) {
				return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
			}

			// Work out which workspace ID to use for room/folder creation
			step = "get_me";
			const me = await getMe(this.root.env, tokens.access_token).catch(() => null);

			const configuredWsId = (this.root.env.MURAL_HOME_OFFICE_WORKSPACE_ID || "").trim();
			const activeWsId = getActiveWorkspaceIdFromMe(me);
			const workspaceId = configuredWsId || activeWsId;

			if (!workspaceId) {
				return this.root.json({ ok: false, error: "no_workspace_id", message: "Could not resolve a workspace id (set MURAL_HOME_OFFICE_WORKSPACE_ID or ensure lastActiveWorkspace is present)" },
					400,
					cors
				);
			}

			const username =
				me?.value?.firstName ||
				me?.value?.name ||
				me?.name ||
				"Private";

			step = "ensure_room";
			const room = await ensureUserRoom(this.root.env, tokens.access_token, workspaceId, username);

			step = "ensure_folder";
			const folder = await ensureProjectFolder(this.root.env, tokens.access_token, room.id, String(projectName).trim());

			step = "create_mural";
			const muralResp = await createMural(this.root.env, tokens.access_token, {
				title: "Reflexive Journal",
				roomId: room.id,
				folderId: folder.id
			});

			// Normalize links so the client always gets a member URL
			const mv = muralResp?.value || muralResp || {};
			const memberUrl =
				mv._canvasLink ||
				// Fallback construction if _canvasLink isn’t present for some reason:
				(mv.workspaceId && mv.id && mv.state ?
					`https://app.mural.co/t/${mv.workspaceId}/m/${mv.workspaceId}/${String(mv.id).split(".").pop()}/${mv.state}` :
					null);

			const visitorUrl = mv?.visitorsSettings?.link || null;

			return this.root.json({
				ok: true,
				workspace: { id: mv.workspaceId || ws.id },
				room,
				folder,
				mural: {
					id: mv.id,
					url: memberUrl, // <- client should open THIS
					visitorLink: visitorUrl, // (kept for reference/debug)
					title: mv.title || "Reflexive Journal",
					thumbnailUrl: mv.thumbnailUrl || null
				}
			}, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");

			return this.root.json({ ok: false, error: "setup_failed", step, message, upstream: body },
				status,
				cors
			);
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
