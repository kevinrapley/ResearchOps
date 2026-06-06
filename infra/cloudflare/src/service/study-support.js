/**
 * @file study-support.js
 * @module study-support
 * @summary Note takers and observers setup endpoints for ResearchOps Worker.
 *
 * @description
 * D1 is the primary source for study support setup. Airtable is isolated as a
 * secondary read fallback so it can be enabled when account limits are lifted.
 */

import { fetchWithTimeout, safeText } from "../core/utils.js";
import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const SETUP_TABLE = "rops_study_support_setup";
const PEOPLE_TABLE = "rops_study_support_people";

const SETUP_SQL = `
	CREATE TABLE IF NOT EXISTS ${SETUP_TABLE} (
		study_id TEXT PRIMARY KEY,
		project_id TEXT,
		decision TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		source TEXT NOT NULL DEFAULT 'd1',
		payload_json TEXT
	)
`;

const PEOPLE_SQL = `
	CREATE TABLE IF NOT EXISTS ${PEOPLE_TABLE} (
		id TEXT PRIMARY KEY,
		study_id TEXT NOT NULL,
		project_id TEXT,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		role_other TEXT,
		email TEXT,
		attendance_scope TEXT NOT NULL,
		notes TEXT,
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

function cleanText(value) {
	return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanLongText(value) {
	return String(value || "").replace(/\r\n/g, "\n").trim();
}

function supportId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `sp_${crypto.randomUUID()}`;
	}
	return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normaliseDecision(value) {
	const raw = cleanText(value).toLowerCase();
	return raw === "yes" || raw === "no" ? raw : "";
}

function normaliseRole(value) {
	const raw = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	const allowed = new Set(["note_taker", "observer", "facilitator", "accessibility_support", "other"]);
	return allowed.has(raw) ? raw : "";
}

function normaliseAttendanceScope(value) {
	const raw = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	const allowed = new Set(["all_sessions", "selected_sessions", "not_sure"]);
	return allowed.has(raw) ? raw : "";
}

function parseJson(value, fallback) {
	if (value == null || value === "") return fallback;
	try {
		const parsed = JSON.parse(String(value));
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function rowToSetup(row) {
	if (!row) return { decision: "", saved: false };
	return {
		decision: row.decision || "",
		saved: true,
		studyId: row.study_id || "",
		projectId: row.project_id || "",
		updatedAt: row.updated_at || ""
	};
}

function rowToPerson(row) {
	if (!row) return null;
	return {
		id: row.id,
		studyId: row.study_id,
		projectId: row.project_id || "",
		name: row.name || "",
		role: row.role || "",
		roleOther: row.role_other || "",
		email: row.email || "",
		attendanceScope: row.attendance_scope || "",
		notes: row.notes || "",
		createdAt: row.created_at || "",
		updatedAt: row.updated_at || ""
	};
}

async function ensureTables(svc) {
	if (!hasD1(svc)) throw new Error("RESEARCHOPS_D1 binding not available");
	await d1Run(svc.env, SETUP_SQL);
	await d1Run(svc.env, PEOPLE_SQL);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_study_support_people_study ON ${PEOPLE_TABLE} (study_id, active, updated_at)`);
	await d1Run(svc.env, `CREATE INDEX IF NOT EXISTS idx_rops_study_support_people_role ON ${PEOPLE_TABLE} (role, active)`);
}

async function readSetupFromD1(svc, studyId) {
	await ensureTables(svc);
	const setup = await d1Get(svc.env, `SELECT * FROM ${SETUP_TABLE} WHERE study_id = ? LIMIT 1`, [studyId]);
	const people = await d1All(svc.env, `
		SELECT *
		FROM ${PEOPLE_TABLE}
		WHERE study_id = ? AND active = 1
		ORDER BY datetime(created_at) ASC, id ASC
	`, [studyId]);
	return {
		setup: rowToSetup(setup),
		people: people.map(rowToPerson).filter(Boolean)
	};
}

async function saveSetupInD1(svc, payload) {
	await ensureTables(svc);
	const now = nowIso();
	await d1Run(svc.env, `
		INSERT INTO ${SETUP_TABLE} (study_id, project_id, decision, created_at, updated_at, source, payload_json)
		VALUES (?, ?, ?, ?, ?, 'd1', ?)
		ON CONFLICT(study_id) DO UPDATE SET
			project_id = excluded.project_id,
			decision = excluded.decision,
			updated_at = excluded.updated_at,
			payload_json = excluded.payload_json
	`, [
		payload.studyId,
		payload.projectId || "",
		payload.decision,
		now,
		now,
		JSON.stringify(payload)
	]);
	return readSetupFromD1(svc, payload.studyId);
}

