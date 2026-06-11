/**
 * @file src/service/reflection/memos.js
 * @module service/reflection/memos
 * @summary Memo management for qualitative research analysis.
 * @description
 * Handles analytical, methodological, theoretical, and reflexive memos
 * that can be linked to journal entries and codes. Provides version
 * tracking and supports the iterative nature of qualitative analysis.
 * 
 * @requires ../internals/airtable
 * @requires ../../core/utils
 */

import { fetchWithTimeout, safeText, toMs, mdToAirtableRich } from "../../core/utils.js";
import { listAll, getRecord, createRecords, patchRecords } from "../internals/airtable.js";

/**
 * @typedef {Object} MemoPayload
 * @property {string} project_id - Airtable ID of the parent project
 * @property {'analytical'|'methodological'|'theoretical'|'reflexive'} memo_type - Category of memo
 * @property {string} content - Memo content in Markdown format
 * @property {string[]} [linked_entries] - Array of journal entry IDs this memo relates to
 * @property {string[]} [linked_codes] - Array of code IDs this memo discusses
 * @property {string} [author] - Author identifier (email or name)
 */

/**
 * @typedef {Object} MemoRecord
 * @property {string} id - Airtable record ID
 * @property {'memo'} type - Record type identifier
 * @property {'analytical'|'methodological'|'theoretical'|'reflexive'} memoType - Category
 * @property {string} content - Rich text content
 * @property {string[]} linkedEntries - Related journal entry IDs
 * @property {string[]} linkedCodes - Related code IDs
 * @property {string} author - Creator of the memo
 * @property {string} createdAt - ISO timestamp of creation
 * @property {string} lastModified - ISO timestamp of last update
 */

/**
 * Create a memo linked to project, entries, and/or codes.
 * 
 * Memos serve different analytical purposes:
 * - Analytical: Interpretive insights about patterns in data
 * - Methodological: Decisions about research process
 * - Theoretical: Connections to existing theory/literature  
 * - Reflexive: Researcher positionality and bias reflection
 * 
 * @async
 * @function createMemo
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {Request} request - HTTP request containing memo data
 * @param {string} origin - Request origin for CORS
 * @returns {Promise<Response>} JSON response with created memo ID
 * @throws {400} Invalid JSON or missing required fields
 * @throws {413} Request body too large
 * @throws {422} Field configuration error in Airtable
 * @throws {500} Airtable API error
 */
export async function createMemo(svc, request, origin) {
	const body = await request.arrayBuffer();
	if (body.byteLength > svc.cfg.MAX_BODY_BYTES) {
		svc.log.warn("request.too_large", { size: body.byteLength });
		return svc.json({ error: "Payload too large" }, 413, svc.corsHeaders(origin));
	}

	/** @type {MemoPayload} */
	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	// Validation
	if (!p.project_id || !p.memo_type || !p.content) {
		return svc.json({
			error: "Missing required fields: project_id, memo_type, content"
		}, 400, svc.corsHeaders(origin));
	}

	const validMemoTypes = ["analytical", "methodological", "theoretical", "reflexive"];
	if (!validMemoTypes.includes(p.memo_type)) {
		return svc.json({
			error: `Invalid memo type. Must be one of: ${validMemoTypes.join(', ')}`
		}, 400, svc.corsHeaders(origin));
	}

	// Try multiple table/field name configurations
	const tableName = svc.env.AIRTABLE_TABLE_MEMOS || "Memos";
	const LINK_FIELDS = ["Project", "Projects"];

	for (const linkName of LINK_FIELDS) {
		const fields = {
			[linkName]: [p.project_id],
			Type: "memo",
			MemoType: p.memo_type,
			Content: mdToAirtableRich(p.content),
			LinkedEntries: Array.isArray(p.linked_entries) ? p.linked_entries : [],
			LinkedCodes: Array.isArray(p.linked_codes) ? p.linked_codes : [],
			Author: p.author || "",
			CreatedDate: new Date().toISOString(),
			LastModified: new Date().toISOString()
		};

		// Remove empty fields
		for (const k of Object.keys(fields)) {
			const v = fields[k];
			if (v === undefined || v === null ||
				(typeof v === "string" && v.trim() === "") ||
				(Array.isArray(v) && v.length === 0)) {
				delete fields[k];
			}
		}

		try {
			const result = await createRecords(svc.env, tableName, [{ fields }], svc.cfg.TIMEOUT_MS);
			const id = result.records?.[0]?.id;

			if (!id) {
				return svc.json({ error: "Airtable response missing id" }, 502, svc.corsHeaders(origin));
			}

			// Create audit log entry
			if (svc.env.AUDIT === "true") {
				svc.log.info("memo.created", {
					id,
					memoType: p.memo_type,
					linkedEntries: p.linked_entries?.length || 0,
					linkedCodes: p.linked_codes?.length || 0
				});
			}

			// Trigger reflexive analysis if this is a reflexive memo
			if (p.memo_type === "reflexive") {
				await triggerReflexiveAnalysis(svc, id, p);
			}

			return svc.json({ ok: true, id }, 200, svc.corsHeaders(origin));

		} catch (err) {
			const msg = String(err?.message || "");

			// If UNKNOWN_FIELD_NAME for the link field, try next candidate
			if (msg.includes("422") && /UNKNOWN_FIELD_NAME/i.test(msg)) {
				continue;
			}

			// Other error - bail out
			svc.log.error("airtable.memo.create.fail", { err: msg });
			return svc.json({
				error: "Failed to create memo",
				detail: safeText(msg)
			}, 500, svc.corsHeaders(origin));
		}
	}

	// No link field matched
	return svc.json({
		error: "Field configuration error",
		detail: `No matching link field name found. Add a link-to-record field to ${tableName} table.`
	}, 422, svc.corsHeaders(origin));
}

