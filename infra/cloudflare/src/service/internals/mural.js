/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) backed by Airtable,
 *          with D1 as a read-through fallback for board lookups when Airtable is unavailable.
 *
 * Key ideas:
 *  - Airtable remains the source of truth for "Mural Boards" metadata.
 *  - D1 is used as a non-breaking fallback when Airtable is rate-limited/unavailable.
 *  - Journal → Mural sync must still work when Airtable 429s, as long as a board
 *    mapping exists in D1 for the project.
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	ensureProjectFolder,
	createMural,
	duplicateMural,
	getMural,
	getMe,
	getActiveWorkspaceIdFromMe,
	listUserWorkspaces,
	updateAreaTitle
} from "../../lib/mural.js";

import {
	PURPOSE_REFLEXIVE,
	registerBoardForService,
	resolveBoardForService
} from "./mural-board-registry.js";
import { handleMuralJournalSync } from "./mural-journal-sticky.js";
import { getValidAccessToken } from "./mural-tokens.js";
import { probeViewerUrl } from "./mural-viewer.js";
import { ensureWorkspace, resolveUserOwnedRoomForSetup } from "./mural-workspace.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

function isMissingOrInaccessibleMural(err) {
	const status = Number(err?.status || 0);
	return status === 403 || status === 404 || status === 410;
}

