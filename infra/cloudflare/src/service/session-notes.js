/**
 * @file session-notes.js
 * @module session-notes
 * @summary Session Notes endpoints (list/create/update) for ResearchOps Worker (Airtable).
 *
 * Endpoints:
 * - GET    /api/session-notes?session=<AirtableSessionId>
 * - POST   /api/session-notes
 * - PATCH  /api/session-notes/:id
 */

import {
	fetchWithTimeout,
	safeText
} from "../core/utils.js";

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

/** Pick first available field from a record using a list of aliases. */
function pick(recFields, aliases) {
	for (const key of aliases) {
		if (Object.prototype.hasOwnProperty.call(recFields, key)) return recFields[key];
	}
	return undefined;
}

/** Convert an Airtable record into our DTO */
function toDto(r) {
	const f = r.fields || {};
	const linkVal = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : "");

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
	// prune undefined
	for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }
	return fields;
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

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");
	const atBase = `https://api.airtable.com/v0/${base}/${table}`;
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	const records = [];
	let offset;
	try {
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);

			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, svc.cfg.TIMEOUT_MS);
			const txt = await resp.text();
			if (!resp.ok) {
				svc.log.error("airtable.session_notes.list.fail", { status: resp.status, text: safeText(txt) });
				return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin));
			}
			let js;
			try { js = JSON.parse(txt); } catch { js = { records: [] }; }
			records.push(...(js.records || []));
			offset = js.offset;
		} while (offset);
	} catch (err) {
		return svc.json({ ok: false, error: "Network error", detail: String(err?.message || err) }, 502, svc.corsHeaders(origin));
	}

	const notes = records
		.filter(r => {
			const arr = pick(r.fields || {}, NOTE_FIELDS.session_link);
			return Array.isArray(arr) && arr.includes(sessionId);
		})
		.map(toDto)
		// sort by start time ascending, then created time
		.sort((a, b) => (new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime()) || (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));

	return svc.json({ ok: true, notes }, 200, svc.corsHeaders(origin));
}

/**
 * Create a session note.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createSessionNote(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		return svc.json({ ok: false, error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}
	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ ok: false, error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const missing = [];
	if (!p.session_airtable_id) missing.push("session_airtable_id");
	// end_iso may be equal to start_iso if user saves quickly; allow either/both present
	if (!p.start_iso) missing.push("start_iso");
	if (!p.content_html) missing.push("content_html");
	if (missing.length) {
		return svc.json({ ok: false, error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));
	}

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

	return svc.json({ ok: true, id: created?.id || null, note: created ? toDto(created) : null }, 200, svc.corsHeaders(origin));
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

	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) return svc.json({ ok: false, error: "Payload too large" }, 413, svc.corsHeaders(origin));

	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ ok: false, error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const fields = buildFieldsPayload(p);
	if (Object.keys(fields).length === 0) {
		return svc.json({ ok: false, error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSION_NOTES || "Session Notes");
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

	const res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: noteId, fields }] })
	}, svc.cfg.TIMEROUT_MS || svc.cfg.TIMEOUT_MS); // tolerate legacy typo

	const txt = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.session_note.update.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ ok: false, error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}
	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}