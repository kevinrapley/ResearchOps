/**
 * @file card-sorts.js
 * @module card-sorts
 * @summary Card sort configuration and result endpoints for ResearchOps Worker.
 *
 * A study whose method is "Card Sort" is prepared ahead of fieldwork with a
 * card sort configuration (sort type, cards, predefined groups) and each
 * session captures a card sort result (the participant's groupings).
 *
 * Endpoints:
 * - GET    /api/card-sorts/config?study=<StudyId>
 * - POST   /api/card-sorts/config (upsert per study)
 * - GET    /api/card-sorts/results?study=<StudyId>[&session=<SessionId>]
 * - POST   /api/card-sorts/results
 * - PATCH  /api/card-sorts/results/:id
 */

import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const CONFIG_TABLE = "rops_card_sort_configs";
const RESULTS_TABLE = "rops_card_sort_results";

const CONFIG_SQL = `
	CREATE TABLE IF NOT EXISTS ${CONFIG_TABLE} (
		study_id TEXT PRIMARY KEY,
		sort_type TEXT NOT NULL DEFAULT 'open',
		allow_new_cards INTEGER NOT NULL DEFAULT 0,
		shuffle_cards INTEGER NOT NULL DEFAULT 1,
		instructions TEXT,
		cards_json TEXT NOT NULL DEFAULT '[]',
		groups_json TEXT NOT NULL DEFAULT '[]',
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)
`;

const RESULTS_SQL = `
	CREATE TABLE IF NOT EXISTS ${RESULTS_TABLE} (
		id TEXT PRIMARY KEY,
		study_id TEXT NOT NULL,
		session_id TEXT NOT NULL,
		participant_id TEXT,
		status TEXT NOT NULL DEFAULT 'in_progress',
		result_json TEXT NOT NULL DEFAULT '{}',
		started_at TEXT,
		completed_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1
	)
`;

const SORT_TYPES = new Set(["open", "closed", "hybrid"]);

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
}

function nowIso() {
	return new Date().toISOString();
}

function resultId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `cs_${crypto.randomUUID()}`;
	}
	return `cs_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

async function ensureTables(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, CONFIG_SQL);
	await d1Run(svc.env, RESULTS_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_card_sort_results_study ON ${RESULTS_TABLE} (study_id, active, created_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_card_sort_results_session ON ${RESULTS_TABLE} (session_id, active, created_at)`);
}