/**
 * Analyze reflexive memos for patterns and trigger analytical memo creation.
 * 
 * When 5+ reflexive memos exist, analyzes themes across them to identify:
 * - Recurring concerns about researcher positionality
 * - Evolution of researcher perspective
 * - Potential biases emerging in analysis
 * 
 * @async
 * @function triggerReflexiveAnalysis
 * @inner
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {string} memoId - ID of newly created reflexive memo
 * @param {MemoPayload} memoData - Original memo data
 * @returns {Promise<void>}
 */
async function triggerReflexiveAnalysis(svc, memoId, memoData) {
	// Count recent reflexive memos to detect patterns
	const recentMemos = await getRecentMemosByType(svc, memoData.project_id, "reflexive", 10);

	if (recentMemos.length >= 5) {
		// Analyze themes across reflexive memos
		const themes = await analyzeReflexiveThemes(recentMemos);

		// Store analysis as a system-generated analytical memo
		if (themes.recurringConcerns.length > 0) {
			await createSystemMemo(svc, {
				project_id: memoData.project_id,
				memo_type: "analytical",
				content: generateReflexiveAnalysisSummary(themes),
				linked_entries: [memoId]
			});
		}
	}
}

/**
 * List memos with optional filtering.
 * 
 * Supports filtering by:
 * - Memo type (analytical, methodological, theoretical, reflexive)
 * - Linked journal entries
 * - Linked codes
 * 
 * @async
 * @function listMemos
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {string} origin - Request origin for CORS
 * @param {URL} url - Request URL with query parameters
 * @returns {Promise<Response>} JSON response with memo array
 * @throws {400} Missing required project parameter
 * @throws {500} Airtable API error
 */
