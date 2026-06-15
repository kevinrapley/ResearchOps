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

import { b64Encode, b64Decode } from "../../core/utils.js";
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

/* ───────────────────────── small debug helpers ───────────────────────── */
function _wantDebugFromUrl(urlLike) {
	try {
		return (new URL(String(urlLike))).searchParams.get("debug") === "true";
	} catch {
		return false;
	}
}

function isMissingOrInaccessibleMural(err) {
	const status = Number(err?.status || 0);
	return status === 403 || status === 404 || status === 410;
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
		return `mural:${uid}:tokens`;
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

	async muralAuth(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";
		try {
			if (ret && new URL(ret).origin === new URL(origin).origin) safeReturn = ret;
		} catch {
			if (ret.startsWith("/")) safeReturn = ret;
		}

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn, dbg }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const { env } = this.root;

		// Debug logging (remove after fix is verified)
		console.log('[muralCallback] Environment check:', {
			hasPAGES_ORIGIN: Boolean(env.PAGES_ORIGIN),
			PAGES_ORIGIN: env.PAGES_ORIGIN,
			hasALLOWED_ORIGINS: Boolean(env.ALLOWED_ORIGINS),
			ALLOWED_ORIGINS: env.ALLOWED_ORIGINS
		});

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

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch { /* ignore */ }

		// Debug: log decoded state
		console.log('[muralCallback] Decoded state:', {
			uid,
			return: stateObj?.return,
			ts: stateObj?.ts
		});

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

		await this.saveTokens(uid, tokens);

		// Build redirect target
		const want = stateObj?.return || "/pages/projects/";
		let backUrl;

		// Use PAGES_ORIGIN as the base for ALL redirects (with hardcoded fallback)
		const pagesOrigin = env.PAGES_ORIGIN || "https://researchops.pages.dev";

		console.log('[muralCallback] Building redirect:', {
			want,
			pagesOrigin,
			startsWithHttp: want.startsWith("http")
		});

		if (want.startsWith("http")) {
			// Absolute URL: validate and use if allowed, otherwise fallback to PAGES_ORIGIN + default path
			const isAllowed = _isAllowedReturn(env, want);
			console.log('[muralCallback] Absolute URL validation:', {
				want,
				isAllowed,
				allowedOrigins: env.ALLOWED_ORIGINS
			});

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
		console.log('[muralCallback] Final redirect URL:', finalUrl);

		return Response.redirect(finalUrl, 302);
	}

	async muralVerify(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
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

	async muralSetup(request, origin) {
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const body = await request.json().catch(() => ({}));
			const uid = body?.uid ?? "anon";
			const projectId = body?.projectId ?? null;
			const projectName = body?.projectName;
			const wsOverride = body?.workspaceId;

			console.log("[mural.setup] Starting", { uid, projectId, projectName, hasWorkspaceOverride: !!wsOverride });

			if (!projectName || !String(projectName).trim()) {
				console.error("[mural.setup] Missing projectName");
				return this.root.json({ ok: false, error: "projectName required" }, 400, cors);
			}
			if (!projectId) {
				console.error("[mural.setup] Missing projectId");
				return this.root.json({ ok: false, error: "projectId required" }, 400, cors);
			}

			step = "load_tokens";
			const tokens = await this.loadTokens(uid);
			if (!tokens?.access_token) {
				console.error("[mural.setup] No access token for uid", { uid });
				return this.root.json({ ok: false, reason: "not_authenticated" }, 401, cors);
			}

			step = "verify_workspace";
			let accessToken = tokens.access_token;
			let ws;
			try {
				ws = await ensureWorkspace(this.root, accessToken, wsOverride);
				console.log("[mural.setup] Workspace verified", { workspaceId: ws.id, workspaceName: ws.name });
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					console.log("[mural.setup] Token expired, refreshing");
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await ensureWorkspace(this.root, accessToken, wsOverride);
					console.log("[mural.setup] Workspace verified after refresh", { workspaceId: ws.id });
				} else if (String(err?.message) === "not_in_home_office_workspace") {
					console.error("[mural.setup] Not in Home Office workspace");
					return this.root.json({ ok: false, reason: "not_in_home_office_workspace" }, 403, cors);
				} else {
					throw err;
				}
			}

			step = "get_me";
			const me = await getMe(this.root.env, accessToken).catch(() => null);
			const username = me?.value?.firstName || me?.name || "Private";
			console.log("[mural.setup] User identity", { username, userId: me?.value?.id });

			step = "resolve_user_room";
			const room = await resolveUserOwnedRoomForSetup(this.root.env, accessToken, ws.id);
			const roomId = room?.id || room?.value?.id;
			if (!roomId) {
				console.error("[mural.setup] No user-owned room ID obtained", { room });
				return this.root.json({ ok: false, error: "user_room_not_found", step }, 502, cors);
			}
			console.log("[mural.setup] Target room resolved", {
				roomId,
				roomName: room?.name || room?.title
			});

			step = "ensure_folder";
			let folder = null;
			try {
				folder = await ensureProjectFolder(this.root.env, accessToken, roomId, String(projectName).trim());
				console.log("[mural.setup] Folder ensured", { folderId: folder?.id, folderName: folder?.name });
			} catch (e) {
				console.warn("[mural.setup] Folder creation failed (non-critical)", { error: e?.message, status: e?.status });
			}

			step = "duplicate_or_create_mural";
			let mural = null;
			let muralId = null;
			let templateCopied = true;

			const templateId = this.root.env.MURAL_TEMPLATE_REFLEXIVE || "76da04f30edfebd1ac5b595ad2953629b41c1c7d";
			const muralTitle = `Reflexive Journal: ${projectName}`;
			console.log("[mural.setup] Starting mural creation", {
				templateId,
				roomId,
				folderId: folder?.id,
				muralTitle,
				willAttemptDuplication: true
			});

			try {
				mural = await duplicateMural(this.root.env, accessToken, {
					title: muralTitle,
					roomId,
					folderId: folder?.id || folder?.value?.id
				});
				muralId = mural?.id || mural?.value?.id;
				console.log("[mural.setup] Template duplication SUCCEEDED", { muralId });
			} catch (e) {
				templateCopied = false;

				console.error("[mural.setup] Template duplication FAILED", {
					error: e?.message,
					status: e?.status,
					body: e?.body,
					templateId: e?.templateId,
					endpoint: e?.endpoint,
					willFallbackToBlank: e?.status === 404
				});

				if (e?.status === 404) {
					console.log("[mural.setup] Fallback: Creating blank mural (404 - endpoint not found)");
					mural = await createMural(this.root.env, accessToken, {
						title: muralTitle,
						roomId,
						folderId: folder?.id || folder?.value?.id
					});
					muralId = mural?.id || mural?.value?.id;
					console.log("[mural.setup] Blank mural created", { muralId });
				} else {
					console.error("[mural.setup] NOT creating blank mural - non-404 error", { status: e?.status });
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
				console.error("[mural.setup] No mural ID after creation attempts");
				return this.root.json({ ok: false, error: "mural_id_unavailable", step }, 502, cors);
			}

			// Update the title widget on the duplicated mural
			step = "update_area_title";
			try {
				console.log("[mural.setup] Updating reflexive journal title widget", {
					muralId,
					projectName
				});
				await updateAreaTitle(this.root.env, accessToken, muralId, projectName);
				console.log("[mural.setup] Title widget update completed", {
					muralId,
					projectName
				});
			} catch (e) {
				console.warn("[mural.setup] Title widget update failed (non-critical)", {
					muralId,
					projectName,
					error: e?.message,
					status: e?.status
				});
			}

			step = "probe_viewer_url";
			let openUrl = null;
			const deadline = Date.now() + 9000;
			let attempts = 0;
			while (!openUrl && Date.now() < deadline) {
				attempts++;
				openUrl = await probeViewerUrl(this.root.env, accessToken, muralId);
				if (!openUrl) {
					await new Promise(r => setTimeout(r, 600));
				}
			}
			console.log("[mural.setup] Viewer URL probe", { openUrl, attempts, found: !!openUrl });

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
			console.log("[mural.setup] Board registered in Airtable");

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
					console.log("[mural.setup] KV cache updated");
				} catch (e) {
					console.warn("[mural.setup] KV cache update failed (non-critical)", { error: e?.message });
				}
			}

			console.log("[mural.setup] COMPLETE", {
				muralId,
				boardUrl: openUrl,
				templateCopied,
				folderCreated: !!folder?.id
			});

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
			const body = err?.body || null;
			const message = String(err?.message || "setup_failed");
			const code = err?.code || null;

			console.error("[mural.setup] FAILED", {
				step,
				status,
				code,
				message,
				body: body?.slice?.(0, 500) || body
			});

			return this.root.json({ ok: false, error: "setup_failed", step, message, code, upstream: body },
				status,
				cors
			);
		}
	}

	async muralResolve(origin, url) {
		const cors = this.root.corsHeaders(origin);
		try {
			const projectId = url.searchParams.get("projectId") || "";
			const uid = url.searchParams.get("uid") || "";
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

	async muralJournalSync(request, origin) {
		return handleMuralJournalSync(this, request, origin);
	}

	async muralListWorkspaces(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";

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

	async muralMe(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";

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
