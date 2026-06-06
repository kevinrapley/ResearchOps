import {
	createBoard as atCreateBoard,
	listBoards as atListBoards,
	resolveProjectRecordId as atResolveProjectRecordId,
	updateBoard as atUpdateBoard,
} from "./airtable.js";
import { d1Get, d1GetProjectByLocalId } from "./researchops-d1.js";

export const PURPOSE_REFLEXIVE = "reflexive_journal";

const memoryCache = new Map();
const resolveBoardCache = new Map();

async function kvProjectMapping(env, { uid, projectId }) {
	const key = `mural:${uid || "anon"}:project:id::${String(projectId || "")}`;
	const raw = await env.SESSION_KV.get(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/**
 * Best-effort lookup of a Mural board in D1 for a given project.
 * Airtable remains primary; D1 is only used when Airtable fails or has no row.
 */
async function d1ResolveMuralBoard(env, { projectRecordId, localProjectId, purpose }) {
	const purposeLower = (purpose || "").toLowerCase().trim();
	const hasProjectRecordId = !!projectRecordId;
	const hasLocalProjectId = !!localProjectId;

	if (!env || !env.RESEARCHOPS_D1) return null;

	const attempts = [];

	if (hasProjectRecordId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE project_record_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [projectRecordId, purposeLower] : [projectRecordId],
		});
	}

	if (!hasProjectRecordId && hasLocalProjectId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE local_project_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [localProjectId, purposeLower] : [localProjectId],
		});
	}

	if (!hasProjectRecordId && hasLocalProjectId) {
		attempts.push({
			sql: `
				SELECT mural_id,
				       board_url,
				       workspace_id,
				       project_record_id,
				       local_project_id
				  FROM mural_boards
				 WHERE project_id = ?1
				   ${purposeLower ? "AND (LOWER(purpose) = ?2)" : ""}
				 ORDER BY datetime(updated_at) DESC
				 LIMIT 1;
			`,
			params: purposeLower ? [localProjectId, purposeLower] : [localProjectId],
		});
	}

	for (const attempt of attempts) {
		try {
			const row = await d1Get(env, attempt.sql, attempt.params);
			if (row && row.mural_id) {
				return {
					mural_id: row.mural_id,
					board_url: row.board_url || null,
					workspace_id: row.workspace_id || null,
					project_record_id: row.project_record_id || null,
					local_project_id: row.local_project_id || null,
				};
			}
		} catch (err) {
			console.warn("[mural.d1ResolveMuralBoard] D1 lookup attempt failed", {
				message: String(err?.message || err),
			});
		}
	}

	return null;
}

