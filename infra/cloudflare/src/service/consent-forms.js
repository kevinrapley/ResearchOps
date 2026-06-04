/**
 * @file consent-forms.js
 * @module consent-forms
 * @summary Consent Forms endpoints for ResearchOps Worker (Airtable-backed Markdown + Mustache templates).
 *
 * @description
 * Encapsulates:
 * - listConsentForms (GET /api/consent-forms?study=...)
 * - readConsentForm (GET /api/consent-forms/:id)
 * - createConsentForm (POST /api/consent-forms)
 * - updateConsentForm (PATCH /api/consent-forms/:id)
 * - publishConsentForm (POST /api/consent-forms/:id/publish)
 */

import {
	fetchWithTimeout,
	mdToAirtableRich,
	pickFirstField,
	safeText,
	toMs
} from "../core/utils.js";
import {
	CONSENT_FORM_LINK_FIELD_CANDIDATES,
	CONSENT_FORM_FIELD_NAMES
} from "../core/fields.js";
import { airtableTryWrite } from "../core/utils.js";
import { getRecord } from "./internals/airtable.js";
import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const CONSENT_FORMS_TABLE = "rops_consent_forms";

const CONSENT_FORMS_SQL = `
	CREATE TABLE IF NOT EXISTS ${CONSENT_FORMS_TABLE} (
		id TEXT PRIMARY KEY,
		study_id TEXT NOT NULL,
		title TEXT NOT NULL,
		form_type TEXT NOT NULL,
		status TEXT NOT NULL,
		version INTEGER NOT NULL DEFAULT 1,
		source_markdown TEXT NOT NULL,
		variables_json TEXT NOT NULL DEFAULT '{}',
		consent_items_json TEXT NOT NULL DEFAULT '[]',
		plain_english_summary TEXT,
		accessibility_notes TEXT,
		review_notes TEXT,
		owner TEXT,
		published_at TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		active INTEGER NOT NULL DEFAULT 1,
		source TEXT NOT NULL DEFAULT 'd1',
		payload_json TEXT
	)
`;

const DEFAULT_CONSENT_ITEMS = [
	{
		id: "participation",
		label: "I understand what taking part involves and I agree to take part in this research.",
		required: true
	},
	{
		id: "voluntary",
		label: "I understand that taking part is voluntary and that I can stop the session at any time.",
		required: true
	},
	{
		id: "data-use",
		label: "I understand how my information will be used for this research.",
		required: true
	},
	{
		id: "recording",
		label: "I agree to the session being recorded if recording is being used for this study.",
		required: false
	}
];

const DEFAULT_VARIABLES = {
	studyTitle: "{{studyTitle}}",
	organisation: "Home Office Biometrics",
	researcherName: "Researcher name",
	researcherEmail: "research@example.gov.uk",
	sessionFormat: "remote research session",
	recordingSummary: "The session may be audio or video recorded if you agree.",
	withdrawalPeriod: "14 days after your session"
};

const DEFAULT_SOURCE_MARKDOWN = `# {{studyTitle}} participant information and consent form

## About this research

We are doing research for {{organisation}}. The session will help us understand how people use or experience this service.

## What taking part involves

You will take part in a {{sessionFormat}} with a researcher. You can choose not to answer any question. You can stop the session at any time.

## Recording and observers

{{recordingSummary}}

## How your information will be used

We will use what we learn to improve the service. Research notes and outputs should not identify you directly.

## Withdrawal

You can ask for your contribution to be withdrawn up to {{withdrawalPeriod}}, where this is possible.

## Consent statements

{{#consentItems}}
- {{label}}
{{/consentItems}}

## Contact

If you have questions, contact {{researcherName}} at {{researcherEmail}}.
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

function consentFormId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `cf_${crypto.randomUUID()}`;
	}
	return `cf_${Date.now().toString(36)}_${randomHex(8)}`;
}

function safeJsonString(value, fallback) {
	if (value === undefined || value === null || value === "") return JSON.stringify(fallback);
	if (typeof value === "string") {
		try {
			JSON.parse(value);
			return value;
		} catch {
			return JSON.stringify(fallback);
		}
	}
	return JSON.stringify(value);
}

async function ensureConsentFormsTable(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, CONSENT_FORMS_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_study ON ${CONSENT_FORMS_TABLE} (study_id, active, updated_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_consent_forms_status ON ${CONSENT_FORMS_TABLE} (status, active)`);
}