function parseJsonArray(value) {
	try {
		const parsed = JSON.parse(String(value || "[]"));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function parseJsonObject(value) {
	try {
		const parsed = JSON.parse(String(value || "{}"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * Normalise a card or group list from client input: keep id/label/description,
 * drop entries without a label, coerce everything to trimmed strings.
 */
function normaliseItems(list, prefix) {
	if (!Array.isArray(list)) return [];
	const out = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const label = String(item.label || "").trim();
		if (!label) continue;
		out.push({
			id: String(item.id || "").trim() || `${prefix}_${out.length + 1}_${Math.random().toString(36).slice(2, 8)}`,
			label,
			description: String(item.description || "").trim()
		});
	}
	return out;
}

function configRowToDto(row) {
	if (!row) return null;
	return {
		study_id: row.study_id,
		sort_type: SORT_TYPES.has(row.sort_type) ? row.sort_type : "open",
		allow_new_cards: Boolean(row.allow_new_cards),
		shuffle_cards: Boolean(row.shuffle_cards),
		instructions: row.instructions || "",
		cards: parseJsonArray(row.cards_json),
		groups: parseJsonArray(row.groups_json),
		createdAt: row.created_at || "",
		updatedAt: row.updated_at || ""
	};
}

function resultRowToDto(row) {
	if (!row) return null;
	return {
		id: row.id,
		study_id: row.study_id,
		session_id: row.session_id,
		participant_id: row.participant_id || "",
		status: row.status || "in_progress",
		result: parseJsonObject(row.result_json),
		started_at: row.started_at || "",
		completed_at: row.completed_at || "",
		createdAt: row.created_at || "",
		lastEditedAt: row.updated_at || ""
	};
}

async function readJsonBody(svc, request) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		throw Object.assign(new Error("Payload too large"), { status: 413 });
	}
	try {
		return JSON.parse(new TextDecoder().decode(body || new ArrayBuffer(0)) || "{}");
	} catch {
		throw Object.assign(new Error("Invalid JSON"), { status: 400 });
	}
}

function unavailableResponse(svc, origin, detail) {
	return svc.json(
		{
			ok: false,
			error: "card_sort_store_unavailable",
			message: "Card sorts are not available right now.",
			detail
		},
		503,
		svc.corsHeaders(origin)
	);
}

/**
 * Get the card sort configuration for a study.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function getCardSortConfig(svc, origin, url) {
	const studyId = String(url.searchParams.get("study") || "").trim();
	if (!studyId) {
		return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));
	}
	if (!hasD1(svc)) return unavailableResponse(svc, origin);
	try {
		await ensureTables(svc);
		const row = await d1Get(svc.env, `SELECT * FROM ${CONFIG_TABLE} WHERE study_id = ? LIMIT 1`, [studyId]);
		return svc.json({ ok: true, config: configRowToDto(row) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("d1.card_sort_config.get.fail", { detail: err.message });
		return unavailableResponse(svc, origin, String(err?.message || err));
	}
}

/**
 * Create or replace the card sort configuration for a study.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function saveCardSortConfig(svc, request, origin) {
	let p;
	try {
		p = await readJsonBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	const studyId = String(p.study_id || p.studyId || "").trim();
	if (!studyId) {
		return svc.json({ ok: false, error: "Missing fields: study_id" }, 400, svc.corsHeaders(origin));
	}
	const sortType = SORT_TYPES.has(String(p.sort_type || "").trim()) ? String(p.sort_type).trim() : "open";
	const cards = normaliseItems(p.cards, "card");
	const groups = sortType === "open" ? [] : normaliseItems(p.groups, "group");
	if (sortType !== "open" && !groups.length) {
		return svc.json({ ok: false, error: "Closed and hybrid card sorts need at least one predefined group" }, 400, svc.corsHeaders(origin));
	}

	if (!hasD1(svc)) return unavailableResponse(svc, origin);
	try {
		await ensureTables(svc);
		const now = nowIso();
		await d1Run(svc.env, `
			INSERT INTO ${CONFIG_TABLE} (study_id, sort_type, allow_new_cards, shuffle_cards, instructions, cards_json, groups_json, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(study_id) DO UPDATE SET
				sort_type = excluded.sort_type,
				allow_new_cards = excluded.allow_new_cards,
				shuffle_cards = excluded.shuffle_cards,
				instructions = excluded.instructions,
				cards_json = excluded.cards_json,
				groups_json = excluded.groups_json,
				updated_at = excluded.updated_at
		`, [
			studyId,
			sortType,
			p.allow_new_cards ? 1 : 0,
			p.shuffle_cards === false ? 0 : 1,
			String(p.instructions || "").trim() || null,
			JSON.stringify(cards),
			JSON.stringify(groups),
			now,
			now
		]);
		const row = await d1Get(svc.env, `SELECT * FROM ${CONFIG_TABLE} WHERE study_id = ? LIMIT 1`, [studyId]);
		return svc.json({ ok: true, config: configRowToDto(row) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("d1.card_sort_config.save.fail", { detail: err.message });
		return unavailableResponse(svc, origin, String(err?.message || err));
	}
}

/**
 * List card sort results for a study or session.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listCardSortResults(svc, origin, url) {
	const studyId = String(url.searchParams.get("study") || "").trim();
	const sessionId = String(url.searchParams.get("session") || "").trim();
	if (!studyId && !sessionId) {
		return svc.json({ ok: false, error: "Missing study or session query" }, 400, svc.corsHeaders(origin));
	}
	if (!hasD1(svc)) return unavailableResponse(svc, origin);
	try {
		await ensureTables(svc);
		const where = [];
		const params = [];
		if (studyId) { where.push("study_id = ?"); params.push(studyId); }
		if (sessionId) { where.push("session_id = ?"); params.push(sessionId); }
		const rows = await d1All(svc.env, `
			SELECT * FROM ${RESULTS_TABLE}
			WHERE ${where.join(" AND ")} AND active = 1
			ORDER BY datetime(created_at) ASC
		`, params);
		return svc.json({ ok: true, results: rows.map(resultRowToDto).filter(Boolean) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("d1.card_sort_results.list.fail", { detail: err.message });
		return unavailableResponse(svc, origin, String(err?.message || err));
	}
}

/**
 * Create a card sort result.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createCardSortResult(svc, request, origin) {
	let p;
	try {
		p = await readJsonBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	const studyId = String(p.study_id || p.studyId || "").trim();
	const sessionId = String(p.session_id || p.sessionId || "").trim();
	const missing = [];
	if (!studyId) missing.push("study_id");
	if (!sessionId) missing.push("session_id");
	if (missing.length) {
		return svc.json({ ok: false, error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));
	}

	if (!hasD1(svc)) return unavailableResponse(svc, origin);
	try {
		await ensureTables(svc);
		const id = resultId();
		const now = nowIso();
		await d1Run(svc.env, `
			INSERT INTO ${RESULTS_TABLE} (id, study_id, session_id, participant_id, status, result_json, started_at, completed_at, created_at, updated_at, active)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
		`, [
			id,
			studyId,
			sessionId,
			String(p.participant_id || p.participantId || "").trim() || null,
			p.status === "completed" ? "completed" : "in_progress",
			JSON.stringify(p.result && typeof p.result === "object" ? p.result : {}),
			String(p.started_at || "").trim() || now,
			p.status === "completed" ? (String(p.completed_at || "").trim() || now) : null,
			now,
			now
		]);
		const row = await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ? LIMIT 1`, [id]);
		return svc.json({ ok: true, id, result: resultRowToDto(row) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("d1.card_sort_result.create.fail", { detail: err.message });
		return unavailableResponse(svc, origin, String(err?.message || err));
	}
}

/**
 * Update a card sort result (placements, status).
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} id
 * @returns {Promise<Response>}
 */
export async function updateCardSortResult(svc, request, origin, id) {
	if (!id) return svc.json({ ok: false, error: "Missing result id" }, 400, svc.corsHeaders(origin));

	let p;
	try {
		p = await readJsonBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	if (!hasD1(svc)) return unavailableResponse(svc, origin);
	try {
		await ensureTables(svc);
		const existing = await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [id]);
		if (!existing) return svc.json({ ok: false, error: "card_sort_result_not_found" }, 404, svc.corsHeaders(origin));

		const now = nowIso();
		const status = p.status === "completed" ? "completed" : (p.status === "in_progress" ? "in_progress" : existing.status);
		const resultJson = p.result && typeof p.result === "object" ? JSON.stringify(p.result) : existing.result_json;
		const completedAt = status === "completed"
			? (String(p.completed_at || "").trim() || existing.completed_at || now)
			: null;

		await d1Run(svc.env, `
			UPDATE ${RESULTS_TABLE}
			SET participant_id = ?, status = ?, result_json = ?, completed_at = ?, updated_at = ?
			WHERE id = ? AND active = 1
		`, [
			String(p.participant_id || p.participantId || "").trim() || existing.participant_id,
			status,
			resultJson,
			completedAt,
			now,
			id
		]);
		const row = await d1Get(svc.env, `SELECT * FROM ${RESULTS_TABLE} WHERE id = ? LIMIT 1`, [id]);
		return svc.json({ ok: true, result: resultRowToDto(row) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("d1.card_sort_result.update.fail", { detail: err.message });
		return unavailableResponse(svc, origin, String(err?.message || err));
	}
}
