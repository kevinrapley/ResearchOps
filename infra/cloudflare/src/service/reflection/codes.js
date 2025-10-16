/**
 * @file service/reflection/codes.js
 * @summary Codes service: list/create/update for CAQDAS.
 *
 * Uses internals/airtable.js helpers: listAll, createRecords, patchRecords.
 */

import { listAll, createRecords, patchRecords } from "../internals/airtable.js";

const TABLE = (service) => service.env.AIRTABLE_TABLE_CODES || "Codes";

/**
 * Conditionally return diagnostic information when running in dev.
 * @param {import("../index.js").ServiceContext} service
 * @param {Record<string, any>} extra
 * @returns {Record<string, any>|undefined}
 */
function diag(service, extra) {
	if (service.env.MODE === "dev" || service.env.MODEL === "dev") {
		return extra;
	}
	return undefined;
}

/**
 * Map Airtable record -> API payload (single projectId).
 * @param {any} r
 * @returns {{id:string,name:string,description:string,colour:string,parentId:string|null,projectId:string|null}}
 */
function mapCodeRecord(r) {
	const f = r.fields || {};
	const projectId = Array.isArray(f["Project"]) ? (f["Project"][0] || null) : (f["Project"] ?? null);
	return {
		id: r.id,
		name: f["Name"] || f["Code"] || f["Short Name"] || "",
		description: f["Definition"] || f["Description"] || "",
		colour: f["Colour"] || f["Color"] || "#505a5f",
		parentId: Array.isArray(f["Parent"]) ? (f["Parent"][0] || null) : (f["Parent"] ?? null),
		projectId
	};
}

/**
 * GET /api/codes?project=<recId>[&nofilter=1]
 * - If nofilter=1, skip filterByFormula (useful to test table accessibility).
 */
export async function listCodes(service, origin, url) {
	const cors = service.corsHeaders(origin);
	try {
		const project = url.searchParams.get("project") || "";
		const nofilter = url.searchParams.get("nofilter") === "1";
		const table = TABLE(service);

		const formula = project && !nofilter ? `FIND('${project}', ARRAYJOIN({Project}))` : "";
		const extraParams = formula ? { filterByFormula: formula } : undefined;

		const { records } = await listAll(service.env, table, { extraParams });
		const codes = (records || []).map(mapCodeRecord);

		const response = { ok: true, codes };
		const extra = diag(service, { formula, table });
		if (extra) Object.assign(response, extra);

		return service.json(response, 200, cors);
	} catch (err) {
		service.log.error("codes.list", { err: String(err) });
		const body = { ok: false, error: "Internal error" };
		const extra = diag(service, { diag: String(err) });
		if (extra) Object.assign(body, extra);
		return service.json(body, 500, cors);
	}
}

/**
 * POST /api/codes
 * Expects a single projectId scalar (will write [projectId] to Airtable).
 */
export async function createCode(service, request, origin) {
	const cors = service.corsHeaders(origin);
	try {
		const body = await request.json().catch(() => ({}));
		const name = (body.name || "").trim();
		if (!name) {
			return service.json({ ok: false, error: "name is required" }, 400, cors);
		}

		const projectId = body.projectId || body.project || null;
		const parentId = body.parentId || body.parent || null;

		const fields = {
			"Name": name,
			"Definition": body.description || body.definition || "",
			"Colour": body.colour || body.color || "#1d70b8",
			...(projectId ? { "Project": [projectId] } : {}),
			...(parentId ? { "Parent": [parentId] } : {})
		};

		const resp = await createRecords(service.env, TABLE(service), [{ fields }]);
		const record = (resp.records || [])[0] || null;
		return service.json({ ok: true, record: record ? mapCodeRecord(record) : null }, 201, cors);
	} catch (err) {
		service.log.error("codes.create", { err: String(err) });
		const body = { ok: false, error: "Internal error" };
		const extra = diag(service, { diag: String(err) });
		if (extra) Object.assign(body, extra);
		return service.json(body, 500, cors);
	}
}

/**
 * PATCH /api/codes/:id
 * Accepts single projectId scalar; writes arrays for Airtable linked fields.
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
		if ("colour" in body || "color" in body) {
			fields["Colour"] = body.colour || body.color || "#1d70b8";
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
		const extra = diag(service, { diag: String(err) });
		if (extra) Object.assign(body, extra);
		return service.json(body, 500, cors);
	}
}