export async function listMemos(svc, origin, url) {
	const projectId = url.searchParams.get("project");
	const memoType = url.searchParams.get("type");
	const linkedEntry = url.searchParams.get("entry");
	const linkedCode = url.searchParams.get("code");

	if (!projectId) {
		return svc.json({ ok: false, error: "Missing project query" }, 400, svc.corsHeaders(origin));
	}

	try {
		const tableName = svc.env.AIRTABLE_TABLE_MEMOS || "Memos";
		let filterFormula = `OR({Project} = '${projectId}', {Projects} = '${projectId}')`;

		// Add additional filters
		if (memoType) {
			filterFormula = `AND(${filterFormula}, {MemoType} = '${memoType}')`;
		}

		const { records } = await listAll(svc.env, tableName, {
			filterByFormula: filterFormula,
			pageSize: 100
		}, svc.cfg.TIMEOUT_MS);

		/** @type {MemoRecord[]} */
		let memos = records.map(r => ({
			id: r.id,
			type: r.fields.Type || "memo",
			memoType: r.fields.MemoType || "analytical",
			content: r.fields.Content || "",
			linkedEntries: r.fields.LinkedEntries || [],
			linkedCodes: r.fields.LinkedCodes || [],
			author: r.fields.Author || "",
			createdAt: r.fields.CreatedDate || r.createdTime,
			lastModified: r.fields.LastModified || r.createdTime
		}));

		// Filter by linked items if specified
		if (linkedEntry) {
			memos = memos.filter(m => m.linkedEntries.includes(linkedEntry));
		}
		if (linkedCode) {
			memos = memos.filter(m => m.linkedCodes.includes(linkedCode));
		}

		// Sort by most recent first
		memos.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

		return svc.json({ ok: true, memos }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("memo.list.error", { err: String(err?.message || err) });
		return svc.json({
			ok: false,
			error: "Failed to list memos",
			detail: String(err?.message || err)
		}, 500, svc.corsHeaders(origin));
	}
}

/**
 * Update an existing memo with version tracking.
 * 
 * Creates a version history entry before updating if version
 * tracking table is configured. Only content, linked entries,
 * linked codes, and memo type can be updated.
 * 
 * @async
 * @function updateMemo
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {Request} request - HTTP request containing update data
 * @param {string} origin - Request origin for CORS
 * @param {string} memoId - Airtable record ID to update
 * @returns {Promise<Response>} JSON response confirming update
 * @throws {400} Missing memo ID or invalid JSON
 * @throws {404} Memo not found
 * @throws {500} Airtable API error
 */
export async function updateMemo(svc, request, origin, memoId) {
	if (!memoId) {
		return svc.json({ error: "Missing memo id" }, 400, svc.corsHeaders(origin));
	}

	const body = await request.arrayBuffer();
	/** @type {Partial<MemoPayload>} */
	let p;
	try {
		p = JSON.parse(new TextDecoder().decode(body));
	} catch {
		return svc.json({ error: "Invalid JSON" }, 400, svc.corsHeaders(origin));
	}

	// First, retrieve existing memo to create version history
	const existing = await getRecord(svc.env, "Memos", memoId, svc.cfg.TIMEOUT_MS);
	if (existing && svc.env.AIRTABLE_TABLE_MEMO_VERSIONS) {
		await createMemoVersion(svc, existing);
	}

	const fields = {
		LastModified: new Date().toISOString()
	};

	// Update allowed fields
	if (typeof p.content === "string") {
		fields.Content = mdToAirtableRich(p.content);
	}
	if (Array.isArray(p.linked_entries)) {
		fields.LinkedEntries = p.linked_entries;
	}
	if (Array.isArray(p.linked_codes)) {
		fields.LinkedCodes = p.linked_codes;
	}
	if (p.memo_type && ["analytical", "methodological", "theoretical", "reflexive"].includes(p.memo_type)) {
		fields.MemoType = p.memo_type;
	}

	try {
		await patchRecords(svc.env, "Memos", [{ id: memoId, fields }], svc.cfg.TIMEOUT_MS);

		if (svc.env.AUDIT === "true") {
			svc.log.info("memo.updated", { memoId, fields: Object.keys(fields) });
		}

		return svc.json({ ok: true }, 200, svc.corsHeaders(origin));

	} catch (err) {
		svc.log.error("memo.update.error", { err: String(err?.message || err), memoId });
		return svc.json({
			error: "Failed to update memo",
			detail: safeText(String(err?.message || err))
		}, 500, svc.corsHeaders(origin));
	}
}

/**
 * @typedef {Object} ReflexiveThemes
 * @property {string[]} recurringConcerns - Repeated reflexive concerns
 * @property {Object[]} temporalShifts - Changes in perspective over time
 * @property {string[]} biasIndicators - Potential bias patterns identified
 */

/**
 * Helper function to retrieve recent memos by type.
 * 
 * @async
 * @function getRecentMemosByType
 * @inner
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {string} projectId - Project to search within
 * @param {string} memoType - Type of memo to retrieve
 * @param {number} limit - Maximum number of memos
 * @returns {Promise<MemoRecord[]>} Array of recent memos
 */
async function getRecentMemosByType(svc, projectId, memoType, limit) {
	// Implementation would query Airtable with appropriate filters
	// This is a placeholder for the actual implementation
	return [];
}

/**
 * Analyze themes across reflexive memos.
 * 
 * @async
 * @function analyzeReflexiveThemes
 * @inner
 * @param {MemoRecord[]} memos - Reflexive memos to analyze
 * @returns {Promise<ReflexiveThemes>} Identified themes and patterns
 */
async function analyzeReflexiveThemes(memos) {
	// Implementation would analyze memo content for patterns
	// This is a placeholder for the actual implementation
	return {
		recurringConcerns: [],
		temporalShifts: [],
		biasIndicators: []
	};
}

/**
 * Create a system-generated memo.
 * 
 * @async
 * @function createSystemMemo
 * @inner
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {MemoPayload} memoData - Memo content and metadata
 * @returns {Promise<void>}
 */
async function createSystemMemo(svc, memoData) {
	// Implementation would create a memo marked as system-generated
	// This is a placeholder for the actual implementation
}

/**
 * Generate summary of reflexive analysis.
 * 
 * @function generateReflexiveAnalysisSummary
 * @inner
 * @param {ReflexiveThemes} themes - Analyzed themes
 * @returns {string} Markdown-formatted summary
 */
function generateReflexiveAnalysisSummary(themes) {
	// Implementation would format themes into readable summary
	// This is a placeholder for the actual implementation
	return "";
}

/**
 * Create version history entry for memo.
 * 
 * @async
 * @function createMemoVersion
 * @inner
 * @param {import("../index.js").ResearchOpsService} svc - Service instance
 * @param {Object} existingRecord - Current memo record from Airtable
 * @returns {Promise<void>}
 */
async function createMemoVersion(svc, existingRecord) {
	// Implementation would copy current state to versions table
	// This is a placeholder for the actual implementation
}
