/**
 * @file infra/cloudflare/src/service/sessions.js
 * @module service/sessions
 * @summary Sessions endpoints (list/create/update + ICS + read-one) for ResearchOps Worker (Airtable).
 *
 * Endpoints covered:
 * - GET    /api/sessions?study=<AirtableStudyId>[&participant=<AirtableId>][&status=<scheduled|rescheduled|cancelled|completed>]
 * - GET    /api/sessions/:id
 * - POST   /api/sessions
 * - PATCH  /api/sessions/:id
 * - GET    /api/sessions/:id/ics
 */

import {
	fetchWithTimeout,
	safeText,
	toMs,
	pickFirstField
} from "../core/utils.js";

import {
	SESSION_FIELDS,
	PARTICIPANT_FIELDS
} from "../core/fields.js";

/* ==========================================================================
   LIST (by study, optional participant/status filters)
   ========================================================================== */

/**
 * List sessions for a study (optionally filter by participant + status).
 * @param {import("../service/index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listSessions(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) {
		return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));
	}
	const filterParticipant = url.searchParams.get("participant") || "";
	const filterStatus = (url.searchParams.get("status") || "").toLowerCase();

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRABLE_TABLE_SESSIONS || svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
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
			svc.log.error("airtable.sessions.list.fail", { status: resp.status, text: safeText(txt) });
			return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin));
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	const sessions = records
		.filter(r => {
			const f = r.fields || {};
			// Study link must include the given studyId
			const studyKey = pickFirstField(f, SESSION_FIELDS.study_link);
			const studyLinks = studyKey ? f[studyKey] : undefined;
			if (!(Array.isArray(studyLinks) && studyLinks.includes(studyId))) return false;

			// Optional participant filter
			if (filterParticipant) {
				const pKey = pickFirstField(f, SESSION_FIELDS.participant_link);
				const pLinks = pKey ? f[pKey] : [];
				if (!(Array.isArray(pLinks) && pLinks.includes(filterParticipant))) return false;
			}

			// Optional status filter (normalise to lower-case to match DTO)
			if (filterStatus) {
				const statusKey = pickFirstField(f, SESSION_FIELDS.status);
				const raw = (statusKey ? f[statusKey] : "").toString().toLowerCase();
				if (raw !== filterStatus) return false;
			}
			return true;
		})
		.map(mapRecordToDto)
		.sort((a, b) => toMs(a.starts_at) - toMs(b.starts_at));

	return svc.json({ ok: true, sessions }, 200, svc.corsHeaders(origin));
}

/* ==========================================================================
   READ ONE (by Airtable record id)
   ========================================================================== */

/**
 * Read a single session by Airtable record id.
 * @param {import("../service/index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} sessionId
 * @returns {Promise<Response>}
 */
export async function getSession(svc, origin, sessionId) {
	if (!sessionId) return svc.json({ ok: false, error: "Missing session id" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
	const atUrl = `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(sessionId)}`;
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	const resp = await fetchWithTimeout(atUrl, { headers }, svc.cfg.TIMEOUT_MS);
	const txt = await resp.text();
	if (!resp.ok) {
		svc.log.error("airtable.session.get.fail", { sessionId, status: resp.status, text: safeText(txt) });
		return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin));
	}

	let rec;
	try { rec = JSON.parse(txt); } catch { rec = null; }
	if (!rec || !rec.id) return svc.json({ ok: false, error: "Not found" }, 404, svc.corsHeaders(origin));

	return svc.json({ ok: true, session: mapRecordToDto(rec) }, 200, svc.corsHeaders(origin));
}

/* ==========================================================================
   CREATE
   ========================================================================== */

