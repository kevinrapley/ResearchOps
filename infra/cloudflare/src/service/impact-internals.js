/**
 * @file service/impact-internals.js
 * @summary D1 persistence helpers for Impact Tracking.
 */

import { d1All, d1Get, d1Run } from "./internals/researchops-d1.js";

const IMPACT_TABLE = "impact_records";
const DISPLAY_REF_PREFIX = "IMPCT-RCD";

function nowIso() {
	return new Date().toISOString();
}

function trim(value) {
	return String(value ?? "").trim();
}

function nullableText(value) {
	const text = trim(value);
	return text || null;
}

function nullableNumber(value) {
	if (value === undefined || value === null || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function randomHex(length = 12) {
	const fallback = Math.random().toString(16).replace("0.", "").padEnd(length, "0");
	if (typeof crypto === "undefined" || !crypto.getRandomValues) return fallback.slice(0, length);
	const bytes = new Uint8Array(Math.ceil(length / 2));
	crypto.getRandomValues(bytes);
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").slice(0, length);
}

function recordId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return `impact-${Date.now().toString(36)}-${randomHex(8)}`;
}

function displayRefFromId(id) {
	const hex = trim(id).replace(/[^a-fA-F0-9]/g, "").toLowerCase().padEnd(12, "0").slice(-12);
	return `${DISPLAY_REF_PREFIX}-${hex}`;
}

function displayRef(id, supplied) {
	const candidate = trim(supplied).toUpperCase();
	if (/^IMPCT-RCD-[A-F0-9]{12}$/.test(candidate)) return candidate;
	return displayRefFromId(id);
}

function hasD1(env) {
	return !!env?.RESEARCHOPS_D1;
}

export async function ensureImpactRecordsTable(env) {
	if (!hasD1(env)) {
		const error = new Error("D1 binding RESEARCHOPS_D1 is not configured for impact records");
		error.status = 500;
		throw error;
	}

	await d1Run(env, `
		CREATE TABLE IF NOT EXISTS ${IMPACT_TABLE} (
			record_id TEXT PRIMARY KEY,
			display_ref TEXT NOT NULL UNIQUE,
			project_id TEXT NOT NULL,
			study_id TEXT,
			decision_link TEXT,
			metric_name TEXT NOT NULL,
			metric_unit TEXT,
			metric_direction TEXT,
			baseline_value REAL,
			target_value REAL,
			actual_value REAL,
			measurement_window TEXT,
			impact_type TEXT,
			impact_scale TEXT,
			status TEXT,
			notes TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			deleted_at TEXT
		)
	`);

	await d1Run(env, `CREATE INDEX IF NOT EXISTS idx_impact_records_project ON ${IMPACT_TABLE} (project_id, deleted_at, updated_at)`);
	await d1Run(env, `CREATE INDEX IF NOT EXISTS idx_impact_records_study ON ${IMPACT_TABLE} (study_id, deleted_at, updated_at)`);
}

function normaliseImpactRow(row) {
	if (!row) return null;
	return {
		id: row.record_id,
		recordId: row.record_id,
		displayRef: row.display_ref,
		projectId: row.project_id,
		studyId: row.study_id || null,
		decisionLink: row.decision_link || "",
		metricName: row.metric_name || "",
		metricUnit: row.metric_unit || "",
		metricDirection: row.metric_direction || "",
		baseline: row.baseline_value,
		target: row.target_value,
		actual: row.actual_value,
		measurementWindow: row.measurement_window || "",
		impactType: row.impact_type || "",
		impactScale: row.impact_scale || "",
		status: row.status || "",
		notes: row.notes || "",
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		deletedAt: row.deleted_at || null
	};
}

function impactPayload(payload = {}, existing = {}) {
	return {
		projectId: nullableText(payload.projectId ?? payload.project_id ?? existing.project_id),
		studyId: nullableText(payload.studyId ?? payload.study_id ?? existing.study_id),
		decisionLink: nullableText(payload.decisionLink ?? payload.decision_link ?? existing.decision_link),
		metricName: nullableText(payload.metricName ?? payload.metric_name ?? existing.metric_name),
		metricUnit: nullableText(payload.metricUnit ?? payload.metric_unit ?? existing.metric_unit),
		metricDirection: nullableText(payload.metricDirection ?? payload.metric_direction ?? existing.metric_direction),
		baseline: nullableNumber(payload.baseline ?? payload.baselineValue ?? payload.baseline_value ?? existing.baseline_value),
		target: nullableNumber(payload.target ?? payload.targetValue ?? payload.target_value ?? existing.target_value),
		actual: nullableNumber(payload.actual ?? payload.actualValue ?? payload.actual_value ?? existing.actual_value),
		measurementWindow: nullableText(payload.measurementWindow ?? payload.measurement_window ?? existing.measurement_window),
		impactType: nullableText(payload.impactType ?? payload.impact_type ?? existing.impact_type),
		impactScale: nullableText(payload.impactScale ?? payload.impact_scale ?? existing.impact_scale),
		status: nullableText(payload.status ?? existing.status) || "planned",
		notes: nullableText(payload.notes ?? existing.notes)
	};
}

export async function listImpactRecords(env, { projectId, studyId = null } = {}) {
	await ensureImpactRecordsTable(env);
	const params = [trim(projectId)];
	let where = "project_id = ? AND deleted_at IS NULL";
	if (studyId) {
		where += " AND study_id = ?";
		params.push(trim(studyId));
	}

	const rows = await d1All(env, `
		SELECT *
		FROM ${IMPACT_TABLE}
		WHERE ${where}
		ORDER BY datetime(updated_at) DESC, display_ref ASC
	`, params);

	return rows.map(normaliseImpactRow);
}

export async function getImpactRecord(env, recordId) {
	await ensureImpactRecordsTable(env);
	const row = await d1Get(env, `
		SELECT *
		FROM ${IMPACT_TABLE}
		WHERE record_id = ?
		LIMIT 1
	`, [trim(recordId)]);
	return normaliseImpactRow(row);
}

export async function createImpactRecord(env, payload = {}) {
	await ensureImpactRecordsTable(env);
	const fields = impactPayload(payload);
	if (!fields.projectId || !fields.metricName) {
		const error = new Error("Missing required fields: projectId, metricName");
		error.status = 400;
		throw error;
	}

	const id = recordId();
	const ref = displayRef(id, payload.displayRef);
	const createdAt = nowIso();
	await d1Run(env, `
		INSERT INTO ${IMPACT_TABLE} (
			record_id, display_ref, project_id, study_id, decision_link, metric_name,
			metric_unit, metric_direction, baseline_value, target_value, actual_value,
			measurement_window, impact_type, impact_scale, status, notes, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, [
		id,
		ref,
		fields.projectId,
		fields.studyId,
		fields.decisionLink,
		fields.metricName,
		fields.metricUnit,
		fields.metricDirection,
		fields.baseline,
		fields.target,
		fields.actual,
		fields.measurementWindow,
		fields.impactType,
		fields.impactScale,
		fields.status,
		fields.notes,
		createdAt,
		createdAt
	]);

	return getImpactRecord(env, id);
}

export async function updateImpactRecord(env, recordIdValue, patch = {}) {
	await ensureImpactRecordsTable(env);
	const existing = await d1Get(env, `SELECT * FROM ${IMPACT_TABLE} WHERE record_id = ? AND deleted_at IS NULL LIMIT 1`, [trim(recordIdValue)]);
	if (!existing) return null;
	const fields = impactPayload(patch, existing);
	if (!fields.metricName) {
		const error = new Error("Metric name is required");
		error.status = 400;
		throw error;
	}

	const updatedAt = nowIso();
	await d1Run(env, `
		UPDATE ${IMPACT_TABLE}
		SET study_id = ?, decision_link = ?, metric_name = ?, metric_unit = ?, metric_direction = ?,
			baseline_value = ?, target_value = ?, actual_value = ?, measurement_window = ?,
			impact_type = ?, impact_scale = ?, status = ?, notes = ?, updated_at = ?
		WHERE record_id = ? AND deleted_at IS NULL
	`, [
		fields.studyId,
		fields.decisionLink,
		fields.metricName,
		fields.metricUnit,
		fields.metricDirection,
		fields.baseline,
		fields.target,
		fields.actual,
		fields.measurementWindow,
		fields.impactType,
		fields.impactScale,
		fields.status,
		fields.notes,
		updatedAt,
		trim(recordIdValue)
	]);
	return getImpactRecord(env, recordIdValue);
}

export async function deleteImpactRecord(env, recordIdValue) {
	await ensureImpactRecordsTable(env);
	const updatedAt = nowIso();
	await d1Run(env, `
		UPDATE ${IMPACT_TABLE}
		SET deleted_at = ?, updated_at = ?
		WHERE record_id = ? AND deleted_at IS NULL
	`, [updatedAt, updatedAt, trim(recordIdValue)]);
	return { id: trim(recordIdValue), deletedAt: updatedAt };
}

export { displayRefFromId };
