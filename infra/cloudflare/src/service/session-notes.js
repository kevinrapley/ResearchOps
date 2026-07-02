/**
 * @file session-notes.js
 * @module session-notes
 * @summary Session Notes endpoints (list/create/update) for ResearchOps Worker.
 *
 * Endpoints:
 * - GET    /api/session-notes?session=<SessionId>
 * - POST   /api/session-notes
 * - PATCH  /api/session-notes/:id
 */

import {
	fetchWithTimeout,
	safeText
} from "../core/utils.js";
import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const SESSION_NOTES_TABLE = "rops_session_notes";

const SESSION_NOTES_SQL = `
	CREATE TABLE IF NOT EXISTS ${SESSION_NOTES_TABLE} (
		id TEXT PRIMARY KEY,
		session_id TEXT NOT NULL,
		participant_id TEXT,
		study_id TEXT,
		start_iso TEXT NOT NULL,
		end_iso TEXT,
		start_offset_ms INTEGER,
		end_offset_ms INTEGER,
		duration_ms INTEGER,
		framework TEXT,
		category TEXT,
		content_html TEXT NOT NULL,
		content_plain TEXT,
		author TEXT,
		temporal_coverage TEXT,
		consent_snapshot_json TEXT,
		synced_to_mural INTEGER NOT NULL DEFAULT 0,
		synced_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		source TEXT NOT NULL DEFAULT 'd1',
		payload_json TEXT
	)
`;

/* ─────────────────────────────────────────────────────────────────────────────
   Airtable field keys (allowing mild variability via aliases)
   If you ever rename in Airtable, you can add synonyms to each array.
   ───────────────────────────────────────────────────────────────────────────── */
const NOTE_FIELDS = {
	session_link: ["Session"],
	participant_link: ["Participant"],
	study_lookup: ["Study ID", "Study"],

	note_started_at: ["Note started at"],
	note_ended_at: ["Note ended at"],
	start_offset_ms: ["Start offset (ms)"],
	end_offset_ms: ["End offset (ms)"],
	duration_ms: ["Duration (ms)"],

	framework: ["Framework"],
	category: ["Category"],

	note_rich: ["Note (rich)"],
	note_plain: ["Note (plain)", "Note (text)"],

	author_free_text: ["Author (free text)"],

	created_by: ["Created By"],
	created_at: ["Created At", "Created time"],
	last_edited_at: ["Last Edited At", "Last modified time"],

	temporal_coverage: ["Temporal coverage"],
	safeguarding_lookup: ["Safeguarding flag (copy)"],
	synced_to_mural: ["Synced to Mural"],
	synced_at: ["Synced At"],
	consent_snapshot_json: ["Consent snapshot (JSON)"]
};

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
}

function airtableConfigured(svc) {
	return Boolean(svc?.env?.AIRTABLE_BASE_ID && svc?.env?.AIRTABLE_API_KEY);
}

function nowIso() {
	return new Date().toISOString();
}

function randomHex(length = 10) {
	const fallback = Math.random().toString(16).replace("0.", "").padEnd(length, "0");
	if (typeof crypto === "undefined" || !crypto.getRandomValues) return fallback.slice(0, length);
	const bytes = new Uint8Array(Math.ceil(length / 2));
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
}

function sessionNoteId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `sn_${crypto.randomUUID()}`;
	}
	return `sn_${Date.now().toString(36)}_${randomHex(8)}`;
}

