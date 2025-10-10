/**
 * @file participants.js
 * @module participants
 * @summary Participants endpoints for ResearchOps Worker (Airtable).
 *
 * @description
 * Implements resilient listing and CRUD for Participants with flexible field-name
 * detection to tolerate Airtable schema variations. Creation handles select-field
 * validation (e.g., INVALID_MULTIPLE_CHOICE_OPTIONS) by retrying with capitalised
 * values and, as a last resort, omitting problematic fields.
 *
 * Endpoints covered:
 * - GET    /api/participants?study=<StudyAirtableId>
 * - POST   /api/participants
 * - PATCH  /api/participants/:id
 * - DELETE /api/participants/:id
 *
 * Notes:
 * - The Participants↔Study link field name can differ; we iterate candidate names.
 * - “Time Zone” is NOT required and will only be sent to Airtable if provided.
 */

import {
	fetchWithTimeout,
	pickFirstField,
	safeText,
	toMs
} from "../core/utils.js";
import { PARTICIPANT_FIELDS } from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";

/**
 * List participants for a study.
 * @route GET /api/participants?study=:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listParticipants(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
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
			svc.log.error("airtable.participants.list.fail", { status: resp.status, text: safeText(txt) });
			return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, svc.corsHeaders(origin));
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	const participants = records
		.filter(r => {
			const f = r.fields || {};
			const linkKey = pickFirstField(f, PARTICIPANT_FIELDS.study_link);
			const linkArr = linkKey ? f[linkKey] : undefined;
			return Array.isArray(linkArr) && linkArr.includes(studyId);
		})
		.map(r => {
			const f = r.fields || {};
			const pick = (keys) => { const k = pickFirstField(f, keys); return k ? f[k] : undefined; };
			return {
				id: r.id,
				display_name: pick(PARTICIPANT_FIELDS.display_name) || "",
				email: pick(PARTICIPANT_FIELDS.email) || "",
				phone: pick(PARTICIPANT_FIELDS.phone) || "",
				channel_pref: pick(PARTICIPANT_FIELDS.channel_pref) || "email",
				access_needs: pick(PARTICIPANT_FIELDS.access_needs) || "",
				recruitment_source: pick(PARTICIPANT_FIELDS.recruitment_source) || "",
				consent_status: pick(PARTICIPANT_FIELDS.consent_status) || "not_sent",
				consent_record_id: pick(PARTICIPANT_FIELDS.consent_record_id) || "",
				privacy_notice_url: pick(PARTICIPANT_FIELDS.privacy_notice_url) || "",
				status: pick(PARTICIPANT_FIELDS.status) || "invited",
				createdAt: r.createdTime || ""
			};
		})
		.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

	return svc.json({ ok: true, participants }, 200, svc.corsHeaders(origin));
}

/**
 * Create a participant linked to a study (resilient to schema + select options).
 * @route POST /api/participants
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @returns {Promise<Response>}
 */