export async function resolveBoardForService(self, { projectId, uid, purpose = PURPOSE_REFLEXIVE, explicitMuralId }) {
	if (explicitMuralId) {
		return {
			muralId: String(explicitMuralId),
			boardUrl: null,
			workspaceId: null,
			projectRecordId: null,
			source: "explicit",
		};
	}

	const rawProjectId = String(projectId || "").trim();
	const cacheKey = `${rawProjectId}·${purpose || ""}·${uid || ""}`;
	const now = Date.now();

	const cached = resolveBoardCache.get(cacheKey);
	if (cached && now - cached.ts < 60_000) {
		return {
			muralId: cached.muralId || null,
			boardUrl: cached.boardUrl || null,
			workspaceId: cached.workspaceId || null,
			projectRecordId: cached.projectRecordId || null,
			source: cached.source || "cache",
		};
	}

	const env = self.root.env;
	const log = self.root.log || console;
	const airtableConfigured =
		!!(env.AIRTABLE_BASE_ID || env.AIRTABLE_BASE) && !!(env.AIRTABLE_API_KEY || env.AIRTABLE_PAT);

	let localProjectId = null;
	let projectRecordId = null;

	if (rawProjectId && rawProjectId.startsWith("rec")) {
		projectRecordId = rawProjectId;
	} else if (rawProjectId) {
		localProjectId = rawProjectId;
	}

	if (localProjectId) {
		try {
			const proj = await d1GetProjectByLocalId(env, localProjectId);
			if (proj?.record_id) {
				projectRecordId = proj.record_id;
				log.info?.("[mural.resolveBoard] D1 mapped local project id → Airtable record id", {
					localProjectId,
					projectRecordId,
				});
			}
		} catch (err) {
			log.warn?.("[mural.resolveBoard] D1 project mapping failed", {
				localProjectId,
				err: String(err?.message || err),
			});
		}
	}

	let airtableError = null;
	if (!projectRecordId && airtableConfigured && rawProjectId) {
		try {
			projectRecordId = await atResolveProjectRecordId(env, rawProjectId);
		} catch (err) {
			airtableError = String(err?.message || err);
			log.warn?.("[mural.resolveBoard] atResolveProjectRecordId failed", {
				rawProjectId,
				err: airtableError,
			});
		}
	}

	let boardFromAirtable = null;

	if (airtableConfigured && (projectRecordId || rawProjectId)) {
		try {
			const rows = await atListBoards(
				env,
				{
					projectId: projectRecordId || rawProjectId,
					uid,
					purpose,
					active: true,
					max: 25,
				},
				self.root,
			);

			if (Array.isArray(rows) && rows.length) {
				const primaryRow =
					rows.find((r) => {
						const f = r?.fields || {};
						return f["Primary?"] === true || String(f["Primary?"] || "").toLowerCase() === "true";
					}) || rows[0];

				const f = primaryRow.fields || {};
				const muralId = f["Mural ID"] || f.mural_id || null;
				const boardUrl = f["Board URL"] || f.board_url || null;
				const workspaceId = f["Workspace ID"] || f.workspace_id || null;

				if (muralId) {
					boardFromAirtable = {
						muralId,
						boardUrl,
						workspaceId,
						projectRecordId: projectRecordId || null,
					};
				}
			}
		} catch (err) {
			airtableError = String(err?.message || err);
			log.warn?.("[mural.resolveBoard] Airtable listBoards failed; will consider D1 fallback", {
				err: airtableError,
			});
		}
	}

	if (boardFromAirtable?.muralId) {
		const result = {
			muralId: boardFromAirtable.muralId,
			boardUrl: boardFromAirtable.boardUrl || null,
			workspaceId: boardFromAirtable.workspaceId || null,
			projectRecordId: boardFromAirtable.projectRecordId || projectRecordId || null,
			source: "airtable",
		};
		resolveBoardCache.set(cacheKey, { ...result, ts: now });
		return result;
	}

	let boardFromD1 = null;
	try {
		boardFromD1 = await d1ResolveMuralBoard(env, {
			projectRecordId,
			localProjectId,
			purpose,
		});
	} catch (err) {
		log.warn?.("[mural.resolveBoard] D1 mural_boards lookup failed", {
			err: String(err?.message || err),
		});
	}

	if (boardFromD1?.mural_id) {
		const result = {
			muralId: boardFromD1.mural_id,
			boardUrl: boardFromD1.board_url || null,
			workspaceId: boardFromD1.workspace_id || null,
			projectRecordId: boardFromD1.project_record_id || projectRecordId || null,
			source: "d1",
		};
		resolveBoardCache.set(cacheKey, { ...result, ts: now });
		return result;
	}

	let kv = null;
	try {
		kv = await kvProjectMapping(env, { uid: uid || "anon", projectId: rawProjectId });
	} catch (err) {
		log.warn?.("[mural.resolveBoard] KV project mapping lookup failed", {
			err: String(err?.message || err),
		});
	}

	if (kv?.muralId) {
		const result = {
			muralId: kv.muralId,
			boardUrl: kv.url || kv.boardUrl || null,
			workspaceId: kv.workspaceId || null,
			projectRecordId: projectRecordId || null,
			source: "kv",
		};
		resolveBoardCache.set(cacheKey, { ...result, ts: now });
		return result;
	}

	const fallbackMuralId = env.MURAL_REFLEXIVE_MURAL_ID || null;
	const result = {
		muralId: fallbackMuralId,
		boardUrl: null,
		workspaceId: null,
		projectRecordId: projectRecordId || null,
		source: fallbackMuralId ? "env" : airtableError ? "airtable+d1-none" : "none",
	};
	resolveBoardCache.set(cacheKey, { ...result, ts: now });
	return result;
}

export async function registerBoardForService(
	self,
	{ projectId, uid, purpose = PURPOSE_REFLEXIVE, muralId, boardUrl, workspaceId = null, primary = true },
) {
	if (!projectId || !uid || !muralId) return { ok: false, error: "missing_fields" };

	const safeProjectIdText = String(projectId).trim();
	const normalizedBoardUrl = typeof boardUrl === "string" && boardUrl.trim() ? boardUrl.trim() : null;
	const normalizedWorkspaceId = typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;

	let existing = null;
	try {
		const rows = await atListBoards(
			self.root.env,
			{ projectId: safeProjectIdText, uid, purpose, active: true, max: 25 },
			self.root,
		);
		existing =
			rows.find((r) => String(r?.fields?.["Mural ID"] || "").trim() === String(muralId).trim()) || null;
	} catch {}

	if (existing) {
		const updateFields = {
			"Project ID": safeProjectIdText,
			UID: String(uid),
			Purpose: String(purpose),
			"Mural ID": String(muralId),
			"Primary?": !!primary,
			Active: true,
		};
		if (normalizedBoardUrl) updateFields["Board URL"] = normalizedBoardUrl;
		if (normalizedWorkspaceId) updateFields["Workspace ID"] = normalizedWorkspaceId;

		await atUpdateBoard(self.root.env, existing.id, updateFields, self.root);
	} else {
		await atCreateBoard(
			self.root.env,
			{
				projectIdText: safeProjectIdText,
				uid: String(uid),
				purpose: String(purpose),
				muralId: String(muralId),
				boardUrl: normalizedBoardUrl || undefined,
				workspaceId: normalizedWorkspaceId || undefined,
				primary: !!primary,
				active: true,
			},
			self.root,
		);
	}

	const cacheKey = `${safeProjectIdText}·${uid || ""}·${purpose}`;
	memoryCache.set(cacheKey, {
		muralId: String(muralId),
		boardUrl: normalizedBoardUrl,
		workspaceId: normalizedWorkspaceId,
		ts: Date.now(),
		primary: !!primary,
		deleted: false,
	});
	return { ok: true };
}