/**
 * Create a session (schedule participant).
 * @param {import("../service/index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createSession(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}
	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	const missing = [];
	if (!p.study_airtable_id) missing.push("study_airtable_id");
	if (!p.participant_airtable_id) missing.push("participant_airtable_id");
	if (!p.starts_at) missing.push("starts_at");
	if (!p.duration_min) missing.push("duration_min");
	if (!p.type) missing.push("type");
	if (!p.location_or_link) missing.push("location_or_link");
	if (missing.length) return svc.json({ error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
	const url = `https://api.airtable.com/v0/${base}/${table}`;

	const fields = {
		[SESSION_FIELDS.study_link[0]]: [p.study_airtable_id],
		[SESSION_FIELDS.participant_link[0]]: [p.participant_airtable_id],
		// Canonical: "Starts at"
		[SESSION_FIELDS.starts_at?.[0] || "Starts at"]: p.starts_at,
		[SESSION_FIELDS.duration_min[0]]: p.duration_min,
		[SESSION_FIELDS.type[0]]: p.type,
		[SESSION_FIELDS.location_or_link[0]]: p.location_or_link,
		[SESSION_FIELDS.backup_contact[0]]: p.backup_contact || undefined,
		[SESSION_FIELDS.researchers[0]]: p.researchers || undefined,
		[SESSION_FIELDS.status[0]]: p.status || "scheduled",
		[SESSION_FIELDS.incentive_type[0]]: p.incentive_type || undefined,
		[SESSION_FIELDS.incentive_amount[0]]: p.incentive_amount || undefined,
		[SESSION_FIELDS.incentive_status[0]]: p.incentive_status || undefined,
		[SESSION_FIELDS.safeguarding_flag[0]]: p.safeguarding_flag ? true : undefined,
		[SESSION_FIELDS.notes[0]]: p.notes || undefined
		// Do NOT attempt to set "Duration Actual min" (formula) on create.
	};
	for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

	const res = await fetchWithTimeout(url, {
		method: "POST",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ fields }] })
	}, svc.cfg.TIMEOUT_MS);

	const txt = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.session.create.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}
	let js;
	try { js = JSON.parse(txt); } catch { js = { records: [] }; }
	const sessionId = js.records?.[0]?.id;

	// Optional audit
	try {
		if (svc.env.AUDIT === "true") svc.log.info("session.created", { sessionId, participant: p.participant_airtable_id });
	} catch (e) {
		svc.log.warn("session.audit.fail", { err: String(e?.message || e) });
	}

	return svc.json({ ok: true, id: sessionId }, 200, svc.corsHeaders(origin));
}

/* ==========================================================================
   UPDATE (PATCH)
   ========================================================================== */

/**
 * Update a session (reschedule/cancel/notes/end).
 * IMPORTANT: We never write to "Duration Actual min" (formula) — read-only.
 *
 * @param {import("../service/index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {string} sessionId
 * @returns {Promise<Response>}
 */
export async function updateSession(svc, request, origin, sessionId) {
	if (!sessionId) return svc.json({ error: "Missing session id" }, 400, svc.corsHeaders(origin));

	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));

	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	// Build partial update map; undefineds are stripped below.
	// Canonical field names used explicitly for time fields: "Starts at", "Ended at".
	const fields = {
		[SESSION_FIELDS.starts_at?.[0] || "Starts at"]: p.starts_at,
		[SESSION_FIELDS.duration_min[0]]: p.duration_min,
		[SESSION_FIELDS.type[0]]: p.type,
		[SESSION_FIELDS.location_or_link[0]]: p.location_or_link,
		[SESSION_FIELDS.backup_contact[0]]: p.backup_contact,
		[SESSION_FIELDS.researchers[0]]: p.researchers,
		[SESSION_FIELDS.status[0]]: p.status,
		[SESSION_FIELDS.incentive_type[0]]: p.incentive_type,
		[SESSION_FIELDS.incentive_amount[0]]: p.incentive_amount,
		[SESSION_FIELDS.incentive_status[0]]: p.incentive_status,
		[SESSION_FIELDS.safeguarding_flag[0]]: typeof p.safeguarding_flag === "boolean" ? p.safeguarding_flag : undefined,
		[SESSION_FIELDS.notes[0]]: p.notes,

		// Canonical end field:
		[SESSION_FIELDS.ended_at?.[0] || "Ended at"]: p.ended_at

		// DO NOT include "Duration Actual min" — it's a formula field.
	};
	for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

	if (Object.keys(fields).length === 0) {
		return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

	const res = await fetchWithTimeout(atUrl, {
		method: "PATCH",
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: sessionId, fields }] })
	}, svc.cfg.TIMEOUT_MS);

	const txt = await res.text();
	if (!res.ok) {
		svc.log.error("airtable.session.update.fail", { status: res.status, text: safeText(txt) });
		return svc.json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, svc.corsHeaders(origin));
	}

	return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
}

/* ==========================================================================
   ICS (calendar export)
   ========================================================================== */

/**
 * Generate a minimal ICS for a session.
 * Prefers explicit "Ended at"; otherwise uses "Starts at" + "Duration min".
 *
 * @param {import("../service/index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {string} sessionId
 * @returns {Promise<Response>}
 */
