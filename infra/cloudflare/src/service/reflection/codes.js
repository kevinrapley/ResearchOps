/**
 * @file service/reflection/codes.js
 * @summary Codes service: list/create/update for CAQDAS.
 *
 * Behaviour:
 * - Single-project codes (scalar projectId in API).
 * - Robust project filter with auto-detection of the linked field label.
 * - Bypass filter via ?nofilter=1 for diagnostics.
 */

import { listAll, createRecords, patchRecords } from "../internals/airtable.js";

const DEFAULT_TABLE = "Codes";
const TABLE = (service) => service.env.AIRTABLE_TABLE_CODES || DEFAULT_TABLE;

// Helper to normalise hexadecimal colour value to 8-digit alpha
function normaliseHex8(v) {
	let val = String(v || "").trim().toLowerCase();
	if (!val.startsWith("#")) val = "#" + val;
	// #RGB → #RRGGBB
	if (/^#[0-9a-f]{3}$/.test(val)) {
		val = "#" + val.slice(1).split("").map(ch => ch + ch).join("");
	}
	// #RRGGBB → #RRGGBBAA (opaque)
	if (/^#[0-9a-f]{6}$/.test(val)) return val + "ff";
	// #RRGGBBAA → keep
	if (/^#[0-9a-f]{8}$/.test(val)) return val;
	// Fallback to GOV.UK blue with full alpha
	return "#1d70b8ff";
}

/**
 * Conditionally include diagnostics (dev or diag=1).
 * @param {import("../index.js").ServiceContext} service
 * @param {URL} url
 * @param {Record<string, any>} extra
 */
function maybeDiag(service, url, extra) {
	const force = url?.searchParams?.get("diag") === "1";
	if (force || service.env.MODE === "dev" || service.env.MODEL === "dev") {
		return extra;
	}
	return undefined;
}

function buildPaths(codes) {
	const byId = new Map(codes.map(c => [c.id, c]));
	const cache = new Map();

	function pathFor(id, guard = 24) {
		if (!id || !byId.has(id) || guard <= 0) return [];
		if (cache.has(id)) return cache.get(id);
		const cur = byId.get(id);
		const up = pathFor(cur.parentId, guard - 1);
		const out = up.concat(cur.name || cur.id);
		cache.set(id, out);
		return out;
	}

	return codes.reduce((acc, c) => {
		acc[c.id] = pathFor(c.id).join(" / ");
		return acc;
	}, {});
}

/**
 * Map an Airtable record to API shape.
 * @param {any} r
 */
function mapCodeRecord(r) {
	const f = r.fields || {};

	let projectId = null;
	if (Array.isArray(f["Project"])) {
		projectId = f["Project"][0] || null;
	} else if ("Project" in f) {
		projectId = Array.isArray(f["Project"]) ? (f["Project"][0] || null) : (f["Project"] ?? null);
	}

	let parentId = null;
	if (Array.isArray(f["Parent"])) {
		parentId = f["Parent"][0] || null;
	} else if ("Parent" in f) {
		parentId = Array.isArray(f["Parent"]) ? (f["Parent"][0] || null) : (f["Parent"] ?? null);
	}

	const colourHex8 = normaliseHex8(f["Colour"] || f["Color"] || "#505a5fff");

	return {
		id: r.id,
		name: f["Name"] || f["Code"] || f["Short Name"] || "",
		description: f["Description"] || "",
		colour: colourHex8,
		parentId: parentId,
		projectId: projectId
	};
}

/**
 * Heuristic: detect a plausible linked Project field name from a sample record.
 * Prefers labels containing "project".
 * @param {Array<any>} records
 */
function detectProjectFieldFromSample(records) {
	if (!Array.isArray(records) || !records.length) return null;
	const f = records[0]?.fields || {};
	const keys = Object.keys(f);
	// Candidates: arrays of 'rec...' strings (linked records), with "project" in the label preferred.
	const scored = keys
		.map(k => {
			const v = f[k];
			const arr = Array.isArray(v) ? v : (v ? [v] : []);
			const looksLinked = Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && v[0].startsWith("rec");
			const labelScore = /project/i.test(k) ? 2 : 0; // prefer labels mentioning project
			return { key: k, looksLinked, score: looksLinked ? (1 + labelScore) : -1 };
		})
		.filter(x => x.score > 0)
		.sort((a, b) => b.score - a.score);

	return scored[0]?.key || null;
}

/**
 * Build a robust filterByFormula for a linked-record field.
 * @param {string} projectId
 * @param {string} fieldLabel
 */
function makeProjectFormula(projectId, fieldLabel) {
	// Works for single or multi link fields
	return `FIND('${projectId}', ARRAYJOIN({${fieldLabel}}))`;
}

/**
 * GET /api/codes?project=<recId>[&nofilter=1][&diag=1]
 */
export async function listCodes(service, origin, url) {
	const cors = service.corsHeaders(origin);
	try {
		const table = TABLE(service);
		const project = (url.searchParams.get("project") || "").trim();
		const nofilter = url.searchParams.get("nofilter") === "1";

		let records = [];
		let formula = "";
		let usedField = "";

		// If no project requested or explicit nofilter, return all records (no filter).
		if (!project || nofilter) {
			const res = await listAll(service.env, table);
			records = res.records || [];
		} else {
			// Strategy:
			// 1) Try likely labels in order.
			// 2) If still empty or throws, fetch sample without filter and auto-detect linked field.
			// 3) If detection fails, return unfiltered (avoid empty UI).

			const likely = ["Project", "Project (link)", "Project ID", "Project Ref"];
			let attempted = [];
			let success = false;
			let lastError = null;

			for (const fld of likely) {
				try {
					formula = makeProjectFormula(project, fld);
					const { records: recs } = await listAll(service.env, table, { extraParams: { filterByFormula: formula } });
					attempted.push({ field: fld, count: (recs || []).length });
					if (Array.isArray(recs) && recs.length) {
						records = recs;
						usedField = fld;
						success = true;
						break;
					}
				} catch (e) {
					lastError = String(e);
					attempted.push({ field: fld, error: lastError });
				}
			}

			if (!success) {
				// Fetch small sample to detect the actual field label
				const sample = await listAll(service.env, table, { extraParams: { pageSize: "3" } });
				const detected = detectProjectFieldFromSample(sample.records || []);
				if (detected) {
					try {
						formula = makeProjectFormula(project, detected);
						const { records: recs } = await listAll(service.env, table, { extraParams: { filterByFormula: formula } });
						records = recs || [];
						usedField = detected;
						success = true;
					} catch (e) {
						lastError = String(e);
					}
				}
			}

			if (!success) {
				// Final fallback: unfiltered list to avoid empty UI
				const res = await listAll(service.env, table);
				records = res.records || [];
			}
		}

		const codes = (records || []).map(mapCodeRecord);

		const paths = buildPaths(codes);
		for (const c of codes) c.path = paths[c.id] || c.name || c.id;

		const body = { ok: true, codes };
		const extra = maybeDiag(service, url, { table, formula, usedField });
		if (extra) Object.assign(body, extra);

		return service.json(body, 200, cors);
	} catch (err) {
		const body = { ok: false, error: "Internal error" };
		const extra = maybeDiag(service, url, { diag: String(err) });
		if (extra) Object.assign(body, extra);
		service.log.error("codes.list", { err: String(err) });
		return service.json(body, 500, cors);
	}
}

/**
 * Read a single code record's Parent field by record id.
 * Uses filterByFormula to fetch exactly one record.
 * @returns {Promise<string|null>} parentId or null
 */
async function readParentId(service, table, codeId) {
	try {
		const formula = "RECORD_ID() = '" + String(codeId) + "'";
		const res = await listAll(service.env, table, { extraParams: { filterByFormula: formula, pageSize: "1" } });
		const rec = Array.isArray(res && res.records) && res.records.length ? res.records[0] : null;
		if (!rec || !rec.fields) return null;
		const v = rec.fields["Parent"];
		if (Array.isArray(v) && v.length) return v[0] || null;
		if (typeof v === "string") return v || null;
		return null;
	} catch {
		return null;
	}
}

/**
 * Compute hierarchical depth for a given record id by walking Parent chain.
 * Level 1 = root (no parent). Level 2 = child. Level 3 = grandchild.
 * @returns {Promise<number>} depth (>=1)
 */
async function computeDepthFromId(service, table, codeId) {
	// If we were given a code id to measure, that id is at least level 1.
	var depth = 1;
	var current = String(codeId || "");

	// Walk up parents until no parent exists or safety cap reached.
	// Safety cap avoids infinite loops if a cycle were mistakenly created.
	var guard = 12;
	while (current && guard > 0) {
		var parentId = await readParentId(service, table, current);
		if (!parentId) break;
		depth += 1;
		current = parentId;
		guard -= 1;
	}
	return depth;
}

/**
 * Validate that creating/moving under parentId does not exceed level 3.
 * Returns null if valid; otherwise returns an error object to send.
 */
async function validateDepthLimit(service, parentId) {
	if (!parentId) return null;
	var table = TABLE(service);
	var parentDepth = await computeDepthFromId(service, table, parentId);
	var newDepth = parentDepth + 1; // new node one level beneath selected parent
	if (newDepth > 3) {
		return { ok: false, error: "Codes are limited to 3 levels. Your selection would create level 4." };
	}
	return null;
}

/**
 * Would moving `movingId` under `newParentId` create a cycle?
 * Walk up from newParentId to root; if we meet movingId, it's a cycle.
 */
async function wouldCycle(service, table, movingId, newParentId) {
	if (!movingId || !newParentId) return false;
	if (movingId === newParentId) return true;
	let cur = String(newParentId);
	let guard = 24; // safety
	while (cur && guard-- > 0) {
		if (cur === movingId) return true;
		cur = await readParentId(service, table, cur);
	}
	return false;
}

/**
 * POST /api/codes
 * Accepts scalar projectId; writes array for Airtable linked field.
 * Stores colour as 8-digit hex (#RRGGBBAA).
 */
export async function createCode(service, request, origin) {
	const cors = service.corsHeaders(origin);
	const urlObj = new URL(request.url);

	try {
		const body = await request.json().catch(() => ({}));
		const name = (body.name || "").trim();
		if (!name) {
			return service.json({ ok: false, error: "name is required" }, 400, cors);
		}

		const projectId = body.projectId || body.project || null;
		const parentId = body.parentId || body.parent || null;

		// Always normalise to #RRGGBBAA
		const inputColour = body.colour8 || body.color8 || body.colour || body.color || "#1d70b8ff";
		const colourHex8 = normaliseHex8(inputColour);

		const table = TABLE(service);

		// Detect the linked Project field label (“Project”, “Project (link)”, etc.)
		let projectFieldLabel = "Project";
		try {
			const sample = await listAll(service.env, table, { extraParams: { pageSize: "3" } });
			const detected = detectProjectFieldFromSample(sample.records || []);
			if (detected) projectFieldLabel = detected;
		} catch (_e) { /* keep default */ }

		// Build Airtable fields (no spread literals)
		const fields = {};
		fields["Name"] = name;
		fields["Colour"] = colourHex8;

		const descVal = (body.description || "").trim();
		if (descVal) {
			fields["Description"] = descVal;
		}
		if (projectId) {
			fields[projectFieldLabel] = [projectId];
		}
		if (parentId) {
			fields["Parent"] = [parentId];
		}

		var depthErrCreate = await validateDepthLimit(service, parentId);
		if (depthErrCreate) {
			return service.json(depthErrCreate, 400, cors);
		}

		// Create
		let resp;
		try {
			resp = await createRecords(service.env, table, [{ fields }]);
		} catch (airErr) {
			const out = { ok: false, error: "Internal error" };
			const diag = {
				stage: "createRecords",
				table: table,
				fields: fields,
				airtableError: String(airErr)
			};
			const maybe = maybeDiag(service, urlObj, diag);
			if (maybe) out.diag = maybe;
			service.log.error("codes.create airtable error", diag);
			return service.json(out, 500, cors);
		}

		const record = (resp.records || [])[0] || null;
		const bodyOut = { ok: true, record: record ? mapCodeRecord(record) : null };
		const extra = maybeDiag(service, urlObj, { table: table, fieldsSubmitted: fields, rawResponse: resp });
		if (extra) bodyOut.diag = extra;

		return service.json(bodyOut, 201, cors);
	} catch (err) {
		const out = { ok: false, error: "Internal error" };
		const diag = maybeDiag(service, urlObj, { stage: "handler-catch", err: String(err) });
		if (diag) out.diag = diag;
		service.log.error("codes.create handler error", { err: String(err) });
		return service.json(out, 500, cors);
	}
}

/**
 * PATCH /api/codes/:id
 * Accepts scalar projectId; writes array for Airtable linked field.
 */
export async function updateCode(service, request, origin, codeId) {
	const cors = service.corsHeaders(origin);
	const urlObj = new URL(request.url);

	try {
		const body = await request.json().catch(() => ({}));
		const fields = {};

		// Detect actual Project linked-record label (e.g. "Project (link)")
		const table = TABLE(service);
		let projectFieldLabel = "Project";
		try {
			const sample = await listAll(service.env, table, { extraParams: { pageSize: "3" } });
			const detected = detectProjectFieldFromSample(sample.records || []);
			if (detected) projectFieldLabel = detected;
		} catch { /* keep default */ }

		// ---------- compute requested parent up-front ----------
		let requestedParent = null;
		if ("parentId" in body || "parent" in body) {
			requestedParent = body.parentId || body.parent || null;
		}

		// ---------- cycle + depth guards ----------
		if (requestedParent) {
			// 1) prevent cycles (self or descendant as parent)
			if (await wouldCycle(service, table, codeId, requestedParent)) {
				return service.json({ ok: false, error: "A code cannot be made a child of itself or its descendants." },
					400,
					cors
				);
			}
			// 2) enforce 3-level maximum (prevent creating level 4)
			const depthErr = await validateDepthLimit(service, requestedParent);
			if (depthErr) {
				return service.json(depthErr, 400, cors);
			}
		}

		// ---------- field updates ----------
		if ("name" in body) {
			fields["Name"] = body.name || "";
		}

		if ("description" in body) {
			fields["Description"] = body.description || "";
		}

		if ("colour" in body || "color" in body || "colour8" in body || "color8" in body) {
			const inputColour = body.colour8 || body.color8 || body.colour || body.color || "#1d70b8ff";
			fields["Colour"] = normaliseHex8(inputColour);
		}

		if ("parentId" in body || "parent" in body) {
			fields["Parent"] = requestedParent ? [requestedParent] : [];
		}

		if ("projectId" in body || "project" in body) {
			const v = body.projectId || body.project || null;
			fields[projectFieldLabel] = v ? [v] : [];
		}

		// ---------- persist ----------
		let resp;
		try {
			resp = await patchRecords(service.env, table, [{ id: codeId, fields }]);
		} catch (airErr) {
			const out = { ok: false, error: "Internal error" };
			const diag = {
				stage: "patchRecords",
				table,
				id: codeId,
				fields,
				airtableError: String(airErr)
			};
			const maybe = maybeDiag(service, urlObj, diag);
			if (maybe) out.diag = maybe;
			service.log.error("codes.update airtable error", diag);
			return service.json(out, 500, cors);
		}

		const record = (resp.records || [])[0] || null;
		return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 200, cors);
	} catch (err) {
		const out = { ok: false, error: "Internal error" };
		const diag = maybeDiag(service, urlObj, { stage: "handler-catch", err: String(err) });
		if (diag) out.diag = diag;
		service.log.error("codes.update handler error", { err: String(err) });
		return service.json(out, 500, cors);
	}
}
