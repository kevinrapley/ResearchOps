/**
 * @file participant-consent.js
 * @module participant-consent
 * @summary Participant consent endpoints for study-scoped consent management.
 */

import { fetchWithTimeout, pickFirstField, safeText, toMs } from "../core/utils.js";
import { PARTICIPANT_CONSENT_FIELDS } from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";
import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const PARTICIPANT_CONSENT_TABLE = "rops_participant_consent_cache";

const PARTICIPANT_CONSENT_SQL = `
	CREATE TABLE IF NOT EXISTS ${PARTICIPANT_CONSENT_TABLE} (
		id TEXT PRIMARY KEY,
		study_id TEXT NOT NULL,
		participant_id TEXT NOT NULL,
		consent_form_id TEXT,
		consent_form_version INTEGER NOT NULL DEFAULT 1,
		responses_json TEXT NOT NULL DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'Not recorded',
		capture_method TEXT,
		withdrawn INTEGER NOT NULL DEFAULT 0,
		withdrawal_reason TEXT,
		recorded_by TEXT,
		recorded_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		source TEXT NOT NULL DEFAULT 'd1',
		payload_json TEXT
	)
`;

function hasD1(svc) {
	return Boolean(svc?.env?.RESEARCHOPS_D1?.prepare);
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

function participantConsentId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `pc_${crypto.randomUUID()}`;
	}
	return `pc_${Date.now().toString(36)}_${randomHex(8)}`;
}

function airtableConfigured(svc) {
	return Boolean(airtableBase(svc) && airtableKey(svc));
}