async function createPersonInD1(svc, payload) {
	await ensureTables(svc);
	const id = supportId();
	const now = nowIso();
	await d1Run(svc.env, `
		INSERT INTO ${PEOPLE_TABLE} (
			id, study_id, project_id, name, role, role_other, email, attendance_scope,
			notes, created_at, updated_at, active, source, payload_json
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'd1', ?)
	`, [
		id,
		payload.studyId,
		payload.projectId || "",
		payload.name,
		payload.role,
		payload.roleOther || "",
		payload.email || "",
		payload.attendanceScope,
		payload.notes || "",
		now,
		now,
		JSON.stringify({ ...payload, id })
	]);
	return readSetupFromD1(svc, payload.studyId);
}

async function deletePersonInD1(svc, personId) {
	await ensureTables(svc);
	const existing = await d1Get(svc.env, `SELECT study_id FROM ${PEOPLE_TABLE} WHERE id = ? AND active = 1 LIMIT 1`, [personId]);
	if (!existing) return null;
	await d1Run(svc.env, `UPDATE ${PEOPLE_TABLE} SET active = 0, updated_at = ? WHERE id = ?`, [nowIso(), personId]);
	return readSetupFromD1(svc, existing.study_id);
}

function airtableConfigured(svc) {
	return Boolean(svc.env.AIRTABLE_BASE_ID && svc.env.AIRTABLE_API_KEY && (svc.env.AIRTABLE_TABLE_STUDY_SUPPORT || svc.env.AIRTABLE_TABLE_NOTE_TAKERS_OBSERVERS));
}

function airtableTable(svc) {
	return encodeURIComponent(svc.env.AIRTABLE_TABLE_STUDY_SUPPORT || svc.env.AIRTABLE_TABLE_NOTE_TAKERS_OBSERVERS || "Study Support People");
}

function airtableUrl(svc, params = "") {
	const query = params ? `?${params}` : "";
	return `https://api.airtable.com/v0/${svc.env.AIRTABLE_BASE_ID}/${airtableTable(svc)}${query}`;
}