export async function createParticipant(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {any} */
	let p;
	try { p = JSON.parse(new TextDecoder().decode(body)); } catch { return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin)); }

	const missing = [];
	if (!p.study_airtable_id) missing.push("study_airtable_id");
	if (!p.display_name) missing.push("display_name");
	if (missing.length) {
		return svc.json({ error: "Missing fields: " + missing.join(", ") }, 400, svc.corsHeaders(origin));
	}

	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
	const atUrl = `https://api.airtable.com/v0/${base}/${table}`;

	// ---- Build a base fields template using preferred names (first in each list)
	const fieldsTemplate = {};
	const setIf = (names, val) => {
		if (val === undefined || val === null || String(val).trim() === "") return null;
		fieldsTemplate[names[0]] = val;
		return names[0];
	};

	setIf(PARTICIPANT_FIELDS.display_name, p.display_name);
	setIf(PARTICIPANT_FIELDS.email, p.email);
	setIf(PARTICIPANT_FIELDS.phone, p.phone);
	setIf(PARTICIPANT_FIELDS.access_needs, p.access_needs);
	setIf(PARTICIPANT_FIELDS.recruitment_source, p.recruitment_source);
	setIf(PARTICIPANT_FIELDS.privacy_notice_url, p.privacy_notice_url);

	// Select-ish fields we may need to retry with Capitalised or omit
	const selects = {
		channel_pref: { key: PARTICIPANT_FIELDS.channel_pref[0], val: p.channel_pref ?? "email" },
		consent_status: { key: PARTICIPANT_FIELDS.consent_status[0], val: p.consent_status ?? "not_sent" },
		status: { key: PARTICIPANT_FIELDS.status[0], val: p.status ?? "invited" }
	};

	// Helper to try a POST with a specific link field & select variants
	const tryCreate = async (linkFieldName, variant) => {
		// variant: {caps?: "channel_pref"|"consent_status"|"status", omit?: same}
		const f = { ...fieldsTemplate, [linkFieldName]: [p.study_airtable_id] };

		// Apply select values according to variant
		for (const [name, meta] of Object.entries(selects)) {
			if (variant?.omit === name) continue;
			if (!meta.key) continue;
			let v = meta.val;
			if (variant?.caps === name && typeof v === "string" && v) {
				v = v.charAt(0).toUpperCase() + v.slice(1);
			}
			f[meta.key] = v;
		}

		return await airtableTryWrite(atUrl, svc.env.AIRTABLE_API_KEY, "POST", f, svc.cfg.TIMEOUT_MS);
	};

	// ---- Iterate link-field candidates first
	let lastDetail = "";
	for (const linkName of PARTICIPANT_FIELDS.study_link) {
		// 1) try as-is (lowercase select values)
		let attempt = await tryCreate(linkName, { variant: "lower" });
		if (attempt.ok) {
			const id = attempt.json.records?.[0]?.id;
			if (svc.env.AUDIT === "true") svc.log.info("participant.created", { id, linkName, statusFallback: "none" });
			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
		}
		lastDetail = attempt.detail || lastDetail;

		// If select options invalid, retry with Capitalised variants then omit
		const isSelectErr = attempt.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
		if (isSelectErr) {
			// Try capitalising each select field (3 attempts)
			const capsOrder = ["channel_pref", "status", "consent_status"];
			for (const caps of capsOrder) {
				const r = await tryCreate(linkName, { caps });
				if (r.ok) {
					const id = r.json.records?.[0]?.id;
					if (svc.env.AUDIT === "true") svc.log.info("participant.created", { id, linkName, statusFallback: "capitalised:" + caps });
					return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
				}
				lastDetail = r.detail || lastDetail;
			}

			// Final fallback: omit problematic select fields (up to 3 passes)
			const omitOrder = ["channel_pref", "status", "consent_status"];
			for (const omit of omitOrder) {
				const r = await tryCreate(linkName, { omit });
				if (r.ok) {
					const id = r.json.records?.[0]?.id;
					if (svc.env.AUDIT === "true") svc.log.info("participant.created", { id, linkName, statusFallback: "omit:" + omit });
					return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
				}
				lastDetail = r.detail || lastDetail;
			}
		}

		// If UNKNOWN_FIELD_NAME for the link field, continue to next candidate.
		if (!attempt.retry) {
			svc.log.error("airtable.participant.create.fail", { status: attempt.status, detail: attempt.detail });
			return svc.json({ error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
		}
	}

	// No link-field candidate worked
	svc.log.error("airtable.participant.create.linkfield.none_matched", { detail: lastDetail });
	return svc.json({
		error: "Airtable 422",
		detail: lastDetail || "No matching link field name found for Participants↔Study relation. Try fields: " + PARTICIPANT_FIELDS.study_link.join(", ")
	}, 422, svc.corsHeaders(origin));
}