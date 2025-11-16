/**
 * @file service/internals/mural.js
 * @module service/internals/mural
 * @summary Mural routes logic (OAuth + provisioning + journal sync) backed by Airtable.
 *
 * Key change: when creating a "Mural Boards" row we now POST the Project Record ID
 * into the single-line text field "Project ID". Airtable's Field Agent will link
 * this to the Projects table internally. We still read legacy linked fields for
 * backward compatibility.
 */

import {
	buildAuthUrl,
	exchangeAuthCode,
	refreshAccessToken,
	verifyHomeOfficeByCompany,
	ensureUserRoom,
	ensureProjectFolder,
	createMural,
	duplicateMural,
	getMural,
	getMe,
	getWorkspace,
	getActiveWorkspaceIdFromMe,
	listUserWorkspaces,
	getWidgets,
	createSticky,
	updateSticky,
	ensureTagsBlueberry,
	applyTagsToSticky,
	normaliseWidgets,
	findLatestInCategory,
	getMuralLinks,
	createViewerLink,
	updateAreaTitle
} from "../../lib/mural.js";

import {
	listBoards as atListBoards,
	createBoard as atCreateBoard,
	updateBoard as atUpdateBoard,
	resolveProjectRecordId as atResolveProjectRecordId
} from "./airtable.js";

import { b64Encode, b64Decode } from "../../core/utils.js";

/** @typedef {import("../index.js").ResearchOpsService} ResearchOpsService */

const GRID_Y = 32;
const DEFAULT_W = 240;
const DEFAULT_H = 120;
const PURPOSE_REFLEXIVE = "reflexive_journal";

const _memCache = new Map();

/* ───────────────────────── small debug helpers ───────────────────────── */
function _wantDebugFromUrl(urlLike) {
	try { return (new URL(String(urlLike))).searchParams.get("debug") === "true"; } catch { return false; }
}

function _withDebugCtx(root, dbg) { return Object.assign({}, root, { __dbg: !!dbg }); }

function _log(root, level, event, data) {
	const dbg = !!root?.__dbg;
	const low = level === "debug" || level === "info";
	if (low && !dbg) return;
	try {
		const log = root?.log;
		if (log?.[level]) log[level](event, data);
		else if (level === "error") console.error(`[${event}]`, data);
		else if (level === "warn") console.warn(`[${event}]`, data);
		else console.log(`[${event}]`, data);
	} catch {}
}

/* ───────────────────────── URL helpers ───────────────────────── */

function _looksLikeMuralViewerUrl(u) {
	try {
		const x = new URL(u);
		if (x.hostname !== "app.mural.co") return false;
		const p = x.pathname || "";
		return (
			/^\/t\/[^/]+\/m\/[^/]+/i.test(p) ||
			/^\/invitation\/mural\/[a-z0-9.-]+/i.test(p) ||
			/^\/viewer\//i.test(p) ||
			/^\/share\/[^/]+\/mural\/[a-z0-9.-]+/i.test(p)
		);
	} catch { return false; }
}

function _extractViewerUrl(payload) {
	if (!payload) return null;
	const seen = new Set();
	const queue = [payload];

	while (queue.length) {
		const n = queue.shift();
		if (!n || seen.has(n)) continue;
		seen.add(n);

		if (typeof n === "string" && _looksLikeMuralViewerUrl(n)) return n;
		if (typeof n !== "object") continue;

		const cands = [
			n.viewerUrl, n.viewerURL, n.viewLink, n.viewURL,
			n.openUrl, n.openURL, n._canvasLink, n.url, n.href, n.link,
			n.value, n.links, n.links?.viewer, n.links?.open, n.links?.share, n.links?.public
		].filter(Boolean);

		for (const c of cands) {
			if (typeof c === "string" && _looksLikeMuralViewerUrl(c)) return c;
			if (c && typeof c === "object") queue.push(c);
		}
		for (const v of Object.values(n))
			if (!cands.includes(v)) queue.push(v);
	}
	return null;
}

