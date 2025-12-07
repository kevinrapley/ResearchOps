/**
 * Impact internals for ResearchOps platform
 *
 * This module provides functions to list and create impact records using the
 * existing Airtable helper functions. It is designed to mirror the patterns
 * found in other internals modules such as `journals.js`. Impact records
 * capture the relationship between research insights and the decisions they
 * inform, along with associated metrics and outcomes.
 */

import { listAll, createRecords } from "./airtable.js";

// Resolve the Airtable table name for impact records. Use an environment
// variable if provided, otherwise default to "Impact".
function impactTableName(env) {
	return env.AIRTABLE_TABLE_IMPACT || "Impact";
}

/**
 * Convert a generic impact object into the Airtable fields format. Airtable
 * expects an object with keys matching the table's column names. This helper
 * centralises the mapping to ensure consistency across create and update calls.
 *
 * @param {Object} record Impact record
 * @returns {Object} Airtable fields object
 */
function toAirtableFields(record) {
	return {
		"Project ID": record.projectId || "",
		"Study ID": record.studyId || "",
		"Insight ID": record.insightId || "",
		"Decision Link": record.decisionLink || "",
		"Metric Name": record.metricName || "",
		"Baseline": typeof record.baseline === "number" ? record.baseline : null,
		"Target": typeof record.target === "number" ? record.target : null,
		"Actual": typeof record.actual === "number" ? record.actual : null,
		"Impact Type": record.impactType || "product",
		"Impact Scale": record.impactScale || "feature",
		"Notes": record.notes || "",
		"Recorded At": record.recordedAt || new Date().toISOString(),
		"Updated At": record.updatedAt || new Date().toISOString()
	};
}

/**
 * List impact records filtered by projectId and/or studyId. This function
 * queries the Airtable Impact table using the generic `listAll` helper from
 * `airtable.js`. It returns an array of objects representing impact records.
 *
 * @param {Object} env Worker environment containing API keys and table names
 * @param {Object} filters Filter options: projectId, studyId
 * @returns {Promise<Array>} List of impact records
 */
export async function listImpactRecords(env, filters = {}) {
	const tableName = impactTableName(env);
	const params = {};
	// Build filter formula for Airtable if filters provided
	const conditions = [];
	if (filters.projectId) {
		conditions.push(`{Project ID}='${filters.projectId}'`);
	}
	if (filters.studyId) {
		conditions.push(`{Study ID}='${filters.studyId}'`);
	}
	if (conditions.length) {
		params.filterByFormula =
			conditions.length === 1 ? conditions[0] : `AND(${conditions.join(",")})`;
	}
	return listAll(env, tableName, params);
}

/**
 * Create a new impact record in Airtable. Accepts a plain object with the
 * standard impact fields and writes it to the Impact table. Uses the
 * `createRecords` helper which can create multiple records; we pass an array
 * with a single item for simplicity.
 *
 * @param {Object} env Worker environment
 * @param {Object} payload Impact record data
 * @returns {Promise<Object>} Created Airtable record
 */
export async function createImpactRecord(env, payload) {
	const tableName = impactTableName(env);
	const fields = toAirtableFields(payload);
	const records = await createRecords(env, tableName, [fields]);
	// Return the first created record
	return records && records.length > 0 ? records[0] : null;
}