async function ensureSessionNotesTable(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, SESSION_NOTES_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_session_notes_session ON ${SESSION_NOTES_TABLE} (session_id, active, start_iso)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_session_notes_study ON ${SESSION_NOTES_TABLE} (study_id, active, start_iso)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_session_notes_participant ON ${SESSION_NOTES_TABLE} (participant_id, active, start_iso)`);
}

/** Pick first available field from a record using a list of aliases. */
function pick(recFields, aliases) {
	for (const key of aliases) {
		if (Object.prototype.hasOwnProperty.call(recFields, key)) return recFields[key];
	}
	return undefined;
}

function linkVal(arr) {
	return Array.isArray(arr) && arr.length ? arr[0] : "";
}

/** Convert an Airtable record into our DTO */
function toDto(r) {
	const f = r.fields || {};

	return {
		id: r.id,
		session_id: linkVal(pick(f, NOTE_FIELDS.session_link)),
		participant_id: linkVal(pick(f, NOTE_FIELDS.participant_link)),
		study_id: linkVal(pick(f, NOTE_FIELDS.study_lookup)) || "",
		start_iso: pick(f, NOTE_FIELDS.note_started_at) || "",
		end_iso: pick(f, NOTE_FIELDS.note_ended_at) || "",
		start_offset_ms: pick(f, NOTE_FIELDS.start_offset_ms) ?? null,
		end_offset_ms: pick(f, NOTE_FIELDS.end_offset_ms) ?? null,
		duration_ms: pick(f, NOTE_FIELDS.duration_ms) ?? null,
		temporal_coverage: pick(f, NOTE_FIELDS.temporal_coverage) || "",
		framework: pick(f, NOTE_FIELDS.framework) || "none",
		category: pick(f, NOTE_FIELDS.category) || "",
		content_html: pick(f, NOTE_FIELDS.note_rich) || "",
		content_plain: pick(f, NOTE_FIELDS.note_plain) || "",
		author: pick(f, NOTE_FIELDS.author_free_text) || "",
		safeguarding_flag: Boolean(pick(f, NOTE_FIELDS.safeguarding_lookup)),
		synced_to_mural: Boolean(pick(f, NOTE_FIELDS.synced_to_mural)),
		synced_at: pick(f, NOTE_FIELDS.synced_at) || "",
		consent_snapshot_json: pick(f, NOTE_FIELDS.consent_snapshot_json) || "",
		createdAt: r.createdTime || pick(f, NOTE_FIELDS.created_at) || "",
		lastEditedAt: pick(f, NOTE_FIELDS.last_edited_at) || ""
	};
}

function rowToDto(row) {
	if (!row) return null;
	return {
		id: row.id,
		session_id: row.session_id || "",
		participant_id: row.participant_id || "",
		study_id: row.study_id || "",
		start_iso: row.start_iso || "",
		end_iso: row.end_iso || "",
		start_offset_ms: row.start_offset_ms ?? null,
		end_offset_ms: row.end_offset_ms ?? null,
		duration_ms: row.duration_ms ?? null,
		temporal_coverage: row.temporal_coverage || "",
		framework: row.framework || "none",
		category: row.category || "",
		content_html: row.content_html || "",
		content_plain: row.content_plain || "",
		author: row.author || "",
		safeguarding_flag: false,
		synced_to_mural: Boolean(row.synced_to_mural),
		synced_at: row.synced_at || "",
		consent_snapshot_json: row.consent_snapshot_json || "",
		createdAt: row.created_at || "",
		lastEditedAt: row.updated_at || ""
	};
}

function plainTextFromHtml(html) {
	return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function durationMs(p) {
	if (typeof p.duration_ms === "number") return p.duration_ms;
	if (typeof p.start_offset_ms === "number" && typeof p.end_offset_ms === "number") {
		return Math.max(0, p.end_offset_ms - p.start_offset_ms);
	}
	return null;
}

function notePayload(p, existing = {}) {
	const sessionId = String(p.sessionId || p.session_id || p.session_airtable_id || existing.session_id || "").trim();
	const participantId = String(p.participantId || p.participant_id || p.participant_airtable_id || existing.participant_id || "").trim();
	const studyId = String(p.studyId || p.study_id || p.study_airtable_id || existing.study_id || "").trim();
	const startIso = String(p.start_iso || p.startIso || existing.start_iso || "").trim();
	const endIso = String(p.end_iso || p.endIso || existing.end_iso || "").trim();
	const contentHtml = String(p.content_html || p.contentHtml || existing.content_html || "").trim();
	const contentPlain = String(p.content_plain || p.contentPlain || existing.content_plain || plainTextFromHtml(contentHtml)).trim();
	return {
		sessionId,
		participantId,
		studyId,
		startIso,
		endIso,
		startOffsetMs: typeof p.start_offset_ms === "number" ? p.start_offset_ms : (existing.start_offset_ms ?? null),
		endOffsetMs: typeof p.end_offset_ms === "number" ? p.end_offset_ms : (existing.end_offset_ms ?? null),
		durationMs: durationMs(p) ?? existing.duration_ms ?? null,
		framework: String(p.framework || existing.framework || "none").trim() || "none",
		category: String(p.category || existing.category || "").trim(),
		contentHtml,
		contentPlain,
		author: String(p.author || existing.author || "").trim(),
		temporalCoverage: String(p.temporal_coverage || existing.temporal_coverage || (startIso && endIso ? `${startIso}/${endIso}` : "")).trim(),
		consentSnapshotJson: String(p.consent_snapshot_json || existing.consent_snapshot_json || "").trim(),
		syncedToMural: typeof p.synced_to_mural === "boolean" ? (p.synced_to_mural ? 1 : 0) : (existing.synced_to_mural ? 1 : 0),
		syncedAt: String(p.synced_at || existing.synced_at || "").trim()
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

async function listD1SessionNotes(svc, sessionId) {
	await ensureSessionNotesTable(svc);
	const rows = await d1All(svc.env, `
		SELECT *
		FROM ${SESSION_NOTES_TABLE}
		WHERE session_id = ? AND active = 1
		ORDER BY datetime(start_iso) ASC, datetime(created_at) ASC
	`, [sessionId]);
	return rows.map(rowToDto).filter(Boolean);
}

async function createD1SessionNote(svc, p) {
	await ensureSessionNotesTable(svc);
	const fields = notePayload(p);
	const id = sessionNoteId();
	const createdAt = nowIso();
	await d1Run(svc.env, `
		INSERT INTO ${SESSION_NOTES_TABLE} (
			id, session_id, participant_id, study_id, start_iso, end_iso, start_offset_ms,
			end_offset_ms, duration_ms, framework, category, content_html, content_plain,
			author, temporal_coverage, consent_snapshot_json, synced_to_mural, synced_at,
			created_at, updated_at, active, source, payload_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'd1', ?)
	`, [
		id,
		fields.sessionId,
		fields.participantId || null,
		fields.studyId || null,
		fields.startIso,
		fields.endIso || null,
		fields.startOffsetMs,
		fields.endOffsetMs,
		fields.durationMs,
		fields.framework,
		fields.category || null,
		fields.contentHtml,
		fields.contentPlain || null,
		fields.author || null,
		fields.temporalCoverage || null,
		fields.consentSnapshotJson || null,
		fields.syncedToMural,
		fields.syncedAt || null,
		createdAt,
		createdAt,
		JSON.stringify({ ...p, id })
	]);
	const row = await d1Get(svc.env, `SELECT * FROM ${SESSION_NOTES_TABLE} WHERE id = ? LIMIT 1`, [id]);
	return rowToDto(row);
}

async function updateD1SessionNote(svc, noteId, p) {
	await ensureSessionNotesTable(svc);
	const existing = await d1Get(svc.env, `SELECT * FROM ${SESSION_NOTES_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [noteId]);
	if (!existing) return null;
	const fields = notePayload(p, existing);
	const updatedAt = nowIso();
	await d1Run(svc.env, `
		UPDATE ${SESSION_NOTES_TABLE}
		SET participant_id = ?, study_id = ?, start_iso = ?, end_iso = ?, start_offset_ms = ?,
			end_offset_ms = ?, duration_ms = ?, framework = ?, category = ?, content_html = ?,
			content_plain = ?, author = ?, temporal_coverage = ?, consent_snapshot_json = ?,
			synced_to_mural = ?, synced_at = ?, updated_at = ?, payload_json = ?
		WHERE id = ? AND active = 1
	`, [
		fields.participantId || null,
		fields.studyId || null,
		fields.startIso,
		fields.endIso || null,
		fields.startOffsetMs,
		fields.endOffsetMs,
		fields.durationMs,
		fields.framework,
		fields.category || null,
		fields.contentHtml,
		fields.contentPlain || null,
		fields.author || null,
		fields.temporalCoverage || null,
		fields.consentSnapshotJson || null,
		fields.syncedToMural,
		fields.syncedAt || null,
		updatedAt,
		JSON.stringify({ ...parseJson(existing.payload_json), ...p, id: noteId }),
		noteId
	]);
	const row = await d1Get(svc.env, `SELECT * FROM ${SESSION_NOTES_TABLE} WHERE id = ? LIMIT 1`, [noteId]);
	return rowToDto(row);
}

