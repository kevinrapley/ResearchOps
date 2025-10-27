/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes and journal-sync integration (Reflexive Journal).
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	getMe,
	getActiveWorkspaceIdFromMe,
	getWidgets,
	createSticky,
	updateSticky,
	ensureTagsBlueberry,
	applyTagsToSticky,
	normaliseWidgets,
	findLatestInCategory
} from "../../lib/mural.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;

/**
 * Encapsulates all Mural OAuth, setup, and journal sync behaviours.
 */
export class MuralServicePart {
	constructor(root) {
		this.root = root;
	}

	kvKey(uid) { return `mural:${uid}:tokens`; }
	projectMuralKey(projectId) { return `mural:project:${projectId}:reflexive`; }

	async saveTokens(uid, tokens) {
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	async _ensureWorkspace(env, accessToken) {
		const inCompany = await verifyHomeOfficeByCompany(env, accessToken);
		if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

		const me = await getMe(env, accessToken);
		const wsId = getActiveWorkspaceIdFromMe(me);
		if (!wsId) throw new Error("no_active_workspace");
		return { id: wsId };
	}

	async resolveReflexiveMuralId(projectId, explicitMuralId) {
		if (explicitMuralId) return explicitMuralId;
		if (!projectId) return null;
		const raw = await this.root.env.SESSION_KV.get(this.projectMuralKey(projectId));
		if (!raw) return null;
		try {
			const js = JSON.parse(raw);
			return js?.muralId || js?.id || null;
		} catch {
			return raw;
		}
	}

	async saveProjectMuralMapping(projectId, muralId, extra = null) {
		if (!projectId || !muralId) return;
		const value = extra ? JSON.stringify({ muralId, ...extra }) : muralId;
		await this.root.env.SESSION_KV.put(this.projectMuralKey(projectId), value, { encryption: true });
	}

	async _getValidAccessToken(uid) {
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };
		let accessToken = tokens.access_token;

		try {
			await verifyHomeOfficeByCompany(this.root.env, accessToken);
			return { ok: true, token: accessToken };
		} catch (err) {
			const status = Number(err?.status || 0);
			if (status === 401 && tokens.refresh_token) {
				try {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					await verifyHomeOfficeByCompany(this.root.env, accessToken);
					return { ok: true, token: accessToken };
				} catch (rfErr) {
					console.error("[mural] token refresh failed:", rfErr);
					return { ok: false, reason: "not_authenticated" };
				}
			}
			console.error("[mural] token validation failed:", err);
			return { ok: false, reason: "error" };
		}
	}

	// ────────────────────────────────────────────────────────────────
	// Routes
	// ────────────────────────────────────────────────────────────────

	async muralAuth(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return");
		const safeReturn = (ret && ret.startsWith("/")) ? ret : "/pages/projects/";
		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const { env } = this.root;
		if (!env.MURAL_CLIENT_SECRET) {
			return this.root.json({ ok: false, error: "missing_secret" }, 500, this.root.corsHeaders(origin));
		}

		const code = url.searchParams.get("code");
		if (!code) {
			return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));
		}

		let uid = "anon";
		try {
			const stateObj = JSON.parse(b64Decode(url.searchParams.get("state") || ""));
			uid = stateObj?.uid || "anon";
		} catch { /* ignore */ }

		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (err) {
			return this.root.json({ ok: false, error: "token_exchange_failed", detail: err?.message }, 500, this.root.corsHeaders(origin));
		}

		await this.saveTokens(uid, tokens);
		return Response.redirect("/pages/projects/?mural=connected", 302);
	}

	async muralVerify(origin, url) {
		const uid = url.searchParams.get("uid") || "anon";
		const tokens = await this.loadTokens(uid);
		if (!tokens?.access_token) {
			return this.root.json({ ok: false, reason: "not_authenticated" }, 401, this.root.corsHeaders(origin));
		}
		let accessToken = tokens.access_token;
		try {
			const inCompany = await verifyHomeOfficeByCompany(this.root.env, accessToken);
			if (!inCompany) return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, this.root.corsHeaders(origin));
		} catch (err) {
			return this.root.json({ ok: false, reason: "error", detail: String(err?.message || err) }, 500, this.root.corsHeaders(origin));
		}
		const me = await getMe(this.root.env, accessToken).catch(() => null);
		const activeWorkspaceId = getActiveWorkspaceIdFromMe(me);
		return this.root.json({ ok: true, me, activeWorkspaceId }, 200, this.root.corsHeaders(origin));
	}

	/**
	 * POST /api/mural/journal-sync
	 * body: { uid?, muralId?, projectId?, category, description, tags? }
	 */
	async muralJournalSync(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";
		try {
			const body = await request.json().catch(() => ({}));
			const uid = String(body?.uid || "anon");
			const category = String(body?.category || "").toLowerCase().trim();
			const description = String(body?.description || "").trim();
			const labels = Array.isArray(body?.tags) ? body.tags.filter(Boolean) : [];

			if (!category || !description) {
				return this.root.json({ ok: false, error: "missing_category_or_description" }, 400, cors);
			}

			step = "resolve_mural_id";
			const muralId = await this.resolveReflexiveMuralId(body.projectId, body.muralId);
			if (!muralId) {
				return this.root.json({
					ok: false,
					error: "no_mural_id",
					message: "No Reflexive Journal mural found or mapped."
				}, 400, cors);
			}

			step = "access_token";
			const tokenRes = await this._getValidAccessToken(uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason }, 401, cors);
			}
			const accessToken = tokenRes.token;

			step = "load_widgets";
			const widgetsJs = await getWidgets(this.root.env, accessToken, muralId).catch((e) => {
				throw Object.assign(new Error("widgets_load_failed"), { cause: e });
			});

			const stickyList = normaliseWidgets(widgetsJs?.widgets);
			const last = findLatestInCategory(stickyList, category);

			let stickyId = null;
			let action = "";
			let targetX = last?.x ?? 200;
			let targetY = last?.y ?? 200;
			let targetW = last?.width ?? DEFAULT_W;
			let targetH = last?.height ?? DEFAULT_H;

			step = "write_or_create";
			if (last && (last.text || "").trim().length === 0) {
				await updateSticky(this.root.env, accessToken, muralId, last.id, { text: description });
				stickyId = last.id;
				action = "updated-empty-sticky";
			} else {
				if (last) {
					targetY = (last.y || 0) + (last.height || DEFAULT_H) + GRID_Y;
					targetX = last.x || targetX;
				}
				const crt = await createSticky(this.root.env, accessToken, muralId, {
					text: description,
					x: Math.round(targetX),
					y: Math.round(targetY),
					width: Math.round(targetW),
					height: Math.round(targetH)
				});
				stickyId = crt?.id || null;
				action = "created-new-sticky";
			}

			step = "tagging";
			if (labels.length && stickyId) {
				const tagIds = await ensureTagsBlueberry(this.root.env, accessToken, muralId, labels).catch(() => []);
				if (tagIds.length) {
					await applyTagsToSticky(this.root.env, accessToken, muralId, stickyId, tagIds).catch(() => null);
				}
			}

			return this.root.json({ ok: true, stickyId, action }, 200, cors);

		} catch (err) {
			console.error("[muralJournalSync]", step, err);
			return this.root.json({
				ok: false,
				error: "journal_sync_failed",
				step,
				message: err?.message || "unknown",
				stack: err?.stack || null
			}, 500, cors);
		}
	}
}