async function ensureParticipantConsentTable(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, PARTICIPANT_CONSENT_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_participant_consent_study ON ${PARTICIPANT_CONSENT_TABLE} (study_id, active, recorded_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_participant_consent_participant ON ${PARTICIPANT_CONSENT_TABLE} (participant_id, active)`);
}

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

function booleanValue(value) {
	return value === true || value === 1 || /^(true|yes|withdrawn)$/i.test(String(value || ""));
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
		withdrawn: booleanValue(withdrawn),
		withdrawalReason: String(pick(PARTICIPANT_CONSENT_FIELDS.withdrawal_reason) || "").trim(),
		recordedBy: String(pick(PARTICIPANT_CONSENT_FIELDS.recorded_by) || "").trim(),
		recordedAt: String(pick(PARTICIPANT_CONSENT_FIELDS.recorded_at) || record.createdTime || "").trim(),
		updatedAt: String(pick(PARTICIPANT_CONSENT_FIELDS.updated_at) || "").trim()
	};
}

function rowToParticipantConsent(row) {
	if (!row) return null;
	return {
		id: row.id,
		studyId: row.study_id || "",
		participantId: row.participant_id || "",
		consentFormId: row.consent_form_id || "",
		consentFormVersion: Number.parseInt(row.consent_form_version, 10) || 1,
		responses: parseResponses(row.responses_json),
		status: normaliseStatus(row.status),
		captureMethod: row.capture_method || "",
		withdrawn: row.withdrawn === true || row.withdrawn === 1 || String(row.withdrawn || "") === "1",
		withdrawalReason: row.withdrawal_reason || "",
		recordedBy: row.recorded_by || "",
		recordedAt: row.recorded_at || row.created_at || "",
		updatedAt: row.updated_at || ""
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

async function readD1ParticipantConsent(svc, studyId) {
	await ensureParticipantConsentTable(svc);
	const rows = await d1All(svc.env, `
		SELECT *
		FROM ${PARTICIPANT_CONSENT_TABLE}
		WHERE study_id = ? AND active = 1
		ORDER BY datetime(recorded_at) ASC, datetime(created_at) ASC
	`, [studyId]);
	return rows.map(rowToParticipantConsent).filter(Boolean);
}

function d1Payload(payload, existing = {}) {
	const responses = payload.responses !== undefined ? payload.responses : parseResponses(existing.responses_json);
	const now = nowIso();
	return {
		studyId: String(payload.studyId || payload.study_airtable_id || existing.study_id || "").trim(),
		participantId: String(payload.participantId || payload.participant_airtable_id || existing.participant_id || "").trim(),
		consentFormId: String(payload.consentFormId || payload.consent_form_airtable_id || existing.consent_form_id || "").trim(),
		consentFormVersion: Number.parseInt(payload.consentFormVersion || payload.consent_form_version || existing.consent_form_version || 1, 10) || 1,
		responsesJson: JSON.stringify(responses || {}),
		status: normaliseStatus(payload.status || existing.status),
		captureMethod: String(payload.captureMethod || payload.capture_method || existing.capture_method || "").trim(),
		withdrawn: payload.withdrawn === undefined ? (existing.withdrawn ? 1 : 0) : (payload.withdrawn ? 1 : 0),
		withdrawalReason: String(payload.withdrawalReason || payload.withdrawal_reason || existing.withdrawal_reason || "").trim(),
		recordedBy: String(payload.recordedBy || payload.recorded_by || existing.recorded_by || "").trim(),
		recordedAt: String(payload.recordedAt || payload.recorded_at || existing.recorded_at || now).trim(),
		updatedAt: now
	};
}

async function createD1ParticipantConsent(svc, payload) {
	await ensureParticipantConsentTable(svc);
	const fields = d1Payload(payload);
	const id = participantConsentId();
	const createdAt = nowIso();
	await d1Run(svc.env, `
		INSERT INTO ${PARTICIPANT_CONSENT_TABLE} (
			id, study_id, participant_id, consent_form_id, consent_form_version, responses_json,
			status, capture_method, withdrawn, withdrawal_reason, recorded_by, recorded_at,
			created_at, updated_at, active, source, payload_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'd1', ?)
	`, [
		id,
		fields.studyId,
		fields.participantId,
		fields.consentFormId || null,
		fields.consentFormVersion,
		fields.responsesJson,
		fields.status,
		fields.captureMethod || null,
		fields.withdrawn,
		fields.withdrawalReason || null,
		fields.recordedBy || null,
		fields.recordedAt || null,
		createdAt,
		fields.updatedAt,
		JSON.stringify({ ...payload, id })
	]);
	const row = await d1Get(svc.env, `SELECT * FROM ${PARTICIPANT_CONSENT_TABLE} WHERE id = ? LIMIT 1`, [id]);
	return rowToParticipantConsent(row);
}

async function updateD1ParticipantConsent(svc, recordId, payload) {
	await ensureParticipantConsentTable(svc);
	const existing = await d1Get(svc.env, `SELECT * FROM ${PARTICIPANT_CONSENT_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [recordId]);
	if (!existing) return null;
	const fields = d1Payload(payload, existing);
	await d1Run(svc.env, `
		UPDATE ${PARTICIPANT_CONSENT_TABLE}
		SET consent_form_id = ?, consent_form_version = ?, responses_json = ?, status = ?,
			capture_method = ?, withdrawn = ?, withdrawal_reason = ?, recorded_by = ?,
			recorded_at = ?, updated_at = ?, payload_json = ?
		WHERE id = ? AND active = 1
	`, [
		fields.consentFormId || null,
		fields.consentFormVersion,
		fields.responsesJson,
		fields.status,
		fields.captureMethod || null,
		fields.withdrawn,
		fields.withdrawalReason || null,
		fields.recordedBy || null,
		fields.recordedAt || null,
		fields.updatedAt,
		JSON.stringify({ ...parseResponses(existing.payload_json), ...payload, id: recordId }),
		recordId
	]);
	const row = await d1Get(svc.env, `SELECT * FROM ${PARTICIPANT_CONSENT_TABLE} WHERE id = ? LIMIT 1`, [recordId]);
	return rowToParticipantConsent(row);
}

async function getAllAirtableRecords(svc) {
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

async function listAirtableParticipantConsent(svc, studyId) {
	const records = await getAllAirtableRecords(svc);
	return records
		.filter(record => recordMatchesStudy(record, studyId))
		.map(recordToParticipantConsent)
		.sort((a, b) => toMs(a.recordedAt) - toMs(b.recordedAt));
}

function fieldsFromPayload(payload, overrides = {}) {
	const fields = {};
	const set = (names, value) => {
		if (value === undefined || value === null || String(value).trim() === "") return;
		fields[names[0]] = value;
	};

	if (overrides.studyLinkField) fields[overrides.studyLinkField] = [payload.study_airtable_id || payload.studyId];
	if (overrides.participantLinkField) fields[overrides.participantLinkField] = [payload.participant_airtable_id || payload.participantId];
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

async function tryCreateWithLinks(svc, payload, studyLinkField, participantLinkField, consentFormLinkField) {
	const fields = fieldsFromPayload(payload, { studyLinkField, participantLinkField, consentFormLinkField });
	return airtableTryWrite(atBaseUrl(svc), airtableKey(svc), "POST", fields, svc.cfg.TIMEOUT_MS);
}

async function createAirtableParticipantConsent(svc, payload, origin) {
	let lastDetail = "";
	for (const studyLinkField of PARTICIPANT_CONSENT_FIELDS.study_link) {
		for (const participantLinkField of PARTICIPANT_CONSENT_FIELDS.participant_link) {
			for (const consentFormLinkField of PARTICIPANT_CONSENT_FIELDS.consent_form_link) {
				const attempt = await tryCreateWithLinks(svc, payload, studyLinkField, participantLinkField, consentFormLinkField);
				if (attempt.ok) {
					const record = attempt.json.records?.[0];
					return svc.json({ ok: true, participantConsent: recordToParticipantConsent(record), fallback: "airtable" }, 200, svc.corsHeaders(origin));
				}
				lastDetail = attempt.detail || lastDetail;
				if (!attempt.retry) {
					return svc.json({ ok: false, error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
				}
			}

			const withoutConsentFormLink = await tryCreateWithLinks(svc, payload, studyLinkField, participantLinkField, null);
			if (withoutConsentFormLink.ok) {
				const record = withoutConsentFormLink.json.records?.[0];
				return svc.json({ ok: true, participantConsent: recordToParticipantConsent(record), consent_form_link_fallback: "omitted", fallback: "airtable" }, 200, svc.corsHeaders(origin));
			}
			lastDetail = withoutConsentFormLink.detail || lastDetail;
		}
	}

	return svc.json({ ok: false, error: "Airtable 422", detail: lastDetail || "No matching Participant Consent link field names found." }, 422, svc.corsHeaders(origin));
}

async function updateAirtableParticipantConsent(svc, payload, origin, recordId) {
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
		return svc.json({ ok: true, participantConsent: recordToParticipantConsent(js.records?.[0]), fallback: "airtable" }, 200, svc.corsHeaders(origin));
	}
	return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(text) }, resp.status, svc.corsHeaders(origin));
}

function unavailableResponse(svc, origin, detail) {
	return svc.json(
		{
			ok: false,
			error: "participant_consent_store_unavailable",
			message: "Participant consent records are not available right now.",
			detail
		},
		503,
		svc.corsHeaders(origin)
	);
}

export async function listParticipantConsent(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	if (hasD1(svc)) {
		try {
			const participantConsentRecords = await readD1ParticipantConsent(svc, studyId);
			return svc.json({ ok: true, participantConsentRecords }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.participant_consent.list.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) {
		try {
			const participantConsentRecords = await listAirtableParticipantConsent(svc, studyId);
			return svc.json({ ok: true, participantConsentRecords, fallback: "airtable" }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("airtable.participant_consent.list.fail", { status: err.status, detail: err.detail || err.message });
			return svc.json({ ok: false, error: err.message || "Airtable error", detail: err.detail }, err.status || 500, svc.corsHeaders(origin));
		}
	}

	return unavailableResponse(svc, origin);
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

	if (hasD1(svc)) {
		try {
			const participantConsent = await createD1ParticipantConsent(svc, payload);
			return svc.json({ ok: true, participantConsent }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.participant_consent.create.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) return createAirtableParticipantConsent(svc, payload, origin);
	return unavailableResponse(svc, origin);
}

export async function updateParticipantConsent(svc, request, origin, recordId) {
	if (!recordId) return svc.json({ ok: false, error: "Missing participant consent id" }, 400, svc.corsHeaders(origin));
	let payload;
	try {
		payload = await readBody(svc, request);
	} catch (err) {
		return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin));
	}

	if (hasD1(svc)) {
		try {
			const participantConsent = await updateD1ParticipantConsent(svc, recordId, payload);
			if (participantConsent) return svc.json({ ok: true, participantConsent }, 200, svc.corsHeaders(origin));
		} catch (err) {
			svc.log.error("d1.participant_consent.update.fail", { detail: err.message });
		}
	}

	if (airtableConfigured(svc)) return updateAirtableParticipantConsent(svc, payload, origin, recordId);
	return svc.json({ ok: false, error: "participant_consent_not_found" }, 404, svc.corsHeaders(origin));
}