function base64UrlEncodeBytes(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeJson(value) {
	return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlDecodeJson(value) {
	const padded = `${String(value || "").replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (String(value || "").length % 4)) % 4)}`;
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return JSON.parse(new TextDecoder().decode(bytes));
}

async function hmacKey(env) {
	const secret = env.MURAL_OAUTH_STATE_SECRET || env.RESEARCHOPS_AUTH_SECRET || "";
	if (!secret) throw new Error("missing_oauth_state_secret");
	return crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"]
	);
}

async function signOAuthState(env, payload) {
	const encodedPayload = base64UrlEncodeJson(payload);
	const signature = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(encodedPayload));
	return `${encodedPayload}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function verifyOAuthState(env, state) {
	const [encodedPayload, encodedSignature] = String(state || "").split(".");
	if (!encodedPayload || !encodedSignature) throw new Error("invalid_oauth_state");
	const signatureBytes = Uint8Array.from(atob(`${encodedSignature.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (encodedSignature.length % 4)) % 4)}`), (char) => char.charCodeAt(0));
	const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), signatureBytes, new TextEncoder().encode(encodedPayload));
	if (!ok) throw new Error("invalid_oauth_state");
	const payload = base64UrlDecodeJson(encodedPayload);
	const issuedAt = Number(payload?.ts || 0);
	if (!payload?.uid || !Number.isFinite(issuedAt) || Date.now() - issuedAt > 10 * 60 * 1000) {
		throw new Error("expired_oauth_state");
	}
	return payload;
}

function authenticatedUid(authContext) {
	const uid = authContext?.user?.id || authContext?.userId || "";
	if (!uid) throw new Error("authenticated_user_required");
	return String(uid);
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	/**
	 * @param {ResearchOpsService} root
	 */
	constructor(root) {
		this.root = root;
	}

	kvKey(uid) {
		return `mural:user:${uid}:tokens`;
	}

	async saveTokens(uid, tokens) {
		await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true });
	}

	async loadTokens(uid) {
		const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid));
		return raw ? JSON.parse(raw) : null;
	}

	/**
	 * Resolve the Mural board for a project.
	 *
	 * Strategy (Airtable-first, D1 fallback):
	 *  1) If explicitMuralId is provided, use it directly (caller knows best).
	 *  2) Try in-memory cache (1-minute TTL).
	 *  3) Determine project identity:
	 *     - If projectId looks like recXXXX, treat as Airtable project id.
	 *     - Else treat as local project UUID and try D1 → Airtable mapping.
	 *     - If still unknown and Airtable is available, use atResolveProjectRecordId.
	 *  4) Query Airtable "Mural Boards" (primary source of truth).
	 *  5) If Airtable fails (429/5xx/env missing) or finds nothing, query D1 mural_boards.
	 *  6) If still nothing, fall back to KV cache, then env.MURAL_REFLEXIVE_MURAL_ID.
	 *
	 * D1 is *never* used to replace Airtable as the primary registry; it only makes
	 * journal → Mural sync resilient when Airtable is having a bad day.
	 *
	 * @param {{ projectId:string, uid?:string, purpose?:string, explicitMuralId?:string|null }} args
	 * @returns {Promise<{ muralId:string|null, boardUrl:string|null, workspaceId:string|null, projectRecordId:string|null, source:string }>}
	 */
	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		return resolveBoardForService(this, { projectId, uid, purpose, explicitMuralId });
	}

	async registerBoard({
		projectId,
		uid,
		purpose = PURPOSE_REFLEXIVE,
		muralId,
		boardUrl,
		workspaceId = null,
		primary = true
	}) {
		return registerBoardForService(this, {
			projectId,
			uid,
			purpose,
			muralId,
			boardUrl,
			workspaceId,
			primary
		});
	}

	async muralAuth(origin, url, authContext) {
		const uid = authenticatedUid(authContext);
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";
		try {
			if (ret && new URL(ret).origin === new URL(origin).origin) safeReturn = ret;
		} catch {
			if (ret.startsWith("/")) safeReturn = ret;
		}

		const state = await signOAuthState(this.root.env, { uid, ts: Date.now(), return: safeReturn });
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const { env } = this.root;

		if (!env.MURAL_CLIENT_SECRET) {
			return this.root.json({
				ok: false,
				error: "missing_secret",
				message: "MURAL_CLIENT_SECRET is not configured in Cloudflare secrets."
			}, 500, this.root.corsHeaders(origin));
		}

		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) {
			return this.root.json({ ok: false, error: "missing_code" }, 400, this.root.corsHeaders(origin));
		}

		let stateObj = {};
		try {
			stateObj = await verifyOAuthState(env, stateB64);
		} catch {
			return this.root.json({ ok: false, error: "invalid_oauth_state" }, 400, this.root.corsHeaders(origin));
		}

		// Exchange code → tokens
		let tokens;
		try {
			tokens = await exchangeAuthCode(env, code);
		} catch (err) {
			return this.root.json({
				ok: false,
				error: "token_exchange_failed",
				message: err?.message || "Unable to exchange OAuth code"
			}, 500, this.root.corsHeaders(origin));
		}

		await this.saveTokens(stateObj.uid, tokens);

		// Build redirect target
		const want = stateObj?.return || "/pages/projects/";
		let backUrl;

		// Use PAGES_ORIGIN as the base for ALL redirects (with hardcoded fallback)
		const pagesOrigin = env.PAGES_ORIGIN || "https://researchops.pages.dev";

		if (want.startsWith("http")) {
			// Absolute URL: validate and use if allowed, otherwise fallback to PAGES_ORIGIN + default path
			const isAllowed = _isAllowedReturn(env, want);
			backUrl = isAllowed ?
				new URL(want) :
				new URL("/pages/projects/", pagesOrigin); // FIX: use pagesOrigin, not url
		} else {
			// Relative URL: use PAGES_ORIGIN as base
			backUrl = new URL(want, pagesOrigin); // FIX: use pagesOrigin, not url
		}

		// Append mural=connected param
		const sp = new URLSearchParams(backUrl.search);
		sp.set("mural", "connected");
		backUrl.search = sp.toString();

		const finalUrl = backUrl.toString();

		return Response.redirect(finalUrl, 302);
	}

	async muralVerify(origin, url, authContext) {
		const cors = this.root.corsHeaders(origin);
		const uid = authenticatedUid(authContext);
		try {
			const tokenRes = await getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const activeWorkspaceId = getActiveWorkspaceIdFromMe(me) || null;
			return this.root.json({ ok: true, me, activeWorkspaceId }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "verify_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralSetup(request, origin, authContext) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const body = await request.json().catch(() => ({}));
			const uid = authenticatedUid(authContext);
			const projectId = body?.projectId ?? null;
			const projectName = body?.projectName;
			const wsOverride = body?.workspaceId;

			if (!projectName || !String(projectName).trim()) {
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}
			if (!projectId) {
				return this.root.json({ ok: false, error: "projectId required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			step = "verify_workspace";
			let accessToken = tokens.access_token;
			let ws;
			try {
				ws = await ensureWorkspace(this.root, accessToken, wsOverride);
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await ensureWorkspace(this.root, accessToken, wsOverride);
				} else if (String(err?.message) === "not_in_home_office_workspace") {
					return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
				} else {
					throw err;
				}
			}

			step = "get_me";
			await getMe(this.root.env, accessToken).catch(() => null);

			step = "resolve_user_room";
			const room = await resolveUserOwnedRoomForSetup(this.root.env, accessToken, ws.id);
			const roomId = room?.id || room?.value?.id;
			if (!roomId) {
				return this.root.json({ ok: false, error: "user_room_not_found", step }, 502, cors);
			}

			step = "ensure_folder";
			let folder = null;
			try {
				folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
			} catch {}

			step = "duplicate_or_create_mural";
			let mural = null;
			let muralId = null;
			let templateCopied = true;

			const muralTitle = `Reflexive Journal: ${projectName}`;

			try {
				mural = await duplicateMural(this.root.env, accessToken, {
					title: muralTitle,
					roomId,
					folderId: folder?.id || folder?.value?.id
				});
				muralId = mural?.id || mural?.value?.id;
			} catch (e) {
				templateCopied = false;

				if (e?.status === 404) {
					mural = await createMural(this.root.env, accessToken, {
						title: muralTitle,
						roomId,
						folderId: folder?.id || folder?.value?.id
					});
					muralId = mural?.id || mural?.value?.id;
				} else {
					throw Object.assign(
						new Error(`Template duplication failed: ${e?.message || "Unknown error"}`), {
							code: "TEMPLATE_COPY_FAILED",
							status: e?.status,
							originalError: e
						}
					);
				}
			}

			if (!muralId) {
				return this.root.json({ ok: false, error: "mural_id_unavailable", step }, 502, cors);
			}

			// Update the title widget on the duplicated mural
			step = "update_area_title";
			try {
				await updateAreaTitle(this.root.env, accessToken, muralId, projectName);
			} catch {}

			step = "probe_viewer_url";
			let openUrl = null;
			const deadline = Date.now() + 9000;
			while (!openUrl && Date.now() < deadline) {
				openUrl = await probeViewerUrl(this.root.env, accessToken, muralId);
				if (!openUrl) {
					await new Promise(r => setTimeout(r, 600));
				}
			}

			step = "register_board";
			await this.registerBoard({
				projectId,
				uid,
				purpose: PURPOSE_REFLEXIVE,
				muralId,
				boardUrl: openUrl ?? undefined,
				workspaceId: ws?.id || null,
				primary: true
			});

			if (openUrl) {
				const kvKey = `mural:${uid}:project:id::${String(projectId)}`;
				try {
					await this.root.env.SESSION_KV.put(
						kvKey,
						JSON.stringify({
							url: openUrl,
							muralId,
							workspaceId: ws?.id || null,
							projectName,
							updatedAt: Date.now()
							})
						);
					} catch {}
				}

			return this.root.json({
					ok: true,
					workspace: ws,
					room,
					folder,
					mural: { ...mural, id: muralId, viewLink: openUrl || null },
					projectId,
					registered: true,
					boardUrl: openUrl || null,
					templateCopied
				},
				200,
				cors
			);
		} catch (err) {
			const status = Number(err?.status) || 500;
			const message = String(err?.message || "setup_failed");
			const code = err?.code || null;

			return this.root.json({ ok: false, error: "setup_failed", step, message, code },
				status,
				cors
			);
		}
	}

	async muralResolve(origin, url, authContext) {
		const cors = this.root.corsHeaders(origin);
		try {
			const projectId = url.searchParams.get("projectId") || "";
			const uid = authenticatedUid(authContext);
			const purpose = url.searchParams.get("purpose") || PURPOSE_REFLEXIVE;
			if (!projectId) {
				return this.root.json({ ok: false, error: "missing_projectId" }, 400, cors);
			}

			const resolved = await this.resolveBoard({ projectId, uid: uid || undefined, purpose });
			if (!resolved?.muralId && !resolved?.boardUrl) {
				return this.root.json({ ok: false, error: "not_found" }, 404, cors);
			}
			if (resolved?.muralId && uid) {
				const tokenRes = await getValidAccessToken(this, uid);
				if (tokenRes.ok) {
					try {
						await getMural(this.root.env, tokenRes.token, resolved.muralId);
					} catch (err) {
						if (isMissingOrInaccessibleMural(err)) {
							return this.root.json(
								{
									ok: false,
									error: "stale_board_unavailable",
									muralId: resolved.muralId,
									source: resolved.source || null
								},
								404,
								cors
							);
						}
						throw err;
					}
				}
			}
			return this.root.json({
					ok: true,
					muralId: resolved.muralId || null,
					boardUrl: resolved.boardUrl || null,
					projectRecordId: resolved.projectRecordId || null,
					source: resolved.source || null
				},
				200,
				cors
			);
		} catch (e) {
			return this.root.json({ ok: false, error: "resolve_failed", detail: String(e?.message || e) },
				500,
				cors
			);
		}
	}

	async muralJournalSync(request, origin, authContext) {
		const body = await request.clone().json().catch(() => ({}));
		const uid = authenticatedUid(authContext);
		const next = new Request(request, {
			body: JSON.stringify({ ...body, uid }),
			headers: new Headers(request.headers)
		});
		return handleMuralJournalSync(this, next, origin);
	}

	async muralListWorkspaces(origin, url, authContext) {
		const cors = this.root.corsHeaders(origin);
		const uid = authenticatedUid(authContext);

		try {
			const tokenRes = await getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const list = await listUserWorkspaces(this.root.env, accessToken);
			return this.root.json({ ok: true, workspaces: list }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "workspaces_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralMe(origin, url, authContext) {
		const cors = this.root.corsHeaders(origin);
		const uid = authenticatedUid(authContext);

		try {
			const tokenRes = await getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			const me = await getMe(this.root.env, accessToken);
			return this.root.json({ ok: true, me }, 200, cors);
		} catch (err) {
			return this.root.json({ ok: false, error: "me_failed", detail: String(err?.message || err) },
				500,
				cors
			);
		}
	}

	async muralDebugEnv(origin) {
		const cors = this.root.corsHeaders(origin);
		const env = this.root.env;
		return this.root.json({
				ok: true,
				env: {
					hasMuralClientId: !!env.MURAL_CLIENT_ID,
					hasMuralClientSecret: !!env.MURAL_CLIENT_SECRET,
					muralRedirectUri: env.MURAL_REDIRECT_URI || "(not set)",
					muralApiBase: env.MURAL_API_BASE || "(default)",
					muralTemplateReflexive: env.MURAL_TEMPLATE_REFLEXIVE || "(default)"
				}
			},
			200,
			cors
		);
	}
}
