/**
 * @file participant-consent.js
 * @module participant-consent
 * @summary Participant consent endpoints for study-scoped consent management.
 */

import { fetchWithTimeout, pickFirstField, safeText, toMs } from "../core/utils.js";
import { PARTICIPANT_CONSENT_FIELDS } from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";

function participantConsentTable(svc) {
	return encodeURIComponent(svc.env.AIRTABLE_TABLE_PARTICIPANT_CONSENT || "Participant Consent");
}

function airtableBase(svc) {
	return svc.env.AIRTABLE_BASE || svc.env.AIRTABLE_BASE_ID;
}

function airtableKey(svc) {
	return svc.env.AIRTABLE_API_KEY || svc.env.AIRTABLE_PAT || svc.env.AIRTABLE_ACCESS_TOKEN;
}

function atBaseUrl(svc) {
	return `https://api.airtable.com/v0/${airtableBase(svc)}/${participantConsentTable(svc)}`;
}

function atHeaders(svc) {
	return { Authorization: `Bearer ${airtableKey(svc)}` };
}

function parseResponses(value) {
	if (!value) return {};
	if (typeof value === "object") return value;
	try {
		return JSON.parse(String(value));
	} catch {
		return {};
	}
}

function normaliseStatus(value) {
	const raw = String(value || "").trim();
	if (/^ready for session$/i.test(raw)) return "Ready for session";
	if (/^needs review$/i.test(raw)) return "Needs review";
	if (/^needs consent$/i.test(raw)) return "Needs consent";
	if (/^withdrawn$/i.test(raw)) return "Withdrawn";
	if (/^not recorded$/i.test(raw)) return "Not recorded";
	return raw || "Not recorded";
}

function recordToParticipantConsent(record) {
	const f = record?.fields || {};
	const pick = keys => {
		const key = pickFirstField(f, keys);
		return key ? f[key] : undefined;
	};
	const studyLink = pick(PARTICIPANT_CONSENT_FIELDS.study_link);
	const participantLink = pick(PARTICIPANT_CONSENT_FIELDS.participant_link);
	const consentFormLink = pick(PARTICIPANT_CONSENT_FIELDS.consent_form_link);
	const withdrawn = pick(PARTICIPANT_CONSENT_FIELDS.withdrawn);

	return {
		id: record.id,
		studyId: Array.isArray(studyLink) ? studyLink[0] || "" : String(studyLink || ""),
		participantId: Array.isArray(participantLink) ? participantLink[0] || "" : String(participantLink || ""),
		consentFormId: Array.isArray(consentFormLink) ? consentFormLink[0] || "" : String(consentFormLink || ""),
		consentFormVersion: Number.parseInt(pick(PARTICIPANT_CONSENT_FIELDS.consent_form_version), 10) || 1,
		responses: parseResponses(pick(PARTICIPANT_CONSENT_FIELDS.responses)),
		status: normaliseStatus(pick(PARTICIPANT_CONSENT_FIELDS.status)),
		captureMethod: String(pick(PARTICIPANT_CONSENT_FIELDS.capture_method) || "").trim(),
		withdrawn: withdrawn === true || /^true|yes|withdrawn$/i.test(String(withdrawn || "")),
		withdrawalReason: String(pick(PARTICIPANT_CONSENT_FIELDS.withdrawal_reason) || "").trim(),
		recordedBy: String(pick(PARTICIPANT_CONSENT_FIELDS.recorded_by) || "").trim(),
		recordedAt: String(pick(PARTICIPANT_CONSENT_FIELDS.recorded_at) || record.createdTime || "").trim(),
		updatedAt: String(pick(PARTICIPANT_CONSENT_FIELDS.updated_at) || "").trim()
	};
}

