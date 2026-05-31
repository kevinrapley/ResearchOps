/**
 * @file participants.js
 * @module participants
 * @summary Participants endpoints for ResearchOps Worker (Airtable).
 *
 * @description
 * Implements a pseudonymised-by-default participant list and a deliberate,
 * permission-checked contact reveal route. D1 is the identity and authority
 * layer. Airtable remains the research data layer.
 */

import { resolveAuthenticatedContext } from "../core/auth/access-scoped.js";
import { assertRoutePermission } from "../core/auth/route-permissions.js";
import {
	fetchWithTimeout,
	pickFirstField,
	safeText,
	toMs
} from "../core/utils.js";
import { PARTICIPANT_FIELDS } from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";

const CONTACT_RESTRICTED_MESSAGE = "Participant contact details are restricted. Ask a Team Admin or authorised role if you need access.";
const PSEUDONYMISED_LIST_FIELDS = [
	...PARTICIPANT_FIELDS.study_link,
	...PARTICIPANT_FIELDS.channel_pref,
	...PARTICIPANT_FIELDS.consent_status,
	...PARTICIPANT_FIELDS.status,
];

function permissionCodes(context = {}) {
	return new Set((context.permissions || []).map((permission) => permission.code).filter(Boolean));
}

function canRevealParticipantContact(context) {
	return permissionCodes(context).has("participant.pii.reveal");
}

function permissionErrorResponse(svc, origin, error, fallbackMessage = CONTACT_RESTRICTED_MESSAGE, preferFallbackMessage = false) {
	const status = error?.status || 403;
	return svc.json(
		{
			ok: false,
			error: error?.code || "permission_denied",
			message: preferFallbackMessage ? fallbackMessage : (error?.message || fallbackMessage),
		},
		status,
		svc.corsHeaders(origin),
	);
}

async function resolveParticipantRouteContext(svc, request, origin) {
	try {
		const context = await resolveAuthenticatedContext(request, svc.env);
		await assertRoutePermission(request, svc.env, context);
		return { context, response: null };
	} catch (error) {
		return { context: null, response: permissionErrorResponse(svc, origin, error) };
	}
}

function dbFor(env = {}) {
	const db = env.RESEARCHOPS_D1;
	return db && typeof db.prepare === "function" ? db : null;
}

function makeAuditId() {
	return `evt_${crypto.randomUUID()}`;
}

async function recordParticipantContactAudit(svc, request, context, participantId, outcome) {
	const db = dbFor(svc.env);
	if (!db) return;

	try {
		await db
			.prepare(`
				INSERT INTO auth_events (id, event_type, actor_user_id, target_user_id, team_id, provider, route_path, metadata_json)
				VALUES (?, ?, ?, NULL, ?, 'researchops_participant_contact', ?, ?)
			`)
			.bind(
				makeAuditId(),
				outcome === "succeeded" ? "participant.contact.revealed" : "participant.contact.reveal.denied",
				context?.user?.id || null,
				context?.activeTeam?.id || null,
				new URL(request.url).pathname,
				JSON.stringify({ participantId, outcome }),
			)
			.run();
	} catch {
		// Participant contact access must not fail only because audit storage is unavailable.
	}
}

function airtableConfig(svc) {
	const base = svc.env.AIRTABLE_BASE_ID;
	const table = encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTICIPANTS || "Participants");
	return {
		base,
		table,
		url: `https://api.airtable.com/v0/${base}/${table}`,
		headers: { "Authorization": `Bearer ${svc.env.AIRTABLE_API_KEY}` },
	};
}

function appendPseudonymisedFieldProjection(params) {
	for (const field of [...new Set(PSEUDONYMISED_LIST_FIELDS)]) {
		params.append("fields[]", field);
	}
}

async function readParticipantRecords(svc) {
	const at = airtableConfig(svc);
	const records = [];
	let offset;

	do {
		const params = new URLSearchParams({ pageSize: "100" });
		appendPseudonymisedFieldProjection(params);
		if (offset) params.set("offset", offset);
		const resp = await fetchWithTimeout(`${at.url}?${params.toString()}`, { headers: at.headers }, svc.cfg.TIMEOUT_MS);
		const txt = await resp.text();
		if (!resp.ok) {
			svc.log.error("airtable.participants.list.fail", { status: resp.status, text: safeText(txt) });
			return { ok: false, response: svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status) };
		}

		let js;
		try {
			js = JSON.parse(txt);
		} catch {
			js = { records: [] };
		}
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);

	return { ok: true, records };
}

async function readParticipantRecord(svc, participantId) {
	const at = airtableConfig(svc);
	const resp = await fetchWithTimeout(`${at.url}/${encodeURIComponent(participantId)}`, { headers: at.headers }, svc.cfg.TIMEOUT_MS);
	const txt = await resp.text();

	if (!resp.ok) {
		svc.log.error("airtable.participant.contact.fail", { status: resp.status, text: safeText(txt) });
		return { ok: false, response: svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(txt) }, resp.status) };
	}

	try {
		return { ok: true, record: JSON.parse(txt) };
	} catch {
		return { ok: false, response: svc.json({ ok: false, error: "Invalid participant response" }, 502) };
	}
}