function rowToConsentForm(row) {
	if (!row) return null;
	return {
		id: row.id,
		title: row.title || "Untitled consent form",
		formType: row.form_type || "Consent form",
		status: row.status || "Draft",
		version: Number.parseInt(row.version, 10) || 1,
		sourceMarkdown: row.source_markdown || "",
		variables: parseJsonField(row.variables_json, {}),
		consentItems: parseJsonField(row.consent_items_json, []),
		plainEnglishSummary: row.plain_english_summary || "",
		accessibilityNotes: row.accessibility_notes || "",
		reviewNotes: row.review_notes || "",
		owner: row.owner || "",
		publishedAt: row.published_at || "",
		createdAt: row.created_at || "",
		updatedAt: row.updated_at || ""
	};
}

function d1Payload(payload, existing = {}) {
	return {
		title: String(payload.title ?? existing.title ?? "Participant information and consent form").trim() || "Participant information and consent form",
		formType: normaliseFormType(payload.formType ?? existing.form_type ?? "Consent form"),
		status: normaliseStatus(payload.status ?? existing.status ?? "Draft"),
		version: Number.isFinite(payload.version) ? payload.version : (Number.parseInt(existing.version, 10) || 1),
		sourceMarkdown: typeof payload.sourceMarkdown === "string" ? payload.sourceMarkdown : (existing.source_markdown || DEFAULT_SOURCE_MARKDOWN),
		variablesJson: safeJsonString(payload.variables, existing.variables_json ? parseJsonField(existing.variables_json, {}) : DEFAULT_VARIABLES),
		consentItemsJson: safeJsonString(payload.consentItems, existing.consent_items_json ? parseJsonField(existing.consent_items_json, []) : DEFAULT_CONSENT_ITEMS),
		plainEnglishSummary: typeof payload.plainEnglishSummary === "string" ? payload.plainEnglishSummary : (existing.plain_english_summary || ""),
		accessibilityNotes: typeof payload.accessibilityNotes === "string" ? payload.accessibilityNotes : (existing.accessibility_notes || ""),
		reviewNotes: typeof payload.reviewNotes === "string" ? payload.reviewNotes : (existing.review_notes || ""),
		owner: typeof payload.owner === "string" ? payload.owner : (existing.owner || ""),
		publishedAt: payload.publishedAt || existing.published_at || ""
	};
}

async function listConsentFormsFromD1(svc, studyId) {
	await ensureConsentFormsTable(svc);
	const rows = await d1All(svc.env, `
		SELECT *
		FROM ${CONSENT_FORMS_TABLE}
		WHERE study_id = ? AND active = 1
		ORDER BY datetime(created_at) DESC, datetime(updated_at) DESC
	`, [studyId]);
	return rows.map(rowToConsentForm).filter(Boolean);
}

async function readConsentFormFromD1(svc, formId) {
	await ensureConsentFormsTable(svc);
	const row = await d1Get(svc.env, `
		SELECT *
		FROM ${CONSENT_FORMS_TABLE}
		WHERE id = ? AND active = 1
		LIMIT 1
	`, [formId]);
	return rowToConsentForm(row);
}

async function createConsentFormInD1(svc, payload) {
	await ensureConsentFormsTable(svc);
	const studyId = payload.study_airtable_id || payload.studyId;
	const id = consentFormId();
	const createdAt = nowIso();
	const fields = d1Payload(payload);
	await d1Run(svc.env, `
		INSERT INTO ${CONSENT_FORMS_TABLE} (
			id, study_id, title, form_type, status, version, source_markdown, variables_json,
			consent_items_json, plain_english_summary, accessibility_notes, review_notes, owner,
			published_at, created_at, updated_at, active, source, payload_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'd1', ?)
	`, [
		id,
		studyId,
		fields.title,
		fields.formType,
		fields.status,
		fields.version,
		fields.sourceMarkdown,
		fields.variablesJson,
		fields.consentItemsJson,
		fields.plainEnglishSummary,
		fields.accessibilityNotes,
		fields.reviewNotes,
		fields.owner,
		fields.publishedAt,
		createdAt,
		createdAt,
		JSON.stringify({ ...payload, id, studyId })
	]);
	return readConsentFormFromD1(svc, id);
}