async function readBody(svc, request) {
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

async function getAllRecords(svc) {
	const records = [];
	let offset;
	do {
		const params = new URLSearchParams({ pageSize: "100" });
		if (offset) params.set("offset", offset);
		const resp = await fetchWithTimeout(`${atBaseUrl(svc)}?${params.toString()}`, { headers: atHeaders(svc) }, svc.cfg.TIMEOUT_MS);
		const text = await resp.text();
		if (!resp.ok) {
			throw Object.assign(new Error(`Airtable ${resp.status}`), { status: resp.status, detail: safeText(text) });
		}
		let js;
		try {
			js = JSON.parse(text);
		} catch {
			js = { records: [] };
		}
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);
	return records;
}

function recordMatchesStudy(record, studyId) {
	const f = record?.fields || {};
	const linkKey = pickFirstField(f, PARTICIPANT_CONSENT_FIELDS.study_link);
	const value = linkKey ? f[linkKey] : undefined;
	if (Array.isArray(value)) return value.includes(studyId);
	return String(value || "") === studyId;
}

function fieldsFromPayload(payload, overrides = {}) {
	const fields = {};
	const set = (names, value) => {
		if (value === undefined || value === null || String(value).trim() === "") return;
		fields[names[0]] = value;
	};

	if (overrides.studyLinkField) fields[overrides.studyLinkField] = [payload.studyId || payload.study_airtable_id];
	if (overrides.participantLinkField) fields[overrides.participantLinkField] = [payload.participantId || payload.participant_airtable_id];
	if (overrides.consentFormLinkField && (payload.consentFormId || payload.consent_form_airtable_id)) {
		fields[overrides.consentFormLinkField] = [payload.consentFormId || payload.consent_form_airtable_id];
	}

	set(PARTICIPANT_CONSENT_FIELDS.consent_form_version, String(payload.consentFormVersion || payload.consent_form_version || 1));
	set(PARTICIPANT_CONSENT_FIELDS.responses, JSON.stringify(payload.responses || {}));
	set(PARTICIPANT_CONSENT_FIELDS.status, normaliseStatus(payload.status));
	set(PARTICIPANT_CONSENT_FIELDS.capture_method, payload.captureMethod || payload.capture_method);
	set(PARTICIPANT_CONSENT_FIELDS.withdrawn, payload.withdrawn ? "true" : "false");
	set(PARTICIPANT_CONSENT_FIELDS.withdrawal_reason, payload.withdrawalReason || payload.withdrawal_reason);
	set(PARTICIPANT_CONSENT_FIELDS.recorded_by, payload.recordedBy || payload.recorded_by);
	set(PARTICIPANT_CONSENT_FIELDS.recorded_at, payload.recordedAt || payload.recorded_at || new Date().toISOString());
	set(PARTICIPANT_CONSENT_FIELDS.updated_at, new Date().toISOString());
	return fields;
}

export async function listParticipantConsent(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	try {
		const records = await getAllRecords(svc);
		const participantConsentRecords = records
			.filter(record => recordMatchesStudy(record, studyId))
			.map(recordToParticipantConsent)
			.sort((a, b) => toMs(a.recordedAt) - toMs(b.recordedAt));
		return svc.json({ ok: true, participantConsentRecords }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("airtable.participant_consent.list.fail", { status: err.status, detail: err.detail || err.message });
		return svc.json({ ok: false, error: err.message || "Airtable error", detail: err.detail }, err.status || 500, svc.corsHeaders(origin));
	}
}

export async function createParticipantConsent(svc, request, origin) {
	let payload;
	try {
		payload = await readBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	const studyId = payload.studyId || payload.study_airtable_id;
	const participantId = payload.participantId || payload.participant_airtable_id;
	if (!studyId || !participantId) {
		return svc.json({ ok: false, error: "Missing fields: studyId, participantId" }, 400, svc.corsHeaders(origin));
	}

	let lastDetail = "";
	for (const studyLinkField of PARTICIPANT_CONSENT_FIELDS.study_link) {
		for (const participantLinkField of PARTICIPANT_CONSENT_FIELDS.participant_link) {
			for (const consentFormLinkField of PARTICIPANT_CONSENT_FIELDS.consent_form_link) {
				const fields = fieldsFromPayload(payload, { studyLinkField, participantLinkField, consentFormLinkField });
				const attempt = await airtableTryWrite(atBaseUrl(svc), airtableKey(svc), "POST", fields, svc.cfg.TIMEOUT_MS);
				if (attempt.ok) {
					const record = attempt.json.records?.[0];
					return svc.json({ ok: true, participantConsent: recordToParticipantConsent(record) }, 200, svc.corsHeaders(origin));
				}
				lastDetail = attempt.detail || lastDetail;
				if (!attempt.retry) {
					return svc.json({ ok: false, error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
				}
			}
		}
	}

	return svc.json({ ok: false, error: "Airtable 422", detail: lastDetail || "No matching Participant Consent link field names found." }, 422, svc.corsHeaders(origin));
}

export async function updateParticipantConsent(svc, request, origin, recordId) {
	if (!recordId) return svc.json({ ok: false, error: "Missing participant consent id" }, 400, svc.corsHeaders(origin));
	let payload;
	try {
		payload = await readBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	const fields = fieldsFromPayload(payload);
	const resp = await fetchWithTimeout(atBaseUrl(svc), {
		method: "PATCH",
		headers: { ...atHeaders(svc), "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: recordId, fields }] })
	}, svc.cfg.TIMEOUT_MS);
	const text = await resp.text();
	if (resp.ok) {
		let js;
		try {
			js = JSON.parse(text);
		} catch {
			js = { records: [] };
		}
		return svc.json({ ok: true, participantConsent: recordToParticipantConsent(js.records?.[0]) }, 200, svc.corsHeaders(origin));
	}
	return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(text) }, resp.status, svc.corsHeaders(origin));
}