async function _probeViewerUrl(env, accessToken, muralId, rootLike = null) {
	try {
		const hydrated = await getMural(env, accessToken, muralId).catch(() => null);
		const url = _extractViewerUrl(hydrated);
		if (url) return url;
	} catch {}
	try {
		const links = await getMuralLinks(env, accessToken, muralId).catch(() => []);
		const best = links.find(l => _looksLikeMuralViewerUrl(l.url)) ||
			links.find(l => /viewer|view|open|public/i.test(String(l.type || "")) && l.url);
		if (best?.url && _looksLikeMuralViewerUrl(best.url)) return best.url;
	} catch {}
	try {
		const created = await createViewerLink(env, accessToken, muralId);
		if (created && _looksLikeMuralViewerUrl(created)) return created;
	} catch {}
	try {
		const hydrated2 = await getMural(env, accessToken, muralId).catch(() => null);
		const url2 = _extractViewerUrl(hydrated2);
		if (url2) return url2;
	} catch {}
	return null;
}

/* ───────────────────────── KV helpers ───────────────────────── */

async function _kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try { return JSON.parse(raw); } catch { return null; }
}

/* ───────────────────────── Workspace helpers ───────────────────────── */

async function _ensureWorkspace(root, accessToken, explicitWorkspaceId) {
	const inCompany = await verifyHomeOfficeByCompany(root.env, accessToken);
	if (!inCompany) throw Object.assign(new Error("not_in_home_office_workspace"), { code: 403 });

	if (explicitWorkspaceId) {
		try {
			const ws = await getWorkspace(root.env, accessToken, explicitWorkspaceId);
			const v = ws?.value || ws || {};
			return { id: v.id || explicitWorkspaceId, key: v.key || v.shortId || null, name: v.name || null };
		} catch {}
	}

	const me = await getMe(root.env, accessToken);
	const wsHint = getActiveWorkspaceIdFromMe(me);
	if (!wsHint) throw new Error("no_active_workspace");

	return { id: wsHint, key: null, name: null };
}

async function _getValidAccessToken(self, uid) {
	const tokens = await self.loadTokens(uid);
	if (!tokens?.access_token) return { ok: false, reason: "not_authenticated" };

	let accessToken = tokens.access_token;
	try {
		await verifyHomeOfficeByCompany(self.root.env, accessToken);
		return { ok: true, token: accessToken };
	} catch (err) {
		const status = Number(err?.status || 0);
		if (status === 401 && tokens.refresh_token) {
			try {
				const refreshed = await refreshAccessToken(self.root.env, tokens.refresh_token);
				const merged = { ...tokens, ...refreshed };
				await self.saveTokens(uid, merged);
				accessToken = merged.access_token;
				await verifyHomeOfficeByCompany(self.root.env, accessToken);
				return { ok: true, token: accessToken };
			} catch {
				return { ok: false, reason: "not_authenticated" };
			}
		}
		return { ok: false, reason: "error" };
	}
}

/* ───────────────────────── Class ───────────────────────── */

export class MuralServicePart {
	constructor(root) { this.root = root; }
	kvKey(uid) { return `mural:${uid}:tokens`; }
	async saveTokens(uid, tokens) { await this.root.env.SESSION_KV.put(this.kvKey(uid), JSON.stringify(tokens), { encryption: true }); }
	async loadTokens(uid) { const raw = await this.root.env.SESSION_KV.get(this.kvKey(uid)); return raw ? JSON.parse(raw) : null; }

	async resolveBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
		if (explicitMuralId) return { muralId: String(explicitMuralId) };

		if (projectId) {
			const cacheKey = `${projectId}·${uid || ""}·${purpose}`;
			const cached = _memCache.get(cacheKey);
			if (cached && (Date.now() - cached.ts < 60_000)) {
				if (cached.deleted) return null;
				return { muralId: cached.muralId, boardUrl: cached.boardUrl, workspaceId: cached.workspaceId };
			}

			const rows = await atListBoards(this.root.env, { projectId, uid, purpose, active: true, max: 25 }, this.root);
			const top = rows[0];
			if (top?.fields) {
				const f = top.fields;
				const rec = {
					muralId: String(f["Mural ID"] || ""),
					boardUrl: f["Board URL"] || null,
					workspaceId: f["Workspace ID"] || null,
					primary: !!f["Primary?"]
				};
				if (rec.muralId) {
					_memCache.set(cacheKey, { ...rec, ts: Date.now(), deleted: false });
					return rec;
				}
			}

			const kv = await _kvProjectMapping(this.root.env, { uid, projectId });
			if (kv?.url && kv?.muralId && _looksLikeMuralViewerUrl(kv.url)) {
				const rec = {
					muralId: String(kv.muralId),
					boardUrl: kv.url,
					workspaceId: kv?.workspaceId ? String(kv.workspaceId) : null,
					primary: true
				};
				_memCache.set(cacheKey, { ...rec, ts: Date.now(), deleted: false });
				return rec;
			}
		}