function parseJson(value) {
	if (!value) return {};
	if (typeof value === "object") return value;
	try {
		const parsed = JSON.parse(String(value));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/** Build the Airtable fields payload from API input */
function buildFieldsPayload(p) {
	const fields = {
		[NOTE_FIELDS.session_link[0]]: p.session_airtable_id ? [p.session_airtable_id] : undefined,
		[NOTE_FIELDS.participant_link[0]]: p.participant_airtable_id ? [p.participant_airtable_id] : undefined,

		[NOTE_FIELDS.note_started_at[0]]: p.start_iso,
		[NOTE_FIELDS.note_ended_at[0]]: p.end_iso,

		[NOTE_FIELDS.start_offset_ms[0]]: typeof p.start_offset_ms === "number" ? p.start_offset_ms : undefined,
		[NOTE_FIELDS.end_offset_ms[0]]: typeof p.end_offset_ms === "number" ? p.end_offset_ms : undefined,

		[NOTE_FIELDS.framework[0]]: p.framework,
		[NOTE_FIELDS.category[0]]: p.category,

		[NOTE_FIELDS.note_rich[0]]: p.content_html,
		[NOTE_FIELDS.author_free_text[0]]: p.author,

		[NOTE_FIELDS.synced_to_mural[0]]: typeof p.synced_to_mural === "boolean" ? p.synced_to_mural : undefined,
		[NOTE_FIELDS.synced_at[0]]: p.synced_at,
		[NOTE_FIELDS.consent_snapshot_json[0]]: p.consent_snapshot_json
	};
	for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }
	return fields;
}

async function listAirtableSessionNotes(svc, sessionId, origin) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");
	const atBase = `https://api.airtable.com/v0/${base}/${table}`;
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	const records = [];
	let offset;
	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);

		const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, svc.cfg.TIMEOUT_MS);
		const txt = await resp.text();
		if (!resp.ok) {
			svc.log.error("airtable.session_notes.list.fail", { status: resp.status, text: safeText(txt) });
			return { response: svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin)) };
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	const notes = records
		.filter(r => {
			const arr = pick(r.fields || {}, NOTE_FIELDS.session_link);
			return Array.isArray(arr) && arr.includes(sessionId);
		})
		.map(toDto)
		.sort((a, b) => (new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime()) || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));

	return { notes };
}

