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

/**
 * Map an Airtable record to API shape.
 * @param {any} r
 */
function mapCodeRecord(r) {
	const f = r.fields || {};
	const projectId =
		Array.isArray(f["Project"]) ? (f["Project"][0] || null) :
		("Project" in f ? (Array.isArray(f["Project"]) ? (f["Project"][0] || null) : (f["Project"] ?? null)) : null);

	const parentId =
		Array.isArray(f["Parent"]) ? (f["Parent"][0] || null) :
		("Parent" in f ? (Array.isArray(f["Parent"]) ? (f["Parent"][0] || null) : (f["Parent"] ?? null)) : null);

	return {
		id: r.id,
		name: f["Name"] || f["Code"] || f["Short Name"] || "",
		description: f["Definition"] || f["Description"] || "",
		colour: normaliseHex8(f["Colour"] || f["Color"] || "#1d70b8ff"),
		parentId,
		projectId
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

		// Always normalise to 8-digit hex
		const inputColour = body.colour8 || body.color8 || body.colour || body.color || "#1d70b8";
		const colourHex8 = normaliseHex8(inputColour);

		// Detect the actual linked Project field label (matches listCodes behaviour)
		const table = TABLE(service);
		let projectFieldLabel = "Project";
		if (projectId) {
			try {
				const sample = await listAll(service.env, table, { extraParams: { pageSize: "3" } });
				const detected = detectProjectFieldFromSample(sample.records || []);
				if (detected) {
					projectFieldLabel = detected;
				}
			} catch (_e) {
				// fall back to default "Project"
			}
		}

		// Build fields object without spread literals
		const fields = {};
		fields["Name"] = name;
		fields["Definition"] = body.description || body.definition || "";
		fields["Colour"] = colourHex8;

		if (projectId) {
			fields[projectFieldLabel] = [projectId];
		}
		if (parentId) {
			fields["Parent"] = [parentId];
		}

		const resp = await createRecords(service.env, table, [{ fields }]);
		const record = (resp.records || [])[0] || null;
		return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 201, cors);
	} catch (err) {
		service.log.error("codes.create", { err: String(err) });
		const body = { ok: false, error: "Internal error" };
		// Use the real request URL so `?diag=1` works
		const extra = maybeDiag(service, urlObj, { diag: String(err) });
		if (extra) Object.assign(body, extra);
		return service.json(body, 500, cors);
	}
}

/**
 * PATCH /api/codes/:id
 * Accepts scalar projectId; writes array for Airtable linked field.
 */
export async function updateCode(service, request, origin, codeId) {
	const cors = service.corsHeaders(origin);
	try {
		const body = await request.json().catch(() => ({}));
		const fields = {};

		if ("name" in body) fields["Name"] = body.name || "";
		if ("description" in body || "definition" in body) {
			fields["Definition"] = body.description || body.definition || "";
		}

		// Always store 8-digit hex
		if ("colour" in body || "color" in body || "colour8" in body || "color8" in body) {
			const input = body.colour8 ?? body.color8 ?? body.colour ?? body.color ?? "";
			fields["Colour"] = normaliseHex8(input);
		}

		if ("parentId" in body || "parent" in body) {
			const v = body.parentId || body.parent || null;
			fields["Parent"] = v ? [v] : [];
		}
		if ("projectId" in body || "project" in body) {
			const v = body.projectId || body.project || null;
			fields["Project"] = v ? [v] : [];
		}

		const resp = await patchRecords(service.env, TABLE(service), [{ id: codeId, fields }]);
		const record = (resp.records || [])[0] || null;

		return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 200, cors);
	} catch (err) {
		service.log.error("codes.update", { err: String(err) });
		const body = { ok: false, error: "Internal error" };
		const extra = maybeDiag(service, new URL("http://local/"), { diag: String(err) });
		if (extra) Object.assign(body, extra);
		return service.json(body, 500, cors);
	}
}