async function updateConsentFormInD1(svc, formId, payload) {
	await ensureConsentFormsTable(svc);
	const existing = await d1Get(svc.env, `SELECT * FROM ${CONSENT_FORMS_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [formId]);
	if (!existing) return null;
	const fields = d1Payload(payload, existing);
	const updatedAt = nowIso();
	await d1Run(svc.env, `
		UPDATE ${CONSENT_FORMS_TABLE}
		SET title = ?, form_type = ?, status = ?, version = ?, source_markdown = ?,
			variables_json = ?, consent_items_json = ?, plain_english_summary = ?,
			accessibility_notes = ?, review_notes = ?, owner = ?, published_at = ?,
			updated_at = ?, payload_json = ?
		WHERE id = ? AND active = 1
	`, [
		fields.title,
		fields.formType,
		fields.status,
		fields.version,
		fields.sourceMarkdown,
		fields.variablesJson,
		fields.consentItemsJson,
		fields.plainEnglishSummary,
		fields.accessibilityNotes,
		fields.reviewNotes,
		fields.owner,
		fields.publishedAt,
		updatedAt,
		JSON.stringify({ ...parseJsonField(existing.payload_json, {}), ...payload, id: formId, studyId: existing.study_id }),
		formId
	]);
	return readConsentFormFromD1(svc, formId);
}

async function publishConsentFormInD1(svc, formId) {
	await ensureConsentFormsTable(svc);
	const existing = await d1Get(svc.env, `SELECT * FROM ${CONSENT_FORMS_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [formId]);
	if (!existing) return null;
	const publishedAt = nowIso();
	const version = (Number.parseInt(existing.version, 10) || 0) + 1;
	await d1Run(svc.env, `
		UPDATE ${CONSENT_FORMS_TABLE}
		SET status = 'Published', version = ?, published_at = ?, updated_at = ?
		WHERE id = ? AND active = 1
	`, [version, publishedAt, publishedAt, formId]);
	return readConsentFormFromD1(svc, formId);
}

function consentFormsTable(svc) {
	return encodeURIComponent(svc.env.AIRTABLE_TABLE_CONSENT_FORMS || "Consent Forms");
}

function airtableBase(svc) {
	return svc.env.AIRTABLE_BASE || svc.env.AIRTABLE_BASE_ID;
}

function airtableKey(svc) {
	return svc.env.AIRTABLE_API_KEY || svc.env.AIRTABLE_PAT || svc.env.AIRTABLE_ACCESS_TOKEN;
}

function airtableConfigured(svc) {
	return Boolean(airtableBase(svc) && airtableKey(svc));
}

function atBaseUrl(svc) {
	return `https://api.airtable.com/v0/${airtableBase(svc)}/${consentFormsTable(svc)}`;
}

function atHeaders(svc) {
	return { "Authorization": `Bearer ${airtableKey(svc)}` };
}

function normaliseStatus(value) {
	const raw = String(value || "Draft").trim();
	if (/^draft$/i.test(raw)) return "Draft";
	if (/^in review$/i.test(raw)) return "In review";
	if (/^published$/i.test(raw)) return "Published";
	if (/^archived$/i.test(raw)) return "Archived";
	return raw || "Draft";
}

function normaliseFormType(value) {
	const raw = String(value || "Consent form").trim();
	if (/^participant information sheet$/i.test(raw)) return "Participant information sheet";
	if (/^consent form$/i.test(raw)) return "Consent form";
	if (/^privacy notice$/i.test(raw)) return "Privacy notice";
	if (/^debrief sheet$/i.test(raw)) return "Debrief sheet";
	if (/^screening consent$/i.test(raw)) return "Screening consent";
	if (/^other$/i.test(raw)) return "Other";
	return raw || "Consent form";
}

function parseJsonField(value, fallback) {
	if (value == null || value === "") return fallback;
	if (typeof value === "object") return value;
	try {
		return JSON.parse(String(value));
	} catch {
		return fallback;
	}
}

function recordToConsentForm(record) {
	const f = record?.fields || {};
	const titleKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.title);
	const formTypeKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.formType);
	const statusKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.status);
	const versionKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.version);
	const sourceKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.source);
	const variablesKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.variables);
	const itemsKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.consentItems);
	const summaryKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.summary);
	const accessibilityKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.accessibilityNotes);
	const reviewKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.reviewNotes);
	const ownerKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.owner);
	const publishedAtKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.publishedAt);
	const createdAtKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.createdAt);
	const updatedAtKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.updatedAt);

	return {
		id: record.id,
		title: titleKey ? f[titleKey] : "Untitled consent form",
		formType: formTypeKey ? f[formTypeKey] : "Consent form",
		status: statusKey ? f[statusKey] : "Draft",
		version: versionKey ? f[versionKey] : 1,
		sourceMarkdown: sourceKey ? (f[sourceKey] || "") : "",
		variables: parseJsonField(variablesKey ? f[variablesKey] : "{}", {}),
		consentItems: parseJsonField(itemsKey ? f[itemsKey] : "[]", []),
		plainEnglishSummary: summaryKey ? (f[summaryKey] || "") : "",
		accessibilityNotes: accessibilityKey ? (f[accessibilityKey] || "") : "",
		reviewNotes: reviewKey ? (f[reviewKey] || "") : "",
		owner: ownerKey ? (f[ownerKey] || "") : "",
		publishedAt: publishedAtKey ? (f[publishedAtKey] || "") : "",
		createdAt: createdAtKey ? (f[createdAtKey] || record.createdTime || "") : (record.createdTime || ""),
		updatedAt: updatedAtKey ? (f[updatedAtKey] || "") : ""
	};
}

