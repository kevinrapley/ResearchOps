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
	safeText,
	toMs,
	pickFirstField,
	mdToAirtableRich, // kept for parity; not used unless you later add rich-text fields
	airtableTryWrite
} from "../core/utils.js";

import {
	PARTICIPANT_FIELDS
} from "../core/fields.js";

/**
 * @typedef {Object} ParticipantsDeps
 * @property {any} env Environment bindings.
 * @property {{ TIMEOUT_MS:number }} cfg Configuration object.
 * @property {import("../core/logger.js").BatchLogger} log Logger instance.
 * @property {(body:any,status?:number,headers?:HeadersInit)=>Response} json JSON responder.
 * @property {(origin:string)=>Record<string,string>} corsHeaders CORS header builder.
 */

/**
 * Factory returning bound Participants handlers.
 * @param {ParticipantsDeps} deps
 */
export function createParticipantsHandlers(deps) {
	const { env, cfg, log, json, corsHeaders } = deps;

	/**
	 * Map an Airtable record into the public Participant shape.
	 * @param {{id:string, createdTime?:string, fields?:Record<string,any>}} rec
	 * @returns {{
	 *   id:string,
	 *   display_name:string,
	 *   email:string,
	 *   phone:string,
	 *   timezone:string,
	 *   channel_pref:string,
	 *   access_needs:string,
	 *   recruitment_source:string,
	 *   consent_status:string,
	 *   consent_record_id:string,
	 *   privacy_notice_url:string,
	 *   status:string,
	 *   createdAt:string
	 * }}
	 */
	function mapParticipant(rec) {
		const f = rec.fields || {};
		const pick = (keys) => { const k = pickFirstField(f, keys); return k ? f[k] : undefined; };

		return {
			id: rec.id,
			display_name: pick(PARTICIPANT_FIELDS.display_name) || "",
			email: pick(PARTICIPANT_FIELDS.email) || "",
			phone: pick(PARTICIPANT_FIELDS.phone) || "",
			// Time Zone is not a requirement; include only if present in Airtable
			timezone: pick(PARTICIPANT_FIELDS.timezone) || "",
			channel_pref: pick(PARTICIPANT_FIELDS.channel_pref) || "email",
			access_needs: pick(PARTICIPANT_FIELDS.access_needs) || "",
			recruitment_source: pick(PARTICIPANT_FIELDS.recruitment_source) || "",
			consent_status: pick(PARTICIPANT_FIELDS.consent_status) || "not_sent",
			consent_record_id: pick(PARTICIPANT_FIELDS.consent_record_id) || "",
			privacy_notice_url: pick(PARTICIPANT_FIELDS.privacy_notice_url) || "",
			status: pick(PARTICIPANT_FIELDS.status) || "invited",
			createdAt: rec.createdTime || ""
		};
	}

	/**
	 * Build a robust Airtable base URL for the Participants table.
	 * @returns {string}
	 */
	function participantsBaseUrl() {
		const base = env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
		return `https://api.airtable.com/v0/${base}/${table}`;
	}

	/**
	 * Standard Airtable auth headers.
	 * @param {boolean} [withJson=false] Include Content-Type for JSON.
	 * @returns {Record<string,string>}
	 */
	function airtableHeaders(withJson = false) {
		const h = { "Authorization": `Bearer ${env.AIRTABLE_API_KEY}` };
		if (withJson) h["Content-Type"] = "application/json";
		return h;
	}

	/**
	 * List participants for a given Study.
	 * @route GET /api/participants?study=:id
	 * @param {string} origin
	 * @param {URL} url
	 * @returns {Promise<Response>}
	 */
	async function listParticipants(origin, url) {
		const studyId = url.searchParams.get("study");
		if (!studyId) return json({ ok: false, error: "Missing study query" }, 400, corsHeaders(origin));

		const atBase = participantsBaseUrl();
		const headers = airtableHeaders(false);

		const records = [];
		let offset;
		do {
			const params = new URLSearchParams({ pageSize: "100" });
			if (offset) params.set("offset", offset);
			const resp = await fetchWithTimeout(`${atBase}?${params.toString()}`, { headers }, cfg.TIMEOUT_MS);
			const txt = await resp.text();
			if (!resp.ok) {
				log.error("airtable.participants.list.fail", { status: resp.status, text: safeText(txt) });
				return json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status, corsHeaders(origin));
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
			.map(mapParticipant)
			.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

		return json({ ok: true, participants }, 200, corsHeaders(origin));
	}

	/**
	 * Create a participant linked to a study (resilient to schema + select options).
	 * @route POST /api/participants
	 * @param {Request} request
	 * @param {string} origin
	 * @returns {Promise<Response>}
	 *
	 * @example
	 * Body:
	 * {
	 *   "study_airtable_id": "recXXXX",
	 *   "display_name": "Jane Doe",
	 *   "email": "jane@example.com",
	 *   "phone": "07123 456789",
	 *   "channel_pref": "email",
	 *   "access_needs": "",
	 *   "recruitment_source": "Panel",
	 *   "consent_status": "not_sent",
	 *   "privacy_notice_url": "https://…",
	 *   "status": "invited"
	 * }
	 */
	async function createParticipant(request, origin) {
		const body = await request.arrayBuffer();
		/** @type {any} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin));
		}

		const missing = [];
		if (!p.study_airtable_id) missing.push("study_airtable_id");
		if (!p.display_name) missing.push("display_name");
		if (missing.length) return json({ error: "Missing fields: " + missing.join(", ") }, 400, corsHeaders(origin));

		const atUrl = participantsBaseUrl();

		// Base template with free-text fields (only include if present/meaningful).
		const fieldsTemplate = {};
		const setIf = (names, val) => {
			if (val === undefined || val === null) return null;
			const s = String(val).trim();
			if (!s) return null;
			fieldsTemplate[names[0]] = s;
			return names[0];
		};

		setIf(PARTICIPANT_FIELDS.display_name, p.display_name);
		setIf(PARTICIPANT_FIELDS.email, p.email);
		setIf(PARTICIPANT_FIELDS.phone, p.phone);
		setIf(PARTICIPANT_FIELDS.access_needs, p.access_needs);
		setIf(PARTICIPANT_FIELDS.recruitment_source, p.recruitment_source);
		setIf(PARTICIPANT_FIELDS.privacy_notice_url, p.privacy_notice_url);

		// NOTE: Time Zone is not a requirement; include ONLY if supplied
		if (p.timezone) setIf(PARTICIPANT_FIELDS.timezone, p.timezone);

		// Select fields we may need to retry with capitalised value or omit
		const selects = {
			channel_pref: { key: PARTICIPANT_FIELDS.channel_pref[0], val: p.channel_pref ?? "email" },
			consent_status: { key: PARTICIPANT_FIELDS.consent_status[0], val: p.consent_status ?? "not_sent" },
			status: { key: PARTICIPANT_FIELDS.status[0], val: p.status ?? "invited" }
		};

		/**
		 * Try a POST with a specific link field & variant tweaks for select values.
		 * @param {string} linkFieldName
		 * @param {("lower"|"caps"|"omit")=} variantMode
		 * @param {string=} omitName which select to omit if variantMode==="omit"
		 * @returns {Promise<{ok:boolean, retry?:boolean, detail?:string, status?:number, json?:any}>}
		 */
		const tryCreate = async (linkFieldName, variantMode = "lower", omitName) => {
			const f = { ...fieldsTemplate, [linkFieldName]: [p.study_airtable_id] };
			for (const [name, meta] of Object.entries(selects)) {
				if (variantMode === "omit" && omitName === name) continue;
				let v = meta.val;
				if (variantMode === "caps" && typeof v === "string" && v) {
					v = v.charAt(0).toUpperCase() + v.slice(1);
				}
				f[meta.key] = v;
			}
			return airtableTryWrite(atUrl, env.AIRTABLE_API_KEY, "POST", f, cfg.TIMEOUT_MS);
		};

		let lastDetail = "";

		// Iterate link-field candidates (schema tolerant)
		for (const linkName of PARTICIPANT_FIELDS.study_link) {
			// 1) As-is (lowercase select values)
			let attempt = await tryCreate(linkName, "lower");
			if (attempt.ok) {
				const id = attempt.json.records?.[0]?.id || null;
				if (env.AUDIT === "true") log.info("participant.created", { id, linkName, statusFallback: "none" });
				return json({ ok: true, id }, 200, corsHeaders(origin));
			}
			lastDetail = attempt.detail || lastDetail;

			// 2) If select invalid, retry with capitalised options
			const isSelectErr = attempt.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
			if (isSelectErr) {
				let capAttempt = await tryCreate(linkName, "caps");
				if (capAttempt.ok) {
					const id = capAttempt.json.records?.[0]?.id || null;
					if (env.AUDIT === "true") log.info("participant.created", { id, linkName, statusFallback: "capitalised" });
					return json({ ok: true, id }, 200, corsHeaders(origin));
				}
				lastDetail = capAttempt.detail || lastDetail;

				// 3) Omit each problematic select field in turn
				const omitOrder = ["channel_pref", "status", "consent_status"];
				for (const omit of omitOrder) {
					const omAttempt = await tryCreate(linkName, "omit", omit);
					if (omAttempt.ok) {
						const id = omAttempt.json.records?.[0]?.id || null;
						if (env.AUDIT === "true") log.info("participant.created", { id, linkName, statusFallback: `omitted_${omit}` });
						return json({ ok: true, id }, 200, corsHeaders(origin));
					}
					lastDetail = omAttempt.detail || lastDetail;
				}
			}

			// If the failure wasn't UNKNOWN_FIELD_NAME, surface it
			if (!attempt.retry) {
				log.error("airtable.participant.create.fail", { status: attempt.status, detail: attempt.detail });
				return json({ error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, corsHeaders(origin));
			}
			// else UNKNOWN_FIELD_NAME → try next link candidate
		}

		// No link-field candidate worked
		log.error("airtable.participant.create.linkfield.none_matched", { detail: lastDetail });
		return json({
			error: "Airtable 422",
			detail: lastDetail || "No matching link field name found for Participants↔Study relation. Try fields: " + PARTICIPANT_FIELDS.study_link.join(", ")
		}, 422, corsHeaders(origin));
	}

	/**
	 * Update a participant (partial; resilient to select validation).
	 * @route PATCH /api/participants/:id
	 * @param {Request} request
	 * @param {string} origin
	 * @param {string} participantId
	 * @returns {Promise<Response>}
	 */
	async function updateParticipant(request, origin, participantId) {
		if (!participantId) return json({ error: "Missing participant id" }, 400, corsHeaders(origin));

		const body = await request.arrayBuffer();
		/** @type {any} */
		let p;
		try { p = JSON.parse(new TextDecoder().decode(body)); } catch {
			return json({ error: "Invalid JSON" }, 400, corsHeaders(origin));
		}

		// Map incoming keys onto preferred Airtable field names (first candidate)
		const fields = {};
		const putIf = (names, val) => {
			if (val === undefined) return null;
			fields[names[0]] = val;
			return names[0];
		};

		putIf(PARTICIPANT_FIELDS.display_name, typeof p.display_name === "string" ? p.display_name : undefined);
		putIf(PARTICIPANT_FIELDS.email, typeof p.email === "string" ? p.email : undefined);
		putIf(PARTICIPANT_FIELDS.phone, typeof p.phone === "string" ? p.phone : undefined);
		putIf(PARTICIPANT_FIELDS.access_needs, typeof p.access_needs === "string" ? p.access_needs : undefined);
		putIf(PARTICIPANT_FIELDS.recruitment_source, typeof p.recruitment_source === "string" ? p.recruitment_source : undefined);
		putIf(PARTICIPANT_FIELDS.privacy_notice_url, typeof p.privacy_notice_url === "string" ? p.privacy_notice_url : undefined);

		// Time Zone remains optional
		if (typeof p.timezone === "string") putIf(PARTICIPANT_FIELDS.timezone, p.timezone);

		const statusKey = putIf(PARTICIPANT_FIELDS.status, typeof p.status === "string" ? p.status : undefined);
		const channelKey = putIf(PARTICIPANT_FIELDS.channel_pref, typeof p.channel_pref === "string" ? p.channel_pref : undefined);
		const consentKey = putIf(PARTICIPANT_FIELDS.consent_status, typeof p.consent_status === "string" ? p.consent_status : undefined);

		if (Object.keys(fields).length === 0) {
			return json({ error: "No updatable fields provided" }, 400, corsHeaders(origin));
		}

		const atBase = participantsBaseUrl();
		const headers = airtableHeaders(true);

		// First attempt
		let res = await fetchWithTimeout(atBase, {
			method: "PATCH",
			headers,
			body: JSON.stringify({ records: [{ id: participantId, fields }] })
		}, cfg.TIMEOUT_MS);

		let txt = await res.text();
		if (res.ok) return json({ ok: true }, 200, corsHeaders(origin));

		// If any select value is invalid, retry with capitalised; then omit
		const isSelectErr = res.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(txt);
		if (isSelectErr) {
			const cap = (v) => (typeof v === "string" && v) ? (v.charAt(0).toUpperCase() + v.slice(1)) : v;
			const f2 = { ...fields };
			if (statusKey && f2[statusKey]) f2[statusKey] = cap(f2[statusKey]);
			if (channelKey && f2[channelKey]) f2[channelKey] = cap(f2[channelKey]);
			if (consentKey && f2[consentKey]) f2[consentKey] = cap(f2[consentKey]);

			res = await fetchWithTimeout(atBase, {
				method: "PATCH",
				headers,
				body: JSON.stringify({ records: [{ id: participantId, fields: f2 }] })
			}, cfg.TIMEOUT_MS);
			txt = await res.text();
			if (res.ok) return json({ ok: true, status_fallback: "capitalised" }, 200, corsHeaders(origin));

			// Omit the select fields one-by-one
			const omitOrder = [statusKey, channelKey, consentKey].filter(Boolean);
			for (const omit of omitOrder) {
				const {
					[omit]: _drop, ...f3 } = f2;
				const r = await fetchWithTimeout(atBase, {
					method: "PATCH",
					headers,
					body: JSON.stringify({ records: [{ id: participantId, fields: f3 }] })
				}, cfg.TIMEOUT_MS);
				const t = await r.text();
				if (r.ok) return json({ ok: true, status_fallback: `omitted:${omit}` }, 200, corsHeaders(origin));
				txt = t; // keep last failure text for logging
			}
		}

		log.error("airtable.participant.update.fail", { status: res.status, text: safeText(txt) });
		return json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, corsHeaders(origin));
	}

	/**
	 * Delete a participant.
	 * @route DELETE /api/participants/:id
	 * @param {string} origin
	 * @param {string} participantId
	 * @returns {Promise<Response>}
	 */
	async function deleteParticipant(origin, participantId) {
		if (!participantId) return json({ error: "Missing participant id" }, 400, corsHeaders(origin));
		const base = env.AIRTABLE_BASE_ID;
		const table = encodeURIComponent(env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
		const url = `https://api.airtable.com/v0/${base}/${table}/${encodeURIComponent(participantId)}`;

		const res = await fetchWithTimeout(url, {
			method: "DELETE",
			headers: airtableHeaders(false)
		}, cfg.TIMEOUT_MS);

		if (!res.ok) {
			const txt = await res.text();
			log.error("airtable.participant.delete.fail", { status: res.status, text: safeText(txt) });
			return json({ error: `Airtable ${res.status}`, detail: safeText(txt) }, res.status, corsHeaders(origin));
		}

		return json({ ok: true }, 200, corsHeaders(origin));
	}

	return {
		listParticipants,
		createParticipant,
		updateParticipant,
		deleteParticipant
	};
}