function pickParticipantField(fields, keys) {
	const key = pickFirstField(fields, keys);
	return key ? fields[key] : undefined;
}

function participantReference(record, index) {
	const id = String(record.id || "");
	const suffix = id ? id.slice(-6).toUpperCase() : String(index + 1).padStart(3, "0");
	return `Participant ${suffix}`;
}

function mapPseudonymisedParticipant(record, index, context) {
	const fields = record.fields || {};

	return {
		id: record.id,
		participant_ref: participantReference(record, index),
		display_name: participantReference(record, index),
		contact_restricted: true,
		has_contact_details: null,
		can_reveal_contact: canRevealParticipantContact(context),
		channel_pref: pickParticipantField(fields, PARTICIPANT_FIELDS.channel_pref) || "not recorded",
		consent_status: pickParticipantField(fields, PARTICIPANT_FIELDS.consent_status) || "not_sent",
		status: pickParticipantField(fields, PARTICIPANT_FIELDS.status) || "invited",
		createdAt: record.createdTime || "",
	};
}

function mapParticipantContact(record) {
	const fields = record.fields || {};
	return {
		id: record.id,
		display_name: pickParticipantField(fields, PARTICIPANT_FIELDS.display_name) || "",
		email: pickParticipantField(fields, PARTICIPANT_FIELDS.email) || "",
		phone: pickParticipantField(fields, PARTICIPANT_FIELDS.phone) || "",
	};
}

/**
 * List pseudonymised participants for a study.
 * @route GET /api/participants?study=:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function listParticipants(svc, request, origin, url) {
	const { context, response } = await resolveParticipantRouteContext(svc, request, origin);
	if (response) return response;

	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	const result = await readParticipantRecords(svc);
	if (!result.ok) return result.response;

	const participants = result.records
		.filter(r => {
			const f = r.fields || {};
			const linkKey = pickFirstField(f, PARTICIPANT_FIELDS.study_link);
			const linkArr = linkKey ? f[linkKey] : undefined;
			return Array.isArray(linkArr) && linkArr.includes(studyId);
		})
		.map((record, index) => mapPseudonymisedParticipant(record, index, context))
		.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

	return svc.json({ ok: true, participants }, 200, svc.corsHeaders(origin));
}

/**
 * Reveal participant contact details for an authorised user.
 * @route GET /api/participants/contact?participant=:id
 * @param {import("./index.js").ResearchOpsService} svc
 * @param {Request} request
 * @param {string} origin
 * @param {URL} url
 * @returns {Promise<Response>}
 */
export async function revealParticipantContact(svc, request, origin, url) {
	const participantId = url.searchParams.get("participant") || url.searchParams.get("id") || "";
	if (!participantId) return svc.json({ ok: false, error: "participant_required", message: "Choose a participant." }, 400, svc.corsHeaders(origin));

	let context;
	try {
		context = await resolveAuthenticatedContext(request, svc.env);
		await assertRoutePermission(request, svc.env, context);
	} catch (error) {
		await recordParticipantContactAudit(svc, request, context, participantId, "denied");
		return permissionErrorResponse(svc, origin, error, CONTACT_RESTRICTED_MESSAGE, true);
	}

	const result = await readParticipantRecord(svc, participantId);
	if (!result.ok) return result.response;

	const contact = mapParticipantContact(result.record);
	await recordParticipantContactAudit(svc, request, context, participantId, "succeeded");

	return svc.json(
		{
			ok: true,
			participant: contact,
			sensitive: true,
			message: "Participant contact details revealed. Handle this information as sensitive.",
		},
		200,
		svc.corsHeaders(origin),
	);
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

	const selects = {
		channel_pref: { key: PARTICIPANT_FIELDS.channel_pref[0], val: p.channel_pref ?? "email" },
		consent_status: { key: PARTICIPANT_FIELDS.consent_status[0], val: p.consent_status ?? "not_sent" },
		status: { key: PARTICIPANT_FIELDS.status[0], val: p.status ?? "invited" }
	};

	const tryCreate = async (linkFieldName, variant) => {
		const f = { ...fieldsTemplate, [linkFieldName]: [p.study_airtable_id] };

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

	let lastDetail = "";
	for (const linkName of PARTICIPANT_FIELDS.study_link) {
		let attempt = await tryCreate(linkName, { variant: "lower" });
		if (attempt.ok) {
			const id = attempt.json.records?.[0]?.id;
			if (svc.env.AUDIT === "true") svc.log.info("participant.created", { id, linkName, statusFallback: "none" });
			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
		}
		lastDetail = attempt.detail || lastDetail;

		const isSelectErr = attempt.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
		if (isSelectErr) {
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

		if (!attempt.retry) {
			svc.log.error("airtable.participant.create.fail", { status: attempt.status, detail: attempt.detail });
			return svc.json({ error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
		}
	}

	svc.log.error("airtable.participant.create.linkfield.none_matched", { detail: lastDetail });
	return svc.json({
		error: "Airtable 422",
		detail: lastDetail || "No matching link field name found for Participants↔Study relation. Try fields: " + PARTICIPANT_FIELDS.study_link.join(", ")
	}, 422, svc.corsHeaders(origin));
}