function fieldsFromPayload(payload, { includeDefaults = false } = {}) {
	const fields = {};
	const set = (names, value) => {
		if (value === undefined || value === null) return;
		fields[names[0]] = value;
	};

	set(CONSENT_FORM_FIELD_NAMES.title, String(payload.title || (includeDefaults ? "Participant information and consent form" : "")) || undefined);
	set(CONSENT_FORM_FIELD_NAMES.formType, normaliseFormType(payload.formType || (includeDefaults ? "Consent form" : undefined)));
	set(CONSENT_FORM_FIELD_NAMES.status, normaliseStatus(payload.status || (includeDefaults ? "Draft" : undefined)));
	set(CONSENT_FORM_FIELD_NAMES.version, Number.isFinite(payload.version) ? payload.version : (includeDefaults ? 1 : undefined));
	set(CONSENT_FORM_FIELD_NAMES.source, typeof payload.sourceMarkdown === "string" ? mdToAirtableRich(payload.sourceMarkdown) : (includeDefaults ? mdToAirtableRich(DEFAULT_SOURCE_MARKDOWN) : undefined));
	set(CONSENT_FORM_FIELD_NAMES.variables, payload.variables != null ? JSON.stringify(payload.variables) : (includeDefaults ? JSON.stringify(DEFAULT_VARIABLES, null, 2) : undefined));
	set(CONSENT_FORM_FIELD_NAMES.consentItems, payload.consentItems != null ? JSON.stringify(payload.consentItems) : (includeDefaults ? JSON.stringify(DEFAULT_CONSENT_ITEMS, null, 2) : undefined));
	set(CONSENT_FORM_FIELD_NAMES.summary, typeof payload.plainEnglishSummary === "string" ? payload.plainEnglishSummary : (includeDefaults ? "Participant-facing consent material for this study." : undefined));
	set(CONSENT_FORM_FIELD_NAMES.accessibilityNotes, typeof payload.accessibilityNotes === "string" ? payload.accessibilityNotes : undefined);
	set(CONSENT_FORM_FIELD_NAMES.reviewNotes, typeof payload.reviewNotes === "string" ? payload.reviewNotes : undefined);
	set(CONSENT_FORM_FIELD_NAMES.owner, typeof payload.owner === "string" ? payload.owner : undefined);
	set(CONSENT_FORM_FIELD_NAMES.updatedAt, new Date().toISOString());
	if (includeDefaults) set(CONSENT_FORM_FIELD_NAMES.createdAt, new Date().toISOString());
	if (payload.publishedAt) set(CONSENT_FORM_FIELD_NAMES.publishedAt, payload.publishedAt);

	return fields;
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
		const txt = await resp.text();
		if (!resp.ok) {
			throw Object.assign(new Error(`Airtable ${resp.status}`), { status: resp.status, detail: safeText(txt) });
		}
		let js;
		try { js = JSON.parse(txt); } catch { js = { records: [] }; }
		records.push(...(js.records || []));
		offset = js.offset;
	} while (offset);
	return records;
}

function mergeConsentForms(...groups) {
	const byId = new Map();
	for (const form of groups.flat()) {
		if (!form?.id || byId.has(form.id)) continue;
		byId.set(form.id, form);
	}
	return Array.from(byId.values()).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
}

