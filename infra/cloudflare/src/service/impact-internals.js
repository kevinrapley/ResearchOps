/**
 * @file service/impact-internals.js
 * @summary Airtable persistence helpers for Impact Tracking.
 *
 * This module keeps the Impact service importable while retaining a flexible
 * mapping layer for Airtable field names used during prototype development.
 */

import { createRecords, listAll } from "./internals/airtable.js";

function impactTableName(env) {
	const configured = env?.AIRTABLE_TABLE_IMPACT || env?.AIRTABLE_TABLE_IMPACT_RECORDS || "";
	return String(configured || "Impact").trim();
}

function hasAirtable(env) {
	return !!((env?.AIRTABLE_BASE_ID || env?.AIRTABLE_BASE) && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_PAT));
}

function firstValue(fields, names, fallback = "") {
	for (const name of names) {
		const value = fields?.[name];
		if (value !== undefined && value !== null && String(value).trim() !== "") return value;
	}
	return fallback;
}

function arrayIncludesValue(value, expected) {
	const needle = String(expected || "").trim();
	if (!needle) return true;
	if (Array.isArray(value)) {
		return value.some(item => {
			if (typeof item === "string") return item.trim() === needle;
			if (item && typeof item === "object") return String(item.id || item.name || "").trim() === needle;
			return false;
		});
	}
	return String(value || "").trim() === needle;
}

function normaliseImpactRecord(record) {
	const fields = record?.fields || {};
	return {
		id: record?.id || "",
		projectId: firstValue(fields, ["Project ID", "ProjectId", "projectId", "Project", "Projects"]),
		studyId: firstValue(fields, ["Study ID", "StudyId", "studyId", "Study", "Studies"], null),
		metricName: firstValue(fields, ["Metric Name", "Metric", "metricName", "Name"]),
		metricValue: firstValue(fields, ["Metric Value", "Value", "metricValue"], null),
		evidence: firstValue(fields, ["Evidence", "Evidence URL", "Source", "Notes"], ""),
		updatedAt: firstValue(fields, ["Updated At", "UpdatedAt", "updatedAt"], record?.createdTime || ""),
		fields
	};
}

function matchesContext(record, { projectId, studyId }) {
	const fields = record?.fields || {};
	const projectValue = firstValue(fields, ["Project ID", "ProjectId", "projectId", "Project", "Projects"], "");
	const studyValue = firstValue(fields, ["Study ID", "StudyId", "studyId", "Study", "Studies"], "");

	if (!arrayIncludesValue(projectValue, projectId)) return false;
	if (studyId && !arrayIncludesValue(studyValue, studyId)) return false;
	return true;
}

function compactFields(fields) {
	const out = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		if (typeof value === "string" && value.trim() === "") continue;
		out[key] = value;
	}
	return out;
}

export async function listImpactRecords(env, { projectId, studyId = null } = {}) {
	if (!projectId) return [];
	if (!hasAirtable(env)) return [];

	const tableName = impactTableName(env);
	const response = await listAll(env, tableName, { pageSize: 100 });
	const records = Array.isArray(response?.records) ? response.records : [];

	return records
		.filter(record => matchesContext(record, { projectId, studyId }))
		.map(normaliseImpactRecord);
}

export async function createImpactRecord(env, payload = {}) {
	if (!hasAirtable(env)) {
		const error = new Error("Airtable is not configured for impact records");
		error.status = 500;
		throw error;
	}

	const tableName = impactTableName(env);
	const fields = compactFields({
		"Project ID": payload.projectId,
		"Study ID": payload.studyId,
		"Metric Name": payload.metricName,
		"Metric Value": payload.metricValue,
		Evidence: payload.evidence,
		Notes: payload.notes,
		"Updated At": payload.updatedAt
	});

	const result = await createRecords(env, tableName, [{ fields }]);
	const record = result?.records?.[0] || null;
	if (!record) {
		const error = new Error("Airtable response missing impact record");
		error.status = 502;
		throw error;
	}

	return normaliseImpactRecord(record);
}
