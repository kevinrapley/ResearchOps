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

function consentFormsTable(svc) {
	return encodeURIComponent(svc.env.AIRTABLE_TABLE_CONSENT_FORMS || "Consent Forms");
}

function airtableBase(svc) {
	return svc.env.AIRTABLE_BASE || svc.env.AIRTABLE_BASE_ID;
}

function airtableKey(svc) {
	return svc.env.AIRTABLE_API_KEY || svc.env.AIRTABLE_PAT || svc.env.AIRTABLE_ACCESS_TOKEN;
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

export async function listConsentForms(svc, origin, url) {
	const studyId = url.searchParams.get("study");
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	try {
		const records = await getAllRecords(svc);
		const forms = [];
		for (const record of records) {
			const f = record.fields || {};
			const linkKey = pickFirstField(f, CONSENT_FORM_LINK_FIELD_CANDIDATES);
			const links = linkKey ? f[linkKey] : undefined;
			if (Array.isArray(links) && links.includes(studyId)) forms.push(recordToConsentForm(record));
		}
		forms.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
		return svc.json({ ok: true, consentForms: forms }, 200, svc.corsHeaders(origin));
	} catch (err) {
		svc.log.error("airtable.consent_forms.list.fail", { status: err.status, detail: err.detail || err.message });
		return svc.json({ ok: false, error: err.message || "Airtable error", detail: err.detail }, err.status || 500, svc.corsHeaders(origin));
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