export async function listConsentForms(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	let d1Forms = null;
	let d1Error = null;
	if (hasD1(svc)) {
		try {
			d1Forms = await listConsentFormsFromD1(svc, studyId);
			if (!airtableConfigured(svc)) {
				return svc.json({ ok: true, consentForms: d1Forms, source: "d1" }, 200, svc.corsHeaders(origin));
			}
		} catch (error) {
			d1Error = error;
			svc.log.warn("d1.consent_forms.list.fail", { detail: String(error?.message || error) });
		}
	}

	try {
		const records = await getAllRecords(svc);
		const forms = [];
		for (const record of records) {
			const f = record.fields || {};
			const linkKey = pickFirstField(f, CONSENT_FORM_LINK_FIELD_CANDIDATES);
				const links = linkKey ? f[linkKey] : undefined;
				if (Array.isArray(links) && links.includes(studyId)) forms.push(recordToConsentForm(record));
			}
			const consentForms = mergeConsentForms(d1Forms || [], forms);
			const source = d1Forms?.length && forms.length ? "d1+airtable" : d1Forms?.length ? "d1" : "airtable";
			return svc.json({ ok: true, consentForms, source }, 200, svc.corsHeaders(origin));
	} catch (err) {
		if (d1Forms) {
			return svc.json({
				ok: true,
				consentForms: d1Forms,
				source: "d1",
				warning: err.message || "Airtable error"
			}, 200, svc.corsHeaders(origin));
		}
		svc.log.error("airtable.consent_forms.list.fail", { status: err.status, detail: err.detail || err.message });
		return svc.json({ ok: false, error: err.message || "Airtable error", detail: err.detail, d1: d1Error ? String(d1Error?.message || d1Error) : undefined }, err.status || 500, svc.corsHeaders(origin));
	}
}

export async function createConsentForm(svc, request, origin) {
	let payload;
	try { payload = await readBody(svc, request); }
	catch (err) { return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin)); }

	if (!payload.study_airtable_id && !payload.studyId) {
		return svc.json({ ok: false, error: "Missing field: study_airtable_id" }, 400, svc.corsHeaders(origin));
	}

	const studyId = payload.study_airtable_id || payload.studyId;

	if (hasD1(svc)) {
		try {
			const consentForm = await createConsentFormInD1(svc, payload);
			return svc.json({ ok: true, id: consentForm.id, consentForm, source: "d1" }, 200, svc.corsHeaders(origin));
		} catch (error) {
			svc.log.warn("d1.consent_forms.create.fail", { detail: String(error?.message || error) });
		}
	}

	const atUrl = atBaseUrl(svc);
	const fieldsTemplate = fieldsFromPayload(payload, { includeDefaults: true });
	let lastDetail = "";

	for (const linkName of CONSENT_FORM_LINK_FIELD_CANDIDATES) {
		const fields = { ...fieldsTemplate, [linkName]: [studyId] };
		let attempt = await airtableTryWrite(atUrl, airtableKey(svc), "POST", fields, svc.cfg.TIMEOUT_MS);
		if (attempt.ok) {
			const id = attempt.json.records?.[0]?.id;
			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));
		}
		lastDetail = attempt.detail || lastDetail;

		const isSelectErr = attempt.status === 422 && /INVALID_MULTIPLE_CHOICE_OPTIONS/i.test(String(attempt.detail || ""));
		if (isSelectErr) {
			const withoutSelects = { ...fields };
			delete withoutSelects[CONSENT_FORM_FIELD_NAMES.status[0]];
			delete withoutSelects[CONSENT_FORM_FIELD_NAMES.formType[0]];
			attempt = await airtableTryWrite(atUrl, airtableKey(svc), "POST", withoutSelects, svc.cfg.TIMEOUT_MS);
			if (attempt.ok) {
				const id = attempt.json.records?.[0]?.id;
				return svc.json({ ok: true, id, select_fallback: "omitted" }, 200, svc.corsHeaders(origin));
			}
			lastDetail = attempt.detail || lastDetail;
		}

		if (!attempt.retry) {
			return svc.json({ ok: false, error: `Airtable ${attempt.status}`, detail: attempt.detail }, attempt.status || 500, svc.corsHeaders(origin));
		}
	}

	return svc.json({ ok: false, error: "Airtable 422", detail: lastDetail || "No matching Consent Forms↔Study link field found." }, 422, svc.corsHeaders(origin));
}

