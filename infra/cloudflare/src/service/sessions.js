/**
 * @file sessions.js
 * @module sessions
 * @summary Sessions endpoints (list/create/update + ICS) for ResearchOps Worker (Airtable).
 *
 * Endpoints covered:
 * - GET    /api/sessions?study=<StudyAirtableId>
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

/**
 * List sessions for a study.
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listSessions(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_SESSIONS || "Sessions");
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
			const linkKey = pickFirstField(f, SESSION_FIELDS.study_link);
			const linkArr = linkKey ? f[linkKey] : undefined;
			return Array.isArray(linkArr) && linkArr.includes(studyId);
		})
		.map(r => {
			const f = r.fields || {};
			const pick = (keys) => { const k = pickFirstField(f, keys); return k ? f[k] : undefined; };
			return {
				id: r.id,
				participant_id: Array.isArray(pick(SESSION_FIELDS.participant_link)) ? pick(SESSION_FIELDS.participant_link)[0] : "",
				starts_at: pick(SESSION_FIELDS.starts_at) || "",
				duration_min: pick(SESSION_FIELDS.duration_min) || 60,
				type: pick(SESSION_FIELDS.type) || "remote",
				location_or_link: pick(SESSION_FIELDS.location_or_link) || "",
				backup_contact: pick(SESSION_FIELDS.backup_contact) || "",
				researchers: pick(SESSION_FIELDS.researchers) || "",
				status: pick(SESSION_FIELDS.status) || "scheduled",
				incentive_type: pick(SESSION_FIELDS.incentive_type) || "",
				incentive_amount: pick(SESSION_FIELDS.incentive_amount) || 0,
				incentive_status: pick(SESSION_FIELDS.incentive_status) || "",
				safeguarding_flag: Boolean(pick(SESSION_FIELDS.safeguarding_flag)),
				notes: pick(SESSION_FIELDS.notes) || "",
				createdAt: r.createdTime || ""
			};
		})
		.sort((a, b) => toMs(a.starts_at) - toMs(b.starts_at));

	return svc.json({ ok: true, sessions }, 200, svc.corsHeaders(origin));
}

/**
 * Create a session (schedule participant).
 * @param {import("./index.js").ResearchOpsService} svc
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
		[SESSION_FIELDS.starts_at[0]]: p.starts_at,
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
		[SESSION_FIELDS.notes[0]]: p.notes || undefined,
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

	// Fire-and-forget: if you later integrate a notification provider, hook it here.
	try {
		if (svc.env.AUDIT === "true") svc.log.info("session.created", { sessionId, participant: p.participant_airtable_id });
	} catch (e) {
		svc.log.warn("comms.confirmation.fail", { err: String(e?.message || e) });
	}

	return svc.json({ ok: true, id: sessionId }, 200, svc.corsHeaders(origin));
}

/**
 * Update a session (reschedule/cancel/notes, etc.).
 * @param {import("./index.js").ResearchOpsService} svc
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
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const fields = {
		[SESSION_FIELDS.starts_at[0]]: p.starts_at,
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
	};
	for (const k of Object.keys(fields)) { if (fields[k] === undefined) delete fields[k]; }

	if (Object.keys(fields).length === 0) return svc.json({ error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));

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

/**
 * Generate a minimal ICS for a session.
 * @param {import("./index.js").ResearchOpsService} svc
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
	const v = (keys) => { const k = pickFirstField(sf, keys); return k ? sf[k] : undefined; };

	const startsAt = v(SESSION_FIELDS.starts_at);
	const duration = Number(v(SESSION_FIELDS.duration_min) || 60);
	const dtStart = new Date(startsAt);
	const dtEnd = new Date(dtStart.getTime() + duration * 60000);
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