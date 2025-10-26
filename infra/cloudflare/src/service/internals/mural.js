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
	projectKvKey(uid, projKey) { return `mural:${uid}:project:${projKey}`; }

	async saveTokens(uid, tokens) {
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	async saveProjectLink(uid, projKey, data) {
		if (!projKey) return;
		await this.root.env.SESSION_KV.put(this.projectKvKey(uid, projKey), JSON.stringify(data), { encryption: true });
	}

	async loadProjectLink(uid, projKey) {
		if (!projKey) return null;
		const raw = await this.root.env.SESSION_KV.get(this.projectKvKey(uid, projKey));
		return raw ? JSON.parse(raw) : null;
	}

	projKeyFromParams(projectId, projectName) {
		const id = (projectId || "").trim();
		if (id) return `id::${id}`;
		const name = (projectName || "").trim();
		if (name) return `name::${name}`;
		return "";
	}

	// ─────────────────────────────────────────────────────────────────
	// Routes
	// ─────────────────────────────────────────────────────────────────

	/** GET /api/mural/auth?uid=:uid[&return=:path] */
	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
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
		const safeReturn = (stateObj?.return && stateObj.return.startsWith("/")) ?
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

	/** POST /api/mural/setup  body: { uid, projectName, projectId? } */
	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const { uid = "anon", projectName, projectId } = await request.json().catch(() => ({}));
			if (!projectName || !String(projectName).trim()) {
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			// We already verify company on /verify; here we just proceed
			step = "get_me";
			const me = await getMe(this.root.env, tokens.access_token).catch(() => null);
			const username = me?.value?.firstName || me?.name || "Private";
			const workspaceId = getActiveWorkspaceIdFromMe(me);

			step = "ensure_room";
			const room = await ensureUserRoom(this.root.env, tokens.access_token, workspaceId, username);

			step = "ensure_folder";
			const folder = await ensureProjectFolder(this.root.env, tokens.access_token, room.id, String(projectName).trim());

			step = "create_mural";
			const mural = await createMural(this.root.env, tokens.access_token, {
				title: "Reflexive Journal",
				roomId: room.id,
				folderId: folder.id
			});

			// Extract a durable open URL (member canvas link if available)
			const v = mural?.value || mural || {};
			const openUrl = v._canvasLink || v.viewerUrl || v.url || "";

			// Persist this per-project so /find is instant and client can flip on reloads
			const projKey = this.projKeyFromParams(projectId, projectName);
			if (projKey && openUrl) {
				await this.saveProjectLink(uid, projKey, {
					url: openUrl,
					muralId: v.id || "",
					roomId: room.id,
					folderId: folder.id,
					projectName,
					updatedAt: Date.now()
				});
			}

			return this.root.json({ ok: true, room, folder, mural, url: openUrl }, 200, cors);

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

	/** GET /api/mural/find?uid=&projectId=&projectName= */
	async muralFind(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
		const projectId = url.searchParams.get("projectId") || "";
		const projectName = url.searchParams.get("projectName") || "";

		const projKey = this.projKeyFromParams(projectId, projectName);
		if (!projKey) {
			return this.root.json({ ok: false, reason: "bad_request", message: "projectId or projectName required" }, 400, cors);
		}

		const saved = await this.loadProjectLink(uid, projKey);
		if (saved?.url) {
			return this.root.json({ ok: true, ...saved }, 200, cors);
		}

		// Do NOT probe Mural API here (avoids upstream 404 noise). Just say not found.
		return this.root.json({ ok: false, reason: "not_found" }, 404, cors);
	}

	/** TEMP: env debug */
	async muralDebugEnv(origin) {
		const env = this.root.env || {};
		return this.root.json({
			ok: true,
			has_CLIENT_ID: Boolean(env.MURAL_CLIENT_ID),
			has_CLIENT_SECRET: Boolean(env.MURAL_CLIENT_SECRET),
			redirect_uri: env.MURAL_REDIRECT_URI || "(unset)",
			scopes: env.MURAL_SCOPES || "(default)",
			company_id: env.MURAL_COMPANY_ID || "(unset)"
		}, 200, this.root.corsHeaders(origin));
	}

	/** TEMP: auth debug */
	async muralDebugAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const authUrl = buildAuthUrl(this.root.env, state);
		return this.root.json({
			redirect_uri: this.root.env.MURAL_REDIRECT_URI,
			scopes: this.root.env.MURAL_SCOPES || "(default)",
			auth_url: authUrl
		}, 200, this.root.corsHeaders(origin));
	}
}