export async function readConsentForm(svc, origin, formId) {
	if (!formId) return svc.json({ ok: false, error: "Missing consent form id" }, 400, svc.corsHeaders(origin));
	if (hasD1(svc)) {
		try {
			const consentForm = await readConsentFormFromD1(svc, formId);
			if (consentForm) return svc.json({ ok: true, consentForm, source: "d1" }, 200, svc.corsHeaders(origin));
			if (!airtableConfigured(svc)) return svc.json({ ok: false, error: "consent_form_not_found" }, 404, svc.corsHeaders(origin));
		} catch (error) {
			svc.log.warn("d1.consent_forms.read.fail", { detail: String(error?.message || error) });
		}
	}
	try {
		const record = await getRecord(svc.env, svc.env.AIRTABLE_TABLE_CONSENT_FORMS || "Consent Forms", formId);
		return svc.json({ ok: true, consentForm: recordToConsentForm(record) }, 200, svc.corsHeaders(origin));
	} catch (err) {
		const msg = String(err?.message || "");
		const isNotFound = /Airtable\s*404/i.test(msg) || /NOT_FOUND/i.test(msg);
		return svc.json({ ok: false, error: isNotFound ? "Airtable 404" : "Airtable error", detail: msg }, isNotFound ? 404 : 500, svc.corsHeaders(origin));
	}
}

export async function updateConsentForm(svc, request, origin, formId) {
	if (!formId) return svc.json({ ok: false, error: "Missing consent form id" }, 400, svc.corsHeaders(origin));
	let payload;
	try { payload = await readBody(svc, request); }
	catch (err) { return svc.json({ ok: false, error: err.message }, err.status || 400, svc.corsHeaders(origin)); }

	const fields = fieldsFromPayload(payload);
	if (!Object.keys(fields).length) return svc.json({ ok: false, error: "No updatable fields provided" }, 400, svc.corsHeaders(origin));

	if (hasD1(svc)) {
		try {
			const consentForm = await updateConsentFormInD1(svc, formId, payload);
			if (consentForm) return svc.json({ ok: true, consentForm, source: "d1" }, 200, svc.corsHeaders(origin));
			if (!airtableConfigured(svc)) return svc.json({ ok: false, error: "consent_form_not_found" }, 404, svc.corsHeaders(origin));
		} catch (error) {
			svc.log.warn("d1.consent_forms.update.fail", { detail: String(error?.message || error) });
		}
	}

	const resp = await fetchWithTimeout(atBaseUrl(svc), {
		method: "PATCH",
		headers: { ...atHeaders(svc), "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: formId, fields }] })
	}, svc.cfg.TIMEOUT_MS);
	const text = await resp.text();
	if (resp.ok) return svc.json({ ok: true }, 200, svc.corsHeaders(origin));
	return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(text) }, resp.status, svc.corsHeaders(origin));
}

export async function publishConsentForm(svc, origin, formId) {
	if (!formId) return svc.json({ ok: false, error: "Missing consent form id" }, 400, svc.corsHeaders(origin));

	if (hasD1(svc)) {
		try {
			const consentForm = await publishConsentFormInD1(svc, formId);
			if (consentForm) return svc.json({ ok: true, version: consentForm.version, status: consentForm.status, consentForm, source: "d1" }, 200, svc.corsHeaders(origin));
			if (!airtableConfigured(svc)) return svc.json({ ok: false, error: "consent_form_not_found" }, 404, svc.corsHeaders(origin));
		} catch (error) {
			svc.log.warn("d1.consent_forms.publish.fail", { detail: String(error?.message || error) });
		}
	}

	let currentVersion = 0;
	try {
		const record = await getRecord(svc.env, svc.env.AIRTABLE_TABLE_CONSENT_FORMS || "Consent Forms", formId);
		const f = record?.fields || {};
		const versionKey = pickFirstField(f, CONSENT_FORM_FIELD_NAMES.version);
		currentVersion = Number.parseInt(f[versionKey], 10) || 0;
	} catch {}

	const fields = {
		[CONSENT_FORM_FIELD_NAMES.status[0]]: "Published",
		[CONSENT_FORM_FIELD_NAMES.version[0]]: currentVersion + 1,
		[CONSENT_FORM_FIELD_NAMES.publishedAt[0]]: new Date().toISOString(),
		[CONSENT_FORM_FIELD_NAMES.updatedAt[0]]: new Date().toISOString()
	};

	const resp = await fetchWithTimeout(atBaseUrl(svc), {
		method: "PATCH",
		headers: { ...atHeaders(svc), "Content-Type": "application/json" },
		body: JSON.stringify({ records: [{ id: formId, fields }] })
	}, svc.cfg.TIMEOUT_MS);
	const text = await resp.text();
	if (resp.ok) return svc.json({ ok: true, version: currentVersion + 1, status: "Published" }, 200, svc.corsHeaders(origin));
	return svc.json({ ok: false, error: `Airtable ${resp.status}`, detail: safeText(text) }, resp.status, svc.corsHeaders(origin));
}