async function createAirtableSessionNote(svc, p, origin) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");
	const url = `https://api.airtable.com/v0/${base}/${table}`;
	const fields = buildFieldsPayload(p);

	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ fields }] })
	}, svc.cfg.TIMEOUT_MS);

	const txt = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.session_note.create.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	let js;
	try { js = JSON.parse(txt); } catch { js = { records: [] }; }
	const created = js.records?.[0];
	return svc.json({ ok: true, id: created?.id || null, note: created ? toDto(created) : null, fallback: "airtable" }, 200, svc.corsHeaders(origin));
}

async function updateAirtableSessionNote(svc, p, origin, noteId) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;
	const fields = buildFieldsPayload(p);

	const res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: noteId, fields }] })
	}, svc.cfg.TIMEROUT_MS || svc.cfg.TIMEOUT_MS);

	const txt = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.session_note.update.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}
	return svc.json({ ok: true, fallback: "airtable" }, 200, svc.corsHeaders(origin));
}

function unavailableResponse(svc, origin, detail) {
	return svc.json(
		{
			ok: false,
			error: "session_notes_store_unavailable",
			message: "Session notes are not available right now.",
			detail
		},
		503,
		svc.corsHeaders(origin)
	);
}

/**
 * List notes for a session.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listSessionNotes(svc, origin, url) {
	const sessionId = url.searchParams.get("session");
	if (!sessionId) {
		return svc.json({ ok: false, error: "Missing session query" }, 400, svc.corsHeaders(origin));
	}

	if (hasD1(svc)) {
		try {
			const notes = await listD1SessionNotes(svc, sessionId);
			return svc.json({ ok: true, notes }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.session_notes.list.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) {
		try {
			const result = await listAirtableSessionNotes(svc, sessionId, origin);
			if (result.response) return result.response;
			return svc.json({ ok: true, notes: result.notes, fallback: "airtable" }, 200, svc.corsHeaders(origin));
		} catch (err) {
			return svc.json({ ok: false, error: "Network error", detail: String(err?.message || err) }, 502, svc.corsHeaders(origin));
		}
	}

	return unavailableResponse(svc, origin);
}

/**
 * Create a session note.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createSessionNote(svc, request, origin) {
	let p;
	try {
		p = await readJsonBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	const fields = notePayload(p);
	const missing = [];
	if (!fields.sessionId) missing.push("session_airtable_id");
	if (!fields.startIso) missing.push("start_iso");
	if (!fields.contentHtml) missing.push("content_html");
	if (missing.length) {
		return svc.json({ ok: false, error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));
	}

	if (hasD1(svc)) {
		try {
			const note = await createD1SessionNote(svc, p);
			return svc.json({ ok: true, id: note?.id || null, note }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.session_note.create.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) return createAirtableSessionNote(svc, p, origin);
	return unavailableResponse(svc, origin);
}

/**
 * Update a session note.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} noteId
 * @returns {Promise<Response>}
 */
export async function updateSessionNote(svc, request, origin, noteId) {
	if (!noteId) return svc.json({ ok: false, error: "Missing note id" }, 400, svc.corsHeaders(origin));

	let p;
	try {
		p = await readJsonBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	if (Object.keys(buildFieldsPayload(p)).length === 0 && !p.contentHtml && !p.sessionId && !p.session_id) {
		return svc.json({ ok: false, error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	if (hasD1(svc)) {
		try {
			const note = await updateD1SessionNote(svc, noteId, p);
			if (note) return svc.json({ ok: true, note }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.session_note.update.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) return updateAirtableSessionNote(svc, p, origin, noteId);
	return svc.json({ ok: false, error: "session_note_not_found" }, 404, svc.corsHeaders(origin));
}
