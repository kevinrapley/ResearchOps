/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Service part that encapsulates Mural routes logic.
 *
 * Depends on /lib/mural.js and a KV binding for session tokens.
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	verifyHomeOfficeWorkspace,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	getMe
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/**
 * @typedef {import("../../service/index.js").ResearchOpsService} ResearchOpsService
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

	/** GET /api/mural/auth?uid=:uid */
	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now() }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	/** GET /api/mural/callback?code=&state= */
	async muralCallback(origin, url) {
		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));

		let uid = "anon";
		try {
			const st = JSON.parse(b64Decode(stateB64 || ""));
			uid = st?.uid || "anon";
		} catch {}

		const tokens = await exchangeAuthCode(this.root.env, code);
		await this.saveTokens(uid, tokens);

		const back = new URL("/pages/projects/", url);
		back.searchParams.set("mural", "connected");
		return Response.redirect(back.toString(), 302);
	}

	/** GET /api/mural/verify?uid=:uid */
	async muralVerify(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
		}
		const ws = await verifyHomeOfficeWorkspace(this.root.env, tokens.access_token);
		if (!ws) {
			return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
		}
		const me = await getMe(this.root.env, tokens.access_token).catch(() => null);
		return this.root.json({ ok: true, workspace: ws, me }, 200, this.root.corsHeaders(origin));
	}

	/** POST /api/mural/setup  body: { uid, projectName } */
	async muralSetup(request, origin) {
		const { uid = "anon", projectName } = await request.json().catch(() => ({}));
		if (!projectName || !String(projectName).trim()) {
			return this.root.json({ ok: false, error: "projectName required" }, 400, this.root.corsHeaders(origin));
		}
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
		}

		const ws = await verifyHomeOfficeWorkspace(this.root.env, tokens.access_token);
		if (!ws) {
			return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
		}

		const me = await getMe(this.root.env, tokens.access_token).catch(() => null);
		const room = await ensureUserRoom(this.root.env, tokens.access_token, ws.id, me?.name || "Private");
		const folder = await ensureProjectFolder(this.root.env, tokens.access_token, room.id, projectName.trim());
		const mural = await createMural(this.root.env, tokens.access_token, { title: "Reflexive Journal", roomId: room.id, folderId: folder.id });

		return this.root.json({ ok: true, workspace: ws, room, folder, mural }, 200, this.root.corsHeaders(origin));
	}
}