async function listSupportFromAirtable(svc, studyId) {
	if (!airtableConfigured(svc)) return null;
	const formula = `OR({Study}='${String(studyId).replaceAll("'", "\\'")}',{Study ID}='${String(studyId).replaceAll("'", "\\'")}')`;
	const params = new URLSearchParams({ pageSize: "100", filterByFormula: formula });
	const response = await fetchWithTimeout(airtableUrl(svc, params.toString()), {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${svc.env.AIRTABLE_API_KEY}`
		}
	}, svc.cfg.TIMEOUT_MS);
	const text = await response.text();
	if (!response.ok) throw Object.assign(new Error(`Airtable ${response.status}`), { status: response.status, detail: safeText(text) });
	const body = parseJson(text, {});
	const records = Array.isArray(body.records) ? body.records : [];
	const people = records
		.map((record) => {
			const fields = record.fields || {};
			const role = normaliseRole(fields.Role || fields.role);
			return {
				id: record.id,
				studyId,
				projectId: cleanText(fields.Project || fields["Project ID"]),
				name: cleanText(fields.Name || fields.name),
				role,
				roleOther: cleanText(fields["Other role"] || fields.roleOther),
				email: cleanText(fields.Email || fields.email),
				attendanceScope: normaliseAttendanceScope(fields["Attendance scope"] || fields.attendanceScope) || "not_sure",
				notes: cleanLongText(fields.Notes || fields.notes),
				createdAt: record.createdTime || "",
				updatedAt: cleanText(fields["Updated at"] || fields.updatedAt)
			};
		})
		.filter((person) => person.name && person.role);
	return {
		setup: { decision: people.length ? "yes" : "", saved: people.length > 0, studyId },
		people
	};
}

async function readBody(svc, request) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) throw Object.assign(new Error("Payload too large"), { status: 413 });
	try {
		return JSON.parse(new TextDecoder().decode(body || new ArrayBuffer(0)) || "{}");
	} catch {
		throw Object.assign(new Error("Invalid JSON"), { status: 400 });
	}
}

function validateSetupPayload(payload) {
	const studyId = cleanText(payload.studyId || payload.study_id);
	const projectId = cleanText(payload.projectId || payload.project_id);
	const decision = normaliseDecision(payload.decision);
	if (!studyId) return { error: "Missing field: studyId" };
	if (!decision) return { error: "Decision must be yes or no" };
	return { studyId, projectId, decision };
}

function validatePersonPayload(payload) {
	const studyId = cleanText(payload.studyId || payload.study_id);
	const projectId = cleanText(payload.projectId || payload.project_id);
	const name = cleanText(payload.name);
	const role = normaliseRole(payload.role);
	const roleOther = cleanText(payload.roleOther || payload.role_other);
	const attendanceScope = normaliseAttendanceScope(payload.attendanceScope || payload.attendance_scope);
	const email = cleanText(payload.email);
	const notes = cleanLongText(payload.notes);
	if (!studyId) return { error: "Missing field: studyId" };
	if (!name) return { error: "Missing field: name" };
	if (!role) return { error: "Missing field: role" };
	if (role === "other" && !roleOther) return { error: "Missing field: roleOther" };
	if (!attendanceScope) return { error: "Missing field: attendanceScope" };
	return { studyId, projectId, name, role, roleOther, attendanceScope, email, notes };
}

export async function readStudySupport(svc, origin, url) {
	const studyId = cleanText(url.searchParams.get("study") || url.searchParams.get("id"));
	if (!studyId) return svc.json({ ok: false, error: "Missing study query" }, 400, svc.corsHeaders(origin));

	let d1Result = null;
	if (hasD1(svc)) {
		try {
			d1Result = await readSetupFromD1(svc, studyId);
			if (!airtableConfigured(svc)) return svc.json({ ok: true, ...d1Result, source: "d1" }, 200, svc.corsHeaders(origin));
		} catch (error) {
			svc.log.warn("d1.study_support.read.fail", { detail: String(error?.message || error) });
		}
	}

	try {
		const airtableResult = await listSupportFromAirtable(svc, studyId);
		if (airtableResult) {
			return svc.json({
				ok: true,
				setup: d1Result?.setup?.saved ? d1Result.setup : airtableResult.setup,
				people: d1Result?.people?.length ? d1Result.people : airtableResult.people,
				source: d1Result ? "d1+airtable" : "airtable"
			}, 200, svc.corsHeaders(origin));
		}
	} catch (error) {
		if (d1Result) {
			return svc.json({ ok: true, ...d1Result, source: "d1", warning: error.message || "Airtable error" }, 200, svc.corsHeaders(origin));
		}
		return svc.json({ ok: false, error: error.message || "Airtable error", detail: error.detail }, error.status || 500, svc.corsHeaders(origin));
	}

	return svc.json({ ok: true, setup: { decision: "", saved: false, studyId }, people: [], source: "empty" }, 200, svc.corsHeaders(origin));
}

export async function saveStudySupportSetup(svc, request, origin) {
	let body;
	try { body = await readBody(svc, request); }
	catch (error) { return svc.json({ ok: false, error: error.message }, error.status || 400, svc.corsHeaders(origin)); }

	const payload = validateSetupPayload(body);
	if (payload.error) return svc.json({ ok: false, error: payload.error }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return svc.json({ ok: false, error: "study_support_store_unavailable" }, 503, svc.corsHeaders(origin));

	try {
		const result = await saveSetupInD1(svc, payload);
		return svc.json({ ok: true, ...result, source: "d1" }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return svc.json({ ok: false, error: error.message || "Could not save setup decision" }, 500, svc.corsHeaders(origin));
	}
}

export async function createStudySupportPerson(svc, request, origin) {
	let body;
	try { body = await readBody(svc, request); }
	catch (error) { return svc.json({ ok: false, error: error.message }, error.status || 400, svc.corsHeaders(origin)); }

	const payload = validatePersonPayload(body);
	if (payload.error) return svc.json({ ok: false, error: payload.error }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return svc.json({ ok: false, error: "study_support_store_unavailable" }, 503, svc.corsHeaders(origin));

	try {
		const result = await createPersonInD1(svc, payload);
		return svc.json({ ok: true, ...result, source: "d1" }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return svc.json({ ok: false, error: error.message || "Could not add support person" }, 500, svc.corsHeaders(origin));
	}
}

export async function deleteStudySupportPerson(svc, origin, personId) {
	if (!personId) return svc.json({ ok: false, error: "Missing support person id" }, 400, svc.corsHeaders(origin));
	if (!hasD1(svc)) return svc.json({ ok: false, error: "study_support_store_unavailable" }, 503, svc.corsHeaders(origin));

	try {
		const result = await deletePersonInD1(svc, personId);
		if (!result) return svc.json({ ok: false, error: "support_person_not_found" }, 404, svc.corsHeaders(origin));
		return svc.json({ ok: true, ...result, source: "d1" }, 200, svc.corsHeaders(origin));
	} catch (error) {
		return svc.json({ ok: false, error: error.message || "Could not remove support person" }, 500, svc.corsHeaders(origin));
	}
}