export async function sessionIcs(svc, origin, sessionId) {
	if (!sessionId) return new Response("Missing id", { status: 400, headers: svc.corsHeaders(origin) });

	const base = svc.env.AIRTABLE_BASE_ID;
	const sTable = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
	const pTable = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
	const headers = { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` };

	// Read session
	const sRes = await fetchWithTimeout(`https://api.airtable.com/v0/${base}/${sTable}/${encodeURIComponent(sessionId)}`, { headers }, svc.cfg.TIMEOUT_MS);
	if (!sRes.ok) return svc.json({ error: `Airtable ${sRes.status}` }, sRes.status, svc.corsHeaders(origin));
	const sRec = await sRes.json();
	const sf = sRec.fields || {};
	const v = (keys, fallbacks = []) => {
		const k = pickFirstField(sf, keys) || pickFirstField(sf, fallbacks);
		return k ? sf[k] : undefined;
	};

	// Canonical time fields (with graceful fallbacks)
	const startsAt = v(SESSION_FIELDS.starts_at, ["Starts at"]) || "";
	const endedAt = v(SESSION_FIELDS.ended_at, ["Ended at"]) || "";
	const durationPlanned = Number(v(SESSION_FIELDS.duration_min) || 60);

	const dtStart = startsAt ? new Date(startsAt) : new Date();
	const dtEnd = endedAt ? new Date(endedAt) : new Date(dtStart.getTime() + durationPlanned * 60000);

	const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

	// Participant display name (optional)
	let displayName = "participant";
	const pIds = Array.isArray(v(SESSION_FIELDS.participant_link)) ? v(SESSION_FIELDS.participant_link) : [];
	if (pIds[0]) {
		const pRes = await fetchWithTimeout(`https://api.airtable.com/v0/${base}/${pTable}/${encodeURIComponent(pIds[0])}`, { headers }, svc.cfg.TIMEOUT_MS);
		if (pRes.ok) {
			const pRec = await pRes.json();
			const pf = pRec.fields || {};
			const pk = pickFirstField(pf, PARTICIPANT_FIELDS.display_name);
			if (pk) displayName = pf[pk] || displayName;
		}
	}

	const location = v(SESSION_FIELDS.location_or_link) || "";
	const summary = `Research session with ${displayName}`;
	const desc = `Join/arrive: ${location}`;

	function foldIcs(s) {
		return s.replace(/(.{1,73})(?=.)/g, "$1\r\n ");
	}

	const ics = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//HOB ResearchOps//Scheduler//EN",
		"BEGIN:VEVENT",
		`UID:${sessionId}@researchops`,
		`DTSTAMP:${fmt(new Date())}`,
		`DTSTART:${fmt(dtStart)}`,
		`DTEND:${fmt(dtEnd)}`,
		`SUMMARY:${summary}`,
		`DESCRIPTION:${desc}`,
		`LOCATION:${location}`,
		"END:VEVENT",
		"END:VCALENDAR"
	].map(foldIcs).join("\r\n") + "\r\n";

	return new Response(ics, {
		status: 200,
		headers: {
			"Content-Type": "text/calendar; charset=utf-8",
			"Content-Disposition": `attachment; filename="session-${sessionId}.ics"`,
			...svc.corsHeaders(origin)
		}
	});
}

/* ==========================================================================
   Helpers
   ========================================================================== */

/**
 * Map an Airtable record to your public DTO (snake_case keys).
 * Includes new: ended_at (canonical), duration_actual_min (formula, read-only).
 * @param {{id:string, fields:Record<string,any>, createdTime?:string}} r
 */
function mapRecordToDto(r) {
	const f = r.fields || {};
	const pick = (keys, fallbacks = []) => {
		const k = pickFirstField(f, keys) || pickFirstField(f, fallbacks);
		return k ? f[k] : undefined;
	};

	return {
		id: r.id,
		participant_id: Array.isArray(pick(SESSION_FIELDS.participant_link)) ? pick(SESSION_FIELDS.participant_link)[0] : "",
		starts_at: pick(SESSION_FIELDS.starts_at, ["Starts at"]) || "",
		ended_at: pick(SESSION_FIELDS.ended_at, ["Ended at"]) || "",
		duration_min: pick(SESSION_FIELDS.duration_min) || 60,
		duration_actual_min: numberOrNull(
			pick(SESSION_FIELDS.duration_actual_min, ["Duration Actual min", "Duration Actual (min)", "Duration Actual"])
		),
		type: pick(SESSION_FIELDS.type) || "remote",
		location_or_link: pick(SESSION_FIELDS.location_or_link) || "",
		backup_contact: pick(SESSION_FIELDS.backup_contact) || "",
		researchers: pick(SESSION_FIELDS.researchers) || "",
		status: (pick(SESSION_FIELDS.status) || "scheduled").toString().toLowerCase(),
		incentive_type: pick(SESSION_FIELDS.incentive_type) || "",
		incentive_amount: numberOrNull(pick(SESSION_FIELDS.incentive_amount)),
		incentive_status: pick(SESSION_FIELDS.incentive_status) || "",
		safeguarding_flag: Boolean(pick(SESSION_FIELDS.safeguarding_flag)),
		notes: pick(SESSION_FIELDS.notes) || "",
		createdAt: r.createdTime || ""
	};
}

function numberOrNull(v) {
	if (v == null || v === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}