		const envId = this.root?.env?.MURAL_REFLEXIVE_MURAL_ID;
		if (envId) return { muralId: String(envId) };
		return null;
	}

	/**
	 * Create/update the Mural Boards mapping row using the "Project ID" text field.
	 */
	async registerBoard({ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl, workspaceId = null, primary = true }) {
		if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

		const safeProjectIdText = String(projectId).trim();
		const normalizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : null;
		const normalizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;

		let existing = null;
		try {
			const rows = await atListBoards(this.root.env, { projectId: safeProjectIdText, uid, purpose, active: true, max: 25 }, this.root);
			existing = rows.find(r => String(r?.fields?.["Mural ID"] || "").trim() === String(muralId).trim()) || null;
		} catch {}

		if (existing) {
			const updateFields = {
				"Project ID": safeProjectIdText,
				"UID": String(uid),
				"Purpose": String(purpose),
				"Mural ID": String(muralId),
				"Primary?": !!primary,
				"Active": true
			};
			if (normalizedBoardUrl) updateFields["Board URL"] = normalizedBoardUrl;
			if (normalizedWorkspaceId) updateFields["Workspace ID"] = normalizedWorkspaceId;

			await atUpdateBoard(this.root.env, existing.id, updateFields, this.root);
		} else {
			await atCreateBoard(this.root.env, {
				projectIdText: safeProjectIdText,
				uid: String(uid),
				purpose: String(purpose),
				muralId: String(muralId),
				boardUrl: normalizedBoardUrl || undefined,
				workspaceId: normalizedWorkspaceId || undefined,
				primary: !!primary,
				active: true
			}, this.root);
		}

		const cacheKey = `${safeProjectIdText}·${uid || ""}·${purpose}`;
		_memCache.set(cacheKey, {
			muralId: String(muralId),
			boardUrl: normalizedBoardUrl,
			workspaceId: normalizedWorkspaceId,
			ts: Date.now(),
			primary: !!primary,
			deleted: false
		});
		return { ok: true };
	}

	async muralAuth(origin, url) {
		const dbg = _wantDebugFromUrl(url);
		const uid = url.searchParams.get("uid") || "anon";
		const ret = url.searchParams.get("return") || "";
		let safeReturn = "/pages/projects/";
		try {
			if (ret && new URL(ret).origin === new URL(origin).origin) safeReturn = ret;
		} catch { if (ret.startsWith("/")) safeReturn = ret; }

		const state = b64Encode(JSON.stringify({ uid, ts: Date.now(), return: safeReturn }));
		const redirect = buildAuthUrl(this.root.env, state);
		return Response.redirect(redirect, 302);
	}

	async muralCallback(origin, url) {
		const code = url.searchParams.get("code");
		const stateB64 = url.searchParams.get("state");
		if (!code) return Response.redirect("/pages/projects/#mural-auth-missing-code", 302);

		let uid = "anon";
		let stateObj = {};
		try {
			stateObj = JSON.parse(b64Decode(stateB64 || ""));
			uid = stateObj?.uid || "anon";
		} catch {}

		let tokens;
		try {
			tokens = await exchangeAuthCode(this.root.env, code);
		} catch {
			return Response.redirect(`${stateObj?.return || "/pages/projects/"}#mural-token-exchange-failed`, 302);
		}

		await this.saveTokens(uid, tokens);

		const want = stateObj?.return || "/pages/projects/";
		const back = want.startsWith("http") ? want : new URL(want, url).toString();
		const u = new URL(back);
		u.searchParams.set("mural", "connected");
		return Response.redirect(u.toString(), 302);
	}

	async muralVerify(origin, url) {
		const cors = this.root.corsHeaders(origin);
		const uid = url.searchParams.get("uid") || "anon";
		try {
			const tokenRes = await _getValidAccessToken(this, uid);
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

	/** POST /api/mural/setup  body: { uid, projectId, projectName, workspaceId? } */
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
				ws = await _ensureWorkspace(this.root, accessToken, wsOverride);
				console.log("[mural.setup] Workspace verified", { workspaceId: ws.id, workspaceName: ws.name });
			} catch (err) {
				const code = Number(err?.status || err?.code || 0);
				if (code === 401 && tokens.refresh_token) {
					console.log("[mural.setup] Token expired, refreshing");
					const refreshed = await refreshAccessToken(this.root.env, tokens.refresh_token);
					const merged = { ...tokens, ...refreshed };
					await this.saveTokens(uid, merged);
					accessToken = merged.access_token;
					ws = await _ensureWorkspace(this.root, accessToken, wsOverride);
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

			step = "resolve_room";
			const room = await ensureUserRoom(this.root.env, accessToken, ws.id);
			const roomId = room?.id || room?.value?.id;
			if (!roomId) {
				console.error("[mural.setup] No room ID obtained", { room });
				return this.root.json({ ok: false, error: "room_not_found", step }, 502, cors);
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

			// ───── NEW: update area title via areas endpoint ─────
			step = "update_area_title";
			try {
				console.log("[mural.setup] Updating area title for reflexive journal", {
					muralId,
					projectName
				});
				await updateAreaTitle(this.root.env, accessToken, muralId, projectName);
				console.log("[mural.setup] Area title update completed", {
					muralId,
					projectName
				});
			} catch (e) {
				console.warn("[mural.setup] Area title update failed (non-critical)", {
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
				openUrl = await _probeViewerUrl(this.root.env, accessToken, muralId, this.root);
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
					await this.root.env.SESSION_KV.put(kvKey, JSON.stringify({
						url: openUrl,
						muralId,
						workspaceId: ws?.id || null,
						projectName,
						updatedAt: Date.now()
					}));
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
			}, 200, cors);

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
			return this.root.json({ ok: true, muralId: resolved.muralId || null, boardUrl: resolved.boardUrl || null },
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
		const cors = this.root.corsHeaders(origin);
		let step = "parse_input";

		try {
			const body = await request.json().catch(() => ({}));
			const uid = String(body?.uid || "anon");
			const purpose = String(body?.purpose || PURPOSE_REFLEXIVE);
			const category = String(body?.category || "").toLowerCase().trim();
			const description = String(body?.description || "").trim();
			const labels = Array.isArray(body?.tags) ? body.tags.filter(Boolean) : [];

			if (!category || !description) {
				return this.root.json({ ok: false, error: "missing_category_or_description" }, 400, cors);
			}
			if (!["perceptions", "procedures", "decisions", "introspections"].includes(category)) {
				return this.root.json({ ok: false, error: "unsupported_category" }, 400, cors);
			}

			step = "resolve_board";
			const resolved = await this.resolveBoard({
				projectId: body.projectId,
				uid: uid || undefined,
				purpose,
				explicitMuralId: body.muralId
			});
			const muralId = resolved?.muralId || null;
			if (!muralId) {
				return this.root.json({ ok: false, error: "no_mural_id" }, 404, cors);
			}

			step = "access_token";
			const tokenRes = await _getValidAccessToken(this, uid);
			if (!tokenRes.ok) {
				return this.root.json({ ok: false, error: tokenRes.reason },
					tokenRes.reason === "not_authenticated" ? 401 : 500,
					cors
				);
			}
			const accessToken = tokenRes.token;

			step = "load_widgets";
			const widgetsJs = await getWidgets(this.root.env, accessToken, muralId);
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
					targetW = last.width || targetW;
					targetH = last.height || targetH;
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
				const tagIds = await ensureTagsBlueberry(this.root.env, accessToken, muralId, labels);
				if (tagIds.length) {
					await applyTagsToSticky(this.root.env, accessToken, muralId, stickyId, tagIds);
				}
			}

			return this.root.json({ ok: true, stickyId, action, muralId }, 200, cors);

		} catch (err) {
			const status = Number(err?.status) || 500;
			const body = err?.body || null;
			const message = String(err?.message || "journal_sync_failed");
			return this.root.json({ ok: false, error: "journal_sync_failed", step, message, upstream: body },
				status,
				cors
			);
		}
	}
}
