/**
 * @file service/impact-internals.js
 * @summary Airtable persistence helpers for Impact Tracking.
 *
 * This module keeps the Impact service importable while retaining a flexible
 * mapping layer for Airtable field names used during prototype development.
 */

import { createRecords, listAll } from "./internals/airtable.js";

const PROJECT_LINK_MODE_TEXT = "text";
const PROJECT_LINK_MODE_LINKED_RECORD = "linked-record";

function impactTableName(env) {
	const configured = env?.AIRTABLE_TABLE_IMPACT || env?.AIRTABLE_TABLE_IMPACT_RECORDS || "";
	return String(configured || "Impact").trim();
}

function hasAirtable(env) {
	return !!((env?.AIRTABLE_BASE_ID || env?.AIRTABLE_BASE) && (env?.AIRTABLE_API_KEY || env?.AIRTABLE_PAT));
}

function isAirtableRecordId(value) {
	return /^rec[a-zA-Z0-9]{14,}$/.test(String(value || "").trim());
}

function firstValue(fields, names, fallback = "") {
	for (const name of names) {
		const value = fields?.[name];
		if (value !== undefined && value !== null && String(value).trim() !== "") return value;
	}
	return fallback;
}

function normaliseLinkedValue(value) {
	if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
	if (value && typeof value === "object") return [String(value.id || value.name || "").trim()].filter(Boolean);
	return [String(value || "").trim()].filter(Boolean);
}

function arrayIncludesValue(value, expected) {
	const needle = String(expected || "").trim();
	if (!needle) return true;
	return normaliseLinkedValue(value).some((item) => item === needle);
}

function canonicalProjectId(fields) {
	return firstValue(fields, ["Project", "Projects", "Project ID", "ProjectId", "projectId"]);
}

function canonicalStudyId(fields) {
	return firstValue(fields, ["Study", "Studies", "Study ID", "StudyId", "studyId"], null);
}

function normaliseImpactRecord(record) {
	const fields = record?.fields || {};
	return {
		id: record?.id || "",
		projectId: canonicalProjectId(fields),
		studyId: canonicalStudyId(fields),
		metricName: firstValue(fields, ["Metric Name", "Metric", "metricName", "Name"]),
		metricValue: firstValue(fields, ["Metric Value", "Value", "metricValue"], null),
		evidence: firstValue(fields, ["Evidence", "Evidence URL", "Source", "Notes"], ""),
		updatedAt: firstValue(fields, ["Updated At", "UpdatedAt", "updatedAt"], record?.createdTime || ""),
		fields
	};
}

function matchesContext(record, { projectId, studyId }) {
	const fields = record?.fields || {};
	const projectValue = canonicalProjectId(fields);
	const studyValue = canonicalStudyId(fields);

	if (!arrayIncludesValue(projectValue, projectId)) return false;
	if (studyId && !arrayIncludesValue(studyValue, studyId)) return false;
	return true;
}

function compactFields(fields) {
	const out = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null) continue;
		if (typeof value === "string" && value.trim() === "") continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[key] = value;
	}
	return out;
}

function impactProjectLinkMode(env) {
	const configured = String(env?.AIRTABLE_IMPACT_PROJECT_LINK_MODE || "").trim().toLowerCase();
	if ([PROJECT_LINK_MODE_TEXT, "project-id", "text-field"].includes(configured)) return PROJECT_LINK_MODE_TEXT;
	return PROJECT_LINK_MODE_LINKED_RECORD;
}

function impactProjectFieldName(env) {
	const configured = String(env?.AIRTABLE_IMPACT_PROJECT_FIELD || "").trim();
	return configured || (impactProjectLinkMode(env) === PROJECT_LINK_MODE_TEXT ? "Project ID" : "Project");
}

function impactStudyFieldName(env) {
	return String(env?.AIRTABLE_IMPACT_STUDY_FIELD || "").trim() || "Study";
}

function projectLinkField(env, projectId) {
	if (!isAirtableRecordId(projectId)) {
		const error = new Error("Impact records must be linked to a project using an Airtable record ID.");
		error.status = 400;
		throw error;
	}

	const fieldName = impactProjectFieldName(env);
	if (impactProjectLinkMode(env) === PROJECT_LINK_MODE_TEXT) return { [fieldName]: projectId };
	return { [fieldName]: [projectId] };
}

function studyLinkField(env, studyId) {
	if (!studyId) return {};
	const fieldName = impactStudyFieldName(env);
	if (isAirtableRecordId(studyId)) return { [fieldName]: [studyId] };
	return { "Study ID": studyId };
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
		...projectLinkField(env, payload.projectId),
		...studyLinkField(env, payload.studyId),
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